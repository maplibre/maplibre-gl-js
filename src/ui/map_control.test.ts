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

test('#addControl', () => {
    const map = createMap();
    const control = {
        onAdd(_) {
            expect(map).toBe(_);
            return window.document.createElement('div');
        }
    } as any as IControl;
    map.addControl(control);
    expect(map._controls[0]).toBe(control);
});

test('#removeControl errors on invalid arguments', () => {
    const map = createMap();
    const control = {} as any as IControl;
    const stub = jest.spyOn(console, 'error').mockImplementation(() => {});

    map.addControl(control);
    map.removeControl(control);
    expect(stub).toHaveBeenCalledTimes(2);

});

test('#removeControl', () => {
    const map = createMap();
    const control = {
        onAdd() {
            return window.document.createElement('div');
        },
        onRemove(_) {
            expect(map).toBe(_);
        }
    };
    map.addControl(control);
    map.removeControl(control);
    expect(map._controls).toHaveLength(0);

});

test('#hasControl', () => {
    const map = createMap();
    function Ctrl() {}
    Ctrl.prototype = {
        onAdd(_) {
            return window.document.createElement('div');
        }
    };

    const control = new Ctrl();
    expect(map.hasControl(control)).toBe(false);
    map.addControl(control);
    expect(map.hasControl(control)).toBe(true);
});
