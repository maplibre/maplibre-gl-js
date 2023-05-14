import Map from '../../ui/map';
import {extend} from '../../util/util';
import Dispatcher from '../../util/dispatcher';
import gl from 'gl';

export function createMap(options?, callback?) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        maplibreLogo: false,
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

export function setupMockWebGLContext(webglContext: any) {

    const mockVaoExtension = {
        bindVertexArrayOES: jest.fn(),
        deleteVertexArrayOES: jest.fn(),
        createVertexArrayOES: jest.fn(),
    };

    const mockColorBufferExtension = {
        RGB16F_EXT: jest.fn(),
    };

    const mockTextureHalfFloatExtension = {
        HALF_FLOAT_OES: jest.fn(),
    };

    // Setup getExtension to return the correct mock extension
    webglContext.getExtension = jest.fn((extensionName) => {
        switch (extensionName) {
            case 'OES_vertex_array_object':
                return mockVaoExtension;
            case 'EXT_color_buffer_half_float':
                return mockColorBufferExtension;
            case 'OES_texture_half_float':
                return mockTextureHalfFloatExtension;
            default:
                return null;
        }
    });

    // Define the properties on the WebGL context
    Object.defineProperty(webglContext, 'bindVertexArray', {
        get() {
            const extension = this.getExtension('OES_vertex_array_object');
            return extension ? extension.bindVertexArrayOES : undefined;
        },
    });

    Object.defineProperty(webglContext, 'RGB16F', {
        get() {
            const extension = this.getExtension('EXT_color_buffer_half_float');
            return extension ? extension.RGB16F_EXT : undefined;
        },
    });

    Object.defineProperty(webglContext, 'HALF_FLOAT', {
        get() {
            const extension = this.getExtension('OES_texture_half_float');
            return extension ? extension.HALF_FLOAT_OES : undefined;
        },
    });

    Object.defineProperty(webglContext, 'deleteVertexArray', {
        get() {
            const extension = this.getExtension('OES_vertex_array_object');
            return extension ? extension.deleteVertexArrayOES : undefined;
        },
    });

    Object.defineProperty(webglContext, 'createVertexArray', {
        get() {
            const extension = this.getExtension('OES_vertex_array_object');
            return extension ? extension.createVertexArrayOES : undefined;
        },
    });

}

// Add webgl context with the supplied GL
function setWebGlContext() {
    const originalGetContext = global.HTMLCanvasElement.prototype.getContext;

    function imitateWebGlGetContext(type, attributes) {
        if (type === 'webgl2' || type === 'webgl') {
            if (!this._webGLContext) {
                this._webGLContext = gl(this.width, this.height, attributes);
                if (!this._webGLContext) {
                    throw new Error('Failed to create a WebGL context');
                }
            }

            setupMockWebGLContext(this._webGLContext);

            return this._webGLContext;
        }
        // Fallback to existing HTMLCanvasElement getContext behaviour
        return originalGetContext.call(this, type, attributes);
    }
    global.HTMLCanvasElement.prototype.getContext = imitateWebGlGetContext;
}

// mock failed webgl context by dispatching "webglcontextcreationerror" event
// and returning null
export function setErrorWebGlContext() {
    const originalGetContext = global.HTMLCanvasElement.prototype.getContext;

    function imitateErrorWebGlGetContext(type, attributes) {
        if (type === 'webgl2' || type === 'webgl') {
            const errorEvent = new Event('webglcontextcreationerror');
            (errorEvent as any).statusMessage = 'mocked webglcontextcreationerror message';
            this.dispatchEvent(errorEvent);
            return null;
        }
        // Fallback to existing HTMLCanvasElement getContext behaviour
        return originalGetContext.call(this, type, attributes);
    }
    global.HTMLCanvasElement.prototype.getContext = imitateErrorWebGlGetContext;
}

export function setPerformance() {
    window.performance.mark = jest.fn();
    window.performance.clearMeasures = jest.fn();
    window.performance.clearMarks = jest.fn();
}

export function setMatchMedia() {
    // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(), // deprecated
            removeListener: jest.fn(), // deprecated
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
}

function setResizeObserver() {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
    }));
}

export function beforeMapTest() {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
    setResizeObserver();
}

export function getWrapDispatcher() {
    const wrapDispatcher = (dispatcher) => {
        return {
            getActor() {
                return dispatcher;
            }
        } as any as Dispatcher;
    };

    return wrapDispatcher;
}

export function getMockDispatcher() {
    const wrapDispatcher = getWrapDispatcher();

    const mockDispatcher = wrapDispatcher({
        send() {}
    });

    return mockDispatcher;
}

export function stubAjaxGetImage(createImageBitmap) {
    global.createImageBitmap = createImageBitmap;

    global.URL.revokeObjectURL = () => {};
    global.URL.createObjectURL = (_) => { return null; };

    // eslint-disable-next-line accessor-pairs
    Object.defineProperty(global.Image.prototype, 'src', {
        set(url: string) {
            if (url === 'error') {
                this.onerror();
            } else this.onload();
        }
    });
}
