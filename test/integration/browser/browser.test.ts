import puppeteer, {Page, Browser} from 'puppeteer';
import st from 'st';
import http from 'http';
import type {Server} from 'http';
import type {AddressInfo} from 'net';
import type {Map} from '../../../src/ui/map';
import type {default as MapLibreGL} from '../../../src/index';

const testWidth = 800;
const testHeight = 600;
const deviceScaleFactor = 2;

let server: Server;
let browser: Browser;
let page: Page;
let map: Map;
let maplibregl: typeof MapLibreGL;

jest.retryTimes(3);

describe('Browser tests', () => {

    // start server
    beforeAll(async () => {
        server = http.createServer(
            st(process.cwd())
        );
        await new Promise<void>((resolve) => server.listen(resolve));

        browser = await puppeteer.launch({headless: 'new'});

    }, 40000);

    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({width: testWidth, height: testHeight, deviceScaleFactor});

        const port = (server.address() as AddressInfo).port;

        await page.goto(`http://localhost:${port}/test/integration/browser/fixtures/land.html`, {waitUntil: 'domcontentloaded'});

        await page.evaluate(() => {
            new Promise<void>((resolve, _reject) => {
                if (map.loaded()) {
                    resolve();
                } else {
                    map.once('load', () => resolve());
                }
            });
        });
    }, 40000);

    afterEach(async() => {
        page.close();
    }, 40000);

    afterAll(async () => {
        await browser.close();
        if (server) {
            server.close();
        }
    }, 40000);

    test('Load should fire before resize and moveend', async () => {
        const firstFiredEvent = await page.evaluate(() => {
            const map2 = new maplibregl.Map({
                container: 'map',
                style: 'https://demotiles.maplibre.org/style.json',
                center: [10, 10],
                zoom: 10
            });
            return new Promise<string>((resolve, _reject) => {
                map2.once('resize', () => resolve('resize'));
                map2.once('moveend', () => resolve('moveend'));
                map2.once('load', () => resolve('load'));
            });
        });
        expect(firstFiredEvent).toBe('load');
    }, 20000);

    test('Should continue zooming from last mouse position after scroll and flyto, see #2709', async () => {
        const finalZoom = await page.evaluate(() => {
            return new Promise<number>((resolve, _reject) => {
                map.once('zoom', () => {
                    map.flyTo({
                        zoom: 9
                    });
                    setTimeout(() => {
                        map.getCanvas().dispatchEvent(new WheelEvent('wheel', {deltaY: 120, bubbles: true}));
                        map.once('idle', () => {
                            resolve(map.getZoom());
                        });
                    }, 1000);
                });
                map.getCanvas().dispatchEvent(new WheelEvent('wheel', {deltaY: 120, bubbles: true}));
            });
        });
        expect(finalZoom).toBeGreaterThan(2);
    }, 20000);

    test('Drag to the left', async () => {
        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox();

        const dragToLeft = async () => {
            await page.mouse.move(canvasBB!.x, canvasBB!.y);
            await page.mouse.down();
            await page.mouse.move(100, 0, {
                steps: 10
            });
            await page.mouse.up();
            await new Promise(r => setTimeout(r, 200));

            return page.evaluate(() => {
                return map.getCenter();
            });
        };

        await page.emulateMediaFeatures([
            {name: 'prefers-reduced-motion', value: 'reduce'},
        ]);
        const centerWithoutInertia = await dragToLeft();
        expect(centerWithoutInertia.lng).toBeCloseTo(-35.15625, 4);
        expect(centerWithoutInertia.lat).toBeCloseTo(0, 7);

        await page.emulateMediaFeatures([
            {name: 'prefers-reduced-motion', value: 'reduce'},
        ]);
        const centerWithInertia = await dragToLeft();
        expect(centerWithInertia.lng).toBeLessThan(-60);
        expect(centerWithInertia.lat).toBeCloseTo(0, 7);
    }, 20000);

    test('Resize viewport (page)', async () => {

        await page.setViewport({width: 400, height: 400, deviceScaleFactor: 2});

        await new Promise(r => setTimeout(r, 200));

        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox();
        expect(canvasBB?.width).toBeCloseTo(400);
        expect(canvasBB?.height).toBeCloseTo(400);
    }, 20000);

    test('Resize div', async () => {

        await page.evaluate(() => {
            document.getElementById('map')!.style.width = '200px';
            document.getElementById('map')!.style.height = '200px';
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox();
        expect(canvasBB!.width).toBeCloseTo(200);
        expect(canvasBB!.height).toBeCloseTo(200);
    }, 20000);

    test('Zoom: Double click at the center', async () => {

        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox()!;
        await page.mouse.click(canvasBB?.x!, canvasBB?.y!, {clickCount: 2});

        // Wait until the map has settled, then report the zoom level back.
        const zoom = await page.evaluate(() => {
            return new Promise((resolve, _reject) => {
                map.once('idle', () => resolve(map.getZoom()));
            });
        });

        expect(zoom).toBe(2);
    }, 20000);

    test('Marker: correct position', async () => {
        const markerScreenPosition = await page.evaluate(() => {
            const markerMapPosition = [11.40, 47.30] as [number, number];
            const marker = new maplibregl.Marker()
                .setLngLat(markerMapPosition)
                .addTo(map);

            map.setPitch(52);
            map.fitBounds(
                [
                    [markerMapPosition[0], markerMapPosition[1] + 0.02],
                    [markerMapPosition[0], markerMapPosition[1] - 0.01]
                ]
                , {duration: 0}
            );

            map.setStyle({
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors',
                        maxzoom: 19
                    },
                    // Use a different source for terrain and hillshade layers, to improve render quality
                    terrainSource: {
                        type: 'raster-dem',
                        url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
                        tileSize: 256
                    },
                    hillshadeSource: {
                        type: 'raster-dem',
                        url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
                        tileSize: 256
                    }
                },
                layers: [
                    {
                        id: 'osm',
                        type: 'raster',
                        source: 'osm'
                    },
                    {
                        id: 'hills',
                        type: 'hillshade',
                        source: 'hillshadeSource',
                        layout: {visibility: 'visible'},
                        paint: {'hillshade-shadow-color': '#473B24'}
                    }
                ],
                terrain: {
                    source: 'terrainSource',
                    exaggeration: 1
                }
            });

            return new Promise<any>((resolve) => {
                map.once('idle', () => {
                    map.setTerrain({source: 'terrainSource'});
                    map.once('idle', () => {
                        const markerBounding = marker.getElement().getBoundingClientRect();
                        resolve({
                            x: markerBounding.x,
                            y: markerBounding.y
                        });
                    });
                });
            });
        });

        expect(markerScreenPosition.x).toBeCloseTo(386.5);
        expect(markerScreenPosition.y).toBeCloseTo(378.1);
    }, 20000);
});
