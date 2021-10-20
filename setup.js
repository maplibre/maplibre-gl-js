import gl from 'gl';

window.performance.mark = () => { };

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
