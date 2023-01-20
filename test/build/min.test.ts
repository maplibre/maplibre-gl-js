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
        const bytes = (await fs.promises.stat('dist/maplibre-gl.js')).size;
        const alpha = 0.1;
        // feel free to update this value after you've checked that it has changed on purpose :-)
        const expectedBytes = 756788;
        expect(bytes).toBeLessThan(expectedBytes * (1 + alpha));
        expect(bytes).toBeGreaterThan(expectedBytes * (1 - alpha));
    });
});
