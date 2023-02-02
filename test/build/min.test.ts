import fs from 'fs';
import reference from '../../src/style-spec/reference/latest';
import packageJson from '../../package.json' assert {type: 'json'};

const minBundle = fs.readFileSync('dist/maplibre-gl.js', 'utf8');

describe('test min build', () => {
    test('production build removes asserts', () => {
        expect(minBundle.includes('canary debug run')).toBeFalsy();
    });

    test('trims package.json assets', () => {
    // confirm that the entire package.json isn't present by asserting
    // the absence of each of our script strings
        for (const name in packageJson.scripts) {
            expect(minBundle.includes(packageJson.scripts[name])).toBeFalsy();
        }
    });

    test('trims reference.json fields', () => {
        expect(reference.$root.version.doc).toBeTruthy();
        expect(minBundle.includes(reference.$root.version.doc)).toBeFalsy();
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

        // feel free to update this value after you've checked that it has changed on purpose :-)
        const expectedBytes = 753792;

        expect(actualBytes - expectedBytes).toBeLessThan(increaseQuota);
        expect(expectedBytes - actualBytes).toBeLessThan(decreaseQuota);
    });
});
