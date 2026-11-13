import {describe, expect, test} from 'vitest';
import {createCameraViewState} from './camera_view_state.ts';
import {createCameraMetrics} from './projected_camera.ts';
import {mercatorWorldCoordinateHelper} from '../geo/mercator_coordinate.ts';

import type {CameraViewState} from './camera_view_state.ts';

function createSizedView(width: number, height: number): CameraViewState {
    return {...createCameraViewState(), width, height};
}

describe('createCameraMetrics', () => {
    test('shares the pixel matrices between camera states of the same size', () => {
        const view = createSizedView(800, 600);
        const zoomed = {...view, zoom: 5};

        const metrics = createCameraMetrics(view, mercatorWorldCoordinateHelper);
        const zoomedMetrics = createCameraMetrics(zoomed, mercatorWorldCoordinateHelper);

        expect(zoomedMetrics.pixelsToGLUnits).toBe(metrics.pixelsToGLUnits);
        expect(zoomedMetrics.pixelsToClipSpaceMatrix).toBe(metrics.pixelsToClipSpaceMatrix);
        expect(zoomedMetrics.clipSpaceToPixelsMatrix).toBe(metrics.clipSpaceToPixelsMatrix);
    });

    test('computes the pixel matrices of a camera that changed size', () => {
        createCameraMetrics(createSizedView(800, 600), mercatorWorldCoordinateHelper);

        const metrics = createCameraMetrics(createSizedView(400, 200), mercatorWorldCoordinateHelper);

        expect(metrics.pixelsToGLUnits).toEqual([2 / 400, -2 / 200]);
        expect(Array.from(metrics.clipSpaceToPixelsMatrix)).toEqual([200, 0, 0, 0, 0, -100, 0, 0, 0, 0, 1, 0, 200, 100, 0, 1]);
        expect(Array.from(metrics.pixelsToClipSpaceMatrix)).toEqual([2 / 400, 0, 0, 0, 0, -2 / 200, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]);
    });

    test('leaves the pixel matrices undefined while the camera has no size', () => {
        const metrics = createCameraMetrics(createCameraViewState(), mercatorWorldCoordinateHelper);

        expect(metrics.pixelsToGLUnits).toBeUndefined();
        expect(metrics.pixelsToClipSpaceMatrix).toBeUndefined();
        expect(metrics.clipSpaceToPixelsMatrix).toBeUndefined();
    });
});
