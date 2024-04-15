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

describe('#queryRenderedFeatures', () => {

    test('if no arguments provided', done => {
        createMap({}, (err, map) => {
            expect(err).toBeFalsy();
            const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

            const output = map.queryRenderedFeatures();

            const args = spy.mock.calls[0];
            expect(args[0]).toBeTruthy();
            expect(args[1]).toEqual({availableImages: []});
            expect(output).toEqual([]);

            done();
        });
    });

    test('if only "geometry" provided', done => {
        createMap({}, (err, map) => {
            expect(err).toBeFalsy();
            const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

            const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

            const args = spy.mock.calls[0];
            expect(args[0]).toEqual([{x: 100, y: 100}]); // query geometry
            expect(args[1]).toEqual({availableImages: []}); // params
            expect(args[2]).toEqual(map.transform); // transform
            expect(output).toEqual([]);

            done();
        });
    });

    test('if only "params" provided', done => {
        createMap({}, (err, map) => {
            expect(err).toBeFalsy();
            const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

            const output = map.queryRenderedFeatures({filter: ['all']});

            const args = spy.mock.calls[0];
            expect(args[0]).toBeTruthy();
            expect(args[1]).toEqual({availableImages: [], filter: ['all']});
            expect(output).toEqual([]);

            done();
        });
    });

    test('if both "geometry" and "params" provided', done => {
        createMap({}, (err, map) => {
            expect(err).toBeFalsy();
            const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

            const output = map.queryRenderedFeatures({filter: ['all']});

            const args = spy.mock.calls[0];
            expect(args[0]).toBeTruthy();
            expect(args[1]).toEqual({availableImages: [], filter: ['all']});
            expect(output).toEqual([]);

            done();
        });
    });

    test('if "geometry" with unwrapped coords provided', done => {
        createMap({}, (err, map) => {
            expect(err).toBeFalsy();
            const spy = jest.spyOn(map.style, 'queryRenderedFeatures');

            map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

            expect(spy.mock.calls[0][0]).toEqual([{x: 612, y: 100}]);
            done();
        });
    });

    test('returns an empty array when no style is loaded', () => {
        const map = createMap({style: undefined});
        expect(map.queryRenderedFeatures()).toEqual([]);
    });

});
