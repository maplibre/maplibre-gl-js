import {describe, expect, test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {GlobeTransform} from '../geo/projection/globe_transform.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {createDEM, createDEMTerrain} from '../util/test/util.ts';
import {captureRotationPivot, orbitRotationPivot} from './rotation_pivot.ts';

describe('captureRotationPivot', () => {
    test('picks the terrain under the point', () => {
        const transform = createTransform();
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));

        const pivot = captureRotationPivot(transform, new Point(570, 370), terrain, false);

        expect(pivot.elevation).toBeCloseTo(1000);
        expect(transform.locationToScreenPoint(pivot.location, terrain).dist(new Point(570, 370))).toBeLessThan(0.1);
    });

    test('picks the surface of the planet under the terrain on the globe', () => {
        const transform = new GlobeTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(800, 600);
        transform.setCenter(new LngLat(10, 45));
        transform.setZoom(10);
        transform.setPitch(60);
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 3000));

        const pivot = captureRotationPivot(transform, new Point(570, 370), terrain, true);

        expect(pivot.elevation).toBeUndefined();
        expect(transform.locationToScreenPoint(pivot.location).dist(pivot.point)).toBeLessThan(0.1);
        expect(transform.locationToScreenPoint(pivot.location, terrain).dist(new Point(570, 370))).toBeLessThan(0.1);
    });

    test('picks the center for a point in the sky', () => {
        const transform = createTransform();
        transform.setPitch(85);

        const pivot = captureRotationPivot(transform, new Point(400, 0), null, false);

        expect(pivot.point).toEqual(new Point(400, 300));
        expect(pivot.location).toEqual(new LngLat(0, 0));
    });
});

describe('orbitRotationPivot', () => {
    test('keeps the pivot at its screen point and zooms to keep its distance from the camera', () => {
        const transform = createTransform();
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 6000));
        const pivot = captureRotationPivot(transform, new Point(570, 370), terrain, false);

        orbitRotationPivot(transform, pivot, {bearingDelta: 30, pitchDelta: -20, rollDelta: 10});

        expect(transform.bearing).toBeCloseTo(30);
        expect(transform.pitch).toBeCloseTo(40);
        expect(transform.roll).toBeCloseTo(10);
        expect(transform.locationToScreenPoint(pivot.location, terrain).dist(new Point(570, 370))).toBeLessThan(0.1);
        expect(transform.zoom).toBeCloseTo(12.388069, 5);
    });

    test('keeps a pivot on the globe at its screen point and zooms to keep its distance from the camera', () => {
        const transform = new GlobeTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(800, 600);
        transform.setCenter(new LngLat(10, 45));
        transform.setZoom(5);
        transform.setPitch(60);
        const pivot = captureRotationPivot(transform, new Point(570, 370), null, true);

        orbitRotationPivot(transform, pivot, {bearingDelta: 30, pitchDelta: -20});

        expect(transform.bearing).toBeCloseTo(30);
        expect(transform.pitch).toBeCloseTo(40);
        expect(transform.locationToScreenPoint(pivot.location).dist(new Point(570, 370))).toBeLessThan(0.1);
        expect(transform.zoom).toBeCloseTo(5.074093, 5);
    });

    test('keeps the pivot at its screen point where the zoom is at its limit', () => {
        const transform = createTransform();
        transform.setZoom(22);
        const pivot = captureRotationPivot(transform, new Point(570, 370), null, false);

        orbitRotationPivot(transform, pivot, {bearingDelta: 30, pitchDelta: -20});

        expect(transform.zoom).toBe(22);
        expect(transform.bearing).toBeCloseTo(30);
        expect(transform.pitch).toBeCloseTo(40);
        expect(transform.locationToScreenPoint(pivot.location).dist(new Point(570, 370))).toBeLessThan(0.1);
    });

    test('keeps only the change of bearing of a frame that would tilt the pivot close to the horizon', () => {
        const transform = createTransform();
        const pivot = captureRotationPivot(transform, new Point(500, 50), null, false);

        orbitRotationPivot(transform, pivot, {bearingDelta: 10, pitchDelta: 20});

        expect(transform.bearing).toBeCloseTo(10);
        expect(transform.pitch).toBe(60);
        expect(transform.locationToScreenPoint(pivot.location).dist(new Point(500, 50))).toBeLessThan(0.1);
    });

    test('keeps only the change of bearing of a frame that would make the camera look up', () => {
        const transform = createTransform();
        transform.setMaxPitch(180);
        const pivot = captureRotationPivot(transform, new Point(500, 550), null, false);

        orbitRotationPivot(transform, pivot, {bearingDelta: 10, pitchDelta: 40});

        expect(transform.bearing).toBeCloseTo(10);
        expect(transform.pitch).toBe(60);
        expect(transform.locationToScreenPoint(pivot.location).dist(new Point(500, 550))).toBeLessThan(0.1);
    });

    test('turns the camera in place around a pivot at the center, also to where it looks up', () => {
        const transform = createTransform();
        transform.setMaxPitch(180);
        transform.setPitch(85);
        const pivot = captureRotationPivot(transform, new Point(400, 0), null, false);

        orbitRotationPivot(transform, pivot, {bearingDelta: 10, pitchDelta: 10});

        expect(transform.bearing).toBeCloseTo(10);
        expect(transform.pitch).toBeCloseTo(95);
        expect(transform.center).toEqual(new LngLat(0, 0));
    });

    test('turns the camera in place where the edge of the map keeps the pivot from its screen point', () => {
        const transform = createTransform();
        transform.setZoom(1);
        const pivot = captureRotationPivot(transform, new Point(700, 100), null, false);

        const held = orbitRotationPivot(transform, pivot, {bearingDelta: 60});

        expect(held).toBe(false);
        expect(transform.bearing).toBeCloseTo(60);
        expect(transform.center).toEqual(new LngLat(0, 0));
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
