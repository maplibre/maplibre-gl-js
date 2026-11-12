import {describe, expect, test, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {createCameraViewState, getCenterPoint} from '../camera_view_state.ts';
import {createCameraContext} from './camera_context.ts';
import * as cameraUpdates from './camera_updates.ts';
import {getZoomAdjustment} from './globe_utils.ts';
import * as verticalPerspectiveCameraUpdates from './vertical_perspective_camera_updates.ts';
import {createTestCamera} from '../../util/test/util.ts';

import type {CameraViewState} from '../camera_view_state.ts';
import type {MapControlsDeltas} from './camera_updates.ts';

/** Pans a 512 x 512 globe at zoom 1 over 0, 0 by 50, 30 pixels, grabbed at the given screen point. */
function panFrom(around: Point): CameraViewState {
    const {state: view, context} = createTestCamera({width: 512, height: 512, zoom: 1, center: [0, 0]}, {projection: 'globe'});
    return verticalPerspectiveCameraUpdates.pan(
        view, context,
        {panDelta: new Point(50, 30), around} as MapControlsDeltas,
        view.center);
}

describe('verticalPerspectiveCameraUpdates.pan', () => {
    test('preserves bearing away from the poles', () => {
        const {state: view, context, projectedCamera} = createTestCamera({width: 512, height: 512, zoom: 4, center: [0, 20]}, {projection: 'globe'});

        const panned = verticalPerspectiveCameraUpdates.pan(
            view, context,
            {panDelta: new Point(50, 30), around: projectedCamera.centerPoint} as MapControlsDeltas,
            view.center);

        expect(panned.bearingInRadians).toBe(0);
        expect(panned.center.lat).not.toBe(20);
    });

    test('does not zoom in when panning off the pole on the constrained min zoom', () => {
        const context = createCameraContext({projection: 'globe'});
        let view = cameraUpdates.resize(createCameraViewState(), context, 512, 512);
        view = cameraUpdates.setCenter(view, context, new LngLat(0, 80));
        view = cameraUpdates.setMinZoom(view, context, 3);
        view = cameraUpdates.setZoom(view, context, 0); // clamps to the latitude-compensated floor, minZoom + getZoomAdjustment(0, 80)
        const zoomBefore = view.zoom;
        expect(zoomBefore).toBeCloseTo(3 + getZoomAdjustment(0, 80), 10);

        const panned = verticalPerspectiveCameraUpdates.pan(
            view, context,
            {panDelta: new Point(0, -50), around: getCenterPoint(view)} as MapControlsDeltas,
            view.center);

        expect(panned.center.lat).toBeLessThan(80);
        // The globe's drawn size is unchanged: zoom moved by exactly the latitude compensation
        expect(panned.zoom).toBeCloseTo(zoomBefore + getZoomAdjustment(80, panned.center.lat), 10);
    });

    test('pans toward the pole in double precision', () => {
        const {state: view, context, projectedCamera} = createTestCamera({width: 512, height: 512, zoom: 1, center: [-100, 88]}, {projection: 'globe'});

        const panned = verticalPerspectiveCameraUpdates.pan(
            view, context,
            {panDelta: new Point(0, 40), around: projectedCamera.centerPoint} as MapControlsDeltas,
            view.center);

        expect(panned.center.lat).toBeCloseTo(89.2138864716364, 10);
    });

    describe('anchor', () => {
        test('a grab off the sphere pans from the center point', () => {
            const dragged = panFrom(new Point(500, 30));
            const centered = panFrom(new Point(256, 256));

            expect(dragged.center.lng).toBe(centered.center.lng);
            expect(dragged.center.lat).toBe(centered.center.lat);
        });

        test('a grab on the sphere pans from the grab', () => {
            const dragged = panFrom(new Point(300, 256));

            expect(dragged.center.lng).not.toBe(panFrom(new Point(256, 256)).center.lng);
        });
    });
});

describe('verticalPerspectiveCameraUpdates.cameraForBoxAndBearing', () => {
    test('returns undefined instead of throwing when the padding exceeds the viewport', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const {state: view, context} = createTestCamera({width: 512, height: 512, zoom: 2, center: [0, 0]}, {projection: 'globe'});

        const result = verticalPerspectiveCameraUpdates.cameraForBoxAndBearing(
            {maxZoom: 22, offset: [0, 0]},
            {top: 50, bottom: 512, left: 50, right: 50},
            view.padding,
            new LngLatBounds([-10, -10], [10, 10]),
            0, view, context);

        expect(result).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe('verticalPerspectiveCameraUpdates.panInertia', () => {
    test('eases onto the pole', () => {
        const {projectedCamera} = createTestCamera({width: 512, height: 512, center: [0, 89]}, {projection: 'globe'});

        const {easingCenter} = verticalPerspectiveCameraUpdates.panInertia(projectedCamera, new Point(0, 50));

        expect(easingCenter.lat).toBe(90);
    });
});
