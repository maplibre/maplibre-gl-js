import {createStore, type StoreApi} from 'zustand/vanilla';
import {constrainState, resize} from '../geo/projection/camera_updates.ts';

import type {CameraState} from '../geo/camera_state.ts';
import type {LngLat} from '../geo/lng_lat.ts';
import type {CameraContext} from '../geo/projection/camera_constrain.ts';
import type {CenterElevationRule} from './center_elevation.ts';

/**
 * @internal
 * The state of a {@link Camera}, as immutable plain data. Only the actions below change it, each through
 * {@link CameraStore.setState}, and listeners subscribed to the store hear of every change with the state before it.
 *
 * It holds what the camera that the map is drawn with is derived from, not that camera itself: the proposed camera,
 * the elevation rule, whether a movement runs and what `transformCameraUpdate` made of it, and how far the terrain
 * and a globe have changed, see `Camera.renderedState`. What the camera works with but does not own, such as its
 * projection, the constrain it was given and the terrain, is handed to the actions that need it.
 */
export type CameraStoreState = {
    /**
     * The proposed camera: the camera that API calls and the frames of movements ask for, before the corrections it is
     * drawn with. During an animation it is the camera of the current frame, not the one the animation ends on.
     */
    readonly proposed: CameraState;
    /**
     * What `transformCameraUpdate` made of the proposal, as the fields it returned, which the rendered camera applies.
     * Null where the movement has no callback, and at rest.
     */
    readonly adjustment: CameraAdjustment | null;
    /**
     * Counts the changes of the terrain the camera is drawn over: DEM data landing, terrain set or removed. The terrain
     * is not data the store can hold, and the rendered camera depends on it, so it is derived again on every change of
     * this count.
     */
    readonly terrainRevision: number;
    /**
     * How far a globe is between mercator, at 0, and the vertical perspective, at 1, which the frame is drawn with.
     * Other projections do not read it.
     */
    readonly projectionTransition: number;
    /** How the proposed center elevation follows the terrain. */
    readonly centerElevation: CenterElevationRule;
    /**
     * Whether a movement runs, from its first change to its `moveend`. While it runs, the proposed camera is drawn with
     * the corrections a movement gets and with its adjustment, and its end makes the camera it drew the proposal.
     */
    readonly moving: boolean;
};

/** @internal The camera fields `transformCameraUpdate` sets, see {@link CameraStoreState.adjustment}. */
export type CameraAdjustment = Readonly<{
    center?: LngLat;
    zoom?: number;
    roll?: number;
    pitch?: number;
    bearing?: number;
    elevation?: number;
}>;

/** @internal The store that holds a camera's {@link CameraStoreState}. */
export type CameraStore = StoreApi<CameraStoreState>;

/**
 * @internal
 * A change to the camera's state, dispatched with `store.setState(action)`: a pure function of the state that returns
 * the fields it changes, or the state itself when it changes nothing, which notifies no listener.
 */
export type CameraAction = (state: CameraStoreState) => Partial<CameraStoreState> | CameraStoreState;

/** @internal Creates the store of a camera at rest on the given camera, with a globe fully a globe. */
export function createCameraStore(camera: CameraState): CameraStore {
    return createStore<CameraStoreState>()(() => ({
        proposed: camera,
        adjustment: null,
        terrainRevision: 0,
        projectionTransition: 1,
        centerElevation: {rule: 'ground'},
        moving: false,
    }));
}

/** @internal Applies actions one after another, as one change of the state. */
export function combineActions(...actions: CameraAction[]): CameraAction {
    return (state) => actions.reduce<CameraStoreState>((current, action) => {
        const changes = action(current);
        return changes === current ? current : {...current, ...changes};
    }, state);
}

/** @internal An API call or the frame of a movement proposes a camera. */
export function proposeCamera(camera: CameraState): CameraAction {
    return (state) => camera === state.proposed ? state : {proposed: camera};
}

/** @internal `transformCameraUpdate` made something of the proposal, see {@link CameraStoreState.adjustment}. */
export function adjustCamera(adjustment: CameraAdjustment | null): CameraAction {
    return (state) => adjustment === state.adjustment ? state : {adjustment};
}

/** @internal The terrain the camera is drawn over changed, see {@link CameraStoreState.terrainRevision}. */
export function terrainChanged(): CameraAction {
    return (state) => ({terrainRevision: state.terrainRevision + 1});
}

/** @internal The camera is resized to the map's size, constrained in the given context where `constrain` is set. */
export function resizeCamera(context: CameraContext, width: number, height: number, constrain: boolean): CameraAction {
    return (state) => ({proposed: resize(state.proposed, context, width, height, constrain)});
}

/** @internal The camera is constrained in the given context, as on a new projection or with a new constrain. */
export function constrainCamera(context: CameraContext): CameraAction {
    return (state) => proposeCamera(constrainState(state.proposed, context))(state);
}

/** @internal A globe moves to another point of its transition between mercator and the vertical perspective. */
export function setProjectionTransition(projectionTransition: number): CameraAction {
    return (state) => projectionTransition === state.projectionTransition ? state : {projectionTransition};
}

/** @internal The proposed camera's center moves to an elevation, keeping everything else. */
export function setProposedElevation(elevation: number): CameraAction {
    return (state) => elevation === state.proposed.elevation ? state : {proposed: {...state.proposed, elevation}};
}

/** @internal The proposed center elevation follows the terrain by another rule. */
export function setCenterElevationRule(centerElevation: CenterElevationRule): CameraAction {
    return (state) => centerElevation === state.centerElevation ? state : {centerElevation};
}

/** @internal A movement starts, or goes on. */
export function startMovement(): CameraAction {
    return (state) => state.moving ? state : {moving: true};
}

/**
 * @internal
 * The movement ends: the camera it drew, with the corrections it got and its adjustment, becomes the proposal, so the
 * next movement starts from what the map shows. A hold that is still on keeps the elevation it holds.
 * @param rendered - the camera the movement drew, see `Camera.renderedState`
 */
export function endMovement(rendered: CameraState): CameraAction {
    return (state) => ({
        moving: false,
        adjustment: null,
        proposed: state.centerElevation.rule === 'held' ? {...rendered, elevation: state.proposed.elevation} : rendered,
    });
}
