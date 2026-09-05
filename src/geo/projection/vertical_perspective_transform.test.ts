import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {EXTENT} from '../../data/extent.ts';
import {LngLat, earthRadius} from '../lng_lat.ts';
import {differenceOfAnglesDegrees} from '../../util/util.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {createDEM, createDEMTerrain} from '../../util/test/util.ts';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform.ts';
import {MercatorTransform} from './mercator_transform.ts';

describe('VerticalPerspectiveTransform.screenTerrainPointToMercatorCoordinate', () => {
    function createTransform(center: LngLat, zoom: number): VerticalPerspectiveTransform {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(512, 512);
        transform.setCenter(center);
        transform.setZoom(zoom);
        return transform;
    }

    test('hits the terrain under the globe center', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));
        const transform = createTransform(new LngLat(0, 0), 1);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBeCloseTo(1000, 6);
        expect(result.x).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).x, 6);
        expect(result.y).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).y, 6);
    });

    test('returns null for a ray that misses the planet', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createTransform(new LngLat(0, 0), 0);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(0, 0), terrain)).toBeNull();
    });

    test('caps the poles at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 2000));
        const transform = createTransform(new LngLat(0, 90), 1);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain).z).toBeCloseTo(2000, 6);

        const beyondTheMercatorEdge = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 200), terrain);

        expect(beyondTheMercatorEdge).not.toBeNull();
        expect(beyondTheMercatorEdge.z).toBe(0);
    });

    test('returns null when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const transform = createTransform(new LngLat(0, 0), 1);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain)).toBeNull();
    });

    test('returns null for a ray that hits the planet outside the renderable tiles', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const transform = createTransform(new LngLat(90, -45), 1);

        expect(transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain)).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const transform = createTransform(new LngLat(0, 0), 1);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
        expect(result.x).toBeCloseTo(0.5, 6);
        expect(result.y).toBeCloseTo(0.5, 6);
    });

    test('hits entirely flat terrain at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createTransform(new LngLat(0, 0), 1);

        const result = transform.screenTerrainPointToMercatorCoordinate(new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x, y) => 500 * x + 300 * y));
        const transform = createTransform(new LngLat(0, 0), 2);

        for (const p of [new Point(256, 256), new Point(230, 280), new Point(300, 220)]) {
            const result = transform.screenTerrainPointToMercatorCoordinate(p, terrain);
            expect(result).not.toBeNull();
            expect(terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT)).toBeCloseTo(result.z, 3);
        }
    });
});

describe('VerticalPerspectiveTransform camera position', () => {
    function createPair(zoom: number, pitch: number, bearing = 0) {
        const create = <T extends VerticalPerspectiveTransform | MercatorTransform>(t: T): T => {
            t.resize(800, 600);
            t.setMaxPitch(180);
            t.setZoom(zoom);
            t.setCenter(new LngLat(8, 47));
            t.setBearing(bearing);
            t.setPitch(pitch);
            return t;
        };
        return {vp: create(new VerticalPerspectiveTransform()), mercator: create(new MercatorTransform())};
    }

    // camera altitude from the sphere geometry: the camera sits d meters from the center point,
    // at an angle of pitch from the local vertical, so its distance to the planet center follows the law of cosines
    function sphereAltitude(t: VerticalPerspectiveTransform): number {
        const d = t.cameraToCenterDistance / t.pixelsPerMeter;
        return Math.sqrt(earthRadius * earthRadius + d * d + 2 * earthRadius * d * Math.cos(t.pitchInRadians)) - earthRadius;
    }

    const relativeDifference = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

    test('altitude matches mercator where the globe is nearly flat', () => {
        const {vp, mercator} = createPair(15, 60);
        expect(relativeDifference(vp.getCameraAltitude(), mercator.getCameraAltitude())).toBeLessThan(1e-3);
    });

    test('altitude follows the sphere geometry at low zoom, where the flat formula underestimates', () => {
        const {vp, mercator} = createPair(4, 60);
        expect(relativeDifference(vp.getCameraAltitude(), sphereAltitude(vp))).toBeLessThan(1e-9);
        expect(vp.getCameraAltitude()).toBeGreaterThan(mercator.getCameraAltitude() * 1.2);
    });

    test('altitude stays positive past 90° pitch while the camera is outside the globe', () => {
        const {vp, mercator} = createPair(4, 100);
        expect(mercator.getCameraAltitude()).toBeLessThan(0);
        expect(vp.getCameraAltitude()).toBeGreaterThan(0);
        expect(relativeDifference(vp.getCameraAltitude(), sphereAltitude(vp))).toBeLessThan(1e-9);
    });

    test('camera lng/lat is the center at pitch 0 and matches mercator where the globe is nearly flat', () => {
        const flat = createPair(15, 0).vp.getCameraLngLat();
        expect(flat.lng).toBeCloseTo(8, 6);
        expect(flat.lat).toBeCloseTo(47, 6);

        const {vp, mercator} = createPair(15, 60);
        expect(vp.getCameraLngLat().lng).toBeCloseTo(mercator.getCameraLngLat().lng, 4);
        expect(vp.getCameraLngLat().lat).toBeCloseTo(mercator.getCameraLngLat().lat, 4);
    });

    test('camera lng/lat lies behind the center along the bearing', () => {
        const north = createPair(4, 60, 0).vp.getCameraLngLat();
        expect(north.lng).toBeCloseTo(8, 6);
        expect(north.lat).toBeLessThan(40);

        // looking east, the camera is west of the center; heading west along a great circle from
        // 47° drifts toward the equator, but less than heading straight south does
        const east = createPair(4, 60, 90).vp.getCameraLngLat();
        expect(east.lng).toBeLessThan(0);
        expect(east.lat).toBeLessThan(47);
        expect(east.lat).toBeGreaterThan(north.lat);
    });
});

describe('VerticalPerspectiveTransform.calculateCameraOptionsFromTo', () => {
    function createTransform(zoom: number, pitch: number, bearing: number, center = new LngLat(8, 47)): VerticalPerspectiveTransform {
        const t = new VerticalPerspectiveTransform();
        t.resize(800, 600);
        t.setMaxPitch(180);
        t.setZoom(zoom);
        t.setCenter(center);
        t.setBearing(bearing);
        t.setPitch(pitch);
        return t;
    }

    test.each([[4, 100, 35], [6, 60, -120], [12, 45, 0], [2, 30, 170]])('round-trips the transform\'s own camera at zoom %s, pitch %s, bearing %s', (zoom, pitch, bearing) => {
        const t = createTransform(zoom, pitch, bearing);
        const result = t.calculateCameraOptionsFromTo(t.getCameraLngLat(), t.getCameraAltitude(), t.center, 0);
        expect(result.zoom).toBeCloseTo(zoom, 6);
        expect(result.pitch).toBeCloseTo(pitch, 6);
        expect(differenceOfAnglesDegrees(result.bearing, bearing)).toBeCloseTo(0, 6);
        expect(result.center.lng).toBeCloseTo(8, 9);
        expect(result.center.lat).toBeCloseTo(47, 9);
    });

    test('lifting a camera that dipped into the sphere lands it on the surface, still looking past the horizon', () => {
        // zooming in at pitch 100 takes the camera below sea level once the planet stops curving away under it
        const t = createTransform(5, 100, 0, new LngLat(13.44, 52.5));
        expect(t.getCameraAltitude()).toBeLessThan(0);

        const lifted = t.calculateCameraOptionsFromTo(t.getCameraLngLat(), 0, t.center, 0);
        // on a plane a camera at ground level looks exactly along the ground; on the sphere the center is below the horizon
        expect(lifted.pitch).toBeGreaterThan(90);
        expect(lifted.pitch).toBeLessThan(102);

        t.setZoom(lifted.zoom);
        t.setPitch(lifted.pitch);
        t.setBearing(lifted.bearing);
        expect(Math.abs(t.getCameraAltitude())).toBeLessThan(1);
    });
});
