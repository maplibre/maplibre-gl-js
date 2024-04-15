import {Map, MapOptions} from './map';
import {createMap, beforeMapTest, sleep, createStyle, createStyleSource} from '../util/test/util';
import {LngLat} from '../geo/lng_lat';
import {Tile} from '../source/tile';
import {OverscaledTileID} from '../source/tile_id';
import {Event as EventedEvent, ErrorEvent} from '../util/evented';
import simulate from '../../test/unit/lib/simulate_interaction';
import {fixedLngLat, fixedNum} from '../../test/unit/lib/fixed';
import {GeoJSONSourceSpecification, LayerSpecification, SourceSpecification, StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {RequestTransformFunction} from '../util/request_manager';
import {extend} from '../util/util';
import {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import {IControl} from './control/control';
import {EvaluationParameters} from '../style/evaluation_parameters';
import {fakeServer, FakeServer} from 'nise';
import {CameraOptions} from './camera';
import {Terrain} from '../render/terrain';
import {mercatorZfromAltitude} from '../geo/mercator_coordinate';
import {Transform} from '../geo/transform';
import {StyleImageInterface} from '../style/style_image';
import {Style} from '../style/style';
import {MapSourceDataEvent} from './events';
import {config} from '../util/config';
import {MessageType} from '../util/actor_messages';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

test('#setMinPitch', () => {
    const map = createMap({pitch: 20});
    map.setMinPitch(10);
    map.setPitch(0);
    expect(map.getPitch()).toBe(10);
});

test('unset minPitch', () => {
    const map = createMap({minPitch: 20});
    map.setMinPitch(null);
    map.setPitch(0);
    expect(map.getPitch()).toBe(0);
});

test('#getMinPitch', () => {
    const map = createMap({pitch: 0});
    expect(map.getMinPitch()).toBe(0);
    map.setMinPitch(10);
    expect(map.getMinPitch()).toBe(10);
});

test('ignore minPitchs over maxPitch', () => {
    const map = createMap({pitch: 0, maxPitch: 10});
    expect(() => {
        map.setMinPitch(20);
    }).toThrow();
    map.setPitch(0);
    expect(map.getPitch()).toBe(0);
});

test('#setMaxPitch', () => {
    const map = createMap({pitch: 0});
    map.setMaxPitch(10);
    map.setPitch(20);
    expect(map.getPitch()).toBe(10);
});

test('unset maxPitch', () => {
    const map = createMap({maxPitch: 10});
    map.setMaxPitch(null);
    map.setPitch(20);
    expect(map.getPitch()).toBe(20);
});

test('#getMaxPitch', () => {
    const map = createMap({pitch: 0});
    expect(map.getMaxPitch()).toBe(60);
    map.setMaxPitch(10);
    expect(map.getMaxPitch()).toBe(10);
});

test('ignore maxPitchs over minPitch', () => {
    const map = createMap({minPitch: 10});
    expect(() => {
        map.setMaxPitch(0);
    }).toThrow();
    map.setPitch(10);
    expect(map.getPitch()).toBe(10);
});

test('throw on maxPitch smaller than minPitch at init', () => {
    expect(() => {
        createMap({minPitch: 10, maxPitch: 5});
    }).toThrow(new Error('maxPitch must be greater than or equal to minPitch'));
});

test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', () => {
    expect(() => {
        createMap({minPitch: 1, maxPitch: 0});
    }).toThrow(new Error('maxPitch must be greater than or equal to minPitch'));
});

test('throw on maxPitch greater than valid maxPitch at init', () => {
    expect(() => {
        createMap({maxPitch: 90});
    }).toThrow(new Error('maxPitch must be less than or equal to 85'));
});

test('throw on minPitch less than valid minPitch at init', () => {
    expect(() => {
        createMap({minPitch: -10});
    }).toThrow(new Error('minPitch must be greater than or equal to 0'));
});
