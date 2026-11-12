import {describe, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';
import {LngLat, earthRadius} from '../geo/lng_lat.ts';
import {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import {fixedLngLat, fixedCoord} from '../../test/unit/lib/fixed.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {getMercatorHorizon} from '../geo/projection/mercator_utils.ts';
import {createCoverageIndex, createDEM, createDEMTerrain, createPainter, createRasterDEMTileManager, createTerrain, expectToBeCloseToArray, createIdentityCrsCamera, createTestCamera, createWrappingWorldCrs} from '../util/test/util.ts';
import {CRSWorldCoordinateHelper} from '../geo/projection/crs.ts';
import {Terrain} from '../render/terrain.ts';
import {EXTENT} from '../data/extent.ts';
import {MercatorCoordinate, mercatorZfromAltitude} from '../geo/mercator_coordinate.ts';
import {createCameraViewState, getMaxBounds} from './camera_view_state.ts';
import {createCameraContext} from './camera_context.ts';
import {projectCamera} from './project_camera.ts';
import {getCameraMath} from './camera_math_factory.ts';
import {raycastTerrain, screenPointToMercatorCoordinateAtZ} from './mercator_camera_math.ts';
import {calculateCenterFromCameraLngLatAlt, resize, setBearing, setCenter, setElevation, setFov, setMaxBounds, setMaxPitch, setMaxZoom, setMinElevationForCurrentTile, setMinPitch, setMinZoom, setPadding, setPitch, setRenderWorldCopies, setRoll, setZoom} from './camera_updates.ts';
import {getCameraSolver} from './camera_solver_factory.ts';

import type {Tile} from '../tile/tile.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';
import type {MercatorProjectedCamera} from './projected_camera.ts';

/** The camera a state projects to in a mercator context, typed for the functions in `mercator_camera_math.ts`. */
function projectMercator(view: CameraViewState, context: CameraContext): MercatorProjectedCamera {
    return projectCamera(view, context) as MercatorProjectedCamera;
}

/** A 512 pixel square mercator camera, its center, zoom and pitch set in that order. */
function createCameraAt(center: LngLat, zoom: number, pitch: number = 0): {state: CameraViewState; context: CameraContext} {
    const context = createCameraContext();
    let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    view = resize(view, context, 512, 512);
    view = setCenter(view, context, center);
    view = setZoom(view, context, zoom);
    view = setPitch(view, pitch);
    return {state: view, context};
}

function expectWorldPixelsClose(actual: MercatorCoordinate, expected: MercatorCoordinate, worldSize: number): void {
    expect(Math.abs(actual.x - expected.x) * worldSize).toBeLessThan(1e-3);
    expect(Math.abs(actual.y - expected.y) * worldSize).toBeLessThan(1e-3);
}

describe('mercator camera', () => {
    test('creates a camera', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        let projectedCamera = projectMercator(view, context);
        expect(view.unmodified).toBe(true);
        expect(projectedCamera.tileSize).toBe(512);
        expect(projectedCamera.worldSize).toBe(512);
        expect(projectedCamera.width).toBe(500);
        expect(view.minZoom).toBe(0);
        expect(view.minPitch).toBe(0);
        // Support signed zero
        expect(projectedCamera.bearing === 0 ? 0 : projectedCamera.bearing).toBe(0);
        view = setBearing(view, 1);
        projectedCamera = projectMercator(view, context);
        expect(projectedCamera.bearing).toBe(1);
        expect([...projectedCamera.rotationMatrix]).toEqual([0.9998477101325989, -0.017452405765652657, 0.017452405765652657, 0.9998477101325989]);
        view = setBearing(view, 0);
        projectedCamera = projectMercator(view, context);
        expect(projectedCamera.bearing).toBe(0);
        expect(view.unmodified).toBe(false);
        view = setMinZoom(view, context, 10);
        expect(view.minZoom).toBe(10);
        view = setMaxZoom(view, context, 10);
        expect(view.maxZoom).toBe(10);
        expect(view.minZoom).toBe(10);
        expect(view.center).toEqual({lng: 0, lat: 0});
        expect(view.maxZoom).toBe(10);
        view = setMinPitch(view, 10);
        expect(view.minPitch).toBe(10);
        view = setMaxPitch(view, 10);
        expect(view.maxPitch).toBe(10);
        projectedCamera = projectMercator(view, context);
        expect(new Point(projectedCamera.width, projectedCamera.height).equals(new Point(500, 500))).toBe(true);
        expect(projectedCamera.centerPoint.equals(new Point(250, 250))).toBe(true);
        expect(projectedCamera.height).toBe(500);
        expect(projectedCamera.nearZ).toBe(10);
        expect(projectedCamera.farZ).toBe(804.8028169246645);
        expect([...projectedCamera.projectionMatrix]).toEqual([3, 0, 0, 0, 0, 3, 0, 0, -0, 0, -1.0251635313034058, -1, 0, 0, -20.25163459777832, 0]);
        expectToBeCloseToArray([...projectedCamera.inverseProjectionMatrix], [0.3333333333333333, 0, 0, 0, 0, 0.3333333333333333, 0, 0, 0, 0, 0, -0.04937872980873673, 0, 0, -1, 0.05062127019126326], 10);
        expectToBeCloseToArray([...mat4.multiply(new Float64Array(16), projectedCamera.projectionMatrix, projectedCamera.inverseProjectionMatrix)], [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1], 6);
        expect([...projectedCamera.modelViewProjectionMatrix]).toEqual([3, 0, 0, 0, 0, -2.954423259036624, -0.1780177690666898, -0.17364817766693033, -0, 0.006822967915294533, -0.013222891287479163, -0.012898324631281611, -786432, 774484.3308168967, 47414.91102496082, 46270.827886319785]);
        expect(fixedLngLat(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(250, 250)))).toEqual({lng: 0, lat: 0});
        expect(fixedCoord(getCameraMath(projectedCamera).screenPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(250, 250)))).toEqual({x: 0.5, y: 0.5, z: 0});
        expect(fixedCoord(screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(250, 250), 1))).toEqual({x: 0.5, y: 0.5000000044, z: 1});
        expect(getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(0, 0))).toEqual({x: 250, y: 250});
    });

    test('setMinElevationForCurrentTile below sea level moves the far plane', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, 11.46);
        view = setPitch(view, 60);

        view = setMinElevationForCurrentTile(view, -455.5);

        expect(projectMercator(view, context).farZ).toBe(1870.705545073004);
    });

    test('does not throw on bad center', () => {
        expect(() => {
            const context = createCameraContext();
            let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
            view = resize(view, context, 500, 500);
            view = setCenter(view, context, new LngLat(50, -90));
            projectMercator(view, context);
        }).not.toThrow();
    });

    test('does not throw on a zero size', () => {
        for (const [width, height] of [[0, 500], [500, 0], [0, 0]]) {
            const context = createCameraContext();
            const view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
            expect(() => projectMercator(resize(view, context, width, height), context)).not.toThrow();
            const resized = resize(view, context, width, height);
            expect(resized.width).toBe(width);
            expect(resized.height).toBe(height);
        }
    });

    test('does not throw when a sized camera is resized to a zero width', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        expect(() => {
            view = resize(view, context, 0, 500);
            projectMercator(view, context);
        }).not.toThrow();
        expect(() => projectMercator(setZoom(view, context, 3), context)).not.toThrow();
    });

    test('calculates matrices again once a zero width becomes a real size', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 0, 500);
        view = setZoom(view, context, 5);
        view = setPitch(view, 30);
        view = setBearing(view, 45);
        view = setCenter(view, context, new LngLat(10, 20));
        projectMercator(view, context);
        view = resize(view, context, 500, 500);
        const projectedCamera = projectMercator(view, context);

        let expectedState = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        expectedState = resize(expectedState, context, 500, 500);
        expectedState = setZoom(expectedState, context, 5);
        expectedState = setPitch(expectedState, 30);
        expectedState = setBearing(expectedState, 45);
        expectedState = setCenter(expectedState, context, new LngLat(10, 20));
        const expected = projectMercator(expectedState, context);

        expect([...projectedCamera.modelViewProjectionMatrix]).toEqual([...expected.modelViewProjectionMatrix]);
        expect([...projectedCamera.cameraPosition]).toEqual([...expected.cameraPosition]);
        expect(fixedLngLat(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(250, 250)))).toEqual({lng: 10, lat: 20});
        expect(fixedCoord(getCameraMath(projectedCamera).screenPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(250, 250)))).toEqual(fixedCoord(getCameraMath(expected).screenPointToMercatorCoordinate(expected, context.worldCoordinateHelper, new Point(250, 250))));
    });

    test('setLocationAtPoint', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, 4);
        expect(view.center).toEqual({lng: 0, lat: 0});
        view = getCameraSolver(context).setLocationAtPoint(view, context, new LngLat(13, 10), new Point(15, 45));
        const projectedCamera = projectMercator(view, context);
        expect(fixedLngLat(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAtPoint tilted', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, 4);
        view = setPitch(view, 50);
        expect(view.center).toEqual({lng: 0, lat: 0});
        view = getCameraSolver(context).setLocationAtPoint(view, context, new LngLat(13, 10), new Point(15, 45));
        const projectedCamera = projectMercator(view, context);
        expect(fixedLngLat(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAtPoint tilted rolled', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, 4);
        view = setPitch(view, 50);
        view = setRoll(view, 50);
        expect(view.center).toEqual({lng: 0, lat: 0});
        view = getCameraSolver(context).setLocationAtPoint(view, context, new LngLat(13, 10), new Point(15, 45));
        const projectedCamera = projectMercator(view, context);
        expect(fixedLngLat(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAtPoint wraps a center it leaves in place', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, 4);
        view = setCenter(view, context, new LngLat(360, 0));
        view = getCameraSolver(context).setLocationAtPoint(view, context, view.center, projectMercator(view, context).centerPoint);
        expect(view.center).toEqual({lng: 0, lat: 0});
    });

    test('getCameraForLocationAtPoint gives the camera setLocationAtPoint moves to, without moving it', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: false});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, 4);
        const centerPoint = projectMercator(view, context).centerPoint;

        const camera = getCameraSolver(context).getCameraForLocationAtPoint(view, context, new LngLat(179, 0), centerPoint);

        expect(view.center).toEqual({lng: 0, lat: 0});
        expect(camera.center.lng).toBeLessThan(179);
        expect(getCameraSolver(context).getCameraForLocationAtPoint(view, context, view.center, centerPoint)).toBeNull();
        view = getCameraSolver(context).setLocationAtPoint(view, context, new LngLat(179, 0), centerPoint);
        expect(view.center).toEqual(camera.center);
        expect(view.zoom).toBe(camera.zoom);
    });

    test('has a default zoom', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        const projectedCamera = projectMercator(view, context);
        expect(projectedCamera.tileZoom).toBe(0);
        expect(projectedCamera.tileZoom).toBe(projectedCamera.zoom);
    });

    test('set zoom inits tileZoom with zoom value', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60});
        view = setZoom(view, context, 5);
        expect(projectMercator(view, context).tileZoom).toBe(5);
    });

    test('set zoom clamps tileZoom to non negative value', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: -2, maxZoom: 22, minPitch: 0, maxPitch: 60});
        view = setZoom(view, context, -2);
        expect(projectMercator(view, context).tileZoom).toBe(0);
    });

    test('set fov', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setFov(view, 10);
        expect(projectMercator(view, context).fov).toBe(10);
        view = setFov(view, 10);
        expect(projectMercator(view, context).fov).toBe(10);
    });

    test('lngRange & latRange constrain zoom and center', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setCenter(view, context, new LngLat(0, 0));
        view = setZoom(view, context, 10);
        view = resize(view, context, 500, 500);

        view = setMaxBounds(view, context, new LngLatBounds([-5, -5, 5, 5]));

        view = setZoom(view, context, 0);
        expect(view.zoom).toBe(5.1357092861044045);

        view = setCenter(view, context, new LngLat(-50, -30));
        expect(view.center).toEqual(new LngLat(0, -0.0063583052861417855));

        view = setZoom(view, context, 10);
        view = setCenter(view, context, new LngLat(-50, -30));
        expect(view.center).toEqual(new LngLat(-4.828338623046875, -4.828969771321582));
    });

    test('constrains center to padded viewport', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 1000, 1000);
        view = setZoom(view, context, 7);
        view = setMaxBounds(view, context, new LngLatBounds([-5, -5, 5, 5]));
        view = setPadding(view, context, {top: 0, right: 500, bottom: 500, left: 0});

        view = setCenter(view, context, new LngLat(50, -50));

        const projectedCamera = projectMercator(view, context);
        const southeast = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(5, -5));
        expect(southeast.x).toBeCloseTo(500, 6);
        expect(southeast.y).toBeCloseTo(500, 6);
    });

    test('re-constrains center when padding changes', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 1000, 1000);
        view = setZoom(view, context, 7);
        view = setMaxBounds(view, context, new LngLatBounds([-5, -5, 5, 5]));
        view = setPadding(view, context, {top: 0, right: 500, bottom: 500, left: 0});
        view = setCenter(view, context, new LngLat(50, -50));

        view = setPadding(view, context, {top: 0, right: 0, bottom: 0, left: 0});

        const projectedCamera = projectMercator(view, context);
        const southeast = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(5, -5));
        expect(southeast.x).toBeCloseTo(1000, 6);
        expect(southeast.y).toBeCloseTo(1000, 6);
    });

    test('lngRange can constrain zoom and center across meridian', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setCenter(view, context, new LngLat(180, 0));
        view = setZoom(view, context, 10);
        view = resize(view, context, 500, 500);

        // equivalent ranges
        const lngRanges: Array<[number, number]> = [
            [175, -175], [175, 185], [-185, -175], [-185, 185]
        ];

        for (const lngRange of lngRanges) {
            view = setMaxBounds(view, context, new LngLatBounds([lngRange[0], -5, lngRange[1], 5]));

            view = setZoom(view, context, 0);
            expect(view.zoom).toBe(5.1357092861044045);

            view = setCenter(view, context, new LngLat(-50, -30));
            expect(view.center).toEqual(new LngLat(180, -0.0063583052861417855));

            view = setZoom(view, context, 10);
            view = setCenter(view, context, new LngLat(-50, -30));
            expect(view.center).toEqual(new LngLat(-175.171661376953125, -4.828969771321582));

            view = setCenter(view, context, new LngLat(230, 0));
            expect(view.center).toEqual(new LngLat(-175.171661376953125, 0));

            view = setCenter(view, context, new LngLat(130, 0));
            expect(view.center).toEqual(new LngLat(175.171661376953125, 0));
        }
    });

    test('clamps pitch', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});

        view = setPitch(view, 45);
        expect(projectMercator(view, context).pitch).toBe(45);

        view = setPitch(view, -10);
        expect(projectMercator(view, context).pitch).toBe(0);

        view = setPitch(view, 90);
        expect(projectMercator(view, context).pitch).toBe(60);
    });

    test('visibleUnwrappedCoordinates', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 200, 200);
        view = setZoom(view, context, 0);
        view = setCenter(view, context, new LngLat(-170.01, 0.01));

        const projectedCamera = projectMercator(view, context);
        let unwrappedCoords = getCameraMath(projectedCamera).getVisibleUnwrappedCoordinates(projectedCamera, context.worldCoordinateHelper, new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords).toHaveLength(4);

        //getVisibleUnwrappedCoordinates should honor _renderWorldCopies
        view = setRenderWorldCopies(view, context.worldCoordinateHelper, false);
        const withoutWorldCopies = projectMercator(view, context);
        unwrappedCoords = getCameraMath(withoutWorldCopies).getVisibleUnwrappedCoordinates(withoutWorldCopies, context.worldCoordinateHelper, new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords).toHaveLength(1);
    });

    test('maintains high float precision when calculating matrices', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 200.25, 200.25);
        view = setZoom(view, context, 20.25);
        view = setPitch(view, 67.25);
        view = setCenter(view, context, new LngLat(0.0, 0.0));
        const projectedCamera = projectMercator(view, context);

        const customLayerMatrix = getCameraMath(projectedCamera).getProjectionDataForCustomLayer(projectedCamera).mainMatrix;
        expect(customLayerMatrix[0].toString().length).toBeGreaterThan(9);
        expect(projectedCamera.pixelsToClipSpaceMatrix[0].toString().length).toBeGreaterThan(9);
        expect(getCameraMath(projectedCamera).maxPitchScaleFactor(projectedCamera)).toBeCloseTo(2.366025418080343, 5);
    });

    test('recenterOnTerrain: no change', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setCenter(view, context, new LngLat(10.0, 50.0));
        view = setZoom(view, context, 14);
        view = setPitch(view, 45);
        view = resize(view, context, 512, 512);
        let projectedCamera = projectMercator(view, context);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect same values because of no elevation change
        const terrain = {
            ...createTerrain(),
            getElevationForLngLat: () => 200,
        } as any;
        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);
        projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        expect(view.zoom).toBe(14);
    });

    test('recenterOnTerrain: small elevation change at extreme latitude does not drastically shift center', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setPitch(view, 60);
        view = setZoom(view, context, 3);
        view = setCenter(view, context, new LngLat(0, 82));
        view = resize(view, context, 512, 512);

        expect(view.center.lat).toBeCloseTo(82, 10);

        const terrain = {
            ...createTerrain(),
            getElevationForLngLat: () => 200 + 1,
        } as any;
        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);
        expect(view.center.lat).toBeCloseTo(82, 4);
    });

    test('recenterOnTerrain: elevation increase', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setCenter(view, context, new LngLat(10.0, 50.0));
        view = setZoom(view, context, 14);
        view = setPitch(view, 45);
        view = resize(view, context, 512, 512);
        let projectedCamera = projectMercator(view, context);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect new zoom and center because of elevation change
        const terrain = {
            ...createTerrain(),
            getElevationForLngLat: () => 400,
        } as any;
        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);
        projectedCamera = projectMercator(view, context);
        expect(view.elevation).toBe(400);
        expect(view.center.lng).toBeCloseTo(10, 10);
        expect(view.center.lat).toBeCloseTo(49.99820083233257, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(expectedCamLngLat.lat, 10);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        expect(view.zoom).toBeCloseTo(14.184585886440683, 10);
    });

    test('recenterOnTerrain solves at the rendered terrain surface, not the tile-zoom DEM sample', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setCenter(view, context, new LngLat(10.0, 50.0));
        view = setZoom(view, context, 14);
        view = setPitch(view, 45);
        view = resize(view, context, 512, 512);
        const projectedCamera = projectMercator(view, context);
        const expectedAltitude = getCameraMath(projectedCamera).getCameraAltitude(projectedCamera);
        const terrain = {
            ...createTerrain(),
            getElevationForLngLat: () => 400,
            getElevationForLngLatZoom: () => 1000,
        } as any;

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        expect(view.elevation).toBe(400);
        const recentered = projectMercator(view, context);
        expect(getCameraMath(recentered).getCameraAltitude(recentered)).toBeCloseTo(expectedAltitude, 10);
    });

    test('recenterOnTerrain: elevation decrease', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setCenter(view, context, new LngLat(10.0, 50.0));
        view = setZoom(view, context, 14);
        view = setPitch(view, 45);
        view = resize(view, context, 512, 512);
        let projectedCamera = projectMercator(view, context);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect new zoom because of elevation change to point below sea level
        const terrain = {
            ...createTerrain(),
            getElevationForLngLat: () => -200,
        } as any;
        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);
        projectedCamera = projectMercator(view, context);
        expect(view.elevation).toBe(-200);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(expectedCamLngLat.lat, 10);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        expect(view.zoom).toBeCloseTo(13.689399565250616, 10);
    });

    test('recenterOnTerrain looks past terrain nearer than maxZoom allows once the center ray has passed over it', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 12.5, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = setCenter(view, context, new LngLat(0.1758, -0.03));
        view = setZoom(view, context, 12);
        view = setPitch(view, 80);
        view = resize(view, context, 512, 512);
        const plateauUnderTheCameraThenAPlain = createDEM((_x, y) => y >= 26 ? 2400 : 0, 64);
        const terrain = createDEMTerrain([new OverscaledTileID(10, 0, 10, 512, 512)], plateauUnderTheCameraThenAPlain);
        const projectedCamera = projectMercator(view, context);
        const cameraLngLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
        const cameraAltitude = getCameraMath(projectedCamera).getCameraAltitude(projectedCamera);

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        expect(view.zoom).toBeCloseTo(12, 6);
        expect(view.elevation).toBeCloseTo(0, 6);
        const recentered = projectMercator(view, context);
        expect(getCameraMath(recentered).getCameraLngLat(recentered, context.worldCoordinateHelper).lat).toBeCloseTo(cameraLngLat.lat, 9);
        expect(getCameraMath(recentered).getCameraAltitude(recentered)).toBeCloseTo(cameraAltitude, 3);
    });

    test('recenterOnTerrain leaves out terrain between the camera and the near clipping plane when maxZoom lets the camera nearer than that plane', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = setCenter(view, context, new LngLat(0, 0));
        view = setZoom(view, context, 12);
        view = setPitch(view, 80);
        view = resize(view, context, 512, 512);
        const projectedCamera = projectMercator(view, context);
        const metersPerDegree = 2 * Math.PI * earthRadius / 360;
        const wallLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat + 100 / metersPerDegree;
        const wallTop = getCameraMath(projectedCamera).getCameraAltitude(projectedCamera) - 12;
        const wallBeforeTheNearPlane = (_lng: number, lat: number) => Math.abs(lat - wallLat) < 15 / metersPerDegree ? wallTop : 0;
        const terrain = createDEMTerrain([], null);
        vi.spyOn(terrain, 'getCoverageIndex').mockReturnValue(createCoverageIndex(wallBeforeTheNearPlane, 0, wallTop));
        vi.spyOn(terrain, 'getElevationForLngLat').mockImplementation(lngLat => wallBeforeTheNearPlane(lngLat.lng, lngLat.lat));

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        expect(view.zoom).toBeCloseTo(12, 6);
        expect(view.center.lat).toBeCloseTo(0, 6);
    });

    test('recenterOnTerrain does not look past terrain the center ray is still inside at the distance maxZoom allows', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 12.5, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = setCenter(view, context, new LngLat(0.1758, -0.03));
        view = setZoom(view, context, 12);
        view = setPitch(view, 80);
        view = resize(view, context, 512, 512);
        const blockBetweenTheCameraAndTheCenter = createDEM((_x, y) => y >= 8 && y < 22 ? 1500 : 0, 64);
        const terrain = createDEMTerrain([new OverscaledTileID(10, 0, 10, 512, 512)], blockBetweenTheCameraAndTheCenter);

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        expect(view.elevation).toBeCloseTo(1500, 6);
        expect(view.zoom).toBe(12.5);
    });

    test('recenterOnTerrain at maxZoom points the camera at the new center', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 12, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = setCenter(view, context, new LngLat(0.1758, -0.03));
        view = setZoom(view, context, 12);
        view = setPitch(view, 80);
        view = resize(view, context, 512, 512);
        const terrain = createDEMTerrain([new OverscaledTileID(10, 0, 10, 512, 512)], createDEM(() => 2400, 64));

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        const projectedCamera = projectMercator(view, context);
        expect(view.center.lat).toBeCloseTo(-0.152407, 6);
        expect(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, projectedCamera.centerPoint).lat).toBeCloseTo(-0.152407, 6);
    });

    test('recenterOnTerrain puts the center on sloped terrain with the camera where it was', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 512, 512);
        view = setZoom(view, context, 11);
        view = setPitch(view, 85);
        view = setCenter(view, context, new LngLat(0.7, 60));
        const projectedBefore = projectMercator(view, context);
        const cameraBefore = getCameraMath(projectedBefore).getCameraLngLat(projectedBefore, context.worldCoordinateHelper);
        const altitudeBefore = getCameraMath(projectedBefore).getCameraAltitude(projectedBefore);
        const demTile = new OverscaledTileID(8, 0, 8, 128, 74);
        const risingNorthward = createDEM((_x, y) => (64 - y) * 30, 64);
        const terrain = createDEMTerrain([demTile], risingNorthward);
        terrain.tileManager.getSourceTile = () => ({tileID: demTile, dem: risingNorthward} as Tile);

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        const projectedCamera = projectMercator(view, context);
        expect(view.elevation).toBeCloseTo(997.526, 2);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(cameraBefore.lat, 8);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(cameraBefore.lng, 8);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(altitudeBefore, 6);
    });

    test('recenterOnTerrain keeps the camera where it is when the center moves to another latitude', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 512, 512);
        view = setCenter(view, context, new LngLat(10, 60));
        view = setZoom(view, context, 11);
        view = setPitch(view, 85);
        const projectedBefore = projectMercator(view, context);
        const cameraBefore = getCameraMath(projectedBefore).getCameraLngLat(projectedBefore, context.worldCoordinateHelper);
        const altitudeBefore = getCameraMath(projectedBefore).getCameraAltitude(projectedBefore);
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        const projectedCamera = projectMercator(view, context);
        expect(view.elevation).toBe(1000);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(cameraBefore.lat, 8);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(cameraBefore.lng, 8);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(altitudeBefore, 6);
    });

    test('recenterOnTerrain keeps the camera where it is at an extreme latitude', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 512, 512);
        view = setCenter(view, context, new LngLat(-150, 80));
        view = setZoom(view, context, 10);
        view = setPitch(view, 70);
        view = setBearing(view, 135);
        const projectedBefore = projectMercator(view, context);
        const cameraBefore = getCameraMath(projectedBefore).getCameraLngLat(projectedBefore, context.worldCoordinateHelper);
        const altitudeBefore = getCameraMath(projectedBefore).getCameraAltitude(projectedBefore);
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 2500));

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        const projectedCamera = projectMercator(view, context);
        expect(view.elevation).toBe(2500);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(cameraBefore.lat, 8);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(cameraBefore.lng, 8);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(altitudeBefore, 6);
    });

    test('recenterOnTerrain leaves the center where it is while the terrain under it is above the camera', () => {
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 15, 60);
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 5000));

        const recentered = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        expect(recentered.zoom).toBe(15);
        expect(recentered.center).toEqual(new LngLat(0, 0));
        expect(recentered.elevation).toBe(0);
    });

    test('recenterOnTerrain looking up at terrain above the camera puts the center on it', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 150, renderWorldCopies: true});
        view = resize(view, context, 512, 512);
        view = setCenter(view, context, new LngLat(0, 0));
        view = setZoom(view, context, 15);
        view = setPitch(view, 120);
        view = setElevation(view, context, 3000);
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 2500));

        view = getCameraSolver(context).recenterOnTerrain(view, context, terrain);

        expect(view.elevation).toBe(2500);
        expect(view.zoom).toBeCloseTo(16.1383, 4);
    });

    test('recenterOnTerrain without terrain', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setCenter(view, context, new LngLat(10.0, 50.0));
        view = setZoom(view, context, 14);
        view = setPitch(view, 45);
        view = resize(view, context, 512, 512);
        let projectedCamera = projectMercator(view, context);

        // This should be an invariant throughout - the zoom is greater when the camera is
        // closer to the terrain (and therefore also when the terrain is closer to the camera),
        // but that shouldn't change the camera's position in world space if that wasn't requested.
        const expectedAltitude = 1865.7579397718;
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        const expectedCamLngLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
        expect(expectedCamLngLat.lng).toBeCloseTo(10, 10);
        expect(expectedCamLngLat.lat).toBeCloseTo(49.9850171656428, 10);

        // expect same values because of no elevation change
        view = getCameraSolver(context).recenterOnTerrain(view, context);
        projectedCamera = projectMercator(view, context);
        expect(view.elevation).toBeCloseTo(0, 10);
        expect(view.center.lng).toBeCloseTo(10, 10);
        expect(view.center.lat).toBeCloseTo(50.00179923503546, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(expectedCamLngLat.lng, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(expectedCamLngLat.lat, 10);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(expectedAltitude, 10);
        expect(view.zoom).toBeCloseTo(13.836362951286565, 10);
    });

    test('screenPointToMercatorCoordinate with terrain that covers nothing should fall back to 2D', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        const projectedCamera = projectMercator(view, context);
        const coordinate = getCameraMath(projectedCamera).screenPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(0, 0), createTerrain());

        expect(coordinate).toBeDefined();
    });

    test('getBounds with horizon', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 500, 500);

        view = setPitch(view, 60);
        let projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).getBounds(projectedCamera, context.worldCoordinateHelper).getNorthWest().toArray()).toStrictEqual(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(0, 0)).toArray());

        view = setPitch(view, 75);
        projectedCamera = projectMercator(view, context);
        const top = Math.max(0, projectedCamera.height / 2 - getMercatorHorizon(projectedCamera));
        expect(top).toBeCloseTo(79.1823898251593, 10);
        expect(getCameraMath(projectedCamera).getBounds(projectedCamera, context.worldCoordinateHelper).getNorthWest().toArray()).toStrictEqual(getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(0, top)).toArray());
    });

    test('isPointOnMapSurface with padding', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setPitch(view, 80);

        view = setPadding(view, context, {top: 200, bottom: 0, left: 0, right: 0});
        const projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, new Point(250, 200))).toBe(false);

        view = setPadding(view, context, {top: 0, bottom: 200, left: 0, right: 0});
        const padded = projectMercator(view, context);
        expect(getCameraMath(padded).isPointOnMapSurface(padded, context.worldCoordinateHelper, new Point(250, 100))).toBe(true);
    });

    test('isPointOnMapSurface is false past the edge of a world projection', () => {
        const context = createCameraContext({worldCoordinateHelper: new CRSWorldCoordinateHelper(createWrappingWorldCrs())});
        let view = createCameraViewState({minZoom: -2, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setZoom(view, context, -1);
        const projectedCamera = projectMercator(view, context);

        expect(getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, new Point(300, 250))).toBe(true);
        expect(getCameraMath(projectedCamera).isPointOnMapSurface(projectedCamera, context.worldCoordinateHelper, new Point(400, 250))).toBe(false);
    });

    test('projectTileCoordinates', () => {
        const precisionDigits = 10;
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        view = resize(view, context, 500, 500);
        view = setCenter(view, context, new LngLat(10.0, 50.0));
        const projectedCamera = projectMercator(view, context);
        let projection = getCameraMath(projectedCamera).projectTileCoordinates(projectedCamera, 1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(0.07111111111111101, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.8719999854792714, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(750, precisionDigits);
        expect(projection.isOccluded).toBe(false);
        view = setBearing(view, 12);
        view = setPitch(view, 10);
        const turned = projectMercator(view, context);
        projection = getCameraMath(turned).projectTileCoordinates(turned, 1024, 1024, new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0)), 0);
        expect(projection.point.x).toBeCloseTo(-0.10639783257205901, precisionDigits);
        expect(projection.point.y).toBeCloseTo(0.8136784996777623, precisionDigits);
        expect(projection.signedDistanceFromCamera).toBeCloseTo(787.6699126802941, precisionDigits);
        expect(projection.isOccluded).toBe(false);
    });

    test('locationToScreenPoint projects a location in front of the camera', () => {
        const {projectedCamera, context} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true, width: 512, height: 512, zoom: 10, center: new LngLat(0, 0), pitch: 80});

        const inFrontOfCamera = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(0, 0.05));
        expect(inFrontOfCamera.x).toBeCloseTo(256, 1);
        expect(inFrontOfCamera.y).toBeCloseTo(244.4, 1);
    });

    test('locationToScreenPoint puts a location behind the camera outside the edge it left through', () => {
        const {projectedCamera, context} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true, width: 512, height: 512, zoom: 10, center: new LngLat(0, 0), pitch: 80});

        // The camera looks north, so a location south of it left the screen through the bottom edge.
        const behindCamera = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(0, -2));
        expect(behindCamera.x).toBeCloseTo(256, 6);
        expect(behindCamera.y).toBeCloseTo(1024, 6);

        // West of a north-facing camera is the left side of the screen.
        const behindLeft = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(-2, -2));
        expect(behindLeft.x).toBeCloseTo(-512, 6);
        expect(behindLeft.y).toBeGreaterThan(256);
        expect(behindLeft.y).toBeLessThan(1024);

        const behindRight = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(2, -2));
        expect(behindRight.x).toBeCloseTo(1024, 6);
        expect(behindRight.y).toBeCloseTo(behindLeft.y, 6);

        // A location only slightly west still leaves through the bottom edge, left of centre.
        const behindSlightlyLeft = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(-0.2, -2));
        expect(behindSlightlyLeft.y).toBeCloseTo(1024, 6);
        expect(behindSlightlyLeft.x).toBeLessThan(256);
        expect(behindSlightlyLeft.x).toBeGreaterThan(-512);
    });

    test('getCameraLngLat', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        view = setElevation(view, context, 200);
        view = setCenter(view, context, new LngLat(15.0, 55.0));
        view = setZoom(view, context, 14);
        view = setPitch(view, 55);
        view = setBearing(view, 75);
        view = resize(view, context, 512, 512);
        let projectedCamera = projectMercator(view, context);

        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(1405.7075926414002, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(14.973921529405033, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(54.99599181678275, 10);

        view = setRoll(view, 31);
        projectedCamera = projectMercator(view, context);

        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(1405.7075926414002, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(14.973921529405033, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(54.99599181678275, 10);
    });

    test('calculateCenterFromCameraLngLatAlt no pitch no bearing', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        view = setPitch(view, 55);
        view = setBearing(view, 75);
        view = resize(view, context, 512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const centerInfo = calculateCenterFromCameraLngLatAlt(view, context.worldCoordinateHelper, camLngLat, camAlt);
        view = setZoom(view, context, centerInfo.zoom);
        view = setCenter(view, context, centerInfo.center);
        view = setElevation(view, context, centerInfo.elevation);
        const projectedCamera = projectMercator(view, context);
        expect(view.zoom).toBeGreaterThan(0);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(camAlt, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(camLngLat.lng, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('calculateCenterFromCameraLngLatAlt no pitch', () => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        view = setPitch(view, 55);
        view = setBearing(view, 75);
        view = resize(view, context, 512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 20;
        const centerInfo = calculateCenterFromCameraLngLatAlt(view, context.worldCoordinateHelper, camLngLat, camAlt, bearing);
        view = setZoom(view, context, centerInfo.zoom);
        view = setCenter(view, context, centerInfo.center);
        view = setElevation(view, context, centerInfo.elevation);
        view = setBearing(view, bearing);
        const projectedCamera = projectMercator(view, context);
        expect(view.zoom).toBeGreaterThan(0);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(camAlt, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(camLngLat.lng, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test.each([30, 88, 89.99, 90, 95, 180])('calculateCenterFromCameraLngLatAlt %f degrees pitch', (pitch) => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true});
        view = setPitch(view, 55);
        view = setBearing(view, 75);
        view = resize(view, context, 512, 512);

        const camLngLat = new LngLat(15, 55);
        const camAlt = 400;
        const bearing = 40;
        const centerInfo = calculateCenterFromCameraLngLatAlt(view, context.worldCoordinateHelper, camLngLat, camAlt, bearing, pitch);
        view = setZoom(view, context, centerInfo.zoom);
        view = setCenter(view, context, centerInfo.center);
        view = setElevation(view, context, centerInfo.elevation);
        view = setBearing(view, bearing);
        view = setPitch(view, pitch);
        const projectedCamera = projectMercator(view, context);
        expect(view.zoom).toBeGreaterThan(0);
        expect(getCameraMath(projectedCamera).getCameraAltitude(projectedCamera)).toBeCloseTo(camAlt, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lng).toBeCloseTo(camLngLat.lng, 10);
        expect(getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper).lat).toBeCloseTo(camLngLat.lat, 10);
    });

    test('getProjectionData parses OverscaledTileID', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true, width: 512, height: 512});
        const projectionData = getCameraMath(projectedCamera).getProjectionData(projectedCamera, {overscaledTileID: new OverscaledTileID(1, 0, 1, 1, 0)});
        expectToBeCloseToArray(projectionData.tileMercatorCoords, [0.5, 0, 0.5 / EXTENT, 0.5 / EXTENT]);
    });

    test('getProjectionData parses null', () => {
        const {projectedCamera} = createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 180, renderWorldCopies: true, width: 512, height: 512});
        const projectionData = getCameraMath(projectedCamera).getProjectionData(projectedCamera, {overscaledTileID: null});
        expectToBeCloseToArray(projectionData.tileMercatorCoords, [0, 0, 1, 1]);
    });
});

describe('calculateCameraOptionsFromTo', () => {
    // a zoom of 1 keeps the center clear of the mercator latitude limits
    const {state: view, context} = createTestCamera({width: 512, height: 512, zoom: 1});

    test('look at north', () => {
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 1, lat: 0}, 0, {lng: 1, lat: 1}, 0);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.center).toBeDefined();
        expect(cameraOptions.bearing).toBeCloseTo(0);
    });

    test('look at west', () => {
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 1, lat: 0}, 0, {lng: 0, lat: 0}, 0);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.bearing).toBeCloseTo(-90);
    });

    test('pitch 45', () => {
        // altitude same as grounddistance => 45°
        // distance between lng x and lng x+1 is 111.2km at same lat
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 1, lat: 0}, 111200, {lng: 0, lat: 0}, 0);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(45);
    });

    test('pitch 90', () => {
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 1, lat: 0}, 0, {lng: 0, lat: 0}, 0);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(90);
    });

    test('pitch 153.435', () => {

        // distance between lng x and lng x+1 is 111.2km at same lat
        // (elevation difference of cam and center) / 2 = grounddistance =>
        // acos(111.2 / sqrt(111.2² + (111.2 * 2)²)) = acos(1/sqrt(5)) => 63.435 + 90 (looking up) = 153.435
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 1, lat: 0}, 111200, {lng: 0, lat: 0}, 111200 * 3);
        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.pitch).toBeCloseTo(153.435);
    });

    test('zoom distance 1000', () => {
        const expectedZoom = Math.log2(projectMercator(view, context).cameraToCenterDistance / mercatorZfromAltitude(1000, 0) / view.tileSize);
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 1000);

        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
    });

    test('zoom distance 1 lng (111.2km), 111.2km altitude away', () => {
        const expectedZoom = Math.log2(projectMercator(view, context).cameraToCenterDistance / mercatorZfromAltitude(Math.hypot(111200, 111200), 0) / view.tileSize);
        const cameraOptions = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 1, lat: 0}, 111200);

        expect(cameraOptions).toBeDefined();
        expect(cameraOptions.zoom).toBeCloseTo(expectedZoom);
    });

    test('same To as From error', () => {
        expect(() => getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 0, lat: 0}, 0)).toThrow('Can\'t calculate camera options with same From and To');
    });
});

describe('screenTerrainPointToMercatorCoordinate', () => {
    test('matches the plane intersection for a flat DEM', () => {
        const height = 500;
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height));
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 4, 45);
        const projectedCamera = projectMercator(view, context);

        for (const p of [new Point(256, 256), new Point(100, 400), new Point(400, 300)]) {
            const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, p, terrain);
            expect(result).not.toBeNull();
            expectWorldPixelsClose(result, screenPointToMercatorCoordinateAtZ(projectedCamera, p, height), projectedCamera.worldSize);
            expect(result.z).toBeCloseTo(height, 10);
        }
    });

    test('hits the terrain between the near clipping plane and twice its distance from the camera', () => {
        const height = 449;
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height));
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 16, 60);
        const projectedCamera = projectMercator(view, context);
        const center = new Point(256, 256);

        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, center, terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBeCloseTo(height, 6);
        expectWorldPixelsClose(result, screenPointToMercatorCoordinateAtZ(projectedCamera, center, height), projectedCamera.worldSize);
    });

    test('applies the terrain exaggeration to the hit elevation', () => {
        const height = 300;
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height), 2.5);
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 4, 30);
        const projectedCamera = projectMercator(view, context);

        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain);

        expect(result.z).toBeCloseTo(height * 2.5, 10);
        expectWorldPixelsClose(result, screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(256, 256), height * 2.5), projectedCamera.worldSize);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x) => x * 400));
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 3, 60);
        const projectedCamera = projectMercator(view, context);

        for (const p of [new Point(200, 300), new Point(256, 350), new Point(330, 420)]) {
            const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, p, terrain);
            expect(result).not.toBeNull();
            const elevation = terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT);
            expect(elevation).toBeCloseTo(result.z, 6);
        }
    });

    test('follows a ramp across a tile boundary', () => {
        const tileIDs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => new OverscaledTileID(1, 0, 1, x, y));
        const terrain = createDEMTerrain(tileIDs, createDEM((x) => x * 200));
        const {state: view, context} = createCameraAt(new LngLat(0, 40), 2, 50);
        const projectedCamera = projectMercator(view, context);
        const crossed = new Set<number>();

        for (const p of [new Point(180, 300), new Point(256, 300), new Point(340, 300)]) {
            const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, p, terrain);
            expect(result).not.toBeNull();
            const tileX = Math.floor(result.x * 2);
            const tileY = Math.floor(result.y * 2);
            crossed.add(tileX);
            const tileID = new OverscaledTileID(1, 0, 1, tileX, tileY);
            const elevation = terrain.getElevation(tileID, (result.x * 2 - tileX) * EXTENT, (result.y * 2 - tileY) * EXTENT, EXTENT);
            expect(elevation).toBeCloseTo(result.z, 6);
        }

        expect(crossed.size).toBe(2);
    });

    test('returns null when the ray never crosses the terrain surface', () => {
        // Into the sky.
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const sky = createCameraAt(new LngLat(0, 0), 4, 80);
        const skyCamera = projectMercator(sky.state, sky.context);
        expect(getCameraMath(skyCamera).screenTerrainPointToMercatorCoordinate(skyCamera, sky.context.worldCoordinateHelper, new Point(256, 0), terrain)).toBeNull();

        // Leaving the world vertically past the covered tiles.
        const edgeTerrain = createDEMTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const edge = createCameraAt(new LngLat(0, 0), 1, 0);
        const edgeCamera = projectMercator(edge.state, edge.context);
        expect(getCameraMath(edgeCamera).screenTerrainPointToMercatorCoordinate(edgeCamera, edge.context.worldCoordinateHelper, new Point(400, 400), edgeTerrain)).toBeNull();

        // Staying below the terrain surface the whole way: at zoom 22 the camera sits about 28 meters up, under a 100 meter plateau.
        const submergedTerrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 100));
        const submerged = createCameraAt(new LngLat(0, 0), 22, 0);
        const submergedCamera = projectMercator(submerged.state, submerged.context);
        expect(getCameraMath(submergedCamera).screenTerrainPointToMercatorCoordinate(submergedCamera, submerged.context.worldCoordinateHelper, new Point(256, 256), submergedTerrain)).toBeNull();
    });

    test('returns null when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 4);

        const projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain)).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 4, 40);
        const projectedCamera = projectMercator(view, context);
        const p = new Point(256, 300);

        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, p, terrain);

        expect(result.z).toBe(0);
        expectWorldPixelsClose(result, screenPointToMercatorCoordinateAtZ(projectedCamera, p, 0), projectedCamera.worldSize);
    });

    test('returns coordinates outside the central world for wrapped copies', () => {
        const tileIDs = [-1, 0, 1, 2].map(wrap => new OverscaledTileID(0, wrap, 0, 0, 0));
        const terrain = createDEMTerrain(tileIDs, createDEM(() => 0));
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 0);
        const projectedCamera = projectMercator(resize(view, context, 2048, 512), context);

        const leftPoint = new Point(600, 256);
        const rightPoint = new Point(1500, 256);
        const left = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, leftPoint, terrain);
        const right = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, rightPoint, terrain);

        expect(left.x).toBeLessThan(0);
        expect(right.x).toBeGreaterThan(1);
        expectWorldPixelsClose(left, screenPointToMercatorCoordinateAtZ(projectedCamera, leftPoint, 0), projectedCamera.worldSize);
        expectWorldPixelsClose(right, screenPointToMercatorCoordinateAtZ(projectedCamera, rightPoint, 0), projectedCamera.worldSize);
    });

    test('samples overscaled tiles from their parent DEM', () => {
        const tileID = new OverscaledTileID(15, 0, 14, 8192, 8192);
        const parent = new OverscaledTileID(13, 0, 13, 4096, 4096);
        const dem = createDEM((x) => x * 100);
        const terrain = createDEMTerrain([tileID], dem);
        terrain.tileManager.getSourceTile = () => ({tileID: parent, dem}) as Tile;
        const scale = 1 << tileID.canonical.z;
        const center = new MercatorCoordinate((tileID.canonical.x + 0.5) / scale, (tileID.canonical.y + 0.5) / scale).toLngLat();
        const {state: view, context} = createCameraAt(center, 15, 30);

        const projectedCamera = projectMercator(view, context);
        const result = getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain);

        expect(result).not.toBeNull();
        expect(result.z).toBeGreaterThan(0);
    });

    test('samples the far tile edge without throwing', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM(() => 100));

        expect(() => terrain.getElevation(tileID, EXTENT - 1e-9, EXTENT - 1e-9, EXTENT)).not.toThrow();

        const {state: view, context} = createCameraAt(new LngLat(179.999, -85), 6, 0);
        const projectedCamera = projectMercator(view, context);
        expect(() => getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain)).not.toThrow();
    });

    test('skips renderable tiles that have no terrain tile yet', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 100));
        const tiles = terrain.tileManager.getRenderableTiles();
        terrain.tileManager.getRenderableTiles = () => [null, ...tiles];
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 4, 30);

        const projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(256, 256), terrain).z).toBeCloseTo(100, 6);
    });

    test('samples the highest zoom tile covering the position', () => {
        const parentID = new OverscaledTileID(0, 0, 0, 0, 0);
        const childID = new OverscaledTileID(1, 0, 1, 0, 0);
        const parentDEM = createDEM(() => 100);
        const childDEM = createDEM(() => 900);
        const terrain = createDEMTerrain([parentID, childID], parentDEM);
        terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem: tileID.canonical.z === 1 ? childDEM : parentDEM}) as Tile;
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 1, 0);
        const projectedCamera = projectMercator(view, context);

        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(128, 128), terrain).z).toBeCloseTo(900, 6);
        expect(getCameraMath(projectedCamera).screenTerrainPointToMercatorCoordinate(projectedCamera, context.worldCoordinateHelper, new Point(384, 384), terrain).z).toBeCloseTo(100, 6);
    });

    test('handles a ray with no vertical component', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createDEMTerrain([tileID], createDEM((x) => x * 200));
        const context = createCameraContext();

        const projectedCamera = projectMercator(createCameraViewState(), context);

        expect(raycastTerrain(projectedCamera, context.worldCoordinateHelper, [0, 256, 500], [512, 256, 500], terrain)).not.toBeNull();
        expect(raycastTerrain(projectedCamera, context.worldCoordinateHelper, [0, 256, 5000], [512, 256, 5000], terrain)).toBeNull();
    });
});

// Outputs captured from main at 379b3673a, where lng/lat math does not go through the world coordinate helper; main's
// center search changed after the first capture (407a8ce9e). Each row is 11 inputs followed by 9 outputs, compared exactly.
const bitIdentityRows: number[][] = [
    [-47.66947732307017, -31.891872510313988, 12.335080658085644, 44.56127839162946, 336.473432360217, 2708.1988365389407, 633.7583729997277, 333.5038125514984, -48.08538376772776, -32.09453024622053, 6542.761099524796, 0.06608625848037492, -47.635173521078315, -0.07879338518436896, -48.10138014914466, -32.06339765398657, 2708.1988365389407, 13.435703555287997, -47.63887852731972, 0.006589276563389035],
    [29.529827423393726, -44.010491259396076, 4.350916175171733, 40.40351155679673, 295.4289326816797, 742.9703597445041, 119.00203712284565, 341.0222121980041, 30.327826311811805, -44.438611211720854, 11584.925448521972, 0.0002609985923233138, 47.682901433135356, -8.598491341610824, 30.222915348529853, -44.402985754807105, 742.9703597445041, 11.78582078869319, 27.14136282768186, -9.145886234506918],
    [-175.4359111469239, -60.00771701335907, 11.576151768676937, 56.23234930448234, 272.34073103405535, 2335.907760076225, 152.67861243337393, 567.1612800098956, -174.8650802965276, -59.31432515755296, 16009.216147474945, 0.039052676546020515, -175.26376370720283, -0.007036734336963946, -175.22507664128196, -59.30681470736939, 2335.907760076225, 10.511814234993166, -175.36093089187702, -0.042540721064781906],
    [-144.41486184485257, 7.587629780173302, 19.653839827515185, 37.38076251000166, 167.28623329661787, 1020.5210256390274, 658.2415254786611, 348.03880993276834, -144.6090480950661, 8.191629043780267, 13963.913300074637, 10.550601155815519, -144.4149643458768, 0.0004543238948713224, -144.5892778507015, 8.104884388547887, 1020.5210256390274, 12.062291260316952, -144.41507905283308, 0.0000017517999424399022],
    [-89.8710085451603, 64.21592768281698, 1.8496395740658045, 48.10014402028173, 158.33662692457438, 657.6341448817402, 48.85685257613659, 331.04150402359664, -90.20058967545629, 64.65715769259259, 19041.576908901334, 0.00004609766002574671, -138.11462647842262, 76.308455124853, -90.04266543186203, 64.48644307922882, 657.6341448817402, 10.104601204958538, -31.785299776317714, 30.85807805159577]
];

describe('mercator camera bit identity with the pre-refactor transform', () => {
    test.each(bitIdentityRows)('center %f,%f zoom %f pitch %f bearing %f', (lng, lat, zoom, pitch, bearing, elevation, px, py, camLng, camLat, alt, ...expected) => {
        const context = createCameraContext();
        let view = createCameraViewState({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
        view = resize(view, context, 800, 600);
        view = setCenter(view, context, new LngLat(lng, lat));
        view = setZoom(view, context, zoom);
        view = setPitch(view, pitch);
        view = setBearing(view, bearing);
        view = setElevation(view, context, elevation);
        const projectedCamera = projectMercator(view, context);

        const cameraLngLat = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
        const fromCamera = calculateCenterFromCameraLngLatAlt(view, context.worldCoordinateHelper, new LngLat(camLng, camLat), alt, bearing, pitch);
        const screen = getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, new Point(px, py));

        expect([
            projectedCamera.pixelsPerMeter, cameraLngLat.lng, cameraLngLat.lat,
            fromCamera.center.lng, fromCamera.center.lat, fromCamera.elevation, fromCamera.zoom,
            screen.lng, screen.lat,
        ]).toEqual(expected);
    });
});

describe('mercator camera over the identity CRS', () => {
    test('uses a non-wrapping helper', () => {
        const {context} = createIdentityCrsCamera(200, 200);
        expect(context.worldCoordinateHelper.wraps).toBe(false);
    });

    test('sets no max bounds', () => {
        const {state: view} = createIdentityCrsCamera(200, 200);
        expect(getMaxBounds(view)).toBeNull();
    });

    describe('constrain', () => {
        test('keeps a center inside the square where the viewport reaches past the square', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);
            view = setZoom(view, context, 1);

            view = setCenter(view, context, new LngLat(89, 89));

            expect(view.center.lat).toBeCloseTo(89, 6);
        });

        test('leaves the zoom to minZoom when the square is smaller than the viewport', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);

            view = setZoom(view, context, -2);

            expect(view.zoom).toBe(-2);
        });

        test('keeps the viewport inside explicit max bounds set inside the square', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);
            view = setZoom(view, context, 4);
            view = setMaxBounds(view, context, new LngLatBounds([-10, -10], [10, 10]));
            const worldSizeAtZoom4 = 8192;
            const degreesPerPixel = 180 / worldSizeAtZoom4;
            const halfViewport = 100;

            view = setCenter(view, context, new LngLat(80, 80));

            expect(view.center.lng).toBeCloseTo(10 - halfViewport * degreesPerPixel, 6);
            expect(view.center.lat).toBeCloseTo(10 - halfViewport * degreesPerPixel, 6);
        });

        test('keeps the viewport inside max bounds that replace earlier ones', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);
            view = setZoom(view, context, 4);
            view = setMaxBounds(view, context, new LngLatBounds([-10, -10], [10, 10]));
            view = setCenter(view, context, new LngLat(0, 0));
            view = setMaxBounds(view, context, new LngLatBounds([30, 30], [50, 50]));
            const worldSizeAtZoom4 = 8192;
            const degreesPerPixel = 180 / worldSizeAtZoom4;
            const halfViewport = 100;

            view = setCenter(view, context, new LngLat(80, 80));

            expect(view.center.lng).toBeCloseTo(50 - halfViewport * degreesPerPixel, 6);
            expect(view.center.lat).toBeCloseTo(50 - halfViewport * degreesPerPixel, 6);
        });

        test('stops a center past the east edge of the square at the edge instead of wrapping it', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);
            view = setZoom(view, context, 4);

            view = setCenter(view, context, new LngLat(200, 0));

            expect(view.center.lng).toBeCloseTo(90, 6);
        });

        test('setLocationAtPoint keeps the longitude it was given instead of wrapping it', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);
            view = setZoom(view, context, 4);

            view = getCameraSolver(context).setLocationAtPoint(view, context, new LngLat(85, 0), projectMercator(view, context).centerPoint);

            expect(view.center.lng).toBeCloseTo(85, 6);
        });
    });

    test('returns only the main world from getVisibleUnwrappedCoordinates while renderWorldCopies is on', () => {
        let {state: view, context} = createIdentityCrsCamera(512, 512);
        view = setZoom(view, context, 0);
        view = setCenter(view, context, new LngLat(0, 0));
        expect(view.renderWorldCopies).toBe(true);
        const projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).getVisibleUnwrappedCoordinates(projectedCamera, context.worldCoordinateHelper, new CanonicalTileID(0, 0, 0))).toHaveLength(1);
    });

    describe('lng/lat and screen points', () => {
        test('round trips a location through screen space with the identity mapping', () => {
            let {state: view, context} = createIdentityCrsCamera(200, 200);
            view = setZoom(view, context, 2);
            view = setCenter(view, context, new LngLat(30, -20));
            const projectedCamera = projectMercator(view, context);
            const point = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(35, -25));
            const back = getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, context.worldCoordinateHelper, point);
            expect(back.lng).toBeCloseTo(35, 6);
            expect(back.lat).toBeCloseTo(-25, 6);
        });

        test('places lng/lat 45,45 in the top-right quarter of the square', () => {
            let {state: view, context} = createIdentityCrsCamera(512, 512);
            view = setZoom(view, context, 0);
            view = setCenter(view, context, new LngLat(0, 0));
            const worldSizeAtZoom0 = 512;
            const projectedCamera = projectMercator(view, context);
            const point = getCameraMath(projectedCamera).locationToScreenPoint(projectedCamera, context.worldCoordinateHelper, new LngLat(45, 45));
            expect(point.x).toBeCloseTo(0.75 * worldSizeAtZoom0, 6);
            expect(point.y).toBeCloseTo(0.25 * worldSizeAtZoom0, 6);
        });

        test('bounds of a pitched view that reaches past the world square stop at the poles instead of throwing', () => {
            let {state: view, context} = createIdentityCrsCamera(512, 512);
            view = setZoom(view, context, 0);
            view = setCenter(view, context, new LngLat(0, 0));
            view = setPitch(view, 60);

            const projectedCamera = projectMercator(view, context);
            const bounds = getCameraMath(projectedCamera).getBounds(projectedCamera, context.worldCoordinateHelper);

            expect(bounds.getNorth()).toBe(90);
            expect(bounds.getSouth()).toBe(-90);
        });

        test('puts the camera above the center when unpitched', () => {
            let {state: view, context} = createIdentityCrsCamera(512, 512);
            view = setZoom(view, context, 3);
            view = setCenter(view, context, new LngLat(10, 20));
            const projectedCamera = projectMercator(view, context);
            const camera = getCameraMath(projectedCamera).getCameraLngLat(projectedCamera, context.worldCoordinateHelper);
            expect(camera.lng).toBeCloseTo(10, 6);
            expect(camera.lat).toBeCloseTo(20, 6);
        });
    });

    describe('calculateCameraOptionsFromTo', () => {
        test('bearing and zoom follow the identity CRS, where lng and lat are the world axes and equal steps make a 45 degree bearing', () => {
            let {state: view, context} = createIdentityCrsCamera(512, 512);
            view = setZoom(view, context, 1);

            const options = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 10, lat: 10}, 0);

            expect(options.bearing).toBeCloseTo(45, 10);
            expect(options.pitch).toBeCloseTo(90, 10);
            expect(options.center).toEqual(new LngLat(10, 10));
            expect(options.zoom).toBeCloseTo(4.254888, 6);
        });

        test('mercator tilts the bearing of the same step by its latitude stretch', () => {
            const {state: view, context} = createTestCamera({width: 512, height: 512, zoom: 1});

            expect(getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 0, {lng: 10, lat: 10}, 0).bearing).not.toBeCloseTo(45, 1);
        });

        test('altitude is scaled by the CRS meters per world unit, so 90 meters down in a 180 meter world is half a world unit', () => {
            let {state: view, context} = createIdentityCrsCamera(512, 512);
            view = setZoom(view, context, 1);

            const options = getCameraSolver(context).calculateCameraOptionsFromTo(view, context, {lng: 0, lat: 0}, 90, {lng: 0, lat: 0}, 0);

            expect(options.pitch).toBeCloseTo(0, 10);
            expect(options.zoom).toBeCloseTo(1.584963, 6);
        });
    });
});

describe('isLocationOccluded', () => {
    test('a location behind a ridge is hidden and one in front of it is in view', () => {
        const tileSpanAtZoom12 = 360 / (1 << 12);
        const ridgeAcrossTheTwoMiddleRows = createDEM((_x, y) => (y === 3 || y === 4) ? 3000 : 0);
        const terrain = createDEMTerrain([new OverscaledTileID(12, 0, 12, 2048, 2047)], ridgeAcrossTheTwoMiddleRows);
        const cameraSouthOfRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.25);
        const {state: view, context} = createCameraAt(cameraSouthOfRidge, 12, 75);
        const projectedCamera = projectMercator(view, context);
        const behindRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.8);
        const inFrontOfRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.3);

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindRidge, terrain)).toBe(true);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, inFrontOfRidge, terrain)).toBe(false);
    });

    test('a location behind a ridge is in view once raised above the ridge', () => {
        const tileSpanAtZoom12 = 360 / (1 << 12);
        const ridgeAcrossTheTwoMiddleRows = createDEM((_x, y) => (y === 3 || y === 4) ? 3000 : 0);
        const terrain = createDEMTerrain([new OverscaledTileID(12, 0, 12, 2048, 2047)], ridgeAcrossTheTwoMiddleRows);
        const cameraSouthOfRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.25);
        const {state: view, context} = createCameraAt(cameraSouthOfRidge, 12, 75);
        const behindRidge = new LngLat(tileSpanAtZoom12 / 2, tileSpanAtZoom12 * 0.8);
        const elevationAboveRidge = 3500;

        const projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindRidge, terrain, elevationAboveRidge)).toBe(false);
    });

    test('a location on the terrain nearer than twice the near clipping plane\'s distance is in view', () => {
        const height = 449;
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height));
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 16, 60);
        const projectedCamera = projectMercator(view, context);
        const drawnAtTheScreenCenter = screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(256, 256), height).toLngLat();

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, drawnAtTheScreenCenter, terrain)).toBe(false);
    });

    test('a location behind the camera or beyond the far plane is hidden', () => {
        const terrain = createDEMTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 6, 80);
        const projectedCamera = projectMercator(view, context);
        const behindTheCamera = new LngLat(0, -70);
        const beyondTheFarPlane = new LngLat(0, 70);

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindTheCamera, terrain)).toBe(true);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, beyondTheFarPlane, terrain)).toBe(true);
    });

    test('nothing is hidden when the terrain has no renderable tiles', () => {
        const terrain = createDEMTerrain([], null);
        const {state: view, context} = createCameraAt(new LngLat(0, 0), 12, 75);

        const projectedCamera = projectMercator(view, context);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, new LngLat(0, 0.01), terrain)).toBe(false);
    });

    test('a location behind a ridge on the identity CRS is hidden, where mercator math would place it in front of the ridge', () => {
        const tileSpanAtZoom2 = 45;
        const ridgeAcrossTheTwoMiddleRows = createDEM((_x, y) => (y === 3 || y === 4) ? 14 : 0);
        let {state: view, context} = createIdentityCrsCamera(512, 512);
        const terrain = new Terrain(createPainter(), createRasterDEMTileManager(), {source: 'dem'}, 'auto', () => context.worldCoordinateHelper);
        terrain.tileManager.getRenderableTiles = () => [{tileID: new OverscaledTileID(2, 0, 2, 2, 1)} as Tile];
        terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem: ridgeAcrossTheTwoMiddleRows}) as Tile;
        view = setCenter(view, context, new LngLat(tileSpanAtZoom2 / 2, tileSpanAtZoom2 * 0.25));
        view = setZoom(view, context, 2);
        view = setPitch(view, 75);
        const projectedCamera = projectMercator(view, context);
        const behindRidge = new LngLat(tileSpanAtZoom2 / 2, 30);
        const inFrontOfRidge = new LngLat(tileSpanAtZoom2 / 2, tileSpanAtZoom2 * 0.3);

        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, behindRidge, terrain)).toBe(true);
        expect(getCameraMath(projectedCamera).isLocationOccluded(projectedCamera, context.worldCoordinateHelper, inFrontOfRidge, terrain)).toBe(false);
    });
});
