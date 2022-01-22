import {test} from '../util/test';
import browser from './util/browser';

describe('zooming', async t => {
    const {driver} = browser;

    await test('double click at the center', async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`);

        // Double-click on the center of the map.
        await driver.executeScript(browser.doubleClick, canvas);

        // Wait until the map has settled, then report the zoom level back.
        const zoom = await driver.executeAsyncScript(callback => {
            /* eslint-disable no-undef */
            map.once('idle', () => callback(map.getZoom()));
        });

        expect(zoom).toBe(2);
    });
});
