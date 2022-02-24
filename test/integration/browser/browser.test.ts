import {Browser, BrowserContext, BrowserType, chromium, Page} from 'playwright';
import address from 'address';
import st from 'st';
import http from 'http';

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

describe('drag and zoom', () => {

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

        test('Zoom: Double click at the center', async () => {

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
