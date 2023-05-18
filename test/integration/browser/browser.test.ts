import puppeteer, {Page, Browser} from 'puppeteer';
import st from 'st';
import http from 'http';
import type {Server} from 'http';
import fs from 'fs';
import path from 'path';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
import type {AddressInfo} from 'net';

const testWidth = 800;
const testHeight = 600;

let server: Server;
let browser: Browser;
let page: Page;
let map: any;

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
        await page.setViewport({width: testWidth, height: testHeight, deviceScaleFactor: 2});

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

    test('No moveend before load', async () => {
        const loadWasFirst = await page.evaluate(() => {
            const map2 = new maplibregl.Map({
                container: 'map', // container id
                style: 'https://demotiles.maplibre.org/style.json', // style URL
                center: [10, 10], // starting position [lng, lat]
                zoom: 10 // starting zoom
            });
            return new Promise<boolean>((resolve, _reject) => {
                map2.once('moveend', () => resolve(false));
                map2.once('load', () => resolve(true));
            });
        });
        expect(loadWasFirst).toBeTruthy();
    }, 20000);

    test('Drag to the left', async () => {

        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox();

        // Perform drag action, wait a bit the end to avoid the momentum mode.
        await page.mouse.move(canvasBB!.x, canvasBB!.y);
        await page.mouse.down();
        await page.mouse.move(100, 0);
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.up();

        const center = await page.evaluate(() => {
            return map.getCenter();
        });

        expect(center.lng).toBeCloseTo(-35.15625, 4);
        expect(center.lat).toBeCloseTo(0, 7);
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

    test('CJK Characters', async () => {

        await page.evaluate(() => {

            map.setStyle({
                version: 8,
                glyphs: 'https://mierune.github.io/fonts/{fontstack}/{range}.pbf',
                sources: {
                    sample: {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [0, 0]
                            },
                            properties: {
                                'name_en': 'abcde',
                                'name_ja': 'あいうえお',
                                'name_ch': '阿衣乌唉哦',
                                'name_kr': '아이우'
                            }
                        }
                    },
                },
                'layers': [
                    {
                        'id': 'sample-text-left',
                        'type': 'symbol',
                        'source': 'sample',
                        'layout': {
                            'text-anchor': 'top',
                            'text-field': '{name_ja}{name_en}',
                            'text-font': ['Open Sans Regular'],
                            'text-offset': [-10, 0],
                        }
                    },
                    {
                        'id': 'sample-text-center',
                        'type': 'symbol',
                        'source': 'sample',
                        'layout': {
                            'text-anchor': 'top',
                            'text-field': '{name_ch}{name_kr}',
                            'text-font': ['Open Sans Regular'],
                            'text-offset': [0, 0],
                        }
                    },
                    {
                        'id': 'sample-text-right',
                        'type': 'symbol',
                        'source': 'sample',
                        'layout': {
                            'text-anchor': 'top',
                            'text-field': '{name_en}{name_ja}',
                            'text-font': ['Open Sans Regular'],
                            'text-offset': [10, 0],
                        }
                    },
                ]
            });
        });

        const image = await page.evaluate(() => {
            return new Promise((resolve, _) => {
                map.once('idle', () => resolve(map.getCanvas().toDataURL()));
                map.setZoom(8);
            });
        });

        const actualBuff = Buffer.from((image as string).replace(/data:.*;base64,/, ''), 'base64');
        const actualPng = new PNG({width: testWidth, height: testHeight});
        actualPng.parse(actualBuff);

        const expectedPlatforms = ['ubuntu-runner', 'macos-runner', 'macos-local'];
        let minDiff = Infinity;
        for (const expected of expectedPlatforms) {
            const diff = compareByPixelmatch(actualPng, expected, testWidth, testHeight);
            if (diff < minDiff) {
                minDiff = diff;
            }
        }

        // At least one platform should be identical
        expect(minDiff).toBe(0);

    }, 20000);

    afterEach(async() => {
        page.close();
    }, 40000);

    afterAll(async () => {
        await browser.close();
        if (server) {
            server.close();
        }
    }, 40000);

    function compareByPixelmatch(actualPng:PNG, platform: string, width:number, height:number): number {
        const platformFixtureBase64 = fs.readFileSync(
            path.join(__dirname, `fixtures/cjk-expected-base64-image/${platform}-base64.txt`), 'utf8')
            .replace(/\s/g, '')
            .replace(/data:.*;base64,/, '');

        const expectedBuff = Buffer.from(platformFixtureBase64, 'base64');

        const expectedPng = new PNG({width: testWidth, height: testHeight});
        expectedPng.parse(expectedBuff);

        const diffImg = new PNG({width, height});

        const diff = pixelmatch(
            actualPng.data, expectedPng.data, diffImg.data,
            width, height, {threshold: 0}) / (width * height);

        return diff;
    }
});
