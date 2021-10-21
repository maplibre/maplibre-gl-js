import Map from '../../ui/map';
import {extend} from '../../util/util';
import gl from 'gl';

export function createMap(options, callback) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        style: {
            'version': 8,
            'sources': {},
            'layers': []
        }
    };

    Object.defineProperty(container, 'clientWidth', {value: 200, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});

    if (options && options.deleteStyle) delete defaultOptions.style;

    const map = new Map(extend(defaultOptions, options));
    if (callback) map.on('load', () => {
        callback(null, map);
    });

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return test.equal(expectedRounded, actualRounded, message, extra);
}

// Add webgl context with the supplied GL
export function setWebGlContext () {
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
}
