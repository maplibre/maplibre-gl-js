import LngLat from './lng_lat';
import MercatorCoordinate, {mercatorScale} from './mercator_coordinate';

describe('Constructor MercatorCoordinate', () => {
    test('creates an object', () => {
        expect(new MercatorCoordinate(0, 0)).toBeInstanceOf(MercatorCoordinate);
    });
    test('creates an object with altitude', () => {
        expect(new MercatorCoordinate(0, 0, 0)).toBeInstanceOf(MercatorCoordinate);
    });
});

describe('Method fromLngLat()', () => {
    const nullIsland = new LngLat(0, 0);
    expect(MercatorCoordinate.fromLngLat(nullIsland)).toEqual({x: 0.5, y: 0.5, z: 0});
});

describe('Method toLngLat()', () => {
    const dc = new LngLat(-77, 39);
    expect(MercatorCoordinate.fromLngLat(dc, 500).toLngLat()).toEqual({lng: -77, lat: 39});
});

describe('Method toAltitude()', () => {
    const dc = new LngLat(-77, 39);

    test('length of 1 meter in MercatorCoordinate units at the equator', () => {
        expect(MercatorCoordinate.fromLngLat(dc, 500).toAltitude()).toBe(500);
    });

    test('length of 1 meter in MercatorCoordinate units at the equator', () => {
        expect(MercatorCoordinate.fromLngLat(dc).toAltitude()).toBe(0);
    });

});

describe('Method meterInMercatorCoordinateUnits()', () => {
    test('length of 1 meter in MercatorCoordinate units at the equator', () => {
        const nullIsland = new LngLat(0, 0);
        expect(MercatorCoordinate.fromLngLat(nullIsland).meterInMercatorCoordinateUnits()).toBe(2.4981121214570498e-8);
    });
});

describe('Method mercatorScale()', () => {
    test('mercator scale at the equator', () => {
        expect(mercatorScale(0)).toBe(1);
    });

    test('mercator scale at 45 degrees latitude', () => {
        expect(mercatorScale(45)).toBe(1.414213562373095);
    });
});
