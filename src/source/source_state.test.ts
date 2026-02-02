
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
});
