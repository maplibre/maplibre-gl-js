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

test('pixel ratio defaults to devicePixelRatio', () => {
    const map = createMap();
    expect(map.getPixelRatio()).toBe(devicePixelRatio);
});

test('pixel ratio by default reflects devicePixelRatio changes', () => {
    global.devicePixelRatio = 0.25;
    const map = createMap();
    expect(map.getPixelRatio()).toBe(0.25);
    global.devicePixelRatio = 1;
    expect(map.getPixelRatio()).toBe(1);
});

test('painter has the expected size and pixel ratio', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    const map = createMap({container, pixelRatio: 2});
    expect(map.painter.pixelRatio).toBe(2);
    expect(map.painter.width).toBe(1024);
    expect(map.painter.height).toBe(1024);
});

test('canvas has the expected size', () => {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    const map = createMap({container, pixelRatio: 2});
    expect(map.getCanvas().width).toBe(1024);
    expect(map.getCanvas().height).toBe(1024);
});

describe('setPixelRatio', () => {
    test('resizes canvas', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        const map = createMap({container, pixelRatio: 1});
        expect(map.getCanvas().width).toBe(512);
        expect(map.getCanvas().height).toBe(512);
        map.setPixelRatio(2);
        expect(map.getCanvas().width).toBe(1024);
        expect(map.getCanvas().height).toBe(1024);
    });

    test('resizes painter', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'clientWidth', {value: 512});
        Object.defineProperty(container, 'clientHeight', {value: 512});
        const map = createMap({container, pixelRatio: 1});
        expect(map.painter.pixelRatio).toBe(1);
        expect(map.painter.width).toBe(512);
        expect(map.painter.height).toBe(512);
        map.setPixelRatio(2);
        expect(map.painter.pixelRatio).toBe(2);
        expect(map.painter.width).toBe(1024);
        expect(map.painter.height).toBe(1024);
    });
});

describe('getPixelRatio', () => {
    test('returns the pixel ratio', () => {
        const map = createMap({pixelRatio: 1});
        expect(map.getPixelRatio()).toBe(1);
        map.setPixelRatio(2);
        expect(map.getPixelRatio()).toBe(2);
    });
});
