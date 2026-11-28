import {describe, expect, test} from 'vitest';
import {getLastDrapedLayerIndex} from './draw_fog.ts';
import {createStyleLayer} from '../../style/create_style_layer.ts';

import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleLayer} from '../../style/style_layer.ts';

function buildLayers(specs: LayerSpecification[]): {layerIds: string[]; layers: Record<string, StyleLayer>} {
    const layers: Record<string, StyleLayer> = {};
    for (const spec of specs) {
        layers[spec.id] = createStyleLayer(spec, {});
    }
    return {layerIds: specs.map(spec => spec.id), layers};
}

describe('getLastDrapedLayerIndex', () => {
    test('returns the index of the last visible draped layer', () => {
        const {layerIds, layers} = buildLayers([
            {id: 'bg', type: 'background'},
            {id: 'labels', type: 'symbol', source: 's'},
            {id: 'fill', type: 'fill', source: 's'},
            {id: 'hidden-fill', type: 'fill', source: 's', minzoom: 20},
            {id: 'dots', type: 'circle', source: 's'}
        ]);

        expect(getLastDrapedLayerIndex(layerIds, layers, 10)).toBe(2);
    });

    test('returns -1 when no visible draped layer exists', () => {
        const {layerIds, layers} = buildLayers([
            {id: 'hidden-bg', type: 'background', minzoom: 20},
            {id: 'labels', type: 'symbol', source: 's'}
        ]);

        expect(getLastDrapedLayerIndex(layerIds, layers, 10)).toBe(-1);
    });
});
