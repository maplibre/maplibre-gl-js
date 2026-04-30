
import {describe, test, expect, vi} from 'vitest';
import {SourceFeatureState} from './source_state';
import {type InViewTiles} from '../tile/tile_manager_in_view_tiles';

describe('SourceFeatureState', () => {
    test('coalesceChanges updates revision when changes occur', () => {
        const sourceState = new SourceFeatureState();
        expect(sourceState.revision).toBe(0);

        const inViewTilesMock = {
            setFeatureState: vi.fn()
        } as unknown as InViewTiles;
        const painterMock = {};

        sourceState.coalesceChanges(inViewTilesMock, painterMock);
        expect(sourceState.revision).toBe(0);

        sourceState.updateState('layer1', 'feature1', {prop: true});
        sourceState.coalesceChanges(inViewTilesMock, painterMock);
        expect(sourceState.revision).toBe(1);
    });

    test('updateState after layer deletion rebuilds deletedStates correctly', () => {
        const sourceState = new SourceFeatureState();
        const inViewTilesMock = {
            setFeatureState: vi.fn()
        } as unknown as InViewTiles;

        // Set up existing state for two features in the same layer
        sourceState.updateState('layer1', 'feature1', {a: 1, b: 2});
        sourceState.updateState('layer1', 'feature2', {c: 3});
        sourceState.coalesceChanges(inViewTilesMock, {});

        // Delete the entire source layer (sets deletedStates['layer1'] = null)
        sourceState.removeFeatureState('layer1');

        // Now update feature1 with a partial state — this triggers the branch
        // where deletedStates[sourceLayer] === null and we iterate existing features
        sourceState.updateState('layer1', 'feature1', {a: 10});

        // feature1 should have prop 'b' queued for deletion (not in newState),
        // but not prop 'a' (present in newState)
        expect(sourceState.deletedStates['layer1']['feature1']).toEqual({b: null});

        // feature2 should be fully queued for deletion (null)
        expect(sourceState.deletedStates['layer1']['feature2']).toBeNull();
    });

    test('updateState after single feature deletion rebuilds deletedStates for that feature', () => {
        const sourceState = new SourceFeatureState();
        const inViewTilesMock = {
            setFeatureState: vi.fn()
        } as unknown as InViewTiles;

        // Set up existing state with multiple props
        sourceState.updateState('layer1', 'feature1', {a: 1, b: 2, c: 3});
        sourceState.coalesceChanges(inViewTilesMock, {});

        // Delete only feature1 (sets deletedStates['layer1']['feature1'] = null)
        sourceState.removeFeatureState('layer1', 'feature1');
        expect(sourceState.deletedStates['layer1']['feature1']).toBeNull();

        // Now update feature1 with partial state — triggers the featureDeletionQueued branch
        sourceState.updateState('layer1', 'feature1', {a: 10});

        // Props not in newState (b, c) should be queued for deletion
        // Prop in newState (a) should NOT be queued for deletion
        expect(sourceState.deletedStates['layer1']['feature1']).toEqual({b: null, c: null});
    });
});
