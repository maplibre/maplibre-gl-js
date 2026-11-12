import {describe, expect, test, vi} from 'vitest';
import {EXTENT} from '../../data/extent.ts';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import {angularCoordinatesRadiansToVector, mercatorCoordinatesToAngularCoordinatesRadians, sphereSurfacePointToCoordinates} from './globe_utils.ts';
import {createTerrain, createTestCamera, expectToBeCloseToArray} from '../../util/test/util.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {tileCoordinatesToLocation} from './mercator_utils.ts';
import {differenceOfAnglesDegrees} from '../../util/util.ts';
import {createCameraState, getBearing, getCenterPoint} from '../camera_state.ts';
import {createGlobeCameraProjection, createVerticalPerspectiveCameraProjection, withGlobeness} from './camera_projection.ts';
import * as cameraMath from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';
import {calculateCameraOptionsFromTo, recenterOnTerrain, setLocationAtPoint, versorSetLocationAtPoint} from './camera_solvers.ts';

import type {CameraState} from '../camera_state.ts';
import type {CameraContext} from './camera_constrain.ts';

function testPlaneAgainstLngLat(lngDegrees: number, latDegrees: number, plane: number[]) {
    const lat = latDegrees / 180.0 * Math.PI;
    const lng = lngDegrees / 180.0 * Math.PI;
    const len = Math.cos(lat);
    const pointOnSphere = [
        Math.sin(lng) * len,
        Math.sin(lat),
        Math.cos(lng) * len
    ];
    return planeDistance(pointOnSphere, plane);
}

function planeDistance(point: number[], plane: number[]) {
    return point[0] * plane[0] + point[1] * plane[1] + point[2] * plane[2] + plane[3];
}

/** The context of a camera on the globe, `globeness` of the way from mercator to the vertical perspective. */
function createGlobeContext(globeness: number = 1): CameraContext {
    return {projection: withGlobeness(createGlobeCameraProjection(), globeness), constrainOverride: null};
}

/** A camera state 640 x 480 pixels with a 45° field of view. */
function createDefaultState(context: CameraContext): CameraState {
    return cameraUpdates.setFov(cameraUpdates.resize(createCameraState(), context, 640, 480), 45);
}

/**
 * How far the center moves in longitude when a drag of 20 pixels to the right ends at `screenPoint`, on a globe at
 * zoom 1 centered on 0, 0.
 */
function panTravel(screenPoint: Point): number {
    const context = createGlobeContext();
    let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
    state = cameraUpdates.setCenter(state, context, new LngLat(0, 0));
    const panDelta = new Point(20, 0);
    const location = cameraMath.screenPointToLocation(cameraMath.projectCamera(state, context.projection), context.projection, screenPoint.sub(panDelta));
    state = versorSetLocationAtPoint(state, context, location, screenPoint, panDelta);
    return Math.abs(differenceOfAnglesDegrees(0, state.center.lng));
}

describe('zero size', () => {
    test('does not throw when projected at a zero size', () => {
        for (const [width, height] of [[0, 480], [640, 0]]) {
            const context = createGlobeContext();
            const state = cameraUpdates.resize(createCameraState(), context, width, height);
            expect(() => cameraMath.projectCamera(state, context.projection)).not.toThrow();
        }
    });

    test('calculates matrices again once a zero width becomes a real size', () => {
        const projection = createGlobeCameraProjection();
        const {state, context} = createTestCamera({width: 0, height: 480, zoom: 3, center: [10, 20]}, projection);
        const resized = cameraMath.projectCamera(cameraUpdates.resize(state, context, 640, 480, true), projection);

        const expected = createTestCamera({width: 640, height: 480, zoom: 3, center: [10, 20]}, projection).projectedCamera;

        expect([...resized.modelViewProjectionMatrix]).toEqual([...expected.modelViewProjectionMatrix]);
        expect(cameraMath.screenPointToLocation(resized, projection, new Point(320, 240)).lng).toBeCloseTo(10, 6);
        expect(cameraMath.screenPointToLocation(resized, projection, new Point(320, 240)).lat).toBeCloseTo(20, 6);
    });
});

test('uses the overridden depth range until the override is cleared', () => {
    const context = createGlobeContext();
    const state = createDefaultState(context);

    const overridden = cameraUpdates.setNearFarZOverride(state, {nearZ: 5, farZ: 500});
    const overriddenCamera = cameraMath.projectCamera(overridden, context.projection);

    expect(overridden.nearFarZOverride).not.toBeNull();
    expect(overriddenCamera.nearZ).toBe(5);
    expect(overriddenCamera.farZ).toBe(500);

    const cleared = cameraUpdates.setNearFarZOverride(overridden, null);
    const clearedCamera = cameraMath.projectCamera(cleared, context.projection);

    expect(cleared.nearFarZOverride).toBeNull();
    expect(clearedCamera.nearZ).toBe(0.5);
    expect(clearedCamera.farZ).toBe(742.3859166956437);
});

describe('getProjectionData', () => {
    const context = createGlobeContext();
    const projectedCamera = cameraMath.projectCamera(createDefaultState(context), context.projection);

    test('mercator tile extents are set', () => {
        const projectionData = cameraMath.getProjectionData(projectedCamera, {overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0)});
        expectToBeCloseToArray(projectionData.tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
    });

    test('Globe transition is 0 when not applying the globe matrix', () => {
        const projectionData = cameraMath.getProjectionData(projectedCamera, {overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0)});
        expect(projectionData.projectionTransition).toBe(0);
    });

    test('Applying the globe matrix sets transition to something different than 0', () => {
        const projectionData = cameraMath.getProjectionData(projectedCamera, {overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0), applyGlobeMatrix: true});
        expect(projectionData.projectionTransition).not.toBe(0);
    });
});

test('getProjectionDataForCustomLayer transition is the in-progress globe transition', () => {
    const context = createGlobeContext(0.5);
    const projectedCamera = cameraMath.projectCamera(createDefaultState(context), context.projection);

    expect(cameraMath.getProjectionDataForCustomLayer(projectedCamera, true).projectionTransition).toBe(0.5);
});

describe('clipping plane', () => {
    const context = createGlobeContext();
    const projectedCamera = cameraMath.projectCamera(createDefaultState(context), context.projection);
    const projectionData = cameraMath.getProjectionData(projectedCamera, {overscaledTileID: new OverscaledTileID(0, 0, 0, 0, 0)});

    test('plane vector length <= 1 so they are not clipped by the near plane.', () => {
        const len = Math.sqrt(
            projectionData.clippingPlane[0] * projectionData.clippingPlane[0] +
            projectionData.clippingPlane[1] * projectionData.clippingPlane[1] +
            projectionData.clippingPlane[2] * projectionData.clippingPlane[2]
        );
        expect(len).toBeLessThanOrEqual(1);
    });

    test('camera is in positive halfspace', () => {
        expect(planeDistance(projectedCamera.cameraPosition as [number, number, number], projectionData.clippingPlane)).toBeGreaterThan(0);
    });

    test('coordinates 0E,0N are in positive halfspace', () => {
        expect(testPlaneAgainstLngLat(0, 0, projectionData.clippingPlane)).toBeGreaterThan(0);
    });

    test('coordinates 40E,0N are in positive halfspace', () => {
        expect(testPlaneAgainstLngLat(40, 0, projectionData.clippingPlane)).toBeGreaterThan(0);
    });

    test('coordinates 0E,90N are in negative halfspace', () => {
        expect(testPlaneAgainstLngLat(0, 90, projectionData.clippingPlane)).toBeLessThan(0);
    });

    test('coordinates 90E,0N are in negative halfspace', () => {
        expect(testPlaneAgainstLngLat(90, 0, projectionData.clippingPlane)).toBeLessThan(0);
    });

    test('coordinates 180E,0N are in negative halfspace', () => {
        expect(testPlaneAgainstLngLat(180, 0, projectionData.clippingPlane)).toBeLessThan(0);
    });
});

describe('projection', () => {
    test('mercator coordinate to sphere point', () => {
        const precisionDigits = 10;

        let projectedAngles;
        let projected;

        projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0.5, 0.5);
        expectToBeCloseToArray(projectedAngles, [0, 0], precisionDigits);
        projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
        expectToBeCloseToArray(projected, [0, 0, 1], precisionDigits);

        projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0, 0.5);
        expectToBeCloseToArray(projectedAngles, [Math.PI, 0], precisionDigits);
        projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
        expectToBeCloseToArray(projected, [0, 0, -1], precisionDigits);

        projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0.75, 0.5);
        expectToBeCloseToArray(projectedAngles, [Math.PI / 2.0, 0], precisionDigits);
        projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
        expectToBeCloseToArray(projected, [1, 0, 0], precisionDigits);

        projectedAngles = mercatorCoordinatesToAngularCoordinatesRadians(0.5, 0);
        expectToBeCloseToArray(projectedAngles, [0, 1.4844222297453324], precisionDigits); // ~0.47pi
        projected = angularCoordinatesRadiansToVector(projectedAngles[0], projectedAngles[1]) as [number, number, number];
        expectToBeCloseToArray(projected, [0, 0.99627207622075, 0.08626673833405434], precisionDigits);
    });

    test('camera position', () => {
        const precisionDigits = 10;
        const context = createGlobeContext();

        let state = createDefaultState(context);
        expectToBeCloseToArray(cameraMath.projectCamera(state, context.projection).cameraPosition as number[], [0, 0, 8.110445867263898], precisionDigits);

        state = cameraUpdates.resize(state, context, 512, 512);
        state = cameraUpdates.setZoom(state, context, -0.5);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 80));
        expectToBeCloseToArray(cameraMath.projectCamera(state, context.projection).cameraPosition as number[], [0, 2.2818294674820794, 0.40234810049271963], precisionDigits);

        state = cameraUpdates.setPitch(state, 35);
        state = cameraUpdates.setBearing(state, 70);
        expectToBeCloseToArray(cameraMath.projectCamera(state, context.projection).cameraPosition as number[], [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

        state = cameraUpdates.setRoll(state, 40);
        expectToBeCloseToArray(cameraMath.projectCamera(state, context.projection).cameraPosition as number[], [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

        state = cameraUpdates.setRoll(state, 180);
        expectToBeCloseToArray(cameraMath.projectCamera(state, context.projection).cameraPosition as number[], [-0.7098603286961542, 2.002400604307631, 0.6154310261827212], precisionDigits);

        state = cameraUpdates.setCenter(state, context, new LngLat(-10, 42));
        expectToBeCloseToArray(cameraMath.projectCamera(state, context.projection).cameraPosition as number[], [-3.8450970996236364, 2.9368285470351516, 4.311953269048194], precisionDigits);
    });

    test('sphere point to coordinate', () => {
        const precisionDigits = 10;
        let unprojected = sphereSurfacePointToCoordinates([0, 0, 1]);
        expect(unprojected.lng).toBeCloseTo(0, precisionDigits);
        expect(unprojected.lat).toBeCloseTo(0, precisionDigits);
        unprojected = sphereSurfacePointToCoordinates([0, 1, 0]);
        expect(unprojected.lng).toBeCloseTo(0, precisionDigits);
        expect(unprojected.lat).toBeCloseTo(90, precisionDigits);
        unprojected = sphereSurfacePointToCoordinates([1, 0, 0]);
        expect(unprojected.lng).toBeCloseTo(90, precisionDigits);
        expect(unprojected.lat).toBeCloseTo(0, precisionDigits);
    });

    const screenCenter = new Point(640 / 2, 480 / 2); // We need the exact screen center
    const screenTopEdgeCenter = new Point(640 / 2, 0);

    describe('project location to coordinates', () => {
        const precisionDigits = 10;

        test('basic test', () => {
            const context = createGlobeContext();
            const state = createDefaultState(context);

            for (const center of [new LngLat(0, 0), new LngLat(70, 50), new LngLat(0, 84)]) {
                const centered = cameraUpdates.setCenter(state, context, center);
                const projected = cameraMath.locationToScreenPoint(cameraMath.projectCamera(centered, context.projection), context.projection, centered.center);
                expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
                expect(projected.y).toBeCloseTo(screenCenter.y, precisionDigits);
            }
        });

        test('project a location that is slightly above and below map\'s center point', () => {
            const context = createGlobeContext();
            const state = cameraUpdates.setCenter(createDefaultState(context), context, new LngLat(0, 0));
            const projectedCamera = cameraMath.projectCamera(state, context.projection);

            let projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, new LngLat(0, 1));
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeLessThan(screenCenter.y);

            projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, new LngLat(0, -1));
            expect(projected.x).toBeCloseTo(screenCenter.x, precisionDigits);
            expect(projected.y).toBeGreaterThan(screenCenter.y);
        });
    });

    describe('unproject', () => {
        test('unproject screen center', () => {
            const precisionDigits = 10;
            const context = createGlobeContext();
            const state = createDefaultState(context);

            for (const centered of [state, cameraUpdates.setCenter(state, context, new LngLat(90.0, 0.0)), cameraUpdates.setCenter(state, context, new LngLat(0.0, 60.0))]) {
                const unprojected = cameraMath.screenPointToLocation(cameraMath.projectCamera(centered, context.projection), context.projection, screenCenter);
                expect(unprojected.lng).toBeCloseTo(centered.center.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(centered.center.lat, precisionDigits);
            }
        });

        test('unproject point to the side', () => {
            const precisionDigits = 10;
            const context = createGlobeContext();
            const projectedCamera = cameraMath.projectCamera(createDefaultState(context), context.projection);

            for (const coords of [new LngLat(0, 0), new LngLat(10, 20), new LngLat(15, -2)]) {
                const projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, coords);
                const unprojected = cameraMath.screenPointToLocation(projectedCamera, context.projection, projected);
                expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
                expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            }
        });

        test('unproject behind the pole', () => {
            // This test tries to unproject a point that is beyond the north pole
            // from the camera's point of view.
            // This particular case turned out to be problematic, hence this test.

            const precisionDigits = 10;
            const context = createGlobeContext();
            // Camera settings from the render test projection/globe/fill-planet-pole
            // See the expected result for how the globe should look with this camera.
            let state = cameraUpdates.resize(createDefaultState(context), context, 512, 512);
            state = cameraUpdates.setZoom(state, context, -0.5);
            state = cameraUpdates.setCenter(state, context, new LngLat(0, 80));
            const projectedCamera = cameraMath.projectCamera(state, context.projection);

            let coords: LngLat;
            let projected: Point;
            let unprojected: LngLat;

            coords = new LngLat(179.9, 71);
            projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, coords);
            unprojected = cameraMath.screenPointToLocation(projectedCamera, context.projection, projected);
            expect(projected.x).toBeCloseTo(256.2434702034287, precisionDigits);
            expect(projected.y).toBeCloseTo(48.27080146399297, precisionDigits);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);

            // Near the pole
            coords = new LngLat(179.9, 89.0);
            projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, coords);
            unprojected = cameraMath.screenPointToLocation(projectedCamera, context.projection, projected);
            expect(projected.x).toBeCloseTo(256.0140972925064, precisionDigits);
            expect(projected.y).toBeCloseTo(167.69159699932908, precisionDigits);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
        });

        test('unproject outside of sphere', () => {
            const precisionDigits = 10;
            const context = createGlobeContext();
            // Try unprojection a point somewhere above the western horizon
            const state = cameraUpdates.setBearing(cameraUpdates.setPitch(createDefaultState(context), 60), -90);
            const unprojected = cameraMath.screenPointToLocation(cameraMath.projectCamera(state, context.projection), context.projection, screenTopEdgeCenter);
            expect(unprojected.lng).toBeCloseTo(-28.990298145461963, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(0.0, precisionDigits);
        });

        test('unproject further outside of sphere clamps to horizon', () => {
            const context = createGlobeContext();
            const state = cameraUpdates.setBearing(cameraUpdates.setPitch(createDefaultState(context), 60), -90);
            const projectedCamera = cameraMath.projectCamera(state, context.projection);
            const screenPointAboveWesternHorizon = screenTopEdgeCenter;
            const screenPointFurtherAboveWesternHorizon = screenTopEdgeCenter.sub(new Point(0, -100));
            const unprojected = cameraMath.screenPointToLocation(projectedCamera, context.projection, screenPointAboveWesternHorizon);
            const unprojected2 = cameraMath.screenPointToLocation(projectedCamera, context.projection, screenPointFurtherAboveWesternHorizon);
            expect(unprojected.lat).toBeCloseTo(unprojected2.lat, 10);
            expect(unprojected.lng).toBeCloseTo(unprojected2.lng, 10);
        });
    });

    describe('setLocationAtPoint', () => {
        const precisionDigits = 10;

        test.each([
            {name: 'identity', bearing: 0, coords: new LngLat(0, 0), point: new Point(320, 240)},
            {name: 'offset lnglat', bearing: 0, coords: new LngLat(5, 10), point: new Point(320, 240)},
            {name: 'offset pixel + lnglat', bearing: 0, coords: new LngLat(5, 10), point: new Point(330, 240)},
            {name: 'larger offset', bearing: 0, coords: new LngLat(30, -2), point: new Point(250, 180)},
            {name: 'rotated identity', bearing: 90, coords: new LngLat(0, 0), point: new Point(320, 240)},
            {name: 'rotated offset lnglat', bearing: 90, coords: new LngLat(5, 0), point: new Point(320, 240)},
            {name: 'rotated offset pixel + lnglat', bearing: 90, coords: new LngLat(0, 10), point: new Point(350, 240)},
        ])('$name', ({bearing, coords, point}) => {
            const context = createGlobeContext();
            let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
            state = cameraUpdates.setBearing(state, bearing);

            state = setLocationAtPoint(state, context, coords, point);

            const projectedCamera = cameraMath.projectCamera(state, context.projection);
            const unprojected = cameraMath.screenPointToLocation(projectedCamera, context.projection, point);
            const projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, coords);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
            expect(projected.x).toBeCloseTo(point.x, precisionDigits);
            expect(projected.y).toBeCloseTo(point.y, precisionDigits);
        });

        test('rotated offset pixel + lnglat moves the center to where the location lands at the point', () => {
            const context = createGlobeContext();
            let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
            state = cameraUpdates.setBearing(state, 90);

            state = setLocationAtPoint(state, context, new LngLat(0, 10), new Point(350, 240));

            expect(state.center.lat).toBeCloseTo(20.659450722109348, precisionDigits);
        });

        test('ignores the elevation parameter when rendering the globe', () => {
            const context = createGlobeContext();
            let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
            const coords = new LngLat(5, 10);
            const point = new Point(320, 240);

            state = setLocationAtPoint(state, context, coords, point, 1000);

            const unprojected = cameraMath.screenPointToLocationAtElevation(cameraMath.projectCamera(state, context.projection), context.projection, point, 1000);
            expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
            expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
        });

        test('solves on the plane at the given elevation when rendering mercator', () => {
            const globeContext = createGlobeContext();
            let state = cameraUpdates.setZoom(createDefaultState(globeContext), globeContext, 5);
            state = cameraUpdates.setPitch(state, 40);
            const mercatorContext = createGlobeContext(0);
            const coords = new LngLat(5, 10);
            const point = new Point(320, 200);

            state = setLocationAtPoint(state, mercatorContext, coords, point, 500);

            const unprojected = cameraMath.screenPointToLocationAtElevation(cameraMath.projectCamera(state, mercatorContext.projection), mercatorContext.projection, point, 500);
            // exact up to the center-latitude change the solve itself causes (~1e-5 deg)
            expect(unprojected.lng).toBeCloseTo(coords.lng, 3);
            expect(unprojected.lat).toBeCloseTo(coords.lat, 3);
        });

        test('does not move the camera where no center puts the location at the point', () => {
            const context = createGlobeContext();
            const state = cameraUpdates.setZoom(createDefaultState(context), context, 1);

            const moved = setLocationAtPoint(state, context, new LngLat(0, 89), new Point(470, 240));

            expect(moved.center).toEqual(new LngLat(0, 0));
        });
    });
});

describe('isPointOnMapSurface', () => {
    const {projectedCamera, context} = createTestCamera({width: 640, height: 480, zoom: 1}, createGlobeCameraProjection());

    test('Top screen edge', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(320, 0))).toBe(false);
    });

    test('Screen center', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(320, 240))).toBe(true);
    });

    test('Top', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(320, 104))).toBe(false);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(320, 105))).toBe(true);
    });

    test('Bottom', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(320, 480 - 105))).toBe(true);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(320, 480 - 104))).toBe(false);
    });

    test('Left', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(184, 240))).toBe(false);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(185, 240))).toBe(true);
    });

    test('Right', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(640 - 185, 240))).toBe(true);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(640 - 184, 240))).toBe(false);
    });

    test('Diagonal', () => {
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(223, 147))).toBe(true);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, new Point(221, 144))).toBe(false);
    });

    test('isPointOnMapSurface is false for point in sky, and true for point on surface', () => {
        const pitched = createTestCamera({maxPitch: 85, width: 640, height: 480, zoom: 11, pitch: 85}, createGlobeCameraProjection());
        expect(cameraMath.isPointOnMapSurface(pitched.projectedCamera, pitched.context.projection, new Point(320, 0))).toBe(false);
        expect(cameraMath.isPointOnMapSurface(pitched.projectedCamera, pitched.context.projection, new Point(320, 479))).toBe(true);
    });
});

test('pointCoordinate', () => {
    const precisionDigits = 10;
    const context = createGlobeContext();
    const projectedCamera = cameraMath.projectCamera(createDefaultState(context), context.projection);

    for (const coords of [new LngLat(0, 0), new LngLat(10, 20)]) {
        const coordsMercator = MercatorCoordinate.fromLngLat(coords);
        const projected = cameraMath.locationToScreenPoint(projectedCamera, context.projection, coords);
        const unprojectedCoordinates = cameraMath.screenPointToMercatorCoordinate(projectedCamera, context.projection, projected);
        expect(unprojectedCoordinates.x).toBeCloseTo(coordsMercator.x, precisionDigits);
        expect(unprojectedCoordinates.y).toBeCloseTo(coordsMercator.y, precisionDigits);
    }
});

describe('getBounds', () => {
    const precisionDigits = 10;

    test('basic', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.resize(createCameraState(), context, 640, 480);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 0));
        state = cameraUpdates.setZoom(state, context, 1);

        const bounds = cameraMath.getBounds(cameraMath.projectCamera(state, context.projection), context.projection);
        expect(bounds._ne.lat).toBeCloseTo(79.3636705287052, precisionDigits);
        expect(bounds._ne.lng).toBeCloseTo(79.36367052870514, precisionDigits);
        expect(bounds._sw.lat).toBeCloseTo(-79.3636705287052, precisionDigits);
        expect(bounds._sw.lng).toBeCloseTo(-79.3636705287052, precisionDigits);
    });

    test('zoomed in', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.resize(createCameraState(), context, 640, 480);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 0));
        state = cameraUpdates.setZoom(state, context, 4);

        const bounds = cameraMath.getBounds(cameraMath.projectCamera(state, context.projection), context.projection);
        expect(bounds._ne.lat).toBeCloseTo(11.76627084591695, precisionDigits);
        expect(bounds._ne.lng).toBeCloseTo(16.124697669965144, precisionDigits);
        expect(bounds._sw.lat).toBeCloseTo(-11.76627084591695, precisionDigits);
        expect(bounds._sw.lng).toBeCloseTo(-16.124697669965144, precisionDigits);
    });

    test('looking at south pole', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.resize(createCameraState(), context, 640, 480);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, -84));
        state = cameraUpdates.setZoom(state, context, -2);

        const bounds = cameraMath.getBounds(cameraMath.projectCamera(state, context.projection), context.projection);
        expect(bounds._ne.lat).toBeCloseTo(-6.299534770946991, precisionDigits);
        expect(bounds._ne.lng).toBeCloseTo(180, precisionDigits);
        expect(bounds._sw.lat).toBeCloseTo(-90, precisionDigits);
        expect(bounds._sw.lng).toBeCloseTo(-180, precisionDigits);
    });

    test('looking at south edge of mercator', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.resize(createCameraState(), context, 640, 480);
        state = cameraUpdates.setCenter(state, context, new LngLat(-163, -83));
        state = cameraUpdates.setZoom(state, context, 3);

        const bounds = cameraMath.getBounds(cameraMath.projectCamera(state, context.projection), context.projection);
        expect(bounds._ne.lat).toBeCloseTo(-79.75570418234764, precisionDigits);
        expect(bounds._ne.lng).toBeCloseTo(-124.19771985801174, precisionDigits);
        expect(bounds._sw.lat).toBeCloseTo(-85.59109073899032, precisionDigits);
        expect(bounds._sw.lng).toBeCloseTo(-201.80228014198985, precisionDigits);
    });
});

describe('projectTileCoordinates', () => {
    const precisionDigits = 10;
    const context = createGlobeContext();
    let base = cameraUpdates.resize(createCameraState(), context, 512, 512);
    base = cameraUpdates.setCenter(base, context, new LngLat(10.0, 50.0));
    base = cameraUpdates.setZoom(base, context, -1);

    test('basic', () => {
        const projectedCamera = cameraMath.projectCamera(base, context.projection);

        const projection = cameraMath.projectTileCoordinates(projectedCamera, 1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(0.008635590705360347, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.16970500709841846, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(781.0549201758624, precisionDigits);
        expect(projection.isOccluded).toBe(false);
    });

    test('rotated', () => {
        const projectedCamera = cameraMath.projectCamera(cameraUpdates.setPitch(cameraUpdates.setBearing(base, 12), 10), context.projection);

        const projection = cameraMath.projectTileCoordinates(projectedCamera, 1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(-0.026585319983152694, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.15506884411121183, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(788.4423931260653, precisionDigits);
        expect(projection.isOccluded).toBe(false);
    });

    test('occluded by planet', () => {
        const projectedCamera = cameraMath.projectCamera(cameraUpdates.setPitch(cameraUpdates.setBearing(base, -90), 60), context.projection);

        const projection = cameraMath.projectTileCoordinates(projectedCamera, 8192, 8192, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(0.22428309892086878, precisionDigits);
        expect(projection.point.y).toBeCloseTo(-0.4462620847133465, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(822.280942015371, precisionDigits);
        expect(projection.isOccluded).toBe(true);
    });

    test('elevated points use line-of-sight occlusion', () => {
        const projectedCamera = cameraMath.projectCamera(cameraUpdates.setPitch(cameraUpdates.setBearing(base, -90), 60), context.projection);

        const visibleProjection = cameraMath.projectTileCoordinates(projectedCamera, 8192, 8192, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 2000000);
        expect(visibleProjection.isOccluded).toBe(false);

        const occludedProjection = cameraMath.projectTileCoordinates(projectedCamera, 8192, 8192, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 1000);
        expect(occludedProjection.isOccluded).toBe(true);
    });

    test('points below the surface use ground-anchor occlusion', () => {
        const projectedCamera = cameraMath.projectCamera(base, context.projection);

        const projection = cameraMath.projectTileCoordinates(projectedCamera, 1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), -100);
        expect(projection.isOccluded).toBe(false);
    });
});

describe('isLocationOccluded', () => {
    const context = createGlobeContext();
    let state = cameraUpdates.resize(createCameraState(), context, 512, 512);
    state = cameraUpdates.setCenter(state, context, new LngLat(0.0, 0.0));
    state = cameraUpdates.setZoom(state, context, -1);
    const projectedCamera = cameraMath.projectCamera(state, context.projection);

    test('center', () => {
        expect(cameraMath.isLocationOccluded(projectedCamera, context.projection, new LngLat(0, 0))).toBe(false);
    });

    test('center from tile', () => {
        expect(cameraMath.isLocationOccluded(projectedCamera, context.projection, tileCoordinatesToLocation(0, 0, new CanonicalTileID(1, 1, 1)))).toBe(false);
    });

    test('backside', () => {
        expect(cameraMath.isLocationOccluded(projectedCamera, context.projection, new LngLat(179.9, 0))).toBe(true);
    });

    test('backside from tile', () => {
        expect(cameraMath.isLocationOccluded(projectedCamera, context.projection, tileCoordinatesToLocation(0, 0, new CanonicalTileID(1, 0, 1)))).toBe(true);
    });

    test('barely visible', () => {
        expect(cameraMath.isLocationOccluded(projectedCamera, context.projection, new LngLat(84.49, 0))).toBe(false);
    });

    test('barely hidden', () => {
        expect(cameraMath.isLocationOccluded(projectedCamera, context.projection, new LngLat(84.50, 0))).toBe(true);
    });
});

describe('getCameraAltitude', () => {
    test('matches the mercator camera at the same zoom and pitch', () => {
        const globe = createTestCamera({width: 512, height: 512, zoom: 14, center: [10, 50], pitch: 45}, createGlobeCameraProjection());
        const mercator = createTestCamera({width: 512, height: 512, zoom: 14, center: [10, 50], pitch: 45});

        // the globe is a sphere here, mercator a plane: the altitudes agree to within half a metre
        expect(cameraMath.getCameraAltitude(globe.projectedCamera)).toBeCloseTo(cameraMath.getCameraAltitude(mercator.projectedCamera), 0);
    });

    test('follows the vertical perspective camera at low zoom and high pitch', () => {
        const globe = createTestCamera({maxPitch: 180, width: 512, height: 512, zoom: 4, center: [10, 50], pitch: 100}, createGlobeCameraProjection());
        const vp = createTestCamera({maxPitch: 180, width: 512, height: 512, zoom: 4, center: [10, 50], pitch: 100}, createVerticalPerspectiveCameraProjection());
        const globeCameraLngLat = cameraMath.getCameraLngLat(globe.projectedCamera, globe.context.projection);
        const vpCameraLngLat = cameraMath.getCameraLngLat(vp.projectedCamera, vp.context.projection);

        expect(cameraMath.getCameraAltitude(globe.projectedCamera)).toBeGreaterThan(0);
        expect(cameraMath.getCameraAltitude(globe.projectedCamera)).toBeCloseTo(cameraMath.getCameraAltitude(vp.projectedCamera), 6);
        expect(globeCameraLngLat.lat).toBeCloseTo(vpCameraLngLat.lat, 9);

        const lifted = calculateCameraOptionsFromTo(globe.state, globe.context.projection, globeCameraLngLat, 0, globe.state.center, 0);
        const liftedVp = calculateCameraOptionsFromTo(vp.state, vp.context.projection, vpCameraLngLat, 0, vp.state.center, 0);
        expect(lifted.pitch).toBeCloseTo(liftedVp.pitch, 9);
        expect(lifted.zoom).toBeCloseTo(liftedVp.zoom, 9);
    });

    test('reads the camera from the projection the globeness selects', () => {
        const {state} = createTestCamera({maxPitch: 180, width: 512, height: 512, zoom: 4, center: [10, 50], pitch: 100}, createGlobeCameraProjection());
        const mercator = createTestCamera({maxPitch: 180, width: 512, height: 512, zoom: 4, center: [10, 50], pitch: 100});
        const vp = createTestCamera({maxPitch: 180, width: 512, height: 512, zoom: 4, center: [10, 50], pitch: 100}, createVerticalPerspectiveCameraProjection());

        const asMercator = withGlobeness(createGlobeCameraProjection(), 0);
        const asMercatorCamera = cameraMath.projectCamera(state, asMercator);
        expect(cameraMath.getCameraAltitude(asMercatorCamera)).toBeLessThan(0);
        expect(cameraMath.getCameraAltitude(asMercatorCamera)).toBeCloseTo(cameraMath.getCameraAltitude(mercator.projectedCamera), 6);
        expect(calculateCameraOptionsFromTo(state, asMercator, cameraMath.getCameraLngLat(asMercatorCamera, asMercator), 0, state.center, 0).pitch).toBeCloseTo(90, 9);

        const asGlobe = createGlobeCameraProjection();
        const asGlobeCamera = cameraMath.projectCamera(state, asGlobe);
        expect(cameraMath.getCameraAltitude(asGlobeCamera)).toBeGreaterThan(0);
        expect(cameraMath.getCameraAltitude(asGlobeCamera)).toBeCloseTo(cameraMath.getCameraAltitude(vp.projectedCamera), 6);
        expect(calculateCameraOptionsFromTo(state, asGlobe, cameraMath.getCameraLngLat(asGlobeCamera, asGlobe), 0, state.center, 0).pitch).toBeGreaterThan(90);
    });

    test('matches the mercator camera while the globe is rendered as a sphere', () => {
        const globe = createTestCamera({width: 512, height: 512, zoom: 2, center: [0, 0]}, createGlobeCameraProjection());
        const mercator = createTestCamera({width: 512, height: 512, zoom: 2, center: [0, 0]});

        expect(cameraMath.getCameraAltitude(globe.projectedCamera)).toBeCloseTo(cameraMath.getCameraAltitude(mercator.projectedCamera), 6);
    });
});

test('recenterOnTerrain adjusts elevation, zoom and center to the terrain under the rendered projection', () => {
    const terrain = createTerrain();
    terrain.getElevationForLngLat = () => 1000;
    const {state, context} = createTestCamera({width: 512, height: 512, zoom: 13, center: [8, 47], pitch: 60}, withGlobeness(createGlobeCameraProjection(), 0));

    const recentered = recenterOnTerrain(state, context, terrain);

    expect(recentered.elevation).toBe(1000);
    expect(recentered.zoom).toBeCloseTo(13.7376, 4);
    expect(recentered.center.lng).toBe(8);
    expect(recentered.center.lat).toBeCloseTo(46.9844, 4);
});

test('recenterOnTerrain does not jump center on globe + terrain (#7025)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = createGlobeContext();
    const state = cameraUpdates.setCenter(createDefaultState(context), context, new LngLat(10, 50));
    const terrain = {
        getElevationForLngLatZoom: () => 200
    } as any;

    const recentered = recenterOnTerrain(state, context, terrain);

    expect(recentered.center.lng).toBeCloseTo(state.center.lng, 10);
    expect(recentered.center.lat).toBeCloseTo(state.center.lat, 10);
});

test('the center reaches the pole', () => {
    const context = createGlobeContext();
    const state = cameraUpdates.setCenter(createDefaultState(context), context, new LngLat(0, 90));

    expect(state.center.lat).toBe(90);
});

test('the center moves back towards the mercator edge as the area past it outgrows the viewport', () => {
    const context = createGlobeContext();
    let state = cameraUpdates.setCenter(createDefaultState(context), context, new LngLat(0, 90));
    state = cameraUpdates.setZoom(state, context, 2.5);

    expect(state.center.lat).toBeCloseTo(86.8327, 4);
});

describe('versorSetLocationAtPoint', () => {
    const precisionDigits = 4;

    test('round-trip accuracy', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        const coords = new LngLat(20, 30);
        const point = new Point(280, 200);

        state = versorSetLocationAtPoint(state, context, coords, point, undefined, false);

        const unprojected = cameraMath.screenPointToLocation(cameraMath.projectCamera(state, context.projection), context.projection, point);
        expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
        expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
    });

    test('round-trip accuracy at center', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        const coords = new LngLat(10, 15);
        const point = new Point(320, 240);

        state = versorSetLocationAtPoint(state, context, coords, point);

        const unprojected = cameraMath.screenPointToLocation(cameraMath.projectCamera(state, context.projection), context.projection, point);
        expect(unprojected.lng).toBeCloseTo(coords.lng, precisionDigits);
        expect(unprojected.lat).toBeCloseTo(coords.lat, precisionDigits);
    });

    test('near-pole panning stays finite', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 80));

        state = versorSetLocationAtPoint(state, context, new LngLat(10, 85), new Point(300, 230));

        expect(isNaN(state.center.lng)).toBe(false);
        expect(isNaN(state.center.lat)).toBe(false);
        expect(isNaN(getBearing(state))).toBe(false);
    });

    test('identical source and target points leave the center unchanged', () => {
        const context = createGlobeContext();
        const state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        const point = new Point(320, 240);
        const coords = cameraMath.screenPointToLocation(cameraMath.projectCamera(state, context.projection), context.projection, point);

        const moved = versorSetLocationAtPoint(state, context, coords, point);

        expect(moved.center.lng).toBeCloseTo(state.center.lng, precisionDigits);
        expect(moved.center.lat).toBeCloseTo(state.center.lat, precisionDigits);
    });

    test('bearing changes when panning off-center without a fixed bearing', () => {
        const context = createGlobeContext();
        const state = cameraUpdates.setZoom(createDefaultState(context), context, 1);

        const moved = versorSetLocationAtPoint(state, context, new LngLat(20, 30), new Point(250, 180), undefined, false);

        expect(getBearing(moved)).not.toBeCloseTo(getBearing(state), 1);
    });

    test('target points that miss the globe are ignored without a pan delta', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        state = cameraUpdates.setCenter(state, context, new LngLat(5, 10));
        const projectedCamera = cameraMath.projectCamera(state, context.projection);
        const point = new Point(620, 240);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, point)).toBe(false);
        const coords = cameraMath.screenPointToLocation(projectedCamera, context.projection, point);

        const moved = versorSetLocationAtPoint(state, context, coords, point);

        expect(moved.center.lng).toBe(state.center.lng);
        expect(moved.center.lat).toBe(state.center.lat);
        expect(getBearing(moved)).toBe(getBearing(state));
    });

    test('panning continues once the cursor leaves the globe', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        state = cameraUpdates.setCenter(state, context, new LngLat(5, 10));
        const projectedCamera = cameraMath.projectCamera(state, context.projection);
        const point = new Point(620, 240);
        expect(cameraMath.isPointOnMapSurface(projectedCamera, context.projection, point)).toBe(false);
        const coords = cameraMath.screenPointToLocation(projectedCamera, context.projection, point);

        const moved = versorSetLocationAtPoint(state, context, coords, point, new Point(20, 0));

        expect(moved.center.lng).not.toBe(state.center.lng);
        expect(isNaN(moved.center.lng)).toBe(false);
        expect(isNaN(moved.center.lat)).toBe(false);
        expect(getBearing(moved)).toBe(getBearing(state));
    });

    test('panning does not freeze near a centred pole', () => {
        // With the pole centred the dial supplies all of the longitude change, so if the dial
        // gives up the drag stops moving entirely.
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 90));
        const projectedCamera = cameraMath.projectCamera(state, context.projection);
        const pole = cameraMath.locationToScreenPoint(projectedCamera, context.projection, new LngLat(0, 90));
        const cursor = new Point(pole.x + 10, pole.y);
        const panDelta = new Point(0, 8); // tangential, so it sweeps around the pole
        const location = cameraMath.screenPointToLocation(projectedCamera, context.projection, cursor.sub(panDelta));

        const moved = versorSetLocationAtPoint(state, context, location, cursor, panDelta);

        expect(Math.abs(differenceOfAnglesDegrees(state.center.lng, moved.center.lng))).toBeGreaterThan(1);
    });

    test('dragging past the pole stops on it', () => {
        const context = createGlobeContext();
        let state = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 88));
        const centerPoint = getCenterPoint(state);
        const panDelta = new Point(0, 100);
        const location = cameraMath.screenPointToLocation(cameraMath.projectCamera(state, context.projection), context.projection, centerPoint);

        const moved = versorSetLocationAtPoint(state, context, location, centerPoint.add(panDelta), panDelta);

        expect(moved.center.lat).toBe(90);
    });

    test('panning off the globe is slower than on it', () => {
        const onGlobe = new Point(340, 240);
        const offGlobe = new Point(620, 240);
        const context = createGlobeContext();
        let reference = cameraUpdates.setZoom(createDefaultState(context), context, 1);
        reference = cameraUpdates.setCenter(reference, context, new LngLat(0, 0));
        const referenceCamera = cameraMath.projectCamera(reference, context.projection);
        expect(cameraMath.isPointOnMapSurface(referenceCamera, context.projection, onGlobe)).toBe(true);
        expect(cameraMath.isPointOnMapSurface(referenceCamera, context.projection, offGlobe)).toBe(false);
        expect(panTravel(offGlobe)).toBeLessThan(panTravel(onGlobe));
    });
});
