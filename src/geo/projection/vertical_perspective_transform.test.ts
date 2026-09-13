import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {EXTENT} from '../../data/extent.ts';
import {LngLat, earthRadius} from '../lng_lat.ts';
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
    test('matches the mercator transform at high zoom, where the globe is nearly flat', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setZoom(15);
        transform.setCenter(new LngLat(8, 47));
        transform.setPitch(60);

        const mercator = new MercatorTransform();
        mercator.resize(800, 600);
        mercator.setZoom(15);
        mercator.setCenter(new LngLat(8, 47));
        mercator.setPitch(60);

        expect(transform.getCameraAltitude()).toBeCloseTo(732.384055, 6);
        expect(transform.getCameraAltitude()).toBeCloseTo(mercator.getCameraAltitude(), 0);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(mercator.getCameraLngLat().lng, 6);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(mercator.getCameraLngLat().lat, 5);
    });

    test('altitude follows the sphere at low zoom, where the flat formula underestimates it', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setZoom(4);
        transform.setCenter(new LngLat(8, 47));
        transform.setPitch(60);

        // 2999 km camera distance, 2597 km sideways => 1500 km above the center's plane + 418 km the sphere drops beneath the camera
        expect(transform.getCameraAltitude()).toBeCloseTo(1917203.7524, 3);
    });

    test('altitude stays positive past 90° pitch while the camera is outside the globe', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setMaxPitch(180);
        transform.setZoom(4);
        transform.setCenter(new LngLat(8, 47));
        transform.setPitch(100);

        // cos 100° => 521 km below the center's plane + 703 km the sphere drops beneath the camera => 183 km above the surface
        expect(transform.getCameraAltitude()).toBeCloseTo(182564.5961, 3);
    });

    test('camera lng/lat is the center at pitch 0', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setZoom(15);
        transform.setCenter(new LngLat(8, 47));

        expect(transform.getCameraLngLat().lng).toBeCloseTo(8, 6);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(47, 6);
    });

    test('camera lng/lat lies behind the center along the bearing and does not move with roll', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setZoom(4);
        transform.setCenter(new LngLat(8, 47));
        transform.setPitch(60);

        expect(transform.getCameraLngLat().lng).toBeCloseTo(8, 6);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(28.7359793, 6);

        transform.setBearing(90);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(-17.8225358, 6);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(43.9881758, 6);
        expect(transform.getCameraAltitude()).toBeCloseTo(1917203.7524, 3);

        transform.setRoll(31);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(-17.8225358, 6);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(43.9881758, 6);
        expect(transform.getCameraAltitude()).toBeCloseTo(1917203.7524, 3);
    });
});

describe('VerticalPerspectiveTransform.calculateCameraOptionsFromTo', () => {
    test('round-trips the transform\'s own camera, past 90° pitch and with a bearing', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setMaxPitch(180);
        transform.setZoom(4);
        transform.setCenter(new LngLat(8, 47));
        transform.setBearing(35);
        transform.setPitch(100);

        const cameraOptions = transform.calculateCameraOptionsFromTo(transform.getCameraLngLat(), transform.getCameraAltitude(), transform.center, 0);
        expect(cameraOptions.center.lng).toBeCloseTo(8, 9);
        expect(cameraOptions.center.lat).toBeCloseTo(47, 9);
        expect(cameraOptions.elevation).toBe(0);
        expect(cameraOptions.zoom).toBeCloseTo(4, 6);
        expect(cameraOptions.pitch).toBeCloseTo(100, 6);
        expect(cameraOptions.bearing).toBeCloseTo(35, 6);
    });

    test('from one earth radius up the horizon is 60° away, and the target altitude becomes the center elevation instead of tilting the camera up', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setMaxPitch(180);

        const cameraOptions = transform.calculateCameraOptionsFromTo(new LngLat(0, 0), earthRadius, new LngLat(60, 0), 2 * earthRadius);
        expect(cameraOptions.center.lng).toBe(60);
        expect(cameraOptions.center.lat).toBe(0);
        expect(cameraOptions.elevation).toBe(2 * earthRadius);
        expect(cameraOptions.pitch).toBeCloseTo(90, 6);
        expect(cameraOptions.bearing).toBeCloseTo(90, 6);
        expect(cameraOptions.zoom).toBeCloseTo(2.6727961, 6);

        transform.setZoom(cameraOptions.zoom);
        transform.setCenter(cameraOptions.center);
        transform.setElevation(cameraOptions.elevation);
        transform.setPitch(cameraOptions.pitch);
        transform.setBearing(cameraOptions.bearing);
        expect(transform.getCameraAltitude()).toBeCloseTo(earthRadius, 3);
        expect(transform.getCameraLngLat().lng).toBeCloseTo(0, 6);
        expect(transform.getCameraLngLat().lat).toBeCloseTo(0, 6);
    });

    test('a camera straight above the center keeps the transform\'s bearing', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setBearing(35);

        const cameraOptions = transform.calculateCameraOptionsFromTo(new LngLat(8, 47), 1000, new LngLat(8, 47), 0);
        expect(cameraOptions.pitch).toBeCloseTo(0, 6);
        expect(cameraOptions.bearing).toBe(35);
        expect(cameraOptions.zoom).toBeCloseTo(15.5504236, 6);
    });

    test('throws for the same From and To, also across the antimeridian and regardless of altitude', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);

        expect(() => transform.calculateCameraOptionsFromTo({lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 0)).toThrow('Can\'t calculate camera options with same From and To');
        expect(() => transform.calculateCameraOptionsFromTo({lng: 180, lat: 0}, 0, {lng: -180, lat: 0}, 0)).toThrow('Can\'t calculate camera options with same From and To');
        expect(() => transform.calculateCameraOptionsFromTo({lng: 0, lat: 0}, 1000, {lng: 0, lat: 0}, 1000)).toThrow('Can\'t calculate camera options with same From and To');
        expect(() => transform.calculateCameraOptionsFromTo({lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 1000)).toThrow('Can\'t calculate camera options with same From and To');
    });

    test('lifts a camera that dipped into the sphere onto the surface, still looking past the horizon', () => {
        const transform = new VerticalPerspectiveTransform();
        transform.resize(800, 600);
        transform.setMaxPitch(180);
        transform.setZoom(5);
        transform.setCenter(new LngLat(13.44, 52.5));
        transform.setPitch(100);
        expect(transform.getCameraAltitude()).toBeCloseTo(-92490.7408, 3);

        const cameraOptions = transform.calculateCameraOptionsFromTo(transform.getCameraLngLat(), 0, transform.center, 0);
        // θ = 12.12° from the center, the chord to it dips θ/2 below the horizon => 90 + θ/2
        expect(cameraOptions.pitch).toBeCloseTo(96.0602239, 6);
        expect(cameraOptions.zoom).toBeCloseTo(4.9929031, 6);
        expect(cameraOptions.bearing).toBeCloseTo(0, 6);

        transform.setZoom(cameraOptions.zoom);
        transform.setPitch(cameraOptions.pitch);
        transform.setBearing(cameraOptions.bearing);
        expect(transform.getCameraAltitude()).toBeCloseTo(0, 3);
    });
});
