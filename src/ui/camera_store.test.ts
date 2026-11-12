import {describe, test, expect, vi} from 'vitest';
import {adjustCamera, combineActions, constrainCamera, createCameraStore, endMovement, proposeCamera, resizeCamera, setCenterElevationRule, setProjectionTransition, setProposedElevation, startMovement, terrainChanged} from './camera_store.ts';
import {createCameraState} from '../geo/camera_state.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {createMercatorCameraProjection} from '../geo/projection/camera_projection.ts';

import type {CameraState} from '../geo/camera_state.ts';
import type {CameraContext} from '../geo/projection/camera_constrain.ts';

function cameraAt(elevation: number): CameraState {
    return {...createCameraState(), elevation};
}

function createMercatorContext(): CameraContext {
    return {projection: createMercatorCameraProjection(), constrainOverride: null};
}

/** A 512 x 512 camera at zoom 0 with its center at 80° north, which no constrain has seen yet. */
function unconstrainedCamera(): CameraState {
    return {...createCameraState(), width: 512, height: 512, center: new LngLat(0, 80)};
}

describe('camera store', () => {
    test('notifies its listeners of a change with the state before it', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);
        const previous = store.getState();

        store.setState(setProposedElevation(100));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(store.getState(), previous);
        expect(store.getState().proposed.elevation).toBe(100);
        expect(previous.proposed.elevation).toBe(0);
    });

    test('notifies no listener of an action that changes nothing', () => {
        const camera = cameraAt(0);
        const store = createCameraStore(camera);
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(proposeCamera(camera));
        store.setState(setProposedElevation(0));

        expect(listener).not.toHaveBeenCalled();
    });

    test('applies combined actions as one change', () => {
        const store = createCameraStore(cameraAt(0));
        const listener = vi.fn();
        store.subscribe(listener);

        store.setState(combineActions(startMovement(), setProposedElevation(100)));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getState()).toMatchObject({moving: true, proposed: {elevation: 100}});
    });

    test('ends a movement on the rendered camera, keeping the elevation a hold still holds', () => {
        const store = createCameraStore(cameraAt(1000));
        store.setState(combineActions(
            startMovement(),
            setCenterElevationRule({rule: 'held', holder: 'gesture', dem: 'loaded', keepsTerrainBelowMaxZoomForCenter: false}),
            adjustCamera({zoom: 3})));

        store.setState(endMovement({...cameraAt(1200), zoom: 3}));

        expect(store.getState()).toMatchObject({moving: false, adjustment: null, proposed: {elevation: 1000, zoom: 3}});
    });

    test('constrains the proposed camera in the given context', () => {
        const store = createCameraStore(unconstrainedCamera());

        store.setState(constrainCamera(createMercatorContext()));

        expect(store.getState().proposed.center.lat).toBeCloseTo(0, 4);
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

    test('resizes the proposed camera', () => {
        const store = createCameraStore(cameraAt(0));

        store.setState(resizeCamera(createMercatorContext(), 640, 480, false));

        expect(store.getState().proposed).toMatchObject({width: 640, height: 480});
    });
});
