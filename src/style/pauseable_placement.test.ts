import {describe, expect, test} from 'vitest';
import {PauseablePlacement} from './pauseable_placement';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import type {StyleLayer} from './style_layer';

describe('PauseablePlacement', () => {
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
