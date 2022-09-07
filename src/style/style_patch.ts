import {DiffOperation} from '../style-spec/diff';
import {FilterSpecification, LayerSpecification, StyleSpecification} from '../style-spec/types.g';
import {warnOnce} from '../util/util';
import {StylePatchFunction, StyleSetterOptions} from './style';

export default function buildPatchOperations(prev: StyleSpecification, next: StyleSpecification, stylePatch: StylePatchFunction, isDiff: boolean): { patchOperations: DiffOperation[]; preservedSources: string[] } {
    const patchOperations: DiffOperation[] = [];
    const preservedSources: string[] = [];
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

            // remove the layer from incoming style if we have id collision with preserved layer
            if (layerId in nextLayerIndex) {
                patchOperations.push({command: 'removeLayer', args: [layerId]});
            }

            // preservedLayer are added on top of layers in next style if the before is unset
            // NOTE: diffing will result in original preserved layer being removed
            before = before && (before in nextLayerIndex) ? before : undefined;
            patchOperations.push({command: 'addLayer', args: [preservedLayer, before, {validate: true}]});

            nextLayerIndex[layerId] = preservedLayer;
        } else {
            warnOnce(`Cannot preserve layer ${layerId} that is not in the previous style.`);
        }
    };

    const updatePaintProperty = (layerId: string, name: string, value: any) => {
        if (layerId in nextLayerIndex) {
            patchOperations.push({command: 'setPaintProperty', args: [layerId, name, value, {validate: true}]});
        } else {
            warnOnce(`Cannot update paint property on layer ${layerId} that is not in the next style.`);
        }
    };

    const updateLayoutProperty = (layerId: string, name: string, value: any) => {
        if (layerId in nextLayerIndex) {
            patchOperations.push({command: 'setLayoutProperty', args: [layerId, name, value, {validate: true}]});
        } else {
            warnOnce(`Cannot update layout property on layer ${layerId} that is not in the next style.`);
        }
    };

    const updateFilter = (layerId: string, filter: FilterSpecification | null, options?: StyleSetterOptions) => {
        if (layerId in nextLayerIndex) {
            patchOperations.push({command: 'setFilter', args: [layerId, filter, options]});
        } else {
            warnOnce(`Cannot update filter on layer ${layerId} that is not in the next style.`);
        }
    };

    stylePatch(prev,
        next,
        preserveLayer,
        updatePaintProperty,
        updateLayoutProperty,
        updateFilter);
    return {patchOperations, preservedSources};
}
