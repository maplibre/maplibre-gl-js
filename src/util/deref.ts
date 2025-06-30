
import {refProperties} from './ref_properties';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

export type LayerWithRef = LayerSpecification & { ref?: string };

function deref(layer: LayerWithRef, parent: LayerSpecification): LayerSpecification {
    const result: Partial<LayerSpecification> = {};

    for (const k in layer) {
        if (k !== 'ref') {
            result[k] = layer[k];
        }
    }

    refProperties.forEach((k) => {
        if (k in parent) {
            result[k] = parent[k];
        }
    });

    return result as LayerSpecification;
}

/**
 *
 * The input is not modified. The output may contain references to portions
 * of the input.
 *
 * @param layers - array of layers, some of which may contain `ref` properties
 * whose value is the `id` of another property
 * @returns a new array where such layers have been augmented with the 'type', 'source', etc. properties
 * from the parent layer, and the `ref` property has been removed.
 */
export function derefLayers(layers: LayerWithRef[]): LayerSpecification[] {
    layers = layers.slice();

    const map = Object.create(null);
    for (let i = 0; i < layers.length; i++) {
        map[layers[i].id] = layers[i];
    }

    for (let i = 0; i < layers.length; i++) {
        if ('ref' in layers[i]) {
            layers[i] = deref(layers[i], map[layers[i].ref]);
        }
    }

    return layers;
}
