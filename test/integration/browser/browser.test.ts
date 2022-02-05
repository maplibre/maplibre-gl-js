import address from 'address';
import st from 'st';
import http from 'http';

import webdriver, {Origin} from 'selenium-webdriver';
const {Builder, By} = webdriver;

import chrome from 'selenium-webdriver/chrome';
import firefox from 'selenium-webdriver/firefox';
import safari from 'selenium-webdriver/safari';

import doubleClick from './util/doubleclick';
import mouseWheel from './util/mousewheel';

const defaultViewportSize = {width: 800, height: 600};

const chromeOptions = new chrome.Options().windowSize(defaultViewportSize);
const firefoxOptions = new firefox.Options().windowSize(defaultViewportSize);
const safariOptions = new safari.Options();

if (process.env.SELENIUM_BROWSER && process.env.SELENIUM_BROWSER.split(/:/, 3)[2] === 'android') {
    chromeOptions.androidChrome().setPageLoadStrategy('normal');
}

const ip = address.ip();
const port = 9968;

const browser = {
    driver: null,
    pixelRatio: 1,
    scaleFactor: 1,
    basePath: `http://${ip}:${port}`,
    getMapCanvas,
    doubleClick,
    mouseWheel
};

export default browser;

async function getMapCanvas(url) {
    await browser.driver.get(url);

    await browser.driver.executeAsyncScript(callback => {

        // @ts-ignore
        if (map.loaded()) {
            callback();
        } else {
            // @ts-ignore
            map.once('load', () => callback());
        }
    });

    return browser.driver.findElement(By.className('maplibregl-canvas mapboxgl-canvas'));
}

let server = null;

describe('drag and zoom', () => {

    // start server
    beforeAll((done) => {
        server = http.createServer(
            st(process.cwd())
        ).listen(port, ip, () => {
            done();
        });
    });

    // start browser
    beforeAll(async () => {

        try {
        // eslint-disable-next-line require-atomic-updates
            browser.driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(chromeOptions)
                .setFirefoxOptions(firefoxOptions)
                .setSafariOptions(safariOptions)
                .build();
        } catch (err) {
            expect(err).toBeFalsy();
        }

        const capabilities = await browser.driver.getCapabilities();
        expect(true).toBeTruthy();
        expect(true).toBeTruthy();
        expect(true).toBeTruthy();

        if (capabilities.getBrowserName() === 'Safari') {
        // eslint-disable-next-line require-atomic-updates
            browser.scaleFactor = 2;
        }

        const metrics = await browser.driver.executeScript(size => {
        /* eslint-disable no-undef */
            return {
                width: outerWidth - innerWidth / devicePixelRatio + size.width,
                height: outerHeight - innerHeight / devicePixelRatio + size.height,
                pixelRatio: devicePixelRatio
            };
        }, defaultViewportSize);
        // eslint-disable-next-line require-atomic-updates
        browser.pixelRatio = metrics.pixelRatio;
        (await browser.driver.manage().window()).setRect({
            width: metrics.width,
            height: metrics.height
        });
    }, 50000);

    test('Drag: To the left', async () => {
        const {driver} = browser;

        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/integration/browser/fixtures/land.html`);

        // Perform drag action, wait a bit the end to avoid the momentum mode.
        await driver
            .actions()
            .move(canvas)
            .press()
            .move({x: 100 / browser.scaleFactor, y: 0, origin: Origin.POINTER})
            .pause(200)
            .release()
            .perform();

        const center = await driver.executeScript(() => {
            /* eslint-disable no-undef */
            // @ts-ignore
            return map.getCenter();
        });
        expect(center.lng).toBeCloseTo(-35.15625, 4);
        expect(center.lat).toBeCloseTo(0, 7);
    }, 20000);

    test('Zoom: Double click at the center', async () => {
        const {driver} = browser;

        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/integration/browser/fixtures/land.html`);

        // Double-click on the center of the map.
        await driver.executeScript(browser.doubleClick, canvas);

        // Wait until the map has settled, then report the zoom level back.
        const zoom = await driver.executeAsyncScript(callback => {
            /* eslint-disable no-undef */
            // @ts-ignore
            map.once('idle', () => callback(map.getZoom()));
        });

        expect(zoom).toBe(2);
    }, 20000);

    afterAll(async () => {
        if (browser.driver) {
            await browser.driver.quit();
        }

        if (server) {
            server.close();
        }
    });
});
