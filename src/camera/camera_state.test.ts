import {describe, test, expect, vi} from 'vitest';
import {adjustCamera, combineActions, constrainView, createCameraStore, endMovement, resizeView, setView, setViewElevation, setCenterElevationRule, setProjectionTransition, startMovement, terrainChanged} from './camera_state.ts';
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

describe('camera store', () => {
    test('notifies its listeners of a change with the state before it', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);
        const previous = store.getState();

        store.setState(setViewElevation(100));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(store.getState(), previous);
        expect(store.getState().view.elevation).toBe(100);
        expect(previous.view.elevation).toBe(0);
    });

    test('notifies no listener of an action that changes nothing', () => {
        const camera = cameraAt(0);
        const store = createCameraStore(camera);
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(setView(camera));
        store.setState(setViewElevation(0));

        expect(listener).not.toHaveBeenCalled();
    });

    test('applies combined actions as one change', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(combineActions(startMovement(), setViewElevation(100)));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getState()).toMatchObject({motion: {moving: true, adjustment: null}, view: {elevation: 100}});
    });

    test('ends a movement on the rendered camera, keeping the elevation a hold still holds', () => {
        const store = createCameraStore(cameraAt(1000));
        store.setState(combineActions(
            startMovement(),
            setCenterElevationRule({rule: 'held', holder: 'gesture', dem: 'loaded', keepsTerrainBelowMaxZoomForCenter: false}),
            adjustCamera({zoom: 3})));

        store.setState(endMovement({...cameraAt(1200), zoom: 3}));

        expect(store.getState()).toMatchObject({motion: {moving: false, adjustment: null}, view: {elevation: 1000, zoom: 3}});
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
        const store = createCameraStore(createCameraViewState());

        store.setState(setView(view));

        expect(store.getState().view).toEqual(view);
        expect(projectCamera(store.getState().view, context)).toEqual(projectCamera(view, context));
    });

    test('constrains the camera in the given context', () => {
        const store = createCameraStore(unconstrainedCamera());

        store.setState(constrainView(createCameraContext()));

        expect(store.getState().view.center.lat).toBeCloseTo(0, 4);
    });

    test('counts the changes of the terrain', () => {
        const store = createCameraStore(cameraAt(0));

        store.setState(terrainChanged());
        store.setState(terrainChanged());

        expect(store.getState().terrainRevision).toBe(2);
    });

    test('moves a globe along its transition, notifying no listener of the point it is already at', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(setProjectionTransition(1));
        store.setState(setProjectionTransition(0.5));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getState().projectionTransition).toBe(0.5);
    });

    test('resizes the camera', () => {
        const store = createCameraStore(cameraAt(0));

        store.setState(resizeView(createCameraContext(), 640, 480, false));

        expect(store.getState().view).toMatchObject({width: 640, height: 480});
    });

    test('adjusts only a movement', () => {
        const store = createCameraStore(cameraAt(0));

        store.setState(adjustCamera({zoom: 3}));
        expect(store.getState().motion).toEqual({moving: false, adjustment: null});

        store.setState(combineActions(startMovement(), adjustCamera({zoom: 3})));
        expect(store.getState().motion).toEqual({moving: true, adjustment: {zoom: 3}});
    });
});
