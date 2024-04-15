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

describe('#getRenderWorldCopies', () => {
    test('initially false', () => {
        const map = createMap({renderWorldCopies: false});
        expect(map.getRenderWorldCopies()).toBe(false);
    });

    test('initially true', () => {
        const map = createMap({renderWorldCopies: true});
        expect(map.getRenderWorldCopies()).toBe(true);
    });

});

describe('#setRenderWorldCopies', () => {
    test('initially false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setRenderWorldCopies(true);
        expect(map.getRenderWorldCopies()).toBe(true);
    });

    test('initially true', () => {
        const map = createMap({renderWorldCopies: true});
        map.setRenderWorldCopies(false);
        expect(map.getRenderWorldCopies()).toBe(false);
    });

    test('undefined', () => {
        const map = createMap({renderWorldCopies: false});
        map.setRenderWorldCopies(undefined);
        expect(map.getRenderWorldCopies()).toBe(true);
    });

    test('null', () => {
        const map = createMap({renderWorldCopies: true});
        map.setRenderWorldCopies(null);
        expect(map.getRenderWorldCopies()).toBe(false);
    });

});

describe('#renderWorldCopies', () => {
    test('does not constrain horizontal panning when renderWorldCopies is set to true', () => {
        const map = createMap({renderWorldCopies: true});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBe(180);
    });

    test('constrains horizontal panning when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });

    test('does not wrap the map when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.setCenter({lng: 200, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
    });

    test('panTo is constrained to single globe when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.panTo({lng: 180, lat: 0}, {duration: 0});
        expect(map.getCenter().lng).toBeCloseTo(110, 0);
        map.panTo({lng: -3000, lat: 0}, {duration: 0});
        expect(map.getCenter().lng).toBeCloseTo(-110, 0);
    });

    test('flyTo is constrained to single globe when renderWorldCopies is set to false', () => {
        const map = createMap({renderWorldCopies: false});
        map.flyTo({center: [1000, 0], zoom: 3, animate: false});
        expect(map.getCenter().lng).toBeCloseTo(171, 0);
        map.flyTo({center: [-1000, 0], zoom: 5, animate: false});
        expect(map.getCenter().lng).toBeCloseTo(-178, 0);
    });

    test('lng is constrained to a single globe when zooming with {renderWorldCopies: false}', () => {
        const map = createMap({renderWorldCopies: false, center: [180, 0], zoom: 2});
        expect(map.getCenter().lng).toBeCloseTo(162, 0);
        map.zoomTo(1, {animate: false});
        expect(map.getCenter().lng).toBeCloseTo(145, 0);
    });

    test('lng is constrained by maxBounds when {renderWorldCopies: false}', () => {
        const map = createMap({
            renderWorldCopies: false,
            maxBounds: [
                [70, 30],
                [80, 40]
            ],
            zoom: 8,
            center: [75, 35]
        });
        map.setCenter({lng: 180, lat: 0});
        expect(map.getCenter().lng).toBeCloseTo(80, 0);
    });
});
