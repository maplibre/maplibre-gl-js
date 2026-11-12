import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {type SymbolProjectionContext, type ProjectionSyntheticVertexArgs, findOffsetIntersectionPoint, projectWithMatrix, transformToOffsetNormal, projectLineVertexToLabelPlane, getPitchedLabelPlaneMatrix, getGlCoordMatrix, getTileSkewVectors, projectTileCoordinatesToClipSpace, projectTileCoordinatesToLabelPlane} from './projection.ts';
import {mat4} from 'gl-matrix';
import {SymbolLineVertexArray} from '../data/array_types.g.ts';
import {CanonicalTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {expectToBeCloseToArray, createTestCamera} from '../util/test/util.ts';
import * as cameraMath from '../geo/projection/camera_math.ts';
import * as cameraUpdates from '../geo/projection/camera_updates.ts';

import type {ProjectedCamera} from '../geo/projected_camera.ts';

const TERRAIN_ELEVATION = 100;
const unwrappedTileID = new UnwrappedTileID(0, new CanonicalTileID(1, 1, 0));

/** A sized, pitched mercator camera, so that projections through it produce meaningful values. */
function createDefaultCamera(): ProjectedCamera {
    return createTestCamera({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true, width: 500, height: 500, center: new LngLat(10.0, 50.0), pitch: 60}).projectedCamera;
}

/**
 * Builds a {@link SymbolProjectionContext} backed by {@link createDefaultCamera}. Pass `overrides` for whatever the
 * test cares about; everything else falls back to a pitched viewport over flat terrain at `TERRAIN_ELEVATION`.
 */
function createProjectionContext(overrides: Partial<SymbolProjectionContext> = {}): SymbolProjectionContext {
    return {
        projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
        lineVertexArray: null,
        pitchedLabelPlaneMatrix: mat4.create(),
        getElevation: (_x, _y) => TERRAIN_ELEVATION,
        tileAnchorPoint: new Point(0, 0),
        pitchWithMap: false,
        unwrappedTileID,
        projectedCamera: overrides.projectedCamera ?? createDefaultCamera(),
        width: 100,
        height: 100,
        translation: [0, 0],
        ...overrides
    };
}

describe('Projection', () => {
    test('matrix float precision', () => {
        const point = new Point(10.000000005, 0);
        const matrix = mat4.create();
        expect(projectWithMatrix(point.x, point.y, matrix).point.x).toBeCloseTo(point.x, 10);
    });
});

describe('Vertex to viewport projection', () => {
    // A three point line along the x axis
    const lineVertexArray = new SymbolLineVertexArray();
    lineVertexArray.emplaceBack(-10, 0, -10);
    lineVertexArray.emplaceBack(0, 0, 0);
    lineVertexArray.emplaceBack(10, 0, 10);
    const {projectedCamera} = createTestCamera();

    test('projecting with null matrix', () => {
        const projectionContext = createProjectionContext({
            lineVertexArray,
            getElevation: (_x, _y) => 0,
            // Only relevant in "behind the camera" case, can't happen with null projection matrix
            tileAnchorPoint: new Point(0, 0),
            pitchWithMap: true,
            unwrappedTileID: null,
            projectedCamera,
            width: 1,
            height: 1
        });

        const syntheticVertexArgs: ProjectionSyntheticVertexArgs = {
            distanceFromAnchor: 0,
            previousVertex: new Point(0, 0),
            direction: 1,
            absOffsetX: 0
        };

        const first = projectLineVertexToLabelPlane(0, projectionContext, syntheticVertexArgs);
        const second = projectLineVertexToLabelPlane(1, projectionContext, syntheticVertexArgs);
        const third = projectLineVertexToLabelPlane(2, projectionContext, syntheticVertexArgs);
        expect(first.x).toBeCloseTo(-10);
        expect(second.x).toBeCloseTo(0);
        expect(third.x).toBeCloseTo(10);
    });
});

describe('Find offset line intersections', () => {
    const lineVertexArray = new SymbolLineVertexArray();
    // A three point line along x axis, to origin, and then up y axis
    lineVertexArray.emplaceBack(-10, 0, -10);
    lineVertexArray.emplaceBack(0, 0, 0);
    lineVertexArray.emplaceBack(0, 10, 10);

    // A three point line along the x axis
    lineVertexArray.emplaceBack(-10, 0, -10);
    lineVertexArray.emplaceBack(0, 0, 0);
    lineVertexArray.emplaceBack(10, 0, 10);
    const {projectedCamera} = createTestCamera();

    const projectionContext = createProjectionContext({
        lineVertexArray,
        getElevation: (_x, _y) => 0,
        projectedCamera,
        pitchWithMap: true,
        unwrappedTileID: null,
        width: 1,
        height: 1
    });

    // Only relevant in "behind the camera" case, can't happen with null projection matrix
    const syntheticVertexArgs: ProjectionSyntheticVertexArgs = {
        direction: 1,
        distanceFromAnchor: 0,
        previousVertex: new Point(0, 0),
        absOffsetX: 0
    };

    test('concave', () => {
        /*
                  | |
                  | |
          ________| |
          __________|  <- origin
        */
        projectionContext.projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetY = 1;

        const prevToCurrent = new Point(10, 0);
        const normal = transformToOffsetNormal(prevToCurrent, lineOffsetY, syntheticVertexArgs.direction);
        expect(normal.y).toBeCloseTo(1);
        expect(normal.x).toBeCloseTo(0);
        const intersectionPoint = findOffsetIntersectionPoint(
            1,
            normal,
            new Point(0, 0),
            0,
            3,
            new Point(-10, 1),
            lineOffsetY,
            projectionContext,
            syntheticVertexArgs
        );
        expect(intersectionPoint.y).toBeCloseTo(1);
        expect(intersectionPoint.x).toBeCloseTo(-1);
    });

    test('convex', () => {
        /*
                    | |
                    | |
           origin \ | |
          __________| |
          ____________|
        */
        projectionContext.projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetY = -1;

        const prevToCurrent = new Point(10, 0);
        const normal = transformToOffsetNormal(prevToCurrent, lineOffsetY, syntheticVertexArgs.direction);
        expect(normal.y).toBeCloseTo(-1);
        expect(normal.x).toBeCloseTo(0);
        const intersectionPoint = findOffsetIntersectionPoint(
            1,
            normal,
            new Point(0, 0),
            0,
            3,
            new Point(-10, -1),
            lineOffsetY,
            projectionContext,
            syntheticVertexArgs
        );
        expect(intersectionPoint.y).toBeCloseTo(-1);
        expect(intersectionPoint.x).toBeCloseTo(1);
    });

    test('parallel', () => {
        /*
          ______._____
          ______|_____
        */
        projectionContext.projectionCache = {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false};
        const lineOffsetY = 1;

        const prevToCurrent = new Point(10, 0);
        const intersectionPoint = findOffsetIntersectionPoint(
            1,
            transformToOffsetNormal(prevToCurrent, lineOffsetY, syntheticVertexArgs.direction),
            new Point(0, 0),
            3,
            5,
            new Point(-10, 1),
            lineOffsetY,
            projectionContext,
            syntheticVertexArgs
        );
        expect(intersectionPoint.x).toBeCloseTo(0);
        expect(intersectionPoint.y).toBeCloseTo(1);
    });

    test('getPitchedLabelPlaneMatrix: bearing and roll', () => {
        const {projectedCamera} = createTestCamera({bearing: 0, pitch: 45, roll: 45});

        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, projectedCamera, 2)],
            [0.4330127239227295, -0.4330127239227295, 0, 0, 0.3061862289905548, 0.3061862289905548, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, projectedCamera, 2)],
            [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    test('getPitchedLabelPlaneMatrix: bearing and pitch', () => {
        const {projectedCamera} = createTestCamera({bearing: 45, pitch: 45, roll: 0});

        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, projectedCamera, 2)],
            [0.3535533845424652, -0.3535533845424652, 0, 0, 0.3535533845424652, 0.3535533845424652, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, projectedCamera, 2)],
            [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    test('getPitchedLabelPlaneMatrix: bearing, pitch, and roll', () => {
        const {projectedCamera} = createTestCamera({bearing: 45, pitch: 45, roll: 45});

        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, projectedCamera, 2)],
            [0.08967986702919006,  -0.5226925611495972, 0, 0, 0.5226925611495972, -0.08967986702919006, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, projectedCamera, 2)],
            [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    test('getGlCoordMatrix: bearing, pitch, and roll', () => {
        const {projectedCamera} = createTestCamera({width: 128, height: 128, bearing: 45, pitch: 45, roll: 45});

        expectToBeCloseToArray([...getGlCoordMatrix(false, false, projectedCamera, 2)],
            [...projectedCamera.pixelsToClipSpaceMatrix], 9);
        expectToBeCloseToArray([...getGlCoordMatrix(false, true, projectedCamera, 2)],
            [...projectedCamera.pixelsToClipSpaceMatrix], 9);
        expectToBeCloseToArray([...getGlCoordMatrix(true, false, projectedCamera, 2)],
            [-0.33820396661758423, 1.9711971282958984, 0, 0, -1.9711971282958984, 0.33820396661758423, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
        expectToBeCloseToArray([...getGlCoordMatrix(true, true, projectedCamera, 2)],
            [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    test('getTileSkewVectors: bearing', () => {
        const {projectedCamera} = createTestCamera({bearing: 45, pitch: 0, roll: 0});

        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecEast],
            [0.7071067690849304, 0.7071067690849304]);
        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecSouth],
            [-0.7071067690849304, 0.7071067690849304], 9);
    });

    test('getTileSkewVectors: roll', () => {
        const {projectedCamera} = createTestCamera({bearing: 0, pitch: 0, roll: 45});

        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecEast],
            [0.7071067690849304, 0.7071067690849304]);
        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecSouth],
            [-0.7071067690849304, 0.7071067690849304], 9);
    });

    test('getTileSkewVectors: pitch', () => {
        const {projectedCamera} = createTestCamera({bearing: 0, pitch: 45, roll: 0});

        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecEast],
            [1.0, 0.0]);
        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecSouth],
            [0.0, 1.0], 9);
    });

    test('getTileSkewVectors: roll pitch bearing', () => {
        const {projectedCamera} = createTestCamera({bearing: 45, pitch: 45, roll: 45});

        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecEast],
            [-0.16910198330879211, 0.9855985641479492]);
        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecSouth],
            [-0.9855985641479492, 0.16910198330879211], 9);
    });

    test('getTileSkewVectors: pitch 90 degrees', () => {
        const {state: view, context, projectedCamera} = createTestCamera({maxPitch: 180, bearing: 0, pitch: 89, roll: 0});

        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecEast],
            [1, 0]);
        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecSouth],
            [0, 1], 9);

        const pitched = cameraUpdates.setPitch(view, 90);
        const pitchedCamera = cameraMath.projectCamera(pitched, context);
        expectToBeCloseToArray([...getTileSkewVectors(pitchedCamera).vecEast],
            [0, 0]);
        expectToBeCloseToArray([...getTileSkewVectors(pitchedCamera).vecSouth],
            [0, 1], 9);

        const turnedCamera = cameraMath.projectCamera(cameraUpdates.setBearing(pitched, 90), context);
        expectToBeCloseToArray([...getTileSkewVectors(turnedCamera).vecEast],
            [0, 0]);
        expectToBeCloseToArray([...getTileSkewVectors(turnedCamera).vecSouth],
            [-1, 0], 9);
    });

    test('getTileSkewVectors: pitch 90 degrees with roll and bearing', () => {
        const {state: view, context, projectedCamera} = createTestCamera({maxPitch: 180, bearing: 45, pitch: 89, roll: 45});

        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecEast],
            [-0.6946603059768677, 0.7193379402160645]);
        expectToBeCloseToArray([...getTileSkewVectors(projectedCamera).vecSouth],
            [-0.7193379402160645, 0.6946603059768677], 9);

        const pitchedCamera = cameraMath.projectCamera(cameraUpdates.setPitch(view, 90), context);
        expectToBeCloseToArray([...getTileSkewVectors(pitchedCamera).vecEast],
            [-0.7071067690849304, 0.7071067690849304]);
        expectToBeCloseToArray([...getTileSkewVectors(pitchedCamera).vecSouth],
            [-0.7071067690849304, 0.7071067690849304], 9);
    });

});

describe('symbol height offset projection', () => {
    const HEIGHT_OFFSET = 250;

    test('projectTileCoordinatesToClipSpace measures the height offset from the terrain when the anchor is ground', () => {
        const projectionContext = createProjectionContext({heightOffset: HEIGHT_OFFSET, heightAnchorGround: true});
        const projected = projectTileCoordinatesToClipSpace(1024, 1024, projectionContext);
        const expected = cameraMath.projectTileCoordinates(projectionContext.projectedCamera, 1024, 1024, unwrappedTileID, TERRAIN_ELEVATION + HEIGHT_OFFSET);
        expect(projected.point.x).toBeCloseTo(expected.point.x, 10);
        expect(projected.point.y).toBeCloseTo(expected.point.y, 10);
    });

    test('projectTileCoordinatesToClipSpace ignores the terrain when the anchor is absolute', () => {
        const projectionContext = createProjectionContext({heightOffset: HEIGHT_OFFSET, heightAnchorGround: false});
        const projected = projectTileCoordinatesToClipSpace(1024, 1024, projectionContext);
        const expected = cameraMath.projectTileCoordinates(projectionContext.projectedCamera, 1024, 1024, unwrappedTileID, HEIGHT_OFFSET);
        expect(projected.point.x).toBeCloseTo(expected.point.x, 10);
        expect(projected.point.y).toBeCloseTo(expected.point.y, 10);
    });

    test('projectTileCoordinatesToClipSpace defaults to the plain terrain elevation without height properties', () => {
        const projectionContext = createProjectionContext();
        const projected = projectTileCoordinatesToClipSpace(1024, 1024, projectionContext);
        const expected = cameraMath.projectTileCoordinates(projectionContext.projectedCamera, 1024, 1024, unwrappedTileID, TERRAIN_ELEVATION);
        expect(projected.point.x).toBeCloseTo(expected.point.x, 10);
        expect(projected.point.y).toBeCloseTo(expected.point.y, 10);
    });

    test('projectTileCoordinatesToLabelPlane raises a viewport-aligned symbol by the height offset', () => {
        const grounded = projectTileCoordinatesToLabelPlane(1024, 1024, createProjectionContext());
        const raised = projectTileCoordinatesToLabelPlane(1024, 1024, createProjectionContext({heightOffset: HEIGHT_OFFSET, heightAnchorGround: true}));
        // The label plane y axis points down the screen, so a raised symbol sits at a smaller y.
        expect(raised.point.y).toBeLessThan(grounded.point.y);
        // Raising the symbol only shifts it along y; x moves by no more than the perspective change.
        expect(raised.point.x).toBeCloseTo(grounded.point.x, 4);
    });
});
