import {createStore, type StoreApi} from 'zustand/vanilla';

import type {CameraState} from '../geo/camera_state.ts';
import type {CenterElevationRule} from './center_elevation.ts';

/**
 * @internal
 * The state of a {@link Camera}, as immutable plain data. Only the actions below change it, each through
 * {@link CameraStore.setState}, and listeners subscribed to the store hear of every change with the state before it.
 */
export type CameraStoreState = {
    /**
     * The requested camera: the camera that movements and changes ask for. At rest it is the rendered camera; while a
     * movement runs it is what the movement asked for, from which the rendered camera is derived.
     */
    readonly requested: CameraState;
    /** How the requested center elevation follows the terrain. */
    readonly centerElevation: CenterElevationRule;
    /**
     * Whether a movement runs, from its first change to its `moveend`. Until then the requested camera is a proposal,
     * rendered with the corrections a movement gets and with `transformCameraUpdate`.
     */
    readonly moving: boolean;
};

/** @internal The store that holds a camera's {@link CameraStoreState}. */
export type CameraStore = StoreApi<CameraStoreState>;

/**
 * @internal
 * A change to the camera's state, dispatched with `store.setState(action)`: a pure function of the state that returns
 * the fields it changes, or the state itself when it changes nothing, which notifies no listener.
 */
export type CameraAction = (state: CameraStoreState) => Partial<CameraStoreState> | CameraStoreState;

/** @internal Creates the store of a camera at rest on the given camera. */
export function createCameraStore(requested: CameraState): CameraStore {
    return createStore<CameraStoreState>()(() => ({requested, centerElevation: {rule: 'ground'}, moving: false}));
}

/** @internal Applies actions one after another, as one change of the state. */
export function combineActions(...actions: CameraAction[]): CameraAction {
    return (state) => actions.reduce<CameraStoreState>((current, action) => {
        const changes = action(current);
        return changes === current ? current : {...current, ...changes};
    }, state);
}

/** @internal A movement or a change asks for a camera. */
export function requestCamera(camera: CameraState): CameraAction {
    return (state) => camera === state.requested ? state : {requested: camera};
}

/** @internal The requested camera's center moves to an elevation, keeping everything else. */
export function setRequestedElevation(elevation: number): CameraAction {
    return (state) => elevation === state.requested.elevation ? state : {requested: {...state.requested, elevation}};
}

/** @internal The requested center elevation follows the terrain by another rule. */
export function setCenterElevationRule(centerElevation: CenterElevationRule): CameraAction {
    return (state) => centerElevation === state.centerElevation ? state : {centerElevation};
}

/** @internal A movement starts, or goes on. */
export function startMovement(): CameraAction {
    return (state) => state.moving ? state : {moving: true};
}

/**
 * @internal
 * The movement ends: the requested camera becomes the camera as it was rendered, with its corrections and with what
 * `transformCameraUpdate` approved, so the next movement starts from what the map shows. A hold that is still on keeps
 * the elevation it holds.
 */
export function endMovement(rendered: CameraState): CameraAction {
    return (state) => ({
        moving: false,
        requested: state.centerElevation.rule === 'held' ? {...rendered, elevation: state.requested.elevation} : rendered,
    });
}
