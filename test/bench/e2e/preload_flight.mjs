// A real camera flight over a deliberately slow tile server, in real Chrome.
//
// This answers what `test/bench/e2e/run.ts` cannot: not how long a flight takes, but what the camera
// arrives to see. The synthetic benchmarks stub out the request path, so they cannot observe a tile the
// viewport covered and then stopped covering mid-download — which is where most of a moving camera's
// network cost goes, and the thing a preload exists to reduce.
//
// Run it against a build of the dev bundle:  npm run build-dev && node test/bench/e2e/preload_flight.mjs
// Knobs: TILE_DELAY_MS per tile, DURATION the flight, PITCH of the destination camera,
//        PROJECTION mercator|globe, SCENARIO waste|recovery|interrupt.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer';

// The dev bundle this flies is a build product, so resolve the repository from here rather than from
// whatever directory it happens to be run in.
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', '..');
const PORT = Number(process.env.PORT ?? 8731);
const TILE_DELAY_MS = Number(process.env.TILE_DELAY_MS ?? 400);

function solidPng() {
    const w = 256, h = 256;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = y * (w * 3 + 1) + 1 + x * 3;
            raw[o] = 40; raw[o + 1] = 120; raw[o + 2] = 200;
        }
    }
    let table;
    const crc32 = (buf) => {
        if (!table) {
            table = new Int32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
                table[n] = c;
            }
        }
        let c = -1;
        for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        return c ^ -1;
    };
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
        return Buffer.concat([len, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
    ]);
}
const PNG = solidPng();

// Which requests are open right now, and which of them were dropped before the server answered. A
// request the browser abandons closes the socket early, which is what separates a request that was
// thrown away from one that simply took its time.
const stats = {
    inFlight: 0, peak: 0, started: 0, perSource: {}, open: new Set(), dropped: new Set(),
    mark() { this.peak = this.inFlight; this.started = 0; this.perSource = {}; this.dropped = new Set(); }
};
const note = (src, url) => {
    stats.inFlight++; stats.started++; stats.perSource[src] = (stats.perSource[src] ?? 0) + 1;
    stats.open.add(url);
    if (stats.inFlight > stats.peak) stats.peak = stats.inFlight;
};
const done = (url, answered) => {
    stats.open.delete(url);
    if (!answered) stats.dropped.add(url);
    stats.inFlight = Math.max(0, stats.inFlight - 1);
};

const STYLE = {
    version: 8,
    sources: {
        base: {type: 'raster', tiles: [`http://localhost:${PORT}/tiles/base/{z}/{x}/{y}.png`], tileSize: 256, maxzoom: 14},
        overlay: {type: 'raster', tiles: [`http://localhost:${PORT}/tiles/overlay/{z}/{x}/{y}.png`], tileSize: 256, maxzoom: 14}
    },
    layers: [{id: 'bg', type: 'raster', source: 'base'}, {id: 'ov', type: 'raster', source: 'overlay'}]
};

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/dist/maplibre-gl.css"></head>
<body style="margin:0"><div id="map" style="width:512px;height:512px"></div>
<script type="module">
import * as maplibregl from '/dist/maplibre-gl-dev.mjs';
window.maplibregl = maplibregl;

const D = Number(window.__duration ?? 3000);
const PITCH = Number(window.__pitch ?? 0);
window.FLIGHTS = {
    intercontinental: {origin: [-73.58, 45.53], destination: {center: [139.69, 35.68], zoom: 11}, duration: D},
    intraContinent:  {origin: [-73.58, 45.53], destination: {center: [-47.92, -15.78], zoom: 11}, duration: D},
    deepZoomIn:      {origin: [-73.58, 45.53], destination: {center: [2.35, 48.85], zoom: 14}, duration: D},
    // A pitched destination, which is where a globe is actually worth looking at: the covering-tile
    // traversal and the flight arc both diverge from the flat case as the camera tilts.
    pitchedClimb:    {origin: [-73.58, 45.53], destination: {center: [2.35, 48.85], zoom: 13, pitch: 55}, duration: D}
};

window.once = (target, type, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for ' + type)), ms);
    target.once(type, (e) => { clearTimeout(timer); resolve(e); });
});

window.probe = async () => {
    const map = new maplibregl.Map({
        container: 'map', style: '/style.json', center: [-73.58, 45.53], zoom: 3, fadeDuration: 0
    });
    window.__map = map;
    window.__stats = () => fetch('/stats').then((r) => r.json());
    window.onerror = (m) => console.log('ONERROR', m);
    map.on('error', (e) => console.log('MAP ERROR:', e.error && e.error.message));
    await once(map, 'idle', 40000);

    // A globe is a different transform, a different covering-tile traversal and a different flight arc,
    // so the preload's sampling has to be measured against one rather than assumed to carry over.
    const projection = window.__projection ?? 'mercator';
    if (projection !== 'mercator') {
        map.setProjection({type: projection});
        await once(map, 'idle', 40000);
    }

    return {
        projection: map.getProjection() ? map.getProjection().type : 'mercator',
        styleLoaded: map.isStyleLoaded(),
        sourceLoaded: map.loaded(),
        tileManagers: Object.keys(map.style.tileManagers),
        inView: Object.fromEntries(Object.entries(map.style.tileManagers).map(([k, tm]) => [k, tm.getIds().length]))
    };
};

window.fly = async (name, preload) => {
    const flight = window.FLIGHTS[name];
    const map = window.__map;
    map.jumpTo({center: flight.origin, zoom: 3});
    await once(map, 'idle', 40000);
    await fetch('/mark');
    const started = performance.now();
    const moved = once(map, 'moveend', 40000);
    map.flyTo({...flight.destination, duration: flight.duration, preload});
    await moved;
    // What the camera is looking at, and how much of it has arrived. Read straight from the in-view set,
    // so this is the screen the user gets rather than a tile set recomputed after the fact.
    // A covering tile that is neither in view nor cached has to be fetched from scratch, which is a
    // blank. One that is already cached is in the out-of-view cache and goes into view on the next
    // update, which is not a blank even though it is not in view yet. Conflating the two would make the
    // preload look worse than it is, so they are counted apart, and by where they sit on screen: at
    // pitch the tiles at the bottom are nearer the viewer and cover more of it.
    // The map's own transform is not public API; the camera's is, and a bench harness may look.
    const transform = map._camera.transform;
    const foreground = {readyY: [], missingY: []};
    for (const tm of Object.values(map.style.tileManagers)) {
        for (const tileID of tm.coveringTiles(transform)) {
            const inView = tm.getTileByID(tileID.key);
            const ready = (inView && (inView.state === 'loaded' || inView.state === 'errored')) ||
                tm._outOfViewCache.getByKey(tileID.key) !== null;
            const ul = tileID.canonical;
            const lng = (ul.x + 0.5) / (2 ** ul.z) * 360 - 180;
            const n2 = Math.PI - 2 * Math.PI * (ul.y + 0.5) / (2 ** ul.z);
            const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)));
            const y = map.project(new maplibregl.LngLat(lng, lat)).y;
            (ready ? foreground.readyY : foreground.missingY).push(y);
        }
    }
    const mean = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);

    // The share of the frame that is actually drawn, as opposed to the share of tiles that arrived. A
    // tile's ground bounds project to a quadrilateral whose area is its weight in the frame, so a missing
    // tile at the horizon counts for almost nothing and one at the bottom of a pitched frame counts for a
    // great deal. That is the distinction both the tile count and the mean screen y miss, and it is the
    // one that decides what the arrival looks like.
    const area = {ready: 0, total: 0};
    for (const tm of Object.values(map.style.tileManagers)) {
        for (const tileID of tm.coveringTiles(transform)) {
            const inView = tm.getTileByID(tileID.key);
            const ready = (inView && (inView.state === 'loaded' || inView.state === 'errored')) ||
                tm._outOfViewCache.getByKey(tileID.key) !== null;
            const ul = tileID.canonical;
            const latOf = (y) => {
                const nn = Math.PI - 2 * Math.PI * y / (2 ** ul.z);
                return 180 / Math.PI * Math.atan(0.5 * (Math.exp(nn) - Math.exp(-nn)));
            };
            const west = ul.x / (2 ** ul.z) * 360 - 180;
            const east = (ul.x + 1) / (2 ** ul.z) * 360 - 180;
            const south = latOf(ul.y + 1);
            const north = latOf(ul.y);
            const corners = [[west, south], [east, south], [east, north], [west, north]]
                .map(([lng, lat]) => map.project(new maplibregl.LngLat(lng, lat)));
            // Shoelace over the projected quadrilateral, which stays a plain polygon however it is skewed.
            let twice = 0;
            for (let i = 0; i < 4; i++) {
                const p1 = corners[i], p2 = corners[(i + 1) % 4];
                twice += p1.x * p2.y - p2.x * p1.y;
            }
            const tileArea = Math.abs(twice) / 2;
            area.total += tileArea;
            if (ready) area.ready += tileArea;
        }
    }
    const frameDrawn = area.total ? area.ready / area.total : null;
    const coverage = {};
    let loaded = 0, total = 0, missing = 0;
    for (const [id, tm] of Object.entries(map.style.tileManagers)) {
        const ids = tm.getIds();
        const states = ids.map((key) => tm.getTileByID(key).state);
        const ready = states.filter((st) => st === 'loaded' || st === 'errored').length;
        const blank = states.filter((st) => st === 'loading' || st === 'unloaded').length;
        coverage[id] = ready + '/' + ids.length;
        loaded += ready; total += ids.length; missing += blank;
    }
    return {
        name, preload, elapsedMs: Math.round(performance.now() - started), loaded, total, missing, coverage,
        foreground: {
            readyMeanY: mean(foreground.readyY), readyN: foreground.readyY.length,
            missingMeanY: mean(foreground.missingY), missingN: foreground.missingY.length,
            frameDrawnPct: frameDrawn === null ? null : Math.round(frameDrawn * 100)
        }
    };
};

// What is still being fetched, and for where, while the camera is in the air. A tile the camera has
// already flown past and is still waiting on is overhead nobody asked for.
window.waste = async (name, preload) => {
    const flight = window.FLIGHTS[name];
    const map = window.__map;
    map.jumpTo({center: flight.origin, zoom: 3});
    await once(map, 'idle', 40000);
    await fetch('/mark');

    const samples = [];
    const timer = setInterval(() => {
        let outstanding = 0, behind = 0, ahead = 0;
        const c = map.getCenter(), z = map.getZoom();
        for (const tm of Object.values(map.style.tileManagers)) {
            for (const tile of tm._preloadedTiles) {
                outstanding++;
                // Where the tile sits relative to the camera, by the ground it covers.
                const ul = tile.tileID.canonical;
                const tileLng = (ul.x + 0.5) / (2 ** ul.z) * 360 - 180;
                let d = Math.abs(tileLng - c.lng);
                if (d > 180) d = 360 - d;
                const tileZoom = ul.z;
                // A tile at a lower zoom than the camera covers ground the camera is already over;
                // a tile at a higher zoom is somewhere the camera has not been yet.
                if (tileZoom < z - 0.5 || (Math.abs(tileZoom - z) < 0.5 && d < 4)) behind++; else ahead++;
            }
        }
        samples.push({outstanding, behind, ahead, zoom: Math.round(z * 10) / 10});
    }, 150);

    const moved = once(map, 'moveend', 40000);
    map.flyTo({...flight.destination, duration: flight.duration, preload});
    await moved;
    await new Promise((r) => setTimeout(r, 200));
    clearInterval(timer);

    let outstanding = 0;
    for (const tm of Object.values(map.style.tileManagers)) outstanding += tm._preloadedTiles.size;
    const stats = await window.__stats();
    return {
        name, preload,
        peakOutstanding: Math.max(0, ...samples.map((s) => s.outstanding)),
        peakBehind: Math.max(0, ...samples.map((s) => s.behind)),
        peakAhead: Math.max(0, ...samples.map((s) => s.ahead)),
        outstandingAtArrival: outstanding,
        samples: samples.length,
        serverStarted: stats.started,
        serverDropped: stats.dropped.length,
        droppedUrls: stats.dropped.slice(0, 6)
    };
};

// How long the viewport the camera lands on after an interruption takes to fill. A preload that keeps
// its in-flight requests rather than cancelling them is spending bandwidth the new viewport needs, and
// the new viewport shares the same connections, so this is where that trade shows up.
window.interruptToIdle = async (name, jumpAtFraction) => {
    const flight = window.FLIGHTS[name];
    const map = window.__map;
    map.jumpTo({center: flight.origin, zoom: 3});
    await once(map, 'idle', 40000);
    await fetch('/mark');
    map.flyTo({...flight.destination, duration: flight.duration, preload: true});
    await new Promise((r) => setTimeout(r, flight.duration * jumpAtFraction));
    const before = await window.__stats();
    const openAtInterrupt = before.open.length;
    const landed = performance.now();
    map.jumpTo({center: [0, 0], zoom: 6});
    await once(map, 'idle', 60000);
    const ms = Math.round(performance.now() - landed);
    const after = await window.__stats();
    return {name, openAtInterrupt, idleAfterInterruptMs: ms, requestedDuringRecovery: after.started};
};

// Start a preloaded flight, then move the camera somewhere unrelated before it arrives. What happens to
// the requests the preload had in flight is the whole question: throwing them away wastes every byte
// already spent on them.
window.interrupt = async (name, jumpAtFraction) => {
    const flight = window.FLIGHTS[name];
    const map = window.__map;
    map.jumpTo({center: flight.origin, zoom: 3});
    await once(map, 'idle', 40000);
    await fetch('/mark');
    map.flyTo({...flight.destination, duration: flight.duration, preload: true});
    await new Promise((r) => setTimeout(r, flight.duration * jumpAtFraction));

    // Exactly which requests are open at the moment the camera leaves, and which of them the browser
    // then abandons. Those are the requests the preload had in flight, and the ones an abort-on-release
    // would have thrown away.
    const before = await window.__stats();
    const openAtInterrupt = before.open;
    map.jumpTo({center: [0, 0], zoom: 6});
    await new Promise((r) => setTimeout(r, 4000));
    const after = await window.__stats();
    const dropped = after.dropped.filter((u) => openAtInterrupt.includes(u));
    return {name, openAtInterrupt: openAtInterrupt.length, requested: before.started, dropped: dropped.length, droppedUrls: dropped.slice(0, 4)};
};
</script></body></html>`;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/mark') { stats.mark(); res.writeHead(204).end(); return; }
    if (url.pathname === '/stats') {
        res.writeHead(200, {'content-type': 'application/json'}).end(JSON.stringify({
            started: stats.started, open: [...stats.open], dropped: [...stats.dropped], perSource: stats.perSource
        }));
        return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, {'content-type': 'text/html'}).end(PAGE); return; }
    if (url.pathname === '/style.json') { res.writeHead(200, {'content-type': 'application/json'}).end(JSON.stringify(STYLE)); return; }
    if (url.pathname.startsWith('/dist/')) {
        const file = path.join(ROOT, url.pathname);
        if (fs.existsSync(file)) {
            res.writeHead(200, {'content-type': file.endsWith('.css') ? 'text/css' : 'text/javascript'}).end(fs.readFileSync(file));
            return;
        }
        res.writeHead(404).end(); return;
    }
    const tile = /^\/tiles\/(base|overlay)\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(url.pathname);
    if (tile) {
        note(tile[1], url.pathname);
        let answered = false;
        res.on('close', () => done(url.pathname, answered));
        await new Promise((r) => setTimeout(r, TILE_DELAY_MS));
        answered = true;
        if (!res.writableEnded) res.writeHead(200, {'content-type': 'image/png'}).end(PNG);
        return;
    }
    res.writeHead(404).end();
});
await new Promise((r) => server.listen(PORT, r));
console.log(`tile server :${PORT}, every tile delayed ${TILE_DELAY_MS}ms`);

const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    executablePath: process.env.CHROME_PATH || undefined
});

try {
    const page = await browser.newPage();
    await page.setViewport({width: 512, height: 512});
    page.on('console', (m) => console.log('[page]', m.text()));
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText));
    await page.goto(`http://localhost:${PORT}/`, {waitUntil: 'domcontentloaded'});
    await page.evaluate((o) => {
        window.__duration = o.duration;
        window.__projection = o.projection;
    }, {duration: Number(process.env.DURATION ?? 3000), projection: process.env.PROJECTION ?? 'mercator'});
    await page.waitForFunction('window.probe !== undefined', {timeout: 30000});

    const probe = await page.evaluate(() => window.probe());
    console.log('probe:', JSON.stringify(probe));
    if (process.env.PROBE_ONLY) process.exit(0);

    page.on('requestfailed', (r) => {
        if (r.url().includes('/tiles/')) page.evaluate(() => { window.__aborted = (window.__aborted ?? 0) + 1; }).catch(() => {});
    });

    if (process.env.SCENARIO === 'waste') {
        for (const name of (process.env.FLIGHTS ?? 'intercontinental').split(',')) {
            for (const preload of [false, true]) {
                const r = await page.evaluate((n, p) => window.waste(n, p), name, preload);
                console.log(`${name.padEnd(17)} preload=${String(preload).padEnd(5)} ` +
                    `peakOutstanding=${r.peakOutstanding} peakBehindCamera=${r.peakBehind} peakAhead=${r.peakAhead} ` +
                    `outstandingAtArrival=${r.outstandingAtArrival} serverStarted=${r.serverStarted} droppedMidFlight=${r.serverDropped}`);
                if (r.droppedUrls.length) console.log('   dropped:', r.droppedUrls.join(' '));
            }
        }
        process.exit(0);
    }

    if (process.env.SCENARIO === 'recovery') {
        for (const name of (process.env.FLIGHTS ?? 'intercontinental').split(',')) {
            const r = await page.evaluate((n, f) => window.interruptToIdle(n, f), name, Number(process.env.JUMP_AT ?? 0.4));
            console.log(`${name.padEnd(17)} openWhenInterrupted=${r.openAtInterrupt}  ` +
                `idleAfterInterrupt=${r.idleAfterInterruptMs}ms  requestsDuringRecovery=${r.requestedDuringRecovery}`);
        }
        process.exit(0);
    }

    if (process.env.SCENARIO === 'interrupt') {
        for (const name of (process.env.FLIGHTS ?? 'intercontinental,deepZoomIn').split(',')) {
            const r = await page.evaluate((n, f) => window.interrupt(n, f), name, Number(process.env.JUMP_AT ?? 0.4));
            console.log(`${name.padEnd(17)} openWhenInterrupted=${r.openAtInterrupt}  ` +
                `ofThoseDroppedAfterwards=${r.dropped}  (requests so far ${r.requested})`);
        }
        console.log('server:', JSON.stringify(stats));
        process.exit(0);
    }

    const names = (process.env.FLIGHTS ?? 'intercontinental,intraContinent,deepZoomIn').split(',');
    for (const name of names) {
        for (const preload of [false, true]) {
            const r = await page.evaluate((n, p) => window.fly(n, p), name, preload);
            const pct = r.total ? (r.loaded / r.total * 100).toFixed(0) : 'n/a';
            // Screen y grows downward, so a smaller y is nearer the horizon and further from the viewer.
            // What decides how a partly-loaded arrival *looks* is which tiles are missing: at the horizon
            // it is a thin strip, in the middle of the frame it is the map you were looking at. The
            // percentage alone cannot tell the two apart, so this is the number to watch.
            const f = r.foreground;
            const verdict = !preload ? ''
                : (f.missingMeanY === null || f.readyMeanY === null) ? 'all present'
                    : f.missingMeanY < f.readyMeanY ? 'shortfall at horizon (good)'
                        : 'SHORTFALL NEAR VIEWER (bad)';
            console.log(`${name.padEnd(17)} preload=${String(preload).padEnd(5)} loadedAtArrival ${String(r.loaded).padStart(3)}/${String(r.total).padEnd(3)} (${String(pct).padStart(3)}%)  frameDrawn=${f.frameDrawnPct}%  screenY[ready=${f.readyMeanY} missing=${f.missingMeanY}]  requested=${stats.started}`);
            await new Promise((r2) => setTimeout(r2, 50));
        }
    }
    console.log('\nserver totals since last mark:', JSON.stringify(stats));
} finally {
    await browser.close();
    server.close();
}
