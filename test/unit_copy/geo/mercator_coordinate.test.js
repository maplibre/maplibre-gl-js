import {test} from '../../util/test';
import LngLat from '../../../rollup/build/tsc/geo/lng_lat';
import MercatorCoordinate, {mercatorScale} from '../../../rollup/build/tsc/geo/mercator_coordinate';

test('LngLat', (t) => {
    t.test('#constructor', (t) => {
        expect(new MercatorCoordinate(0, 0) instanceof MercatorCoordinate).toBeTruthy();
        expect(new MercatorCoordinate(0, 0, 0) instanceof MercatorCoordinate).toBeTruthy();
        t.end();
    });

    t.test('#fromLngLat', (t) => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland)).toEqual({x: 0.5, y: 0.5, z: 0});
        t.end();
    });

    t.test('#toLngLat', (t) => {
        const dc = new LngLat(-77, 39);
        expect(MercatorCoordinate.fromLngLat(dc, 500).toLngLat()).toEqual({lng: -77, lat: 39});
        t.end();
    });

    t.test('#toAltitude', (t) => {
        const dc = new LngLat(-77, 39);
        expect(MercatorCoordinate.fromLngLat(dc, 500).toAltitude()).toBe(500);
        t.end();
    });

    t.test('#mercatorScale', (t) => {
        expect(mercatorScale(0)).toBe(1);
        expect(mercatorScale(45)).toBe(1.414213562373095);
        t.end();
    });

    t.test('#meterInMercatorCoordinateUnits', (t) => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland).meterInMercatorCoordinateUnits()).toBe(2.4981121214570498e-8);
        t.end();
    });

    t.end();
});
