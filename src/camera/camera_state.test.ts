import {describe, test, expect} from 'vitest';
import {adjustCamera, applyAction, combineActions, constrainView, createCameraState, endMovement, resizeView, setView, setViewElevation, setCenterElevationRule, setProjectionTransition, startMovement, terrainChanged} from './camera_state.ts';
import {createCameraViewState} from './camera_view_state.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {createCameraContext} from './camera_context.ts';
import {projectCamera} from './project_camera.ts';
import {setBearing, setCenter, setElevation, setFov, setMaxBounds, setMaxPitch, setMaxZoom, setMinElevationForCurrentTile, setMinPitch, setMinZoom, setPadding, setPitch, setRenderWorldCopies, setRoll, setZoom} from './camera_updates.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';

import type {CameraViewState} from './camera_view_state.ts';

function cameraAt(elevation: number): CameraViewState {
    return {...createCameraViewState(), elevation};
}

/** A 512 x 512 camera at zoom 0 with its center at 80° north, which no constrain has seen yet. */
function unconstrainedCamera(): CameraViewState {
    return {...createCameraViewState(), width: 512, height: 512, center: new LngLat(0, 80)};
}

describe('camera state', () => {
    test('applies an action as a new state, leaving the state before it as it was', () => {
        const previous = createCameraState(cameraAt(0));

        const state = applyAction(previous, setViewElevation(100));

        expect(state.view.elevation).toBe(100);
        expect(previous.view.elevation).toBe(0);
    });

    test('keeps the state of an action that changes nothing', () => {
        const camera = cameraAt(0);
        const state = createCameraState(camera);

        expect(applyAction(state, setView(camera))).toBe(state);
        expect(applyAction(state, setViewElevation(0))).toBe(state);
    });

    test('applies combined actions as one change', () => {
        const state = applyAction(createCameraState(cameraAt(0)), combineActions(startMovement(), setViewElevation(100)));

        expect(state).toMatchObject({motion: {moving: true, adjustment: null}, view: {elevation: 100}});
    });

    test('ends a movement on the rendered camera, keeping the elevation a hold still holds', () => {
        let state = applyAction(createCameraState(cameraAt(1000)), combineActions(
            startMovement(),
            setCenterElevationRule({rule: 'held', holder: 'gesture', dem: 'loaded', keepsTerrainBelowMaxZoomForCenter: false}),
            adjustCamera({zoom: 3})));

        state = applyAction(state, endMovement({...cameraAt(1200), zoom: 3}));

        expect(state).toMatchObject({motion: {moving: false, adjustment: null}, view: {elevation: 1000, zoom: 3}});
    });

    test('sets every field of a view, leaving it unconstrained', () => {
        const context = createCameraContext({constrainOverride: (lngLat, zoom) => ({center: lngLat, zoom: zoom ?? 0})});
        let view = createCameraViewState();
        view = setBearing(view, 12);
        view = setCenter(view, context, new LngLat(3, 4));
        view = setElevation(view, context, 5);
        view = setFov(view, 1);
        view = setMaxBounds(view, context, new LngLatBounds([-160, -80, 160, 80]));
        view = setMaxPitch(view, 50);
        view = setMaxZoom(view, context, 10);
        view = setMinElevationForCurrentTile(view, 0.1);
        view = setMinPitch(view, 0.1);
        view = setMinZoom(view, context, 0.1);
        view = setPadding(view, context, {top: 1, right: 4, bottom: 2, left: 3});
        view = setPitch(view, 3);
        view = setRoll(view, 7);
        view = setRenderWorldCopies(view, context.worldCoordinateHelper, false);
        view = setZoom(view, context, 2.3);
        const state = applyAction(createCameraState(createCameraViewState()), setView(view));

        expect(state.view).toEqual(view);
        expect(projectCamera(state.view, context)).toEqual(projectCamera(view, context));
    });

    test('constrains the camera in the given context', () => {
        const state = applyAction(createCameraState(unconstrainedCamera()), constrainView(createCameraContext()));

        expect(state.view.center.lat).toBeCloseTo(0, 4);
    });

    test('counts the changes of the terrain', () => {
        let state = createCameraState(cameraAt(0));

        state = applyAction(state, terrainChanged());
        state = applyAction(state, terrainChanged());

        expect(state.terrainRevision).toBe(2);
    });

    test('moves a globe along its transition, keeping the state at the point it is already at', () => {
        const state = createCameraState(cameraAt(0));

        expect(applyAction(state, setProjectionTransition(1))).toBe(state);
        expect(applyAction(state, setProjectionTransition(0.5)).projectionTransition).toBe(0.5);
    });

    test('resizes the camera', () => {
        const state = applyAction(createCameraState(cameraAt(0)), resizeView(createCameraContext(), 640, 480, false));

        expect(state.view).toMatchObject({width: 640, height: 480});
    });

    test('adjusts only a movement', () => {
        let state = createCameraState(cameraAt(0));

        state = applyAction(state, adjustCamera({zoom: 3}));
        expect(state.motion).toEqual({moving: false, adjustment: null});

        state = applyAction(state, combineActions(startMovement(), adjustCamera({zoom: 3})));
        expect(state.motion).toEqual({moving: true, adjustment: {zoom: 3}});
    });
});
