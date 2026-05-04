
import {describe, test, expect, vi} from 'vitest';
import {SourceFeatureState} from './source_state.ts';
import {type InViewTiles} from '../tile/tile_manager_in_view_tiles.ts';
import type {Painter} from '../render/painter.ts';

describe('SourceFeatureState', () => {
    test('coalesceChanges updates revision when changes occur', () => {
        const sourceState = new SourceFeatureState();
        expect(sourceState.revision).toBe(0);

        const inViewTilesMock = {
            setFeatureState: vi.fn()
        } as unknown as InViewTiles;
        const painterMock = {} as unknown as Painter;

        sourceState.coalesceChanges(inViewTilesMock, painterMock);
        expect(sourceState.revision).toBe(0);

        sourceState.updateState('layer1', 'feature1', {prop: true});
        sourceState.coalesceChanges(inViewTilesMock, painterMock);
        expect(sourceState.revision).toBe(1);
    });

    test('Feature state update after bulk remove does not keep initial values', () => {
        const sourceState = new SourceFeatureState();
        const inViewTilesMock = {
            setFeatureState: vi.fn()
        } as unknown as InViewTiles;

        sourceState.updateState('layer1', 'feature1', {a: 1, b: 2});
        sourceState.updateState('layer1', 'feature2', {c: 3});
        sourceState.coalesceChanges(inViewTilesMock, {});

        sourceState.removeFeatureState('layer1');

        // Now update feature1 with a partial state — this triggers the branch
        // where deletedStates[sourceLayer] === null and we iterate existing features
        sourceState.updateState('layer1', 'feature1', {a: 10});

        expect(sourceState.deletedStates['layer1']['feature1']).toEqual({b: null});
        expect(sourceState.deletedStates['layer1']['feature2']).toBeNull();
    });

    test('updateState after single feature deletion rebuilds deletedStates for that feature', () => {
        const sourceState = new SourceFeatureState();
        const inViewTilesMock = {
            setFeatureState: vi.fn()
        } as unknown as InViewTiles;

        sourceState.updateState('layer1', 'feature1', {a: 1, b: 2, c: 3});
        sourceState.coalesceChanges(inViewTilesMock, {});

        sourceState.removeFeatureState('layer1', 'feature1');
        expect(sourceState.deletedStates['layer1']['feature1']).toBeNull();

        // Now update feature1 with partial state — triggers the featureDeletionQueued branch
        sourceState.updateState('layer1', 'feature1', {a: 10});

        expect(sourceState.deletedStates['layer1']['feature1']).toEqual({b: null, c: null});
    });
});
