import {SymbolProjectionContext, ProjectionSyntheticVertexArgs, findOffsetIntersectionPoint, projectWithMatrix, transformToOffsetNormal, projectLineVertexToLabelPlane, getPitchedLabelPlaneMatrix} from './projection';

import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';
import {SymbolLineVertexArray} from '../data/array_types.g';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import { expectToBeCloseToArray } from '../util/test/util';

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
    const transform = new MercatorTransform();

    test('projecting with null matrix', () => {
        const projectionContext: SymbolProjectionContext = {
            projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
            lineVertexArray,
            pitchedLabelPlaneMatrix: mat4.create(),
            getElevation: (_x, _y) => 0,
            // Only relevant in "behind the camera" case, can't happen with null projection matrix
            tileAnchorPoint: new Point(0, 0),
            pitchWithMap: true,
            unwrappedTileID: null,
            transform,
            width: 1,
            height: 1,
            translation: [0, 0]
        };

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
    const transform = new MercatorTransform();

    const projectionContext: SymbolProjectionContext = {
        projectionCache: {projections: {}, offsets: {}, cachedAnchorPoint: undefined, anyProjectionOccluded: false},
        lineVertexArray,
        pitchedLabelPlaneMatrix: mat4.create(),
        getElevation: (_x, _y) => 0,
        tileAnchorPoint: new Point(0, 0),
        transform,
        pitchWithMap: true,
        unwrappedTileID: null,
        width: 1,
        height: 1,
        translation: [0, 0]
    };

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
        const transform = {roll: 45, pitch: 45, bearing: 0};
        
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, transform, 2).values()],
        [0.4330127239227295, -0.4330127239227295, 0, 0, 0.3061862289905548, 0.3061862289905548, 0, 0, 0, 0, 1, 0, 0, 0,0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, transform, 2).values()],
        [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    test('getPitchedLabelPlaneMatrix: bearing and pitch', () => {
        const transform = {roll: 0, pitch: 45, bearing: 45};
        
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, transform, 2).values()],
        [0.3535533845424652, -0.3535533845424652, 0, 0, 0.3535533845424652, 0.3535533845424652, 0, 0, 0, 0, 1, 0, 0, 0,0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, transform, 2).values()],
        [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

    test('getPitchedLabelPlaneMatrix: bearing, pitch, and roll', () => {
        const transform = {roll: 45, pitch: 45, bearing: 45};
        
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(false, transform, 2).values()],
        [0.08967986702919006,  -0.5226925611495972, 0, 0, 0.5226925611495972, -0.08967986702919006, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
        expectToBeCloseToArray([...getPitchedLabelPlaneMatrix(true, transform, 2).values()],
        [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 9);
    });

});
