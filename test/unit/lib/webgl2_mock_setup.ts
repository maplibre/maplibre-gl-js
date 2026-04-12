import {NullWebGL2RenderingContext} from '../../../src/util/test/null_gl';

(globalThis as any).WebGL2RenderingContext = NullWebGL2RenderingContext;

const _originalGetContext = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = function (type: string, attributes?: any): any {
    if (type === 'webgl2') {
        const key = '__nullWebGL2Context';
        if (this[key]) return this[key];
        const ctx = new NullWebGL2RenderingContext(this, attributes);
        this[key] = ctx;
        return ctx;
    }
    return _originalGetContext.call(this, type, attributes);
} as any;
