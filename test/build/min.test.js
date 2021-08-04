import {test} from '../util/test';
import fs from 'fs';
import path, {dirname} from 'path';
import reference from '../../rollup/build/tsc/style-spec/reference/latest';
import {Linter} from 'eslint';
import packageJson from '../../package.json';
import browserify from 'browserify';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const minBundle = fs.readFileSync('dist/maplibre-gl.js', 'utf8');

test('production build removes asserts', (t) => {
    t.assert(minBundle.indexOf('canary assert') === -1);
    t.assert(minBundle.indexOf('canary debug run') === -1);
    t.end();
});

test('trims package.json assets', (t) => {
    // confirm that the entire package.json isn't present by asserting
    // the absence of each of our script strings
    for (const name in packageJson.scripts) {
        t.assert(minBundle.indexOf(packageJson.scripts[name]) === -1);
    }
    t.end();
});

test('trims reference.json fields', (t) => {
    t.assert(reference.$root.version.doc);
    t.assert(minBundle.indexOf(reference.$root.version.doc) === -1);
    t.end();
});

test('can be browserified', (t) => {
    browserify(path.join(__dirname, 'browserify-test-fixture.js')).bundle((err) => {
        t.ifError(err);
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
    try {
        let mgl = await import ('../../dist/maplibre-gl.js');
    } catch {
        t.fail();
    }
    t.end();
});

test('distributed in plain ES5 code', (t) => {
    const linter = new Linter();
    const messages = linter.verify(minBundle, {
        parserOptions: {
            ecmaVersion: 5
        },
        rules: {},
        env: {
            node: true
        }
    });
    t.deepEqual(messages.map(message => `${message.line}:${message.column}: ${message.message}`), []);
    t.end();
});

