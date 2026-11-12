import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {smartWrap} from './smart_wrap.ts';
import {getCameraMath} from '../camera/camera_math_factory.ts';
import {createMercatorTransform} from '../geo/projection/mercator_transform.ts';

describe('smartWrap', () => {
    test('Shifts lng to -360 deg when such point is closer to the priorPos', () => {
        // A viewport wider than the world shows the copies at -360 and +360 deg on either side of the center.
        const transform = createMercatorTransform();
        transform.resize(1200, 100);
        transform.setZoom(0);
        transform.setCenter(new LngLat(0, 0));
        const {projectedCamera, worldCoordinateHelper} = transform;
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, new LngLat(-360, 0)).add(new Point(2, 1));

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            worldCoordinateHelper);
        expect(result.lng).toBe(-360);
    });

    test('Shifts lng to +360 deg when such point is closer to the priorPos', () => {
        const transform = createMercatorTransform();
        transform.resize(1200, 100);
        transform.setZoom(0);
        transform.setCenter(new LngLat(0, 0));
        const {projectedCamera, worldCoordinateHelper} = transform;
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, new LngLat(360, 0)).add(new Point(-2, 1));

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            worldCoordinateHelper);
        expect(result.lng).toBe(360);
    });

    test('Does not change lng when there are no closer points at -360 and +360 deg', () => {
        const transform = createMercatorTransform();
        transform.resize(1200, 100);
        transform.setZoom(0);
        transform.setCenter(new LngLat(0, 0));
        const {projectedCamera, worldCoordinateHelper} = transform;
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, new LngLat(15, 0)).add(new Point(2, 1));

        const result = smartWrap(
            new LngLat(15, 0),
            priorPos,
            projectedCamera,
            worldCoordinateHelper);
        expect(result.lng).toBe(15);
    });

    test('Does not change lng to -360 deg when such point is above horizon', () => {
        // Looking west at a steep pitch, the copy at -360 deg is far ahead, beyond the horizon the map draws to.
        const transform = createMercatorTransform({maxPitch: 85});
        transform.resize(1200, 600);
        transform.setZoom(5);
        transform.setCenter(new LngLat(0, 0));
        transform.setPitch(80);
        transform.setBearing(-90);
        const {projectedCamera, worldCoordinateHelper} = transform;
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, new LngLat(-360, 0));
        expect(getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, worldCoordinateHelper, priorPos)).toBe(false);

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            worldCoordinateHelper);
        expect(result.lng).toBe(0);
    });

    test('Shifts lng to -360 if lng is outside viewport on the right and at least 180° from map center', () => {
        const transform = createMercatorTransform();
        transform.resize(100, 100);
        transform.setZoom(0);
        transform.setCenter(new LngLat(50, 0));
        const {projectedCamera, worldCoordinateHelper} = transform;
        const lngLat = new LngLat(250, 0); // 200 from map center
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, lngLat);
        expect(priorPos.x).toBeGreaterThan(projectedCamera.width);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            worldCoordinateHelper);
        expect(result.lng).toBe(-110);
    });

    test('Shifts lng to +360 if lng is outside viewport on the left and at least 180° from map center', () => {
        const transform = createMercatorTransform();
        transform.resize(100, 100);
        transform.setZoom(0);
        transform.setCenter(new LngLat(50, 0));
        const {projectedCamera, worldCoordinateHelper} = transform;
        const lngLat = new LngLat(-150, 0); // 200 from map center
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, worldCoordinateHelper, lngLat);
        expect(priorPos.x).toBeLessThan(0);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            worldCoordinateHelper);
        expect(result.lng).toBe(210);
    });
});
