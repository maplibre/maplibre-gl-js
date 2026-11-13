import {createStore} from 'zustand/vanilla';
import {createCameraState} from '../camera/camera_state.ts';
import {createCameraViewState} from '../camera/camera_view_state.ts';

import type {StoreApi} from 'zustand/vanilla';
import type {CameraState} from '../camera/camera_state.ts';

/**
 * @internal
 * The state of a {@link Map}, as immutable plain data, held in its {@link MapStore}. Each part of the map keeps its
 * state in a field of its own, which only that part changes.
 */
export type MapState = {
    /** The state of the map's camera, see `Camera`. */
    readonly camera: CameraState;
};

/**
 * @internal
 * The store that holds a {@link MapState}. Its listeners hear of every change of the whole state; a part of the map
 * that only follows its own field subscribes with {@link subscribeToSlice}.
 */
export type MapStore = StoreApi<MapState>;

/** @internal Creates the store of a new map, its camera at rest with no size yet. */
export function createMapStore(): MapStore {
    return createStore<MapState>()(() => ({camera: createCameraState(createCameraViewState())}));
}

/**
 * @internal
 * Subscribes a listener to a slice of the map's state, such as `state => state.camera`: it hears only of the changes
 * that replace that slice, with the slice before each one.
 * @returns the function that unsubscribes the listener
 */
export function subscribeToSlice<T>(store: MapStore, select: (state: MapState) => T, listener: (slice: T, previous: T) => void): () => void {
    return store.subscribe((state, previousState) => {
        const slice = select(state);
        const previous = select(previousState);
        if (slice !== previous) listener(slice, previous);
    });
}
