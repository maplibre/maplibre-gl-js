import path, {dirname} from 'path';
import fs from 'fs';
import {PNG} from 'pngjs';
import harness from './harness';
import pixelmatch from 'pixelmatch';
import {fileURLToPath} from 'url';
import glob from 'glob';
import ignores from './ignores.json';
import render from './suite_implementation';
import type {PointLike} from '../../../src/ui/camera';
import nise from 'nise';
import {createRequire} from 'module';
const {fakeServer} = nise;
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));
const requireFn = createRequire(import.meta.url);

type TestData = {
    id: string;
    width: number;
    height: number;
    pixelRatio: number;
    recycleMap: boolean;
    allowed: number;
    ok: boolean;
    difference: number;
    actual: string;
    expected: string;
    diff: string;
    timeout: number;
    addFakeCanvas: {
        id: string;
        image: string;
    };
    axonometric: boolean;
    skew: [number, number];
    fadeDuration: number;
    debug: boolean;
    showOverdrawInspector: boolean;
    showPadding: boolean;
    collisionDebug: boolean;
    localIdeographFontFamily: string;
    crossSourceCollisions: boolean;
    operations: any[];
    queryGeometry: PointLike;
    queryOptions: any;
}

type RenderOptions = {
    tests: any[];
    ignores: {};
    shuffle: boolean;
    recycleMap: boolean;
    seed: string;
}

// https://stackoverflow.com/a/1349426/229714
function makeHash(): string {
    const array = [];
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 10; ++i)
        array.push(possible.charAt(Math.floor(Math.random() * possible.length)));

    // join array elements without commas.
    return array.join('');
}

function checkParameter(options: RenderOptions, param: string): boolean {
    const index = options.tests.indexOf(param);
    if (index === -1)
        return false;
    options.tests.splice(index, 1);
    return true;
}

function checkValueParameter(options: RenderOptions, defaultValue: any, param: string) {
    const index = options.tests.findIndex((elem) => { return String(elem).startsWith(param); });
    if (index === -1)
        return defaultValue;

    const split = String(options.tests.splice(index, 1)).split('=');
    if (split.length !== 2)
        return defaultValue;

    return split[1];
}

function compareRenderResults(directory: string, testData: TestData, err: Error, data: Buffer, done: Function) {
    if (err) return done(err);

    let stats;
    const dir = path.join(directory, testData.id);
    try {
        // @ts-ignore
        stats = fs.statSync(dir, fs.R_OK | fs.W_OK);
        if (!stats.isDirectory()) throw new Error();
    } catch (e) {
        fs.mkdirSync(dir);
    }

    const expectedPath = path.join(dir, 'expected.png');
    const actualPath = path.join(dir, 'actual.png');
    const diffPath = path.join(dir, 'diff.png');

    const width = Math.floor(testData.width * testData.pixelRatio);
    const height = Math.floor(testData.height * testData.pixelRatio);
    const actualImg = new PNG({width, height});

    // PNG data must be unassociated (not premultiplied)
    for (let i = 0; i < data.length; i++) {
        const a = data[i * 4 + 3] / 255;
        if (a !== 0) {
            data[i * 4 + 0] /= a;
            data[i * 4 + 1] /= a;
            data[i * 4 + 2] /= a;
        }
    }
    actualImg.data = data;

    // there may be multiple expected images, covering different platforms
    const expectedPaths = glob.sync(path.join(dir, 'expected*.png'));

    if (!process.env.UPDATE && expectedPaths.length === 0) {
        throw new Error('No expected*.png files found; did you mean to run tests with UPDATE=true?');
    }

    if (process.env.UPDATE) {
        fs.writeFileSync(expectedPath, PNG.sync.write(actualImg));

    } else {
        // if we have multiple expected images, we'll compare against each one and pick the one with
        // the least amount of difference; this is useful for covering features that render differently
        // depending on platform, i.e. heatmaps use half-float textures for improved rendering where supported
        let minDiff = Infinity;
        let minDiffImg, minExpectedBuf;

        for (const path of expectedPaths) {
            const expectedBuf = fs.readFileSync(path);
            const expectedImg = PNG.sync.read(expectedBuf);
            const diffImg = new PNG({width, height});

            const diff = pixelmatch(
                actualImg.data, expectedImg.data, diffImg.data,
                width, height, {threshold: 0.1285}) / (width * height);

            if (diff < minDiff) {
                minDiff = diff;
                minDiffImg = diffImg;
                minExpectedBuf = expectedBuf;
            }
        }

        const diffBuf = PNG.sync.write(minDiffImg, {filterType: 4});
        const actualBuf = PNG.sync.write(actualImg, {filterType: 4});

        fs.writeFileSync(diffPath, diffBuf);
        fs.writeFileSync(actualPath, actualBuf);

        testData.difference = minDiff;
        testData.ok = minDiff <= testData.allowed;

        testData.actual = actualBuf.toString('base64');
        testData.expected = minExpectedBuf.toString('base64');
        testData.diff = diffBuf.toString('base64');
    }

    done();
}

function mockXhr() {
    const server = fakeServer.create();
    global.XMLHttpRequest = (server as any).xhr;
    // @ts-ignore
    XMLHttpRequest.onCreate = (req: any) => {
        setTimeout(() => {
            const relativePath = req.url.replace(/^http:\/\/localhost:(\d+)\//, '').replace(/\?.*/, '');

            let body: Buffer = null;
            try {
                if (relativePath.startsWith('mapbox-gl-styles')) {
                    body = fs.readFileSync(path.join(path.dirname(requireFn.resolve('mapbox-gl-styles')), '..', relativePath));
                } else if (relativePath.startsWith('mvt-fixtures')) {
                    body = fs.readFileSync(path.join(path.dirname(requireFn.resolve('@mapbox/mvt-fixtures')), '..', relativePath));
                } else {
                    body = fs.readFileSync(path.join(__dirname, '../assets', relativePath));
                }
                if (req.responseType !== 'arraybuffer') {
                    req.response = body.toString('utf8');
                } else {
                    req.response = body;
                }
                req.setStatus(200);
                req.onload();
            } catch (ex) {
                req.setStatus(404); // file not found
                req.onload();
            }
        }, 0);
    };
    return server;
}

/**
 * Run the render test suite, compute differences to expected values (making exceptions based on
 * implementation vagaries), print results to standard output, write test artifacts to the
 * filesystem (optionally updating expected results), and exit the process with a success or
 * failure code.
 *
 * Caller must supply a `render` function that does the actual rendering and passes the raw image
 * result on to the `render` function's callback.
 *
 * A local server is launched that is capable of serving requests for the source, sprite,
 * font, and tile assets needed by the tests, and the URLs within the test styles are
 * rewritten to point to that server.
 *
 * As the tests run, results are printed to standard output, and test artifacts are written
 * to the filesystem. If the environment variable `UPDATE` is set, the expected artifacts are
 * updated in place based on the test rendering.
 *
 * If all the tests are successful, this function exits the process with exit code 0. Otherwise
 * it exits with 1. If an unexpected error occurs, it exits with -1.
 *
 * @returns {undefined} terminates the process when testing is complete
 */
export function runRenderTests() {
    const options: RenderOptions = {ignores, tests: [], shuffle: false, recycleMap: false, seed: makeHash()};

    if (process.argv.length > 2) {
        options.tests = process.argv.slice(2).filter((value, index, self) => { return self.indexOf(value) === index; }) || [];
        options.shuffle = checkParameter(options, '--shuffle');
        options.recycleMap = checkParameter(options, '--recycle-map');
        options.seed = checkValueParameter(options, options.seed, '--seed');
    }

    mockXhr();

    const directory = path.join(__dirname);
    harness(directory, 'js', options, (style, testData, done) => {
        render(style, testData, (err, data) => {
            compareRenderResults(directory, testData, err, data, done);
        });
    });
}
