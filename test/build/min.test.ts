import fs from 'fs';
import reference from '../../rollup/build/tsc/src/style-spec/reference/latest';
import packageJson from '../../package.json';

let minBundle;

describe('test min build', () => {

    beforeAll(() => {
        minBundle = fs.readFileSync('dist/maplibre-gl.js', 'utf8');
    });

    test('production build removes asserts', () => {
        expect(minBundle.includes('canary assert')).toBeFalsy();
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

});
