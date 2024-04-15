import {Map, MapOptions} from '../map';
import {createMap, beforeMapTest, sleep, createStyle, createStyleSource} from '../../util/test/util';
import {LngLat} from '../../geo/lng_lat';
import {Tile} from '../../source/tile';
import {OverscaledTileID} from '../../source/tile_id';
import {Event as EventedEvent, ErrorEvent} from '../../util/evented';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../../test/unit/lib/fixed';
import {GeoJSONSourceSpecification, LayerSpecification, SourceSpecification, StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {RequestTransformFunction} from '../../util/request_manager';
import {extend} from '../../util/util';
import {LngLatBoundsLike} from '../../geo/lng_lat_bounds';
import {IControl} from '../control/control';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import {fakeServer, FakeServer} from 'nise';
import {CameraOptions} from '../camera';
import {Terrain} from '../../render/terrain';
import {mercatorZfromAltitude} from '../../geo/mercator_coordinate';
import {Transform} from '../../geo/transform';
import {StyleImageInterface} from '../../style/style_image';
import {Style} from '../../style/style';
import {MapSourceDataEvent} from '../events';
import {config} from '../../util/config';
import {MessageType} from '../../util/actor_messages';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('Max Canvas Size option', () => {
    test('maxCanvasSize width = height', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
        const map = createMap({container, maxCanvasSize: [8192, 8192], pixelRatio: 5});
        map.resize();
        expect(map.getCanvas().width).toBe(8192);
        expect(map.getCanvas().height).toBe(8192);
    });

    test('maxCanvasSize width != height', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 1024});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(8192);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(4096);
        const map = createMap({container, maxCanvasSize: [8192, 4096], pixelRatio: 3});
        map.resize();
        expect(map.getCanvas().width).toBe(2048);
        expect(map.getCanvas().height).toBe(4096);
    });

    test('maxCanvasSize below clientWidth and clientHeigth', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 12834});
        Object.defineProperty(container, 'clientHeight', {value: 9000});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(4096);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(8192);
        const map = createMap({container, maxCanvasSize: [4096, 8192], pixelRatio: 1});
        map.resize();
        expect(map.getCanvas().width).toBe(4096);
        expect(map.getCanvas().height).toBe(2872);
    });

    test('maxCanvasSize with setPixelRatio', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 2048});
        Object.defineProperty(container, 'clientHeight', {value: 2048});
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferWidth', 'get').mockReturnValue(3072);
        jest.spyOn(WebGLRenderingContext.prototype, 'drawingBufferHeight', 'get').mockReturnValue(3072);
        const map = createMap({container, maxCanvasSize: [3072, 3072], pixelRatio: 1.25});
        map.resize();
        expect(map.getCanvas().width).toBe(2560);
        expect(map.getCanvas().height).toBe(2560);
        map.setPixelRatio(2);
        expect(map.getCanvas().width).toBe(3072);
        expect(map.getCanvas().height).toBe(3072);
    });
});
