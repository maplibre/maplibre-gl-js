import {PNG} from 'pngjs';
import maplibregl from '../../../src/index';
import browser from '../../../src/util/browser';
import * as rtlTextPluginModule from '../../../src/source/rtl_text_plugin';
import rtlText from '@mapbox/mapbox-gl-rtl-text';
import fs from 'fs';
import path, {dirname} from 'path';
import customLayerImplementations from './custom_layer_implementations';
import {fileURLToPath} from 'url';
import '../../unit/lib/web_worker_mock';
import type Map from '../../../src/ui/map';
import CanvasSource from '../../../src/source/canvas_source';
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

let now = 0;
const {plugin: rtlTextPlugin} = rtlTextPluginModule;

rtlTextPlugin['applyArabicShaping'] = rtlText.applyArabicShaping;
rtlTextPlugin['processBidirectionalText'] = rtlText.processBidirectionalText;
rtlTextPlugin['processStyledBidirectionalText'] = rtlText.processStyledBidirectionalText;

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

function applyOperations(options, map: Map & { _render: () => void}, operations: any[], callback: Function) {
    const operation = operations && operations[0];
    if (!operations || operations.length === 0) {
        callback();

    } else if (operation[0] === 'wait') {
        if (operation.length > 1) {
            now += operation[1];
            map._render();
            applyOperations(options, map, operations.slice(1), callback);

        } else {
            const wait = function() {
                if (map.loaded()) {
                    applyOperations(options, map, operations.slice(1), callback);
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
            applyOperations(options, map, operations.slice(1), callback);
        }, operation[1]);
    } else if (operation[0] === 'addImage') {
        const {data, width, height} = PNG.sync.read(fs.readFileSync(path.join(__dirname, '../assets', operation[2])));
        map.addImage(operation[1], {width, height, data: new Uint8Array(data)}, operation[3] || {});
        applyOperations(options, map, operations.slice(1), callback);
    } else if (operation[0] === 'addCustomLayer') {
        map.addLayer(new customLayerImplementations[operation[1]](), operation[2]);
        map._render();
        applyOperations(options, map, operations.slice(1), callback);
    } else if (operation[0] === 'updateFakeCanvas') {
        const canvasSource = map.getSource(operation[1]) as CanvasSource;
        canvasSource.play();
        // update before pause should be rendered
        updateFakeCanvas(window.document, options.addFakeCanvas.id, operation[2]);
        canvasSource.pause();
        // update after pause should not be rendered
        updateFakeCanvas(window.document, options.addFakeCanvas.id, operation[3]);
        map._render();
        applyOperations(options, map, operations.slice(1), callback);
    } else if (operation[0] === 'setStyle') {
        // Disable local ideograph generation (enabled by default) for
        // consistent local ideograph rendering using fixtures in all runs of the test suite.
        map.setStyle(operation[1], {localIdeographFontFamily: false as any});
        applyOperations(options, map, operations.slice(1), callback);
    } else if (operation[0] === 'pauseSource') {
        map.style.sourceCaches[operation[1]].pause();
        applyOperations(options, map, operations.slice(1), callback);
    } else {
        if (typeof map[operation[0]] === 'function') {
            map[operation[0]](...operation.slice(1));
        }
        applyOperations(options, map, operations.slice(1), callback);
    }
}

export default function render(style, _callback) {
    const options = style.metadata.test;
    let wasCallbackCalled = false;

    const timeout = setTimeout(() => {
        callback(new Error('Test timed out'));
    }, options.timeout || 20000);

    function callback(...args) {
        if (!wasCallbackCalled) {
            clearTimeout(timeout);
            wasCallbackCalled = true;
            _callback(...args);
        }
    }

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
        pixelRatio: options.pixelRatio,
        preserveDrawingBuffer: true,
        axonometric: options.axonometric || false,
        skew: options.skew || [0, 0],
        fadeDuration: options.fadeDuration || 0,
        localIdeographFontFamily: options.localIdeographFontFamily || false,
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

            const results = options.queryGeometry ?
                map.queryRenderedFeatures(options.queryGeometry, options.queryOptions || {}) :
                [];

            map.remove();
            gl.getExtension('STACKGL_destroy_context').destroy();
            delete map.painter.context.gl;

            if (options.addFakeCanvas) {
                const fakeCanvas = window.document.getElementById(options.addFakeCanvas.id);
                fakeCanvas.parentNode.removeChild(fakeCanvas);
            }

            callback(null, data, results.map((feature) => {
                feature = feature.toJSON();
                delete feature.layer;
                return feature;
            }));

        });
    });

}
