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

test('#setMinZoom', () => {
    const map = createMap({zoom: 5});
    map.setMinZoom(3.5);
    map.setZoom(1);
    expect(map.getZoom()).toBe(3.5);
});

test('unset minZoom', () => {
    const map = createMap({minZoom: 5});
    map.setMinZoom(null);
    map.setZoom(1);
    expect(map.getZoom()).toBe(1);
});

test('#getMinZoom', () => {
    const map = createMap({zoom: 0});
    expect(map.getMinZoom()).toBe(-2);
    map.setMinZoom(10);
    expect(map.getMinZoom()).toBe(10);
});


test('ignore minZooms over maxZoom', () => {
    const map = createMap({zoom: 2, maxZoom: 5});
    expect(() => {
        map.setMinZoom(6);
    }).toThrow();
    map.setZoom(0);
    expect(map.getZoom()).toBe(0);
});

test('#setMaxZoom', () => {
    const map = createMap({zoom: 0});
    map.setMaxZoom(3.5);
    map.setZoom(4);
    expect(map.getZoom()).toBe(3.5);
});

test('unset maxZoom', () => {
    const map = createMap({maxZoom: 5});
    map.setMaxZoom(null);
    map.setZoom(6);
    expect(map.getZoom()).toBe(6);
});

test('#getMaxZoom', () => {
    const map = createMap({zoom: 0});
    expect(map.getMaxZoom()).toBe(22);
    map.setMaxZoom(10);
    expect(map.getMaxZoom()).toBe(10);
});

test('ignore maxZooms over minZoom', () => {
    const map = createMap({minZoom: 5});
    expect(() => {
        map.setMaxZoom(4);
    }).toThrow();
    map.setZoom(5);
    expect(map.getZoom()).toBe(5);
});

test('throw on maxZoom smaller than minZoom at init', () => {
    expect(() => {
        createMap({minZoom: 10, maxZoom: 5});
    }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
});

test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', () => {
    expect(() => {
        createMap({minZoom: 1, maxZoom: 0});
    }).toThrow(new Error('maxZoom must be greater than or equal to minZoom'));
});

