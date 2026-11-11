import {describe, test, expect, vi} from 'vitest';
import {combineActions, createCameraStore, endMovement, requestCamera, setCenterElevationRule, setRequestedElevation, startMovement} from './camera_store.ts';
import {createCameraState} from '../geo/camera_state.ts';

import type {CameraState} from '../geo/camera_state.ts';

function cameraAt(elevation: number): CameraState {
    return {...createCameraState(), elevation};
}

describe('camera store', () => {
    test('notifies its listeners of a change with the state before it', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);
        const previous = store.getState();

        store.setState(setRequestedElevation(100));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(store.getState(), previous);
        expect(store.getState().requested.elevation).toBe(100);
        expect(previous.requested.elevation).toBe(0);
    });

    test('notifies no listener of an action that changes nothing', () => {
        const camera = cameraAt(0);
        const store = createCameraStore(camera);
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(requestCamera(camera));
        store.setState(setRequestedElevation(0));

        expect(listener).not.toHaveBeenCalled();
    });

    test('applies combined actions as one change', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(combineActions(startMovement(), setRequestedElevation(100)));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getState()).toMatchObject({moving: true, requested: {elevation: 100}});
    });

    test('ends a movement on the rendered camera, keeping the elevation a hold still holds', () => {
        const store = createCameraStore(cameraAt(1000));
        store.setState(combineActions(startMovement(), setCenterElevationRule({rule: 'held', holder: 'gesture', dem: 'loaded', keepsTerrainBelowMaxZoomForCenter: false})));

        store.setState(endMovement({...cameraAt(1200), zoom: 3}));

        expect(store.getState()).toMatchObject({moving: false, requested: {elevation: 1000, zoom: 3}});
    });
});
