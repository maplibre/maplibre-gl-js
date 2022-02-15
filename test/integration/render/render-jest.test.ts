import canvas from 'canvas';
import ignores from './ignores.json';
import path from 'path';
import fs from 'fs';
import {PNG} from 'pngjs';
import glob from 'glob';
import pixelmatch from 'pixelmatch';
import localizeURLs from '../lib/localize-urls';
import Map from '../../../src/ui/map';
import browser from '../../../src/util/browser';
import * as rtlTextPluginModule from '../../../src/source/rtl_text_plugin';
import rtlText from '@mapbox/mapbox-gl-rtl-text';
import customLayerImplementations from './custom_layer_implementations';
import '../../unit/lib/web_worker_mock';
import {setPerformance, setWebGlContext} from '../../../src/util/test/util';
import {fakeXhr} from 'nise';
import {StyleSpecification} from '../../../src/style-spec/types';
import {PointLike} from '../../../src/ui/camera';
import CanvasSource from '../../../src/source/canvas_source';

const {registerFont} = canvas;

const PORT = 99999;

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

type StyleWithTestData = StyleSpecification & {
    metadata : {
        test: TestData;
    };
}

type RenderOptions = {
    tests: any[];
    ignores: {};
    shuffle: boolean;
    recycleMap: boolean;
    seed: string;
}

registerFont('./node_modules/npm-font-open-sans/fonts/Bold/OpenSans-Bold.ttf', {family: 'Open Sans', weight: 'bold'});

// https://stackoverflow.com/a/1349426/229714
function makeHash(): string {
    const array = [];
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 10; ++i)
        array.push(possible.charAt(Math.floor(Math.random() * possible.length)));

    // join array elements without commas.
    return array.join('');
}

function checkParameter(param: string, options: RenderOptions) {
    const index = options.tests.indexOf(param);
    if (index === -1)
        return false;
    options.tests.splice(index, 1);
    return true;
}

function checkValueParameter(defaultValue: any, param: string, options: RenderOptions) {
    const index = options.tests.findIndex((elem) => { return String(elem).startsWith(param); });
    if (index === -1)
        return defaultValue;

    const split = String(options.tests.splice(index, 1)).split('=');
    if (split.length !== 2)
        return defaultValue;

    return split[1];
}

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

function compareRenderResults(data: Buffer, style: StyleWithTestData) {
    const testData = style.metadata.test;
    const dir = path.join(__dirname, testData.id);
    try {
        // @ts-ignore
        const stats = fs.statSync(dir, fs.R_OK | fs.W_OK);
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
        return;
    }
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

function applyOperations(map: Map, operations: any[], options: TestData, callback: Function) {
    const operation = operations && operations[0];
    if (!operations || operations.length === 0) {
        callback();

    } else if (operation[0] === 'wait') {
        if (operation.length > 1) {
            now += operation[1];
            (map as any)._render();
            applyOperations(map, operations.slice(1), options, callback);

        } else {
            const wait = function() {
                if (map.loaded()) {
                    applyOperations(map, operations.slice(1), options, callback);
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
            applyOperations(map, operations.slice(1), options, callback);
        }, operation[1]);
    } else if (operation[0] === 'addImage') {
        const {data, width, height} = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets', operation[2])));
        map.addImage(operation[1], {width, height, data: new Uint8Array(data)}, operation[3] || {});
        applyOperations(map, operations.slice(1), options, callback);
    } else if (operation[0] === 'addCustomLayer') {
        map.addLayer(new customLayerImplementations[operation[1]](), operation[2]);
        (map as any)._render();
        applyOperations(map, operations.slice(1), options, callback);
    } else if (operation[0] === 'updateFakeCanvas') {
        const canvasSource = map.getSource(operation[1]) as CanvasSource;
        canvasSource.play();
        // update before pause should be rendered
        updateFakeCanvas(window.document, options.addFakeCanvas.id, operation[2]);
        canvasSource.pause();
        // update after pause should not be rendered
        updateFakeCanvas(window.document, options.addFakeCanvas.id, operation[3]);
        (map as any)._render();
        applyOperations(map, operations.slice(1), options, callback);
    } else if (operation[0] === 'setStyle') {
        // Disable local ideograph generation (enabled by default) for
        // consistent local ideograph rendering using fixtures in all runs of the test suite.
        map.setStyle(operation[1], {localIdeographFontFamily: false as any});
        applyOperations(map, operations.slice(1), options, callback);
    } else if (operation[0] === 'pauseSource') {
        map.style.sourceCaches[operation[1]].pause();
        applyOperations(map, operations.slice(1), options, callback);
    } else {
        if (typeof map[operation[0]] === 'function') {
            map[operation[0]](...operation.slice(1));
        }
        applyOperations(map, operations.slice(1), options, callback);
    }
}

function getRenderTestsStyles(options: RenderOptions): StyleWithTestData[] {
    const styles = [];
    const renderTestStyles = glob.sync('**/style.json', {cwd: __dirname});
    for (const renderTestStyle of renderTestStyles) {
        const id = path.dirname(renderTestStyle);
        if (ignores[`render/${id}`]) {
            continue;
        }
        const style = JSON.parse(fs.readFileSync(path.join(__dirname, renderTestStyle), 'utf8'));
        localizeURLs(style, PORT, path.join(__dirname, '../'), require);
        style.metadata = style.metadata || {};

        style.metadata.test = Object.assign({
            id,
            width: 512,
            height: 512,
            pixelRatio: 1,
            recycleMap: options.recycleMap || false,
            allowed: 0.00015
        }, style.metadata.test);

        styles.push(style);
    }
    return styles;
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

function runRenderingLogic(style: StyleWithTestData, _callback) {
    let wasCallbackCalled = false;
    const testData = style.metadata.test;
    // HM TODO: remove this...?
    const timeout = setTimeout(() => {
        callback(new Error('Test timed out'));
    }, testData.timeout || 20000);

    function callback(...args) {
        if (!wasCallbackCalled) {
            clearTimeout(timeout);
            wasCallbackCalled = true;
            _callback(...args);
        }
    }

    fakeXhr.useFakeXMLHttpRequest().onCreate = (req: any) => {
        setTimeout(() => {
            const relativePath = req.url.replace(/^http:\/\/localhost:(\d+)\//, '');
            let body: Buffer = null;
            try {
                if (relativePath.startsWith('mapbox-gl-styles')) {
                    body = fs.readFileSync(path.join(path.dirname(require.resolve('mapbox-gl-styles')), '..', relativePath));
                } else {
                    body = fs.readFileSync(path.join(__dirname, '../assets', relativePath));
                }
                req.response = body;
                req.setStatus(200);
                req.onload();
            } catch {
                req.setStatus(404); // file not found
                req.onload();
            }
        }, 0);
    };

    if (testData.addFakeCanvas) {
        const fakeCanvas = createFakeCanvas(window.document, testData.addFakeCanvas.id, testData.addFakeCanvas.image);
        window.document.body.appendChild(fakeCanvas);
    }

    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: testData.width});
    Object.defineProperty(container, 'clientHeight', {value: testData.height});

    const map = new Map({
        container,
        style,

        // @ts-ignore
        classes: testData.classes,
        interactive: false,
        attributionControl: false,
        pixelRatio: testData.pixelRatio,
        preserveDrawingBuffer: true,
        axonometric: testData.axonometric || false,
        skew: testData.skew || [0, 0],
        fadeDuration: testData.fadeDuration || 0,
        localIdeographFontFamily: testData.localIdeographFontFamily || false as any,
        crossSourceCollisions: typeof testData.crossSourceCollisions === 'undefined' ? true : testData.crossSourceCollisions
    });

    // Configure the map to never stop the render loop
    map.repaint = true;
    now = 0;
    browser.now = () => {
        return now;
    };

    if (testData.debug) map.showTileBoundaries = true;
    if (testData.showOverdrawInspector) map.showOverdrawInspector = true;
    if (testData.showPadding) map.showPadding = true;

    const gl = map.painter.context.gl;
    map.once('load', () => {
        if (testData.collisionDebug) {
            map.showCollisionBoxes = true;
            if (testData.operations) {
                testData.operations.push(['wait']);
            } else {
                testData.operations = [['wait']];
            }
        }
        applyOperations(map, testData.operations, testData, () => {
            const viewport = gl.getParameter(gl.VIEWPORT);
            const w = viewport[2];
            const h = viewport[3];

            const pixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            // eslint-disable-next-line new-cap
            const data = Buffer.from(pixels);

            // Flip the scanlines.
            const stride = w * 4;
            // eslint-disable-next-line new-cap
            const tmp = Buffer.alloc(stride);
            for (let i = 0, j = h - 1; i < j; i++, j--) {
                const start = i * stride;
                const end = j * stride;
                data.copy(tmp, 0, start, start + stride);
                data.copy(data, start, end, end + stride);
                tmp.copy(data, end);
            }

            const results = testData.queryGeometry ?
                map.queryRenderedFeatures(testData.queryGeometry, testData.queryOptions || {}) :
                [];

            map.remove();
            gl.getExtension('STACKGL_destroy_context').destroy();
            delete map.painter.context.gl;

            if (testData.addFakeCanvas) {
                const fakeCanvas = window.document.getElementById(testData.addFakeCanvas.id);
                fakeCanvas.parentNode.removeChild(fakeCanvas);
            }

            // HM TODO: is returning the feature needed?
            callback(null, data, results.map((feature) => {
                feature = feature.toJSON();
                delete feature.layer;
                return feature;
            }));

        });
    });
}

// @ts-ignore
let now = 0;

const {plugin: rtlTextPlugin} = rtlTextPluginModule;

rtlTextPlugin['applyArabicShaping'] = rtlText.applyArabicShaping;
rtlTextPlugin['processBidirectionalText'] = rtlText.processBidirectionalText;
rtlTextPlugin['processStyledBidirectionalText'] = rtlText.processStyledBidirectionalText;

const options: RenderOptions = {ignores, tests:[], shuffle:false, recycleMap:false, seed: makeHash()};
if (process.argv.length > 2) {
    options.tests = process.argv.slice(2).filter((value, index, self) => { return self.indexOf(value) === index; }) || [];
    options.shuffle = checkParameter('--shuffle', options);
    options.recycleMap = checkParameter('--recycle-map', options);
    options.seed = checkValueParameter(options.seed, '--seed', options);
}

describe('render tests', () => {
    beforeAll(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.setTimeout(20000);
        setWebGlContext();
        setPerformance();
        global.matchMedia = window.matchMedia;
        global.fetch = null;
        global.createImageBitmap = ((blob: Blob) => new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onload = (_) => {
                const buff = reader.result;
                const array = Buffer.from(buff as ArrayBuffer);
                const png = PNG.sync.read(array);
                resolve({
                    data: buff,
                    width: png.width,
                    height: png.height
                });
            };
            reader.readAsArrayBuffer(blob);
        })) as any;
    });
    const tests = getRenderTestsStyles(options);
    let index = 0;
    for (const style of tests) {
        // eslint-disable-next-line no-loop-func
        test(style.metadata.test.id, (done) => {
            runRenderingLogic(style, (err: Error, data: Buffer) => {
                if (err) {
                    done(err);
                    console.log(`${++index}/${tests.length} failed: ${style.metadata.test.id}`);
                    return;
                }
                if (!data) {
                    done('Empty data...');
                    console.log(`${++index}/${tests.length} failed: ${style.metadata.test.id}`);
                    return;
                }
                compareRenderResults(data, style);
                if (style.metadata.test.ok) {
                    console.log(`${++index}/${tests.length} passed: ${style.metadata.test.id}`);
                    done();
                } else {
                    done(`failed, check diff.png in ${style.metadata.test.id}`);
                    console.log(`${++index}/${tests.length} failed: ${style.metadata.test.id}`);
                }
            });
        });
    }
});
