import {describe, expect, test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {createCameraState} from '../camera_state.ts';
import {createMercatorCameraProjection} from './camera_projection.ts';
import {projectCamera} from './camera_math.ts';
import * as cameraUpdates from './camera_updates.ts';
import {CRSWorldCoordinateHelper} from './crs.ts';
import {createRotatedCrs, createTestCamera} from '../../util/test/util.ts';

import type {CameraState} from '../camera_state.ts';
import type {CameraContext} from './camera_constrain.ts';

function createContext(): CameraContext {
    return {projection: createMercatorCameraProjection(), constrainOverride: null};
}

function createSizedState(context: CameraContext): CameraState {
    const state = cameraUpdates.resize(createCameraState({renderWorldCopies: true}), context, 200, 200);
    return cameraUpdates.setZoom(state, context, 10);
}

describe('setMaxBounds', () => {
    test('constrains latitude while leaving longitude unbounded', () => {
        const context = createContext();
        let state = createSizedState(context);

        state = cameraUpdates.setMaxBounds(state, context, new LngLatBounds([-Infinity, -50], [Infinity, 65]));
        state = cameraUpdates.setCenter(state, context, new LngLat(180, 80));

        expect(state.center.lng).toBe(180);
        expect(state.center.lat).toBeLessThan(65);
        expect(state.lngRange).toBeNull();
        expect(state.latRange).toEqual([-50, 65]);
    });

    test('rejects one-sided infinite longitude bounds', () => {
        const context = createContext();
        const state = createCameraState();

        expect(() => cameraUpdates.setMaxBounds(state, context, new LngLatBounds([-Infinity, -50], [30, 65]))).toThrow(
            'Longitude maxBounds values must either be finite or span from -Infinity to Infinity'
        );
        expect(() => cameraUpdates.setMaxBounds(state, context, new LngLatBounds([-30, -50], [Infinity, 65]))).toThrow(
            'Longitude maxBounds values must either be finite or span from -Infinity to Infinity'
        );
    });

    test('can constrain longitude without further restricting latitude', () => {
        const context = createContext();
        let state = createSizedState(context);

        state = cameraUpdates.setMaxBounds(state, context, new LngLatBounds([-30, -90], [30, 90]));
        state = cameraUpdates.setCenter(state, context, new LngLat(80, 80));

        expect(state.center.lng).toBeLessThan(30);
        expect(state.center.lat).toBe(80);
    });

    test('clears bounds when both axes span their valid ranges', () => {
        const context = createContext();
        let state = createCameraState();

        state = cameraUpdates.setMaxBounds(state, context, new LngLatBounds([-30, -50], [30, 65]));
        state = cameraUpdates.setMaxBounds(state, context, new LngLatBounds([-Infinity, -90], [Infinity, 90]));

        expect(state).toEqual(createCameraState());
    });
});

test('derives no projection matrices until the camera has a width and a height', () => {
    const context = createContext();
    const state = createCameraState();

    expect(projectCamera(cameraUpdates.resize(state, context, 0, 480, false), context.projection).projectionMatrix).toBeUndefined();
    expect(projectCamera(cameraUpdates.resize(state, context, 640, 0, false), context.projection).projectionMatrix).toBeUndefined();
    expect(projectCamera(cameraUpdates.resize(state, context, 640, 480, false), context.projection).projectionMatrix).toBeDefined();
});

test('takeState keeps every input of the camera it takes, without constraining it', () => {
    const context: CameraContext = {...createContext(), constrainOverride: (lngLat, zoom) => ({center: lngLat, zoom})};
    let original = createCameraState();
    original = cameraUpdates.setBearing(original, 12);
    original = cameraUpdates.setCenter(original, context, new LngLat(3, 4));
    original = cameraUpdates.setElevation(original, context, 5);
    original = cameraUpdates.setFov(original, 1);
    original = cameraUpdates.setMaxBounds(original, context, new LngLatBounds([-160, -80, 160, 80]));
    original = cameraUpdates.setMaxPitch(original, 50);
    original = cameraUpdates.setMaxZoom(original, context, 10);
    original = cameraUpdates.setMinElevationForCurrentTile(original, 0.1);
    original = cameraUpdates.setMinPitch(original, 0.1);
    original = cameraUpdates.setMinZoom(original, context, 0.1);
    original = cameraUpdates.setPadding(original, context, {top: 1, right: 4, bottom: 2, left: 3});
    original = cameraUpdates.setPitch(original, 3);
    original = cameraUpdates.setRoll(original, 7);
    original = cameraUpdates.setRenderWorldCopies(original, context.projection.worldCoordinateHelper, false);
    original = cameraUpdates.setZoom(original, context, 2.3);

    expect(cameraUpdates.takeState(original, createContext(), false)).toEqual(original);
});

test('normalizeCenter extends the target past the antimeridian when that path is shorter in a wrapping world', () => {
    const {state, context} = createTestCamera({renderWorldCopies: true, width: 200, height: 200, center: [170, 0]});
    const target = new LngLat(-170, 0);

    cameraUpdates.normalizeCenter(state, context.projection.worldCoordinateHelper, target);

    expect(target.lng).toBe(190);
});

test('normalizeCenter leaves the target alone in a world that does not wrap', () => {
    const projection = createMercatorCameraProjection(new CRSWorldCoordinateHelper(createRotatedCrs()));
    const {state, context} = createTestCamera({renderWorldCopies: true, width: 200, height: 200, zoom: 4, center: [140, 0]}, projection);
    const target = new LngLat(-140, 0);

    cameraUpdates.normalizeCenter(state, context.projection.worldCoordinateHelper, target);

    expect(target.lng).toBe(-140);
});
