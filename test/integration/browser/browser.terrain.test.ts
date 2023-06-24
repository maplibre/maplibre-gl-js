import puppeteer, {Page, Browser} from 'puppeteer';
import st from 'st';
import http from 'http';
import type {Server} from 'http';
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

        await page.goto(`http://localhost:${port}/test/integration/browser/fixtures/terrain.html`, {waitUntil: 'domcontentloaded'});

        await page.evaluate(() => {
            return new Promise<void>((resolve, _reject) => {
                if (map.loaded()) {
                    resolve();
                } else {
                    map.once('load', () => {
                        resolve();
                    });
                }
            });
        });
    }, 40000);

    test('Change bearing to collide with terrain', async () => {

        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox();

        // Print camera states
        const originalMap = await page.evaluate(() => {
            return {
                center: map.getCenter(),
                zoom: map.getZoom(),
                bearing: map.getBearing(),
                pitch: map.getPitch(),
            };
        });
        console.debug('Original Camera State', originalMap);

        // Hold the right mouse and drag to change bearing
        const left = canvasBB!.x;
        const top = canvasBB!.y;
        await page.mouse.move(left, top);
        await page.mouse.down({button: 'right'});
        await page.mouse.move(left + 40, top);
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.up({button: 'right'});

        // Print collision states
        const collisionInfo = await page.evaluate(() => {
            return map.checkTerrainCollision();
        });
        console.debug('Information about collision', collisionInfo);

        // Print new camera states
        const newMap = await page.evaluate(() => {
            return {
                center: map.getCenter(),
                zoom: map.getZoom(),
                bearing: map.getBearing(),
                pitch: map.getPitch(),
            };
        });
        console.debug('New Camera State', newMap);

        // Expect camera is above terrain surface
        expect(collisionInfo.cameraAltitude).toBeGreaterThan(collisionInfo.minAllowedAltitude);

        // Expect no need to change pitch
        expect(collisionInfo.maxPitch).toBeNull();

        // Expect pitch will be changed to prevent collision
        expect(newMap.pitch).toBeLessThan(originalMap.pitch);
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
});
