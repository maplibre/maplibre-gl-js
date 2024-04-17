import {createMap, beforeMapTest} from '../../util/test/util';
import {LngLat} from '../../geo/lng_lat';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
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
