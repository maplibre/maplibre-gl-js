import {test} from '../util/test';
import fs from 'fs';
import path, {dirname} from 'path';
import reference from '../../rollup/build/tsc/src/style-spec/reference/latest';
import packageJson from '../../package.json';
import browserify from 'browserify';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const minBundle = fs.readFileSync('dist/maplibre-gl.js', 'utf8');

test('production build removes asserts', (t) => {
    expect(minBundle.indexOf('canary assert') === -1).toBeTruthy();
    expect(minBundle.indexOf('canary debug run') === -1).toBeTruthy();
    t.end();
});

test('trims package.json assets', (t) => {
    // confirm that the entire package.json isn't present by asserting
    // the absence of each of our script strings
    for (const name in packageJson.scripts) {
        expect(minBundle.indexOf(packageJson.scripts[name]) === -1).toBeTruthy();
    }
    t.end();
});

test('trims reference.json fields', (t) => {
    expect(reference.$root.version.doc).toBeTruthy();
    expect(minBundle.indexOf(reference.$root.version.doc) === -1).toBeTruthy();
    t.end();
});

test('can be browserified', (t) => {
    browserify(path.join(__dirname, 'browserify-test-fixture.js')).bundle((err) => {
        expect(err).toBeFalsy();
        t.end();
    });
});

test('evaluates without errors', async (t) => {
    global.window = {
        URL: {
            createObjectURL: () => {}
        }
    };
    global.Blob = function() {};
    global.performance = {};
    global.navigator = {};
    try {
        await import('../../dist/maplibre-gl.js');
    } catch (e) {
        expect(e).toBeFalsy();
    }
    t.end();
});

