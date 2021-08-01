import gl from 'gl';
import { JSDOM, VirtualConsole } from "jsdom";
import { PNG } from 'pngjs';
import sinon from 'sinon';

let lastDataFroUrl = null;

// The following is the mocking of what's needed in window and global for the tests to run.
const { window } = new JSDOM('', {
    // Send jsdom console output to the node console object.
    virtualConsole: new VirtualConsole().sendTo(console)
});

global.ImageData = window.ImageData || function () { return false; };
global.ImageBitmap = window.ImageBitmap || function () { return false; };
global.WebGLFramebuffer = window.WebGLFramebuffer || Object;
global.HTMLElement = window.HTMLElement;
global.HTMLImageElement = window.HTMLImageElement;
global.HTMLVideoElement = window.HTMLVideoElement;
global.HTMLCanvasElement = window.HTMLCanvasElement;
global.OffscreenCanvas = window.OffscreenCanvas;
global.Image = window.Image;
global.navigator = window.navigator;
// stubbing image load as it is not implemented in jsdom
Object.defineProperty(global.Image.prototype, 'src', {
    set(src) {
        if (lastDataFroUrl) {
            const reader = new window.FileReader();
            reader.onload = (_) => {
                const dataUrl = reader.result;
                new PNG().parse(dataUrl, (err, png) => {
                    this.data = png.data;
                    this.height = png.height;
                    this.width = png.width;
                    setTimeout(() => this.onload());
                });
            }
            reader.readAsArrayBuffer(lastDataFroUrl);
        }
    }
});
global.Blob = window.Blob;
global.URL = window.URL;
global.fetch = window.fetch;
global.document = window.document;
global.window = window;

// Delete local and session storage from JSDOM and stub them out with a warning log
// Accessing these properties during extend() produces an error in Node environments
// See https://github.com/mapbox/mapbox-gl-js/pull/7455 for discussion
delete window.localStorage;
delete window.sessionStorage;
window.localStorage = window.sessionStorage = () => console.log('Local and session storage not available in Node. Use a stub implementation if needed for testing.');

window.devicePixelRatio = 1;

global.requestAnimationFrame = window.requestAnimationFrame = function (callback) {
    return setImmediate(callback, 0);
};
global.cancelAnimationFrame = clearImmediate;

// Add webgl context with the supplied GL
const originalGetContext = global.HTMLCanvasElement.prototype.getContext;

function imitateWebGlGetContext(type, attributes) {
    if (type === 'webgl') {
        if (!this._webGLContext) {
            this._webGLContext = gl(this.width, this.height, attributes);
        }
        return this._webGLContext;
    }
    // Fallback to existing HTMLCanvasElement getContext behaviour
    return originalGetContext.call(this, type, attributes);
}
global.HTMLCanvasElement.prototype.getContext = imitateWebGlGetContext;

// HM TODO: move this to the relevat test...
window.useFakeHTMLCanvasGetContext = function () {
    this.HTMLCanvasElement.prototype.getContext = () =>  { return '2d'; };
};

window.clearFakeHTMLCanvasGetContext = () => {
    global.HTMLCanvasElement.prototype.getContext = imitateWebGlGetContext;
}

// HM TODO: move this to the relevat test...
window.useFakeXMLHttpRequest = function () {
    sinon.xhr.supportsCORS = true;
    this.server = sinon.fakeServer.create();
    global.XMLHttpRequest = this.server.xhr;
};

window.clearFakeXMLHttpRequest = () => {
    window.server = null;
    global.XMLHttpRequest = null;
}

global.URL.createObjectURL = (blob) => {
    lastDataFroUrl = blob;
    return 'blob:';
}
global.URL.revokeObjectURL = function () {
    lastDataFroUrl = null;
};

window.useFakeWorkerPresence = function () {
    global.WorkerGlobalScope = function () { };
    global.self = new global.WorkerGlobalScope();
};
window.clearFakeWorkerPresence = function () {
    global.WorkerGlobalScope = undefined;
    global.self = undefined;
};


window.performance.getEntriesByName = function () { };
window.performance.mark = function () { };
window.performance.measure = function () { };
window.performance.clearMarks = function () { };
window.performance.clearMeasures = function () { };