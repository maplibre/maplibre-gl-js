import {describe, test, expect} from 'vitest';
import {LngLat} from './lng_lat';
import {MercatorCoordinate, mercatorScale} from './mercator_coordinate';

describe('LngLat', () => {
    test('constructor', () => {
        expect(new MercatorCoordinate(0, 0) instanceof MercatorCoordinate).toBeTruthy();
        expect(new MercatorCoordinate(0, 0, 0) instanceof MercatorCoordinate).toBeTruthy();
    });

    test('fromLngLat', () => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland)).toEqual({x: 0.5, y: 0.5, z: 0});
    });

    test('toLngLat', () => {
        const dc = new LngLat(-77, 39);
        expect(MercatorCoordinate.fromLngLat(dc, 500).toLngLat()).toEqual({lng: -77, lat: 39});
    });

    test('toAltitude', () => {
        const dc = new LngLat(-77, 39);
        expect(MercatorCoordinate.fromLngLat(dc, 500).toAltitude()).toBe(500);
    });

    test('mercatorScale', () => {
        expect(mercatorScale(0)).toBe(1);
        expect(mercatorScale(45)).toBe(1.414213562373095);
    });

    test('meterInMercatorCoordinateUnits', () => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland).meterInMercatorCoordinateUnits()).toBe(2.4981121214570498e-8);
    });
});
