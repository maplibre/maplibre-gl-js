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

test('stops camera animation on touchstart when interactive', () => {
    const map = createMap({interactive: true});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.touchstart(map.getCanvasContainer(), {touches: [{target: map.getCanvas(), clientX: 0, clientY: 0}]});
    expect(map.isEasing()).toBe(false);

    map.remove();
});

test('continues camera animation on touchstart when non-interactive', () => {
    const map = createMap({interactive: false});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.touchstart(map.getCanvasContainer());
    expect(map.isEasing()).toBe(true);

    map.remove();
});

test('continues camera animation on resize', () => {
    const map = createMap(),
        container = map.getContainer();

    map.flyTo({center: [200, 0], duration: 100});

    Object.defineProperty(container, 'clientWidth', {value: 250});
    Object.defineProperty(container, 'clientHeight', {value: 250});
    map.resize();

    expect(map.isMoving()).toBeTruthy();

});

test('stops camera animation on mousedown when interactive', () => {
    const map = createMap({interactive: true});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.mousedown(map.getCanvasContainer());
    expect(map.isEasing()).toBe(false);

    map.remove();
});

test('continues camera animation on mousedown when non-interactive', () => {
    const map = createMap({interactive: false});
    map.flyTo({center: [200, 0], duration: 100});

    simulate.mousedown(map.getCanvasContainer());
    expect(map.isEasing()).toBe(true);

    map.remove();
});