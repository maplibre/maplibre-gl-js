import {Browser, BrowserContext, BrowserType, chromium, Page} from 'playwright';
import address from 'address';
import st from 'st';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ip = address.ip();
const port = 9968;
const basePath = `http://${ip}:${port}`;

async function getMapCanvas(url, page: Page) {

    await page.goto(url);

    await page.evaluate(() => {
        new Promise<void>((resolve, _reject) => {
            if (map.loaded()) {
                resolve();
            } else {
                map.once('load', () => resolve());
            }
        });
    });

}

async function newTest(impl: BrowserType) {
    browser = await impl.launch({
        headless: false,
    });

    context = await browser.newContext({
        viewport: {width: 800, height: 600},
        deviceScaleFactor: 2,
    });

    page = await context.newPage();
    await getMapCanvas(`${basePath}/test/integration/browser/fixtures/land.html`, page);
}

let server = null;
let browser: Browser;
let context: BrowserContext;
let page: Page;
let map: any;

describe('browser tests', () => {

    // start server
    beforeAll((done) => {
        server = http.createServer(
            st(process.cwd())
        ).listen(port, ip, () => {
            done();
        });
    });

    [chromium].forEach((impl) => {

        test(`${impl.name()} - Drag to the left`, async () => {

            await newTest(impl);

            const canvas = await page.$('.maplibregl-canvas');
            const canvasBB = await canvas.boundingBox();

            // Perform drag action, wait a bit the end to avoid the momentum mode.
            await page.mouse.move(canvasBB.x, canvasBB.y);
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

        test(`${impl.name()} Zoom: Double click at the center`, async () => {

            await newTest(impl);
            const canvas = await page.$('.maplibregl-canvas');
            const canvasBB = await canvas.boundingBox();
            await page.mouse.dblclick(canvasBB.x, canvasBB.y);

            // Wait until the map has settled, then report the zoom level back.
            const zoom = await page.evaluate(() => {
                return new Promise((resolve, _reject) => {
                    map.once('idle', () => resolve(map.getZoom()));
                });
            });

            expect(zoom).toBe(2);
        }, 20000);

        test(`${impl.name()} - CJK Characters`, async () => {
            await newTest(impl);
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

            const pageWithImage = `<html><head></head><body><img src="${image}" width="800" height="600" /></body></html>`.replace(/\s/g, '');

            function getFixture(platform: string): string {
                return fs.readFileSync(path.join(__dirname, `fixtures/cjk-expected-base64-image/${platform}.html`), 'utf8').replace(/\s/g, '');
            }

            expect(
                pageWithImage === getFixture('ubuntu-runner') ||
                pageWithImage === getFixture('macos-runner') ||
                pageWithImage === getFixture('macos-local')
            ).toBeTruthy();

        }, 20000);
    });

    afterEach(async() => {
        await browser.close();
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });
});
