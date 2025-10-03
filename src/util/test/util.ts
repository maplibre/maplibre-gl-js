import {vi, expect} from 'vitest';
import {Map} from '../../ui/map';
import {extend} from '../../util/util';
import {type Dispatcher} from '../../util/dispatcher';
import {type IActor} from '../actor';
import {Evented} from '../evented';
import {type SourceSpecification, type StyleSpecification, type TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import {MercatorTransform} from '../../geo/projection/mercator_transform';
import {RequestManager} from '../request_manager';
import {type IReadonlyTransform, type ITransform} from '../../geo/transform_interface';
import {type Style} from '../../style/style';
import {type Terrain} from '../../render/terrain';
import {Frustum} from '../primitives/frustum';
import {mat4} from 'gl-matrix';

export class StubMap extends Evented {
    style: Style;
    transform: IReadonlyTransform;
    private _requestManager: RequestManager;
    _terrain: TerrainSpecification;

    constructor() {
        super();
        this.transform = new MercatorTransform();
        this._requestManager = new RequestManager();
    }

    _getMapId() {
        return 1;
    }

    getPixelRatio() {
        return 1;
    }

    setTerrain(terrain) { this._terrain = terrain; }
    getTerrain() { return this._terrain; }

    migrateProjection(newTransform: ITransform) {
        newTransform.apply(this.transform);
        this.transform = newTransform;
    }
}

export function createMap(options?) {
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

    if (options?.deleteStyle) delete defaultOptions.style;

    const map = new Map(extend(defaultOptions, options));

    return map;
}

export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;

    return test.equal(expectedRounded, actualRounded, message, extra);
}

export function setPerformance() {
    window.performance.mark = vi.fn();
    window.performance.clearMeasures = vi.fn();
    window.performance.clearMarks = vi.fn();
}

export function setMatchMedia() {
    // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

function setResizeObserver() {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    }));
}

export function beforeMapTest() {
    setPerformance();
    setMatchMedia();
    setResizeObserver();
    // remove the following when the following is merged and released: https://github.com/Adamfsk/jest-webgl-canvas-mock/pull/5
    (WebGLRenderingContext.prototype as any).bindVertexArray = WebGLRenderingContext.prototype.getExtension('OES_vertex_array_object').bindVertexArrayOES;
    (WebGLRenderingContext.prototype as any).createVertexArray = WebGLRenderingContext.prototype.getExtension('OES_vertex_array_object').createVertexArrayOES;
    if (!WebGLRenderingContext.prototype.drawingBufferHeight && !WebGLRenderingContext.prototype.drawingBufferWidth) {
        Object.defineProperty(WebGLRenderingContext.prototype, 'drawingBufferWidth', {
            get: vi.fn(),
            configurable: true,
        });
        Object.defineProperty(WebGLRenderingContext.prototype, 'drawingBufferHeight', {
            get: vi.fn(),
            configurable: true,
        });
    }
}

export function getWrapDispatcher() {
    const wrapDispatcher = (actor: IActor) => {
        return {
            getActor() {
                return actor;
            }
        } as any as Dispatcher;
    };

    return wrapDispatcher;
}

export function getMockDispatcher() {
    const wrapDispatcher = getWrapDispatcher();

    const mockDispatcher = wrapDispatcher({
        sendAsync() { return Promise.resolve({}); },
    });

    return mockDispatcher;
}

export function stubAjaxGetImage(createImageBitmap) {
    global.createImageBitmap = createImageBitmap;

    global.URL.revokeObjectURL = () => {};
    global.URL.createObjectURL = (_) => { return null; };

    Object.defineProperty(global.Image.prototype, 'src', {
        set(url: string) {
            if (url === 'error') {
                this.onerror();
            } else if (this.onload) {
                this.onload();
            }
        }
    });
}

/**
 * This should be used in test that use nise since the internal buffer returned from a file is not an instance of ArrayBuffer for some reason.
 * @param data - the data read from a file, for example by `fs.readFileSync(...)`
 * @returns a copy of the data in the file in `ArrayBuffer` format
 */
export function bufferToArrayBuffer(data: Buffer): ArrayBuffer {
    const newBuffer = new ArrayBuffer(data.buffer.byteLength);
    const view = new Uint8Array(newBuffer);
    data.copy(view);
    return view.buffer;
}

/**
 * This allows test to wait for a certain amount of time before continuing.
 * @param milliseconds - the amount of time to wait in milliseconds
 * @returns - a promise that resolves after the specified amount of time
 */
export const sleep = (milliseconds: number = 0) => {
    return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
};

export function waitForMetadataEvent(source: Evented): Promise<void> {
    return new Promise((resolve) => {
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                resolve();
            }
        });
    });
}

export function createStyleSource() {
    return {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    } as SourceSpecification;
}

export function createStyle(): StyleSpecification {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {},
        layers: []
    };
}

export function expectToBeCloseToArray(actual: Array<number>, expected: Array<number>, precision?: number) {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], precision);
    }
}

export function createTerrain(): Terrain {
    return {
        pointCoordinate: () => null,
        getElevationForLngLatZoom: () => 1000,
        getMinTileElevationForLngLatZoom: () => 0,
        getFramebuffer: () => ({}),
        getCoordsTexture: () => ({}),
        depthAtPoint: () => .9,
        sourceCache: {
            update: () => {},
            getRenderableTiles: () => [],
            anyTilesAfterTime: () => false
        }
    } as any as Terrain;
}

export function createFramebuffer() {
    return {
        colorAttachment: {
            get: () => null,
            set: () => {}
        },
        depthAttachment: {
            get: () => null,
            set: () => {}
        },
        destroy: () => {}
    };
}

export function waitForEvent(evented: Evented, eventName: string, predicate: (e: any) => boolean): Promise<any> {
    return new Promise((resolve) => {
        const listener = (e: Event) => {
            if (predicate(e)) {
                resolve(e);
            }
        };
        evented.on(eventName, listener);
    });
}

export function createTestCameraFrustum(fovy: number, aspectRatio: number, zNear: number, zFar: number, elevation: number, rotation: number): Frustum {
    const proj = new Float64Array(16) as any as mat4;
    const invProj = new Float64Array(16) as any as mat4;

    // Note that left handed coordinate space is used where z goes towards the sky.
    // Y has to be flipped as well because it's part of the projection/camera matrix used in transform.js
    mat4.perspective(proj, fovy, aspectRatio, zNear, zFar);
    mat4.scale(proj, proj, [1, -1, 1]);
    mat4.translate(proj, proj, [0, 0, elevation]);
    mat4.rotateZ(proj, proj, rotation);
    mat4.invert(invProj, proj);

    return Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);
}
