import {describe, expect, test, vi} from 'vitest';
import {createMapStore, subscribeToSlice} from './map_state.ts';
import {applyAction, setViewElevation} from '../camera/camera_state.ts';

describe('map store', () => {
    test('notifies a slice listener of a change of its slice, with the slice before it', () => {
        const store = createMapStore();
        const listener = vi.fn();
        subscribeToSlice(store, (state) => state.camera, listener);
        const previous = store.getState().camera;

        store.setState({camera: applyAction(previous, setViewElevation(100))});

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(store.getState().camera, previous);
        expect(store.getState().camera.view.elevation).toBe(100);
    });

    test('notifies no slice listener of a change that keeps its slice', () => {
        const store = createMapStore();
        const listener = vi.fn();
        subscribeToSlice(store, (state) => state.camera, listener);

        store.setState({camera: store.getState().camera});

        expect(listener).not.toHaveBeenCalled();
    });
});
