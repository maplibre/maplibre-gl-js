import {describe, expect, test} from 'vitest';
import {LngLat} from '../lng_lat.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {createCameraViewState} from '../camera_view_state.ts';
import {createCameraContext} from './camera_context.ts';
import {projectCamera} from './project_camera.ts';
import * as cameraUpdates from './camera_updates.ts';
import {CRSWorldCoordinateHelper} from './crs.ts';
import {createRotatedCrs, createTestCamera} from '../../util/test/util.ts';

import type {CameraViewState} from '../camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';

function createSizedState(context: CameraContext): CameraViewState {
    const view = cameraUpdates.resize(createCameraViewState({renderWorldCopies: true}), context, 200, 200);
    return cameraUpdates.setZoom(view, context, 10);
}

describe('setMaxBounds', () => {
    test('constrains latitude while leaving longitude unbounded', () => {
        const context = createCameraContext();
        let view = createSizedState(context);

        view = cameraUpdates.setMaxBounds(view, context, new LngLatBounds([-Infinity, -50], [Infinity, 65]));
        view = cameraUpdates.setCenter(view, context, new LngLat(180, 80));

        expect(view.center.lng).toBe(180);
        expect(view.center.lat).toBeLessThan(65);
        expect(view.lngRange).toBeNull();
        expect(view.latRange).toEqual([-50, 65]);
    });

    test('rejects one-sided infinite longitude bounds', () => {
        const context = createCameraContext();
        const view = createCameraViewState();

        expect(() => cameraUpdates.setMaxBounds(view, context, new LngLatBounds([-Infinity, -50], [30, 65]))).toThrow(
            'Longitude maxBounds values must either be finite or span from -Infinity to Infinity'
        );
        expect(() => cameraUpdates.setMaxBounds(view, context, new LngLatBounds([-30, -50], [Infinity, 65]))).toThrow(
            'Longitude maxBounds values must either be finite or span from -Infinity to Infinity'
        );
    });

    test('can constrain longitude without further restricting latitude', () => {
        const context = createCameraContext();
        let view = createSizedState(context);

        view = cameraUpdates.setMaxBounds(view, context, new LngLatBounds([-30, -90], [30, 90]));
        view = cameraUpdates.setCenter(view, context, new LngLat(80, 80));

        expect(view.center.lng).toBeLessThan(30);
        expect(view.center.lat).toBe(80);
    });

    test('clears bounds when both axes span their valid ranges', () => {
        const context = createCameraContext();
        let view = createCameraViewState();

        view = cameraUpdates.setMaxBounds(view, context, new LngLatBounds([-30, -50], [30, 65]));
        view = cameraUpdates.setMaxBounds(view, context, new LngLatBounds([-Infinity, -90], [Infinity, 90]));

        expect(view).toEqual(createCameraViewState());
    });
});

test('derives no projection matrices until the camera has a width and a height', () => {
    const context = createCameraContext();
    const view = createCameraViewState();

    expect(projectCamera(cameraUpdates.resize(view, context, 0, 480, false), context).projectionMatrix).toBeUndefined();
    expect(projectCamera(cameraUpdates.resize(view, context, 640, 0, false), context).projectionMatrix).toBeUndefined();
    expect(projectCamera(cameraUpdates.resize(view, context, 640, 480, false), context).projectionMatrix).toBeDefined();
});

test('normalizeCenter extends the target past the antimeridian when that path is shorter in a wrapping world', () => {
    const {state: view, context} = createTestCamera({renderWorldCopies: true, width: 200, height: 200, center: [170, 0]});
    const target = new LngLat(-170, 0);

    cameraUpdates.normalizeCenter(view, context.worldCoordinateHelper, target);

    expect(target.lng).toBe(190);
});

test('normalizeCenter leaves the target alone in a world that does not wrap', () => {
    const {state: view, context} = createTestCamera({renderWorldCopies: true, width: 200, height: 200, zoom: 4, center: [140, 0]}, {worldCoordinateHelper: new CRSWorldCoordinateHelper(createRotatedCrs())});
    const target = new LngLat(-140, 0);

    cameraUpdates.normalizeCenter(view, context.worldCoordinateHelper, target);

    expect(target.lng).toBe(-140);
});
