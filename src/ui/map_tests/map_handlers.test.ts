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

test('disables all handlers', () => {
    const map = createMap({interactive: false});

    expect(map.boxZoom.isEnabled()).toBeFalsy();
    expect(map.doubleClickZoom.isEnabled()).toBeFalsy();
    expect(map.dragPan.isEnabled()).toBeFalsy();
    expect(map.dragRotate.isEnabled()).toBeFalsy();
    expect(map.keyboard.isEnabled()).toBeFalsy();
    expect(map.scrollZoom.isEnabled()).toBeFalsy();
    expect(map.touchZoomRotate.isEnabled()).toBeFalsy();
});

const handlerNames = [
    'scrollZoom',
    'boxZoom',
    'dragRotate',
    'dragPan',
    'keyboard',
    'doubleClickZoom',
    'touchZoomRotate'
];
handlerNames.forEach((handlerName) => {
    test(`disables "${handlerName}" handler`, () => {
        const options = {};
        options[handlerName] = false;
        const map = createMap(options);

        expect(map[handlerName].isEnabled()).toBeFalsy();

    });
});

