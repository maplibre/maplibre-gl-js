import {describe, test, expect, vi} from 'vitest';
import {adjustCamera, combineActions, constrainView, createCameraStore, endMovement, resizeView, setView, setViewElevation, setCenterElevationRule, setProjectionTransition, startMovement, terrainChanged} from './camera_state.ts';
import {createCameraViewState} from '../geo/camera_view_state.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {createCameraContext} from '../geo/projection/camera_context.ts';

import type {CameraViewState} from '../geo/camera_view_state.ts';

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
