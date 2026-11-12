import {describe, expect, test, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {createCameraState, getCenterPoint} from '../camera_state.ts';
import {createGlobeCameraProjection} from './camera_projection.ts';
import * as cameraUpdates from './camera_updates.ts';
import {getZoomAdjustment} from './globe_utils.ts';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper.ts';
import {createTestCamera} from '../../util/test/util.ts';

import type {CameraState} from '../camera_state.ts';
import type {MapControlsDeltas} from './camera_helper.ts';

/** Pans a 512 x 512 globe at zoom 1 over 0, 0 by 50, 30 pixels, grabbed at the given screen point. */
function panFrom(around: Point): CameraState {
    const {state, context} = createTestCamera({width: 512, height: 512, zoom: 1, center: [0, 0]}, createGlobeCameraProjection());
    return new VerticalPerspectiveCameraHelper().handleMapControlsPan(
        state, context,
        {panDelta: new Point(50, 30), around} as MapControlsDeltas,
        state.center);
}

describe('VerticalPerspectiveCameraHelper.handleMapControlsPan', () => {
    test('preserves bearing away from the poles', () => {
        const {state, context, projectedCamera} = createTestCamera({width: 512, height: 512, zoom: 4, center: [0, 20]}, createGlobeCameraProjection());
        const helper = new VerticalPerspectiveCameraHelper();

        const panned = helper.handleMapControlsPan(
            state, context,
            {panDelta: new Point(50, 30), around: projectedCamera.centerPoint} as MapControlsDeltas,
            state.center);

        expect(panned.bearingInRadians).toBe(0);
        expect(panned.center.lat).not.toBe(20);
    });

    test('does not zoom in when panning off the pole on the constrained min zoom', () => {
        const context = {projection: createGlobeCameraProjection(), constrainOverride: null};
        let state = cameraUpdates.resize(createCameraState(), context, 512, 512);
        state = cameraUpdates.setCenter(state, context, new LngLat(0, 80));
        state = cameraUpdates.setMinZoom(state, context, 3);
        state = cameraUpdates.setZoom(state, context, 0); // clamps to the latitude-compensated floor, minZoom + getZoomAdjustment(0, 80)
        const zoomBefore = state.zoom;
        expect(zoomBefore).toBeCloseTo(3 + getZoomAdjustment(0, 80), 10);
        const helper = new VerticalPerspectiveCameraHelper();

        const panned = helper.handleMapControlsPan(
            state, context,
            {panDelta: new Point(0, -50), around: getCenterPoint(state)} as MapControlsDeltas,
            state.center);

        expect(panned.center.lat).toBeLessThan(80);
        // The globe's drawn size is unchanged: zoom moved by exactly the latitude compensation
        expect(panned.zoom).toBeCloseTo(zoomBefore + getZoomAdjustment(80, panned.center.lat), 10);
    });

    test('pans toward the pole in double precision', () => {
        const {state, context, projectedCamera} = createTestCamera({width: 512, height: 512, zoom: 1, center: [-100, 88]}, createGlobeCameraProjection());
        const helper = new VerticalPerspectiveCameraHelper();

        const panned = helper.handleMapControlsPan(
            state, context,
            {panDelta: new Point(0, 40), around: projectedCamera.centerPoint} as MapControlsDeltas,
            state.center);

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

describe('VerticalPerspectiveCameraHelper.cameraForBoxAndBearing', () => {
    test('returns undefined instead of throwing when the padding exceeds the viewport', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const {state, context} = createTestCamera({width: 512, height: 512, zoom: 2, center: [0, 0]}, createGlobeCameraProjection());
        const helper = new VerticalPerspectiveCameraHelper();

        const result = helper.cameraForBoxAndBearing(
            {maxZoom: 22, offset: [0, 0]},
            {top: 50, bottom: 512, left: 50, right: 50},
            state.padding,
            new LngLatBounds([-10, -10], [10, 10]),
            0, state, context);

        expect(result).toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

describe('VerticalPerspectiveCameraHelper.handlePanInertia', () => {
    test('eases onto the pole', () => {
        const {projectedCamera} = createTestCamera({width: 512, height: 512, center: [0, 89]}, createGlobeCameraProjection());

        const {easingCenter} = new VerticalPerspectiveCameraHelper().handlePanInertia(new Point(0, 50), projectedCamera);

        expect(easingCenter.lat).toBe(90);
    });
});
