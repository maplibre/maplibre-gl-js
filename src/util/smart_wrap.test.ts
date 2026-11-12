import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {smartWrap} from './smart_wrap.ts';
import * as cameraMath from '../geo/projection/camera_math.ts';
import {createTestCamera} from './test/util.ts';

describe('smartWrap', () => {
    test('Shifts lng to -360 deg when such point is closer to the priorPos', () => {
        // A viewport wider than the world shows the copies at -360 and +360 deg on either side of the center.
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 100, zoom: 0, center: [0, 0]});
        const priorPos = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(-360, 0)).add(new Point(2, 1));

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(-360);
    });

    test('Shifts lng to +360 deg when such point is closer to the priorPos', () => {
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 100, zoom: 0, center: [0, 0]});
        const priorPos = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(360, 0)).add(new Point(-2, 1));

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(360);
    });

    test('Does not change lng when there are no closer points at -360 and +360 deg', () => {
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 100, zoom: 0, center: [0, 0]});
        const priorPos = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(15, 0)).add(new Point(2, 1));

        const result = smartWrap(
            new LngLat(15, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(15);
    });

    test('Does not change lng to -360 deg when such point is above horizon', () => {
        // Looking west at a steep pitch, the copy at -360 deg is far ahead, beyond the horizon the map draws to.
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 600, zoom: 5, center: [0, 0], maxPitch: 85, pitch: 80, bearing: -90});
        const priorPos = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(-360, 0));
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, priorPos)).toBe(false);

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(0);
    });

    test('Shifts lng to -360 if lng is outside viewport on the right and at least 180° from map center', () => {
        const {projectedCamera, context} = createTestCamera({width: 100, height: 100, zoom: 0, center: [50, 0]});
        const lngLat = new LngLat(250, 0); // 200 from map center
        const priorPos = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);
        expect(priorPos.x).toBeGreaterThan(projectedCamera.width);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(-110);
    });

    test('Shifts lng to +360 if lng is outside viewport on the left and at least 180° from map center', () => {
        const {projectedCamera, context} = createTestCamera({width: 100, height: 100, zoom: 0, center: [50, 0]});
        const lngLat = new LngLat(-150, 0); // 200 from map center
        const priorPos = cameraMath.locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);
        expect(priorPos.x).toBeLessThan(0);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(210);
    });
});
