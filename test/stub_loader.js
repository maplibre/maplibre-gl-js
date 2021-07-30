import gl from 'gl';
import { JSDOM, VirtualConsole } from "jsdom"


// The following is the mocking of what's needed in window and global for the tests to run.
const { window } = new JSDOM('', {
    // Send jsdom console output to the node console object.
    virtualConsole: new VirtualConsole().sendTo(console)
});

global.ImageData = window.ImageData || function () { return false; };
global.ImageBitmap = window.ImageBitmap || function () { return false; };
global.WebGLFramebuffer = window.WebGLFramebuffer || Object;
global.HTMLCanvasElement = function () {};
global.HTMLElement = window.HTMLElement;
global.HTMLImageElement = window.HTMLImageElement;
global.HTMLVideoElement = window.HTMLVideoElement;
global.HTMLCanvasElement = window.HTMLCanvasElement;
global.OffscreenCanvas = window.OffscreenCanvas;
global.Image = window.Image;
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

global.requestAnimationFrame = function (callback) {
    return setImmediate(callback, 0);
};
global.cancelAnimationFrame = clearImmediate;

// Add webgl context with the supplied GL
const originalGetContext = global.HTMLCanvasElement.prototype.getContext;
global.HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    if (type === 'webgl') {
        if (!this._webGLContext) {
            this._webGLContext = gl(this.width, this.height, attributes);
        }
        return this._webGLContext;
    }
    // Fallback to existing HTMLCanvasElement getContext behaviour
    return originalGetContext.call(this, type, attributes);
};

// HM TODO: move this to the relevat test...
window.useFakeHTMLCanvasGetContext = function () {
    this.HTMLCanvasElement.prototype.getContext = function () { return '2d'; };
};

// HM TODO: move this to the relevat test...
window.useFakeXMLHttpRequest = function () {
    sinon.xhr.supportsCORS = true;
    this.server = sinon.fakeServer.create();
    this.XMLHttpRequest = this.server.xhr;
};

global.URL.createObjectURL = () => 'blob:';
global.URL.revokeObjectURL = function () { };

window.fakeWorkerPresence = function () {
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

// HM TODO: accurate this to context and stuff
global.getImageData = function({width, height, data}, padding = 0) {
    const source = new Uint8Array(data);
    const dest = new Uint8Array((2 * padding + width) * (2 * padding + height) * 4);

    const offset = (2 * padding + width) * padding + padding;
    for (let i = 0; i < height; i++) {
        dest.set(source.slice(i * width * 4, (i + 1) * width * 4), 4 * (offset + (width + 2 * padding) * i));
    }
    return {width: width + 2 * padding, height: height + 2 * padding, data: dest};
};

