import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {smartWrap} from './smart_wrap.ts';
import {getCameraMath} from '../camera/camera_math_factory.ts';
import {createTestCamera} from './test/util.ts';
import {CRSWorldCoordinateHelper, identityCrs} from '../geo/projection/crs.ts';

describe('smartWrap', () => {
    test('Shifts lng to -360 deg when such point is closer to the priorPos', () => {
        // A viewport wider than the world shows the copies at -360 and +360 deg on either side of the center.
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 100, zoom: 0, center: [0, 0]});
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(-360, 0)).add(new Point(2, 1));

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(-360);
    });

    test('Shifts lng to +360 deg when such point is closer to the priorPos', () => {
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 100, zoom: 0, center: [0, 0]});
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(360, 0)).add(new Point(-2, 1));

        const result = smartWrap(
            new LngLat(0, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(360);
    });

    test('Does not change lng when there are no closer points at -360 and +360 deg', () => {
        const {projectedCamera, context} = createTestCamera({width: 1200, height: 100, zoom: 0, center: [0, 0]});
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(15, 0)).add(new Point(2, 1));

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
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(-360, 0));
        expect(getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, priorPos)).toBe(false);

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
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);
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
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);
        expect(priorPos.x).toBeLessThan(0);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(210);
    });

    test('Does not shift lng to -360 with {renderWorldCopies: false} when lng is outside viewport on the right and at least 180° from map center', () => {
        const {projectedCamera, context} = createTestCamera(
            {width: 800, height: 400, zoom: 1, center: [-150, 0], renderWorldCopies: false},
            {constrainOverride: (lngLat: LngLat, zoom: number) => ({center: lngLat, zoom})});
        const lngLat = new LngLat(170, 0);
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);
        expect(projectedCamera.center.lng).toBe(-150);
        expect(priorPos.x).toBeGreaterThan(projectedCamera.width);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(170);
    });

    test('Does not shift lng -180 to +180 with {renderWorldCopies: false} when lng is outside viewport on the left', () => {
        const {projectedCamera, context} = createTestCamera(
            {width: 800, height: 400, zoom: 1, center: [100, 0], renderWorldCopies: false},
            {constrainOverride: (lngLat: LngLat, zoom: number) => ({center: lngLat, zoom})});
        const lngLat = new LngLat(-180, 0);
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);
        expect(priorPos.x).toBeLessThan(0);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(-180);
    });

    test('Wraps lng beyond 180 back onto the world with {renderWorldCopies: false}', () => {
        const {projectedCamera, context} = createTestCamera({width: 800, height: 400, zoom: 1, center: [0, 0], renderWorldCopies: false});
        const lngLat = new LngLat(190, 0);
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, lngLat);

        const result = smartWrap(
            lngLat,
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(-170);
    });

    test('Does not shift lng to +360 in a projection whose world does not wrap, even when such point is on screen and closer to the priorPos', () => {
        const {projectedCamera, context} = createTestCamera(
            {width: 1200, height: 100, minZoom: -2, zoom: -1, center: [0, 0]},
            {worldCoordinateHelper: new CRSWorldCoordinateHelper(identityCrs)});
        const priorPos = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(370, 0)).add(new Point(-2, 1));

        const result = smartWrap(
            new LngLat(10, 0),
            priorPos,
            projectedCamera,
            context.worldCoordinateHelper);
        expect(result.lng).toBe(10);
    });
});
