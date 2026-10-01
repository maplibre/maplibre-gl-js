import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createDEM, createDEMTerrain} from '../util/test/util.ts';
import {captureRotationPivot, orbitRotationPivot} from './rotation_pivot.ts';

describe('captureRotationPivot', () => {
    test('picks the terrain under the point', () => {
        const transform = createTransform();
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));

        const pivot = captureRotationPivot(transform, new Point(570, 370), terrain);

        expect(pivot.elevation).toBeCloseTo(1000);
        expect(transform.locationToScreenPoint(pivot.location, terrain).dist(new Point(570, 370))).toBeLessThan(0.1);
    });

    test('picks the center for a point in the sky', () => {
        const transform = createTransform();
        transform.setPitch(85);

        const pivot = captureRotationPivot(transform, new Point(400, 0), null);

        expect(pivot.point).toEqual(new Point(400, 300));
        expect(pivot.location).toEqual(new LngLat(0, 0));
    });
});

describe('orbitRotationPivot', () => {
    test('keeps the pivot at its screen point and at its distance from the camera', () => {
        const transform = createTransform();
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));
        const pivot = captureRotationPivot(transform, new Point(570, 370), terrain);

        orbitRotationPivot(transform, pivot, {bearingDelta: 30, pitchDelta: -20});

        expect(transform.bearing).toBeCloseTo(30);
        expect(transform.pitch).toBeCloseTo(40);
        expect(transform.locationToScreenPoint(pivot.location, terrain).dist(new Point(570, 370))).toBeLessThan(0.1);
        expect(Math.hypot(transform.getCameraLngLat().distanceTo(pivot.location), transform.getCameraAltitude() - 1000)).toBeCloseTo(pivot.distance, 0);
    });

    test('keeps only the change of bearing of a frame that would tilt the pivot close to the horizon', () => {
        const transform = createTransform();
        const pivot = captureRotationPivot(transform, new Point(500, 50), null);

        orbitRotationPivot(transform, pivot, {bearingDelta: 10, pitchDelta: 20});

        expect(transform.bearing).toBeCloseTo(10);
        expect(transform.pitch).toBe(60);
        expect(transform.locationToScreenPoint(pivot.location).dist(new Point(500, 50))).toBeLessThan(0.1);
    });

});

function createTransform(): MercatorTransform {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    transform.resize(800, 600);
    transform.setCenter(new LngLat(0, 0));
    transform.setZoom(12);
    transform.setElevation(500);
    transform.setPitch(60);
    return transform;
}
