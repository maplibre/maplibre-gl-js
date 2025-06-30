
import {refProperties} from './ref_properties';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

function stringify(obj: any): string {
    const type = typeof obj;
    if (type === 'number' || type === 'boolean' || type === 'string' || obj === undefined || obj === null)
        return JSON.stringify(obj);

    if (Array.isArray(obj)) {
        let str = '[';
        for (const val of obj) {
            str += `${stringify(val)},`;
        }
        return `${str}]`;
    }

    const keys = Object.keys(obj).sort();

    let str = '{';
    for (let i = 0; i < keys.length; i++) {
        str += `${JSON.stringify(keys[i])}:${stringify(obj[keys[i]])},`;
    }
    return `${str}}`;
}

function getKey(layer: LayerSpecification): string {
    let key = '';
    for (const k of refProperties) {
        key += `/${stringify(layer[k])}`;
    }
    return key;
}

/**
 * Given an array of layers, return an array of arrays of layers where all
 * layers in each group have identical layout-affecting properties. These
 * are the properties that were formerly used by explicit `ref` mechanism
 * for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
 * 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @param layers - an array of StyleLayer objects.
 * @param cachedKeys - an object to keep already calculated keys.
 * @returns an array of arrays of StyleLayer objects, where each inner array 
 * contains layers that share the same layout-affecting properties.
 */
export function groupByLayout(layers: LayerSpecification[], cachedKeys?: Record<string, string>): LayerSpecification[][] {
    const groups: Record<string, LayerSpecification[]> = {};

    for (let i = 0; i < layers.length; i++) {

        const k: string = (cachedKeys && cachedKeys[layers[i].id]) || getKey(layers[i]);
        // update the cache if there is one
        if (cachedKeys)
            cachedKeys[layers[i].id] = k;

        let group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }

    const result: LayerSpecification[][] = [];

    for (const k in groups) {
        result.push(groups[k]);
    }

    return result;
}
