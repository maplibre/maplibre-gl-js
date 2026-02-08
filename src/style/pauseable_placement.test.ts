import {describe, expect, test} from 'vitest';
import {PauseablePlacement} from './pauseable_placement';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import type {StyleLayer} from './style_layer';

describe('PauseablePlacement', () => {
    // When a style change adds or reorders symbol layers, the placement loop
    // can run before style recalculation has finished hydrating the new layer's
    // `layout` property.  The layer already has `type: 'symbol'` so it passes
    // the type check, but accessing `layout.get(...)` throws because `layout`
    // is still undefined.  The guard in continuePlacement should skip these
    // not-yet-ready layers instead of crashing.
    test('should skip symbol layers whose layout is not yet hydrated', () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);

        const pp = new PauseablePlacement(
            transform,
            undefined as any,
            ['symbol-layer'],
            true,
            false,
            300,
            true,
        );

        const layers: {[_: string]: StyleLayer} = {
            'symbol-layer': {
                type: 'symbol',
                source: 'test-source',
                layout: undefined,
            } as any as StyleLayer,
        };

        expect(() => {
            pp.continuePlacement(['symbol-layer'], layers, {'test-source': []});
        }).not.toThrow();

        expect(pp.isDone()).toBe(true);
    });
});
