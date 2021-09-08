import Point from '../../../../rollup/build/tsc/util/point';
import Transform from '../../../../rollup/build/tsc/geo/transform';
import LngLat from '../../../../rollup/build/tsc/geo/lng_lat';
import {OverscaledTileID, CanonicalTileID} from '../../../../rollup/build/tsc/source/tile_id';
import {fixedLngLat, fixedCoord} from '../../../util/fixed';

describe('creates a transform', () => {
    const transform = new Transform();
    transform.resize(500, 500);

    test('_unmodified', () => {
        expect(transform['_unmodified']).toBe(true);
    });

    test('maxValidLatitude', () => {
        expect(transform.maxValidLatitude).toBe(85.051129);
    });

    test('tileSize', () => {
        expect(transform.tileSize).toBe(512);
    });

    test('worldSize', () => {
        expect(transform.worldSize).toBe(512);
    });

    test('width', () => {
        expect(transform.width).toBe(500);
    });

    test('minZoom', () => {
        expect(transform.minZoom).toBe(0);
    });

    test('minPitch', () => {
        expect(transform.minPitch).toBe(0);
    });

    test('bearing (https://en.wikipedia.org/wiki/Signed_zero)', () => {
        expect(transform.bearing).toBe(-0);
    });

    test('set bearing', () => {
        expect(transform.bearing = 1).toBe(1);
    });

    test('bearing', () => {
        expect(transform.bearing).toBe(1);
    });

    test('_unmodified', () => {
        expect(transform['_unmodified']).toBe(false);
    });

    test('set bearing', () => {
        expect(transform.bearing = 0).toBe(0);
    });

    test('set minZoom', () => {
        expect(transform.minZoom = 10).toBe(10);
    });

    test('set maxZoom', () => {
        expect(transform.maxZoom = 10).toBe(10);
    });

    test('set bearing', () => {
        expect(transform.minZoom).toBe(10);
    });

    test('center', () => {
        expect(transform['center']).toEqual({lng: 0, lat: 0});
    });

    test('maxZoom', () => {
        expect(transform.maxZoom).toBe(10);
    });

    test('set minPitch', () => {
        expect(transform.minPitch = 10).toBe(10);
    });

    test('set maxPitch', () => {
        expect(transform.maxPitch = 10).toBe(10);
    });

    test('size', () => {
        expect(transform.size.equals(new Point(500, 500))).toBeTruthy();
    });

    test('centerPoint', () => {
        expect(transform.centerPoint.equals(new Point(250, 250))).toBeTruthy();
    });

    test('scaleZoom 0', () => {
        expect(transform.scaleZoom(0)).toBe(-Infinity);
    });

    test('scaleZoom 10', () => {
        expect(transform.scaleZoom(10)).toBe(3.3219280948873626);
    });

    test('point', () => {
        expect(transform.point).toEqual(new Point(262144, 262144));
    });

    test('height', () => {
        expect(transform.height).toBe(500);
    });

    test('pointLocation', () => {
        const point = (transform['pointLocation'](new Point(250, 250)));
        const fixedPoint = fixedLngLat(point);
        expect(fixedPoint).toEqual({lng: 0, lat: -0});
    });

    test('pointCoordinate', () => {
        const point = (transform['pointCoordinate'](new Point(250, 250)));
        const fixedPoint = fixedCoord(point);
        expect(fixedPoint).toEqual({x: 0.5, y: 0.5, z: 0});
    });

    test('locationPoint', () => {
        const locationPoint = (transform['locationPoint'](new LngLat(0, 0)));
        expect(locationPoint).toEqual({x: 250, y: 250});
    });

    test('locationCoordinate', () => {
        const locationCoordinate = (transform['locationCoordinate'](new LngLat(0, 0)));
        expect(locationCoordinate).toEqual({x: 0.5, y: 0.5, z: 0});
    });

});

describe('does not throw on `bad` center', () => {
    test('set center', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform['center'] = new LngLat(50, -90);
        expect(transform['center']).toEqual({lng: 49.99999999999997, lat: -4.214945686958828});
    });

    test('set center', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform['center'] = new LngLat(50, 90);
        expect(transform['center']).toEqual({lng: 49.99999999999997, lat: 4.214945686958913});
    });

    test('set center to value with lat bigger than 180', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform['center'] = new LngLat(260, 0);
        expect(transform['center']).toEqual({lng: 260, lat: 0});
    });
});
