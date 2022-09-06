import {DiffOperation} from '../style-spec/diff';
import {LayerSpecification, StyleSpecification} from '../style-spec/types.g';
import {warnOnce} from '../util/util';
import {StylePatchFunction} from './style';

export default function buildPatchOperations(prev: StyleSpecification, next: StyleSpecification, stylePatch: StylePatchFunction, isDiff: boolean): { patchOperations: DiffOperation[]; preservedSources: string[]; preservedLayers: string[] } {
    const patchOperations: DiffOperation[] = [];
    const preservedSources: string[] = [];
    const preservedLayers: string[] = [];
    const nextLayerIndex = next.layers.reduce((p: { [layerId: string]: LayerSpecification }, c: LayerSpecification) => ({
        ...p,
        [c.id]: c
    }), {});

    const preserveLayer = (layerId: string, before?: string) => {
        const preservedLayer = prev.layers.find(layer => layer.id === layerId);
        if (preservedLayer) {
            if (preservedLayer.type !== 'background' && !(preservedLayer.source in next.sources) && !preservedSources.includes(preservedLayer.source)) {
                if (!isDiff) {
                    patchOperations.push({command: 'addSource', args: [preservedLayer.source, prev.sources[preservedLayer.source], {validate: false}]});
                }
                preservedSources.push(preservedLayer.source);
            }

            if (layerId in nextLayerIndex) {
                patchOperations.push({command: 'removeLayer', args: [layerId]});
            }

            before = (before in nextLayerIndex || preservedLayers.includes(before)) ? before : undefined;
            if (isDiff) {
                patchOperations.push({command: 'moveLayer', args: [preservedLayer.id, before, {validate: true}]});
            } else {
                patchOperations.push({command: 'addLayer', args: [preservedLayer, before, {validate: true}]});
            }
            preservedLayers.push(layerId);
        } else {
            warnOnce(`Cannot preserve layer ${layerId} that is not in the previous style.`);
        }
    };

    const updatePaintProperty = (layerId: string, name: string, value: any) => {
        if (layerId in nextLayerIndex || preservedLayers.includes(layerId)) {
            patchOperations.push({command: 'setPaintProperty', args: [layerId, name, value, {validate: true}]});
        } else {
            warnOnce(`Cannot update paint property on layer ${layerId} that is not in the next style.`);
        }
    };

    const updateLayoutProperty = (layerId: string, name: string, value: any) => {
        if (layerId in nextLayerIndex || preservedLayers.includes(layerId)) {
            patchOperations.push({command: 'setLayoutProperty', args: [layerId, name, value, {validate: true}]});
        } else {
            warnOnce(`Cannot update layout property on layer ${layerId} that is not in the next style.`);
        }
    };

    const updateFilter = (layerId: string, name: string, value: any) => {
        if (layerId in nextLayerIndex || preservedLayers.includes(layerId)) {
            patchOperations.push({command: 'setFilter', args: [layerId, name, value, {validate: true}]});
        } else {
            warnOnce(`Cannot update filter on layer ${layerId} that is not in the next style.`);
        }
    };

    stylePatch(prev,
        next,
        preserveLayer.bind(this),
        updatePaintProperty.bind(this),
        updateLayoutProperty.bind(this),
        updateFilter.bind(this));
    return {patchOperations, preservedSources, preservedLayers};
}
