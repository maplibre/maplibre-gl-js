import {describe, test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';
import packageJson from '../../package.json' assert {type: 'json'};
import bundleSize from './bundle_size.json' assert {type: 'json'};

const minBundle = fs.readFileSync('dist/maplibre-gl.js', 'utf8');

describe('test min build', () => {

    test('trims package.json assets', () => {
    // confirm that the entire package.json isn't present by asserting
    // the absence of each of our script strings
        for (const name in packageJson.scripts) {
            if (packageJson.scripts[name].length < 10) continue; // skip short names like "lint"
            expect(minBundle.includes(packageJson.scripts[name])).toBeFalsy();
        }
    });

    test('evaluates without errors', async () => {

        global.URL.createObjectURL = () => 'placeholder';

        try {
            eval(minBundle);
        } catch (e) {
            expect(e).toBeFalsy();
        }
    });

    test('bundle size stays the same', async () => {
        const actualBytes = (await fs.promises.stat('dist/maplibre-gl.js')).size;

        // Need to be very frugal when it comes to minified script.
        // Most changes should increase less than 1k.
        const increaseQuota = 1024;

        // decreasement means optimizations, so more generous (4k) but still
        // need to make sure not a big bug that resulted in a big loss.
        const decreaseQuota = 4096;

        let expectedBytes = bundleSize;

        if (process.env.UPDATE) {
            expectedBytes = actualBytes;
            fs.writeFileSync(path.resolve(__dirname, './bundle_size.json'), `${expectedBytes}\n`);
        }

        expect(actualBytes, `Consider changing bundle_size.json to ${actualBytes}: UPDATE=true npm run test-build -- min.test.ts`).toBeLessThan(expectedBytes + increaseQuota);
        expect(actualBytes).toBeGreaterThan(expectedBytes - decreaseQuota);
    });
});
