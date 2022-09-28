import path, {dirname} from 'path';
import fs from 'fs';
import gl from 'gl';
import {JSDOM, VirtualConsole} from 'jsdom';
import {PNG} from 'pngjs';
import {fileURLToPath} from 'url';
import '../../unit/lib/web_worker_mock';
// @ts-ignore
const __dirname = dirname(fileURLToPath(import.meta.url));

let lastDataFromUrl = null;

// The following is the mocking of what's needed in window and global for the tests to run.
const {window} = new JSDOM('', {
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
global.HTMLSourceElement = window.HTMLSourceElement;
global.OffscreenCanvas = window.OffscreenCanvas;
global.Image = window.Image;
global.navigator = window.navigator;
global.performance = window.performance;
global.devicePixelRatio = window.devicePixelRatio;
global.addEventListener = window.addEventListener;
global.removeEventListener = window.removeEventListener;
global.matchMedia = window.matchMedia;
global.caches = window.caches;
global.WheelEvent = window.WheelEvent;
global.Blob = window.Blob;
global.URL = window.URL;
global.fetch = window.fetch;
global.document = window.document;
//@ts-ignore
global.window = window;
// stubbing image load as it is not implemented in jsdom
// eslint-disable-next-line accessor-pairs
Object.defineProperty(global.Image.prototype, 'src', {
    set(src) {
        if (!this.onload) {
            return;
        }
        if (src.startsWith('data:image/png')) {
            const base64 = src.replace(/data:.*;base64,/, '');
            const buff = Buffer.from(base64, 'base64');
            const png = PNG.sync.read(buff);
            this.data = png.data;
            this.height = png.height;
            this.width = png.width;
            this.onload();
            return;
        }
        if (src && typeof src === 'string' && !src.startsWith('blob')) {
            this.onload();
            return;
        }
        if (!lastDataFromUrl) {
            return;
        }
        if (lastDataFromUrl.size < 10) {
            // if this is not a valid image load it anyway but don't set the data for later use
            // this is the case in the unit tests
            this.onload();
            return;
        }
        const reader = new window.FileReader();
        reader.onload = (_) => {
            const dataUrl = reader.result;
            new PNG().parse(dataUrl as any, (err, png) => {
                if (err) throw new Error('Couldn\'t parse PNG');
                this.data = png.data;
                this.height = png.height;
                this.width = png.width;
                this.onload();
            });
        };
        reader.readAsArrayBuffer(lastDataFromUrl);
    }
});

// This assumes that the code is using appendChild to add a source element to the video element.
// At this time the fake code will go to the server and get the "video".
// Hack: since node doesn't have any good video codec modules, just grab a png with
// the first frame and fake the video API.
HTMLVideoElement.prototype.appendChild = function(s: any) {
    if (!this.onloadstart) {
        return;
    }
    const relativePath = s.src.replace(/^http:\/\/localhost:(\d+)\//, '').replace(/\?.*/, '');
    const body = fs.readFileSync(path.join(__dirname, '../assets', relativePath));
    const png = PNG.sync.read(body);
    Object.defineProperty(this, 'readyState', {get: () => 4}); // HAVE_ENOUGH_DATA
    this.addEventListener = () => {};
    this.play = () => {};
    this.width = png.width;
    this.height =  png.height;
    this.data = png.data;
    this.onloadstart();
    return s;
};

//@ts-ignore
window.devicePixelRatio = 1;
//@ts-ignore
global.requestAnimationFrame = window.requestAnimationFrame = (callback) => {
    return setImmediate(callback, 0);
};
//@ts-ignore
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

global.URL.createObjectURL = (blob) => {
    lastDataFromUrl = blob;
    return 'blob:';
};

global.URL.revokeObjectURL = () => {
    lastDataFromUrl = null;
};

const performance = window.performance as any;
performance.getEntriesByName = () => { };
performance.mark = () => { };
performance.measure = () => { };
performance.clearMarks = () => { };
performance.clearMeasures = () => { };

