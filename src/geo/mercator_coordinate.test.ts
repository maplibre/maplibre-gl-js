import {describe, test, expect} from 'vitest';
import {LngLat} from './lng_lat.ts';
import {MercatorCoordinate, mercatorScale, mercatorWorldCoordinates} from './mercator_coordinate.ts';

describe('LngLat', () => {
    test('constructor', () => {
        expect(new MercatorCoordinate(0, 0)).toBeInstanceOf(MercatorCoordinate);
        expect(new MercatorCoordinate(0, 0, 0)).toBeInstanceOf(MercatorCoordinate);
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

function createSamplePoints(): Array<[number, number]> {
    return [
        [0, 0],
        [-180, -85],
        [179.999, 85],
        [12.5, 41.9],
        [-122.4, 37.8],
        [151.2, -33.9],
        [37.6, 55.8],
    ];
}

describe('mercatorWorldCoordinates', () => {
    test('round-trips lng/lat through world coordinates', () => {
        for (const [lng, lat] of createSamplePoints()) {
            const {x, y} = mercatorWorldCoordinates.worldFromLngLat(lng, lat);
            const back = mercatorWorldCoordinates.lngLatFromWorld(x, y);
            expect(back.lng).toBeCloseTo(lng, 10);
            expect(back.lat).toBeCloseTo(lat, 10);
        }
    });
});
