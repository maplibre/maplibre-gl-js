/* eslint-disable no-process-exit */
import './mock_browser_for_node';
import canvas from 'canvas';
import path, {dirname} from 'path';
import fs from 'fs';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {fileURLToPath} from 'url';
import glob from 'glob';
import nise, {FakeXMLHttpRequest} from 'nise';
import {createRequire} from 'module';
import rtlText from '@mapbox/mapbox-gl-rtl-text';
import localizeURLs from '../lib/localize-urls';
import maplibregl from '../../../src/index';
import browser from '../../../src/util/browser';
import * as rtlTextPluginModule from '../../../src/source/rtl_text_plugin';
import CanvasSource from '../../../src/source/canvas_source';
import customLayerImplementations from './custom_layer_implementations';
import type Map from '../../../src/ui/map';
import type {StyleSpecification} from '../../../src/style-spec/types.g';
import type {PointLike} from '../../../src/ui/camera';

const {fakeXhr} = nise;
const {plugin: rtlTextPlugin} = rtlTextPluginModule;
const {registerFont} = canvas;

// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));
// @ts-ignore
const require = createRequire(import.meta.url);
registerFont('./node_modules/npm-font-open-sans/fonts/Bold/OpenSans-Bold.ttf', {family: 'Open Sans', weight: 'bold'});

rtlTextPlugin['applyArabicShaping'] = rtlText.applyArabicShaping;
rtlTextPlugin['processBidirectionalText'] = rtlText.processBidirectionalText;
rtlTextPlugin['processStyledBidirectionalText'] = rtlText.processStyledBidirectionalText;

let now = 0;

type TestData = {
    id: string;
    width: number;
    height: number;
    pixelRatio: number;
    recycleMap: boolean;
    allowed: number;
    ok: boolean;
    difference: number;
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
    error: Error;
    maxPitch: number;

    // base64-encoded content of the PNG results
    actual: string;
    diff: string;
    expected: string;
}

type RenderOptions = {
    tests: any[];
    recycleMap: boolean;
    report: boolean;
    seed: string;
}

type StyleWithTestData = StyleSpecification & {
    metadata : {
        test: TestData;
    };
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
/**
 * Compares the Unit8Array that was created to the expected file in the file system.
 * It updates testData with the results.
 *
 * @param directory The base directory of the data
 * @param testData The test data
 * @param data The actual image data to compare the expected to
 * @returns nothing as it updates the testData object
 */
function compareRenderResults(directory: string, testData: TestData, data: Uint8Array) {
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
    actualImg.data = data as any;

    // there may be multiple expected images, covering different platforms
    let globPattern = path.join(dir, 'expected*.png');
    globPattern = globPattern.replace(/\\/g, '/'); // ensure a Windows path is converted to a glob compatible pattern.
    const expectedPaths = glob.sync(globPattern);

    if (!process.env.UPDATE && expectedPaths.length === 0) {
        throw new Error('No expected*.png files found; did you mean to run tests with UPDATE=true?');
    }

    if (process.env.UPDATE) {
        fs.writeFileSync(expectedPath, PNG.sync.write(actualImg));
        return;
    }

    // if we have multiple expected images, we'll compare against each one and pick the one with
    // the least amount of difference; this is useful for covering features that render differently
    // depending on platform, i.e. heatmaps use half-float textures for improved rendering where supported
    let minDiff = Infinity;
    let minDiffImg: PNG;
    let minExpectedBuf: Buffer;

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

/**
 * Mocks XHR request and simply pulls file from the file system.
 */
function mockXhr() {
    global.XMLHttpRequest = fakeXhr.useFakeXMLHttpRequest() as any;
    // @ts-ignore
    XMLHttpRequest.onCreate = (req: FakeXMLHttpRequest & XMLHttpRequest & { response: any }) => {
        setTimeout(() => {
            if (req.readyState === 0) return; // aborted...
            const relativePath = req.url.replace(/^http:\/\/localhost:(\d+)\//, '').replace(/\?.*/, '');

            let body: Buffer | null = null;
            try {
                if (relativePath.startsWith('mvt-fixtures')) {
                    body = fs.readFileSync(path.join(path.dirname(require.resolve('@mapbox/mvt-fixtures')), '..', relativePath));
                } else {
                    body = fs.readFileSync(path.join(__dirname, '../assets', relativePath));
                }
                if (req.responseType !== 'arraybuffer') {
                    req.response = body.toString('utf8');
                } else {
                    req.response = body;
                }
                req.setStatus(req.response.length > 0 ? 200 : 204);
                req.onload(undefined as any);
            } catch (ex) {
                req.status = 404; // file not found
                req.onload(undefined as any);
            }
        }, 0);
    };
}

/**
 * Gets all the tests from the file system looking for style.json files.
 *
 * @param options The options
 * @param directory The base directory
 * @returns The tests data structure and the styles that were loaded
 */
function getTestStyles(options: RenderOptions, directory: string): StyleWithTestData[] {
    const tests = options.tests || [];

    const globCwd = directory.replace(/\\/g, '/'); // ensure a Windows path is converted to a glob compatible pattern.
    const sequence = glob.sync('**/style.json', {cwd: globCwd})
        .map(fixture => {
            const id = path.dirname(fixture);
            const style = JSON.parse(fs.readFileSync(path.join(directory, fixture), 'utf8')) as StyleWithTestData;
            style.metadata = style.metadata || {} as any;

            style.metadata.test = Object.assign({
                id,
                width: 512,
                height: 512,
                pixelRatio: 1,
                recycleMap: options.recycleMap || false,
                allowed: 0.00025
            }, style.metadata.test);

            return style;
        })
        .filter(style => {
            const test = style.metadata.test;

            if (tests.length !== 0 && !tests.some(t => test.id.indexOf(t) !== -1)) {
                return false;
            }

            if (process.env.BUILDTYPE !== 'Debug' && test.id.match(/^debug\//)) {
                console.log(`* skipped ${test.id}`);
                return false;
            }
            localizeURLs(style, 2900, path.join(__dirname, '../'));
            return true;
        });
    return sequence;
}

// replacing the browser method of get image in order to avoid usage of context and canvas 2d with Image object...
// @ts-ignore
browser.getImageData = (img, padding = 0) => {
    // @ts-ignore
    if (!img.data) {
        return {width: 1, height: 1, data: new Uint8Array(1)};
    }
    const width = img.width as number;
    const height = img.height as number;
    // @ts-ignore
    const data = img.data;
    const source = new Uint8Array(data);
    const dest = new Uint8Array((2 * padding + width) * (2 * padding + height) * 4);

    const offset = (2 * padding + width) * padding + padding;
    for (let i = 0; i < height; i++) {
        dest.set(source.slice(i * width * 4, (i + 1) * width * 4), 4 * (offset + (width + 2 * padding) * i));
    }
    return {width: width + 2 * padding, height: height + 2 * padding, data: dest};
};

function createFakeCanvas(document: Document, id: string, imagePath: string): HTMLCanvasElement {
    const fakeCanvas = document.createElement('canvas');
    const image = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets', imagePath)));
    fakeCanvas.id = id;
    (fakeCanvas as any).data = image.data;
    fakeCanvas.width = image.width;
    fakeCanvas.height = image.height;
    return fakeCanvas;
}

function updateFakeCanvas(document: Document, id: string, imagePath: string) {
    const fakeCanvas = document.getElementById(id);
    const image = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets', imagePath)));
    (fakeCanvas as any).data = image.data;
}

/**
 * Executes the operations in the test data
 *
 * @param testData The test data to operate upon
 * @param map The Map
 * @param operations The operations
 * @param callback The callback to use when all the operations are executed
 */
function applyOperations(testData: TestData, map: Map & { _render: () => void}, operations: any[], callback: Function) {
    const operation = operations && operations[0];
    if (!operations || operations.length === 0) {
        callback();

    } else if (operation[0] === 'wait') {
        if (operation.length > 1) {
            now += operation[1];
            map._render();
            applyOperations(testData, map, operations.slice(1), callback);

        } else {
            const wait = function() {
                if (map.loaded()) {
                    applyOperations(testData, map, operations.slice(1), callback);
                } else {
                    map.once('render', wait);
                }
            };
            wait();
        }

    } else if (operation[0] === 'sleep') {
        // Prefer "wait", which renders until the map is loaded
        // Use "sleep" when you need to test something that sidesteps the "loaded" logic
        setTimeout(() => {
            applyOperations(testData, map, operations.slice(1), callback);
        }, operation[1]);
    } else if (operation[0] === 'addImage') {
        const {data, width, height} = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets', operation[2])));
        map.addImage(operation[1], {width, height, data: new Uint8Array(data)}, operation[3] || {});
        applyOperations(testData, map, operations.slice(1), callback);
    } else if (operation[0] === 'addCustomLayer') {
        map.addLayer(new customLayerImplementations[operation[1]](), operation[2]);
        map._render();
        applyOperations(testData, map, operations.slice(1), callback);
    } else if (operation[0] === 'updateFakeCanvas') {
        const canvasSource = map.getSource(operation[1]) as CanvasSource;
        canvasSource.play();
        // update before pause should be rendered
        updateFakeCanvas(window.document, testData.addFakeCanvas.id, operation[2]);
        canvasSource.pause();
        // update after pause should not be rendered
        updateFakeCanvas(window.document, testData.addFakeCanvas.id, operation[3]);
        map._render();
        applyOperations(testData, map, operations.slice(1), callback);
    } else if (operation[0] === 'setStyle') {
        // Disable local ideograph generation (enabled by default) for
        // consistent local ideograph rendering using fixtures in all runs of the test suite.
        map.setStyle(operation[1], {localIdeographFontFamily: false as any});
        applyOperations(testData, map, operations.slice(1), callback);
    } else if (operation[0] === 'pauseSource') {
        map.style.sourceCaches[operation[1]].pause();
        applyOperations(testData, map, operations.slice(1), callback);
    } else {
        if (typeof map[operation[0]] === 'function') {
            map[operation[0]](...operation.slice(1));
        }
        applyOperations(testData, map, operations.slice(1), callback);
    }
}
/**
 * It creates the map and applies the operations to create an image
 * and returns it as a Uint8Array
 *
 * @param style The style to use
 * @returns an image byte array promise
 */
function getImageFromStyle(style: StyleWithTestData): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const options = style.metadata.test;

        setTimeout(() => {
            reject(new Error('Test timed out'));
        }, options.timeout || 20000);

        if (options.addFakeCanvas) {
            const fakeCanvas = createFakeCanvas(window.document, options.addFakeCanvas.id, options.addFakeCanvas.image);
            window.document.body.appendChild(fakeCanvas);
        }

        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: options.width});
        Object.defineProperty(container, 'clientHeight', {value: options.height});

        const map = new maplibregl.Map({
            container,
            style,

            // @ts-ignore
            classes: options.classes,
            interactive: false,
            attributionControl: false,
            maxPitch: options.maxPitch,
            pixelRatio: options.pixelRatio,
            preserveDrawingBuffer: true,
            axonometric: options.axonometric || false,
            skew: options.skew || [0, 0],
            fadeDuration: options.fadeDuration || 0,
            localIdeographFontFamily: options.localIdeographFontFamily || false as any,
            crossSourceCollisions: typeof options.crossSourceCollisions === 'undefined' ? true : options.crossSourceCollisions
        });

        // Configure the map to never stop the render loop
        map.repaint = true;
        now = 0;
        browser.now = () => {
            return now;
        };

        if (options.debug) map.showTileBoundaries = true;
        if (options.showOverdrawInspector) map.showOverdrawInspector = true;
        if (options.showPadding) map.showPadding = true;

        const gl = map.painter.context.gl;

        map.once('load', () => {
            if (options.collisionDebug) {
                map.showCollisionBoxes = true;
                if (options.operations) {
                    options.operations.push(['wait']);
                } else {
                    options.operations = [['wait']];
                }
            }
            applyOperations(options, map as any, options.operations, () => {
                const viewport = gl.getParameter(gl.VIEWPORT);
                const w = viewport[2];
                const h = viewport[3];

                const data = new Uint8Array(w * h * 4);
                gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);

                // Flip the scanlines.
                const stride = w * 4;
                const tmp = new Uint8Array(stride);
                for (let i = 0, j = h - 1; i < j; i++, j--) {
                    const start = i * stride;
                    const end = j * stride;
                    tmp.set(data.slice(start, start + stride), 0);
                    data.set(data.slice(end, end + stride), start);
                    data.set(tmp, end);
                }

                map.remove();
                gl.getExtension('STACKGL_destroy_context').destroy();
                delete map.painter.context.gl;

                if (options.addFakeCanvas) {
                    const fakeCanvas = window.document.getElementById(options.addFakeCanvas.id);
                    fakeCanvas.parentNode.removeChild(fakeCanvas);
                }

                resolve(data);
            });
        });
    });
}

/**
 * Prints the progress to the console
 *
 * @param test The current test
 * @param total The total number of tests
 * @param index The current test index
 */
function printProgress(test: TestData, total: number, index: number) {
    if (test.error) {
        console.log(`${index}/${total}: errored ${test.id} ${test.error.message}`);
    } else if (!test.ok) {
        console.log(`${index}/${total}: failed ${test.id} ${test.difference}`);
    } else {
        console.log(`${index}/${total}: passed ${test.id}`);
    }
}

type TestStats = {
    total: number;
    errored: TestData[];
    failed: TestData[];
    passed: TestData[];
};

/**
 * Prints the summary at the end of the run
 *
 * @param tests all the tests with their resutls
 * @returns
 */
function printStatistics(stats: TestStats): boolean {
    const erroredCount = stats.errored.length;
    const failedCount = stats.failed.length;
    const passedCount = stats.passed.length;

    function printStat(status: string, statusCount: number) {
        if (statusCount > 0) {
            console.log(`${statusCount} ${status} (${(100 * statusCount / stats.total).toFixed(1)}%)`);
        }
    }

    printStat('passed', passedCount);
    printStat('failed', failedCount);
    printStat('errored', erroredCount);

    return (failedCount + erroredCount) === 0;
}

/**
 * Run the render test suite, compute differences to expected values (making exceptions based on
 * implementation vagaries), print results to standard output, write test artifacts to the
 * filesystem (optionally updating expected results), and exit the process with a success or
 * failure code.
 *
 * If all the tests are successful, this function exits the process with exit code 0. Otherwise
 * it exits with 1.
 */
const options: RenderOptions = {
    tests: [],
    recycleMap: false,
    report: false,
    seed: makeHash()
};

if (process.argv.length > 2) {
    options.tests = process.argv.slice(2).filter((value, index, self) => { return self.indexOf(value) === index; }) || [];
    options.recycleMap = checkParameter(options, '--recycle-map');
    options.report = checkParameter(options, '--report');
    options.seed = checkValueParameter(options, options.seed, '--seed');
}

mockXhr();

const directory = path.join(__dirname);
const testStyles = getTestStyles(options, directory);
let index = 0;
for (const style of testStyles) {
    try {
        //@ts-ignore
        const data = await getImageFromStyle(style);
        compareRenderResults(directory, style.metadata.test, data);
    } catch (ex) {
        style.metadata.test.error = ex;
    }
    printProgress(style.metadata.test, testStyles.length, ++index);
}

const tests = testStyles.map(s => s.metadata.test).filter(t => !!t);
const testStats: TestStats = {
    total: tests.length,
    errored: tests.filter(t => t.error),
    failed: tests.filter(t => !t.error && !t.ok),
    passed: tests.filter(t => !t.error && t.ok)
};

if (process.env.UPDATE) {
    console.log(`Updated ${testStyles.length} tests.`);
    process.exit(0);
}

const success = printStatistics(testStats);

function getReportItem(test: TestData) {
    let status: 'errored' | 'failed';

    if (test.error) {
        status = 'errored';
    } else {
        status = 'failed';
    }

    return `<div class="test">
    <h2>${test.id}</h2>
    ${status !== 'errored' ? `
        <img width="${test.width}" height="${test.height}" src="data:image/png;base64,${test.actual}" data-alt-src="data:image/png;base64,${test.expected}">
        <img style="width: ${test.width}; height: ${test.height}" src="data:image/png;base64,${test.diff}">` : ''
}
    ${test.error ? `<p style="color: red"><strong>Error:</strong> ${test.error.message}</p>` : ''}
    ${test.difference ? `<p class="diff"><strong>Diff:</strong> ${test.difference}</p>` : ''}
</div>`;
}

if (options.report) {
    const erroredItems = testStats.errored.map(t => getReportItem(t));
    const failedItems = testStats.failed.map(t => getReportItem(t));

    let resultData: string;

    if (erroredItems.length || failedItems.length) {
        resultData = `
    <div class="tests failed">
        <h1 style="color: red"><button id="toggle-failed">Toggle</button> Failed Tests (${failedItems.length})</h1>
        ${failedItems.join('\n')}
    </div>

    <div class="tests errored">
        <h1 style="color: black"><button id="toggle-errored">Toggle</button> Errored Tests (${erroredItems.length})</h1>
        ${erroredItems.join('\n')}
    </div>

    <script>
        document.addEventListener('mouseover', handleHover);
        document.addEventListener('mouseout', handleHover);

        function handleHover(e) {
            var el = e.target;
            if (el.tagName === 'IMG' && el.dataset.altSrc) {
                var tmp = el.src;
                el.src = el.dataset.altSrc;
                el.dataset.altSrc = tmp;
            }
        }

        document.getElementById('toggle-failed').addEventListener('click', function (e) {
            for (const row of document.querySelectorAll('.tests.failed .test')) {
                row.classList.toggle('hide');
            }
        });
        document.getElementById('toggle-errored').addEventListener('click', function (e) {
            for (const row of document.querySelectorAll('.tests.errored .test.')) {
                row.classList.toggle('hide');
            }
        });
    </script>`;
    } else {
        resultData = '<h1 style="color: green">All tests passed!</h1>';
    }

    const resultsContent = `
<!doctype html>
<html lang="en">
<head>
<title>Render Test Results</title>
<style>
    body {
        font: 18px/1.2 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
        padding: 10px;
    }
    h1 {
        font-size: 32px;
        margin-bottom: 0;
    }
    button {
        vertical-align: middle;
    }
    h2 {
        font-size: 24px;
        font-weight: normal;
        margin: 10px 0 10px;
        line-height: 1;
    }
    img {
        margin: 0 10px 10px 0;
        border: 1px dotted #ccc;
    }
    .stats {
        margin-top: 10px;
    }
    .test {
        border-bottom: 1px dotted #bbb;
        padding-bottom: 5px;
    }
    .tests {
        border-top: 1px dotted #bbb;
        margin-top: 10px;
    }
    .diff {
        color: #777;
    }
    .test p, .test pre {
        margin: 0 0 10px;
    }
    .test pre {
        font-size: 14px;
    }
    .label {
        color: white;
        font-size: 18px;
        padding: 2px 6px 3px;
        border-radius: 3px;
        margin-right: 3px;
        vertical-align: bottom;
        display: inline-block;
    }
    .hide {
        display: none;
    }
</style>
</head>

<body>
${resultData}
</body>
</html>
`;

    const p = path.join(__dirname, options.recycleMap ? 'results-recycle-map.html' : 'results.html');
    fs.writeFileSync(p, resultsContent, 'utf8');
    console.log(`Results logged to '${p}'`);
}

process.exit(success ? 0 : 1);
