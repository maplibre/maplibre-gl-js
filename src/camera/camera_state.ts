import {createStore, type StoreApi} from 'zustand/vanilla';
import {constrainState, resize} from './camera_updates.ts';

import type {CameraViewState} from './camera_view_state.ts';
import type {LngLat} from '../geo/lng_lat.ts';
import type {CameraContext, CameraProjectionKind} from './camera_context.ts';
import type {CenterElevationRule} from './center_elevation.ts';

/**
 * @internal
 * The state of a {@link Camera}, as immutable plain data, held in its {@link CameraStore}. Only the actions below
 * change it, each through {@link applyAction}, which leaves the state before it as it was.
 *
 * It holds what the camera the map is drawn with is derived from, not that camera itself, see `Camera.renderedState`.
 * What the camera works with but does not own, such as its projection, the constrain it was given and the terrain, is
 * handed to the actions that need it.
 */
export type CameraState = {
    /**
     * The camera's view as API calls and movements set it, before the corrections it is drawn with. At rest it is the
     * view; during a movement it is what the movement asks for, which each of its frames goes on from, see
     * {@link motion}.
     */
    readonly view: CameraViewState;
    /** Whether a movement is under way, and what `transformCameraUpdate` made of it. */
    readonly motion: CameraMotionState;
    /** How the camera's center elevation follows the terrain. */
    readonly centerElevation: CenterElevationRule;
    /**
     * Counts the changes of the terrain the camera is drawn over: DEM data landing, terrain set or removed. The terrain
     * is not data the state can hold, and the rendered camera depends on it, so it is derived again on every change of
     * this count.
     */
    readonly terrainRevision: number;
    /** The projection the camera is projected with, see {@link CameraProjectionKind}. */
    readonly projection: CameraProjectionKind;
    /**
     * How far a globe is between mercator, at 0, and the vertical perspective, at 1, which the frame is drawn with.
     * Other projections do not read it.
     */
    readonly projectionTransition: number;
};

/**
 * @internal
 * The movement of a camera. A movement runs from its first change to its `moveend`: a gesture, an animation or an API
 * call. During it the camera is a proposal, drawn with the corrections that keep it out of the terrain and with its
 * adjustment, and its end makes the camera it drew the camera, see {@link endMovement}.
 */
export type CameraMotionState = {
    /** Whether a movement is under way. */
    readonly moving: boolean;
    /**
     * What `transformCameraUpdate` made of the movement's camera, as the fields it returned, which the rendered camera
     * applies. Null at rest and without a callback.
     */
    readonly adjustment: CameraAdjustment | null;
};

/** The motion state of a camera at rest. */
const AT_REST: CameraMotionState = {moving: false, adjustment: null};

/** @internal The camera fields `transformCameraUpdate` sets, see {@link CameraMotionState.adjustment}. */
export type CameraAdjustment = Readonly<{
    center?: LngLat;
    zoom?: number;
    roll?: number;
    pitch?: number;
    bearing?: number;
    elevation?: number;
}>;

/**
 * @internal
 * The store that holds a camera's {@link CameraState}. Its `setState` applies an action as {@link applyAction} does,
 * and listeners subscribed to it hear of every change with the state before it; an action that changes nothing
 * notifies no listener.
 */
export type CameraStore = StoreApi<CameraState>;

/**
 * @internal
 * A change to the camera's state, applied with {@link applyAction}: a pure function of the state that returns the
 * fields it changes, or the state itself when it changes nothing.
 */
export type CameraAction = (state: CameraState) => Partial<CameraState> | CameraState;

/** @internal Creates the state of a camera at rest on the given view, with a globe fully a globe. */
export function createCameraState(view: CameraViewState): CameraState {
    return {
        view,
        motion: AT_REST,
        centerElevation: {rule: 'ground'},
        terrainRevision: 0,
        projection: 'mercator',
        projectionTransition: 1,
    };
}

/** @internal Creates the store of a camera at rest on the given view, see {@link createCameraState}. */
export function createCameraStore(view: CameraViewState): CameraStore {
    return createStore<CameraState>()(() => createCameraState(view));
}

/**
 * @internal
 * The state an action leaves: the state itself where the action changes nothing, otherwise a new state with the fields
 * the action returned.
 */
export function applyAction(state: CameraState, action: CameraAction): CameraState {
    const changes = action(state);
    return changes === state ? state : {...state, ...changes};
}

/** @internal Applies actions one after another, as one change of the state. */
export function combineActions(...actions: CameraAction[]): CameraAction {
    return (state) => actions.reduce<CameraState>(applyAction, state);
}

/** @internal An API call or the frame of a movement sets the camera's view. */
export function setView(view: CameraViewState): CameraAction {
    return (state) => view === state.view ? state : {view};
}

/** @internal The view's center moves to an elevation, keeping everything else. */
export function setViewElevation(elevation: number): CameraAction {
    return (state) => elevation === state.view.elevation ? state : {view: {...state.view, elevation}};
}

/** @internal The view is resized to the map's size, constrained in the given context where `constrain` is set. */
export function resizeView(context: CameraContext, width: number, height: number, constrain: boolean): CameraAction {
    return (state) => ({view: resize(state.view, context, width, height, constrain)});
}

/** @internal The view is constrained in the given context, as on a new projection or with a new constrain. */
export function constrainView(context: CameraContext): CameraAction {
    return (state) => setView(constrainState(state.view, context))(state);
}

/** @internal A movement starts, or goes on. */
export function startMovement(): CameraAction {
    return (state) => state.motion.moving ? state : {motion: {moving: true, adjustment: null}};
}

/**
 * @internal
 * `transformCameraUpdate` made something of the movement's camera, see {@link CameraMotionState.adjustment}. Only a
 * movement is adjusted.
 */
export function adjustCamera(adjustment: CameraAdjustment | null): CameraAction {
    return (state) => !state.motion.moving || adjustment === state.motion.adjustment ? state : {motion: {moving: true, adjustment}};
}

/**
 * @internal
 * The movement ends: the view it drew, with the corrections it got and its adjustment, becomes the view, so the
 * next movement starts from what the map shows. A hold that is still on keeps the elevation it holds.
 * @param rendered - the camera the movement drew, see `Camera.renderedState`
 */
export function endMovement(rendered: CameraViewState): CameraAction {
    return (state) => ({
        motion: AT_REST,
        view: state.centerElevation.rule === 'held' ? {...rendered, elevation: state.view.elevation} : rendered,
    });
}

/** @internal The camera's center elevation follows the terrain by another rule. */
export function setCenterElevationRule(centerElevation: CenterElevationRule): CameraAction {
    return (state) => centerElevation === state.centerElevation ? state : {centerElevation};
}

/** @internal The terrain the camera is drawn over changed, see {@link CameraState.terrainRevision}. */
export function terrainChanged(): CameraAction {
    return (state) => ({terrainRevision: state.terrainRevision + 1});
}

/** @internal The camera moves onto another projection, a globe fully a globe until the next frame says otherwise. */
export function setProjection(projection: CameraProjectionKind): CameraAction {
    return (state) => projection === state.projection ? state : {projection, projectionTransition: 1};
}

/** @internal A globe moves to another point of its transition between mercator and the vertical perspective. */
export function setProjectionTransition(projectionTransition: number): CameraAction {
    return (state) => projectionTransition === state.projectionTransition ? state : {projectionTransition};
}
