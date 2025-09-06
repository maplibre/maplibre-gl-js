import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer';

import type {
    BucketFeature,
    PopulateParameters
} from '../bucket';
import {type PossiblyEvaluated} from '../../style/properties';

type PatternStyleLayers = Array<LineStyleLayer> | Array<FillStyleLayer> | Array<FillExtrusionStyleLayer>;

export function hasPattern(type: string, layers: PatternStyleLayers, options: PopulateParameters) {
    const patterns = options.patternDependencies;
    let hasPattern = false;

    for (const layer of layers) {
        const patternProperty = (layer.paint as PossiblyEvaluated<any, any>).get(`${type}-pattern`);
        if (!patternProperty.isConstant()) {
            hasPattern = true;
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern) {
            hasPattern = true;
            patterns[constantPattern.to] =  true;
            patterns[constantPattern.from] =  true;
        }

        // Also check for data-driven dasharray
        if (type === 'line') {
            const dasharrayProperty = (layer.paint as PossiblyEvaluated<any, any>).get('line-dasharray');
            if (dasharrayProperty && !dasharrayProperty.isConstant()) {
                hasPattern = true;
            }
        }
    }

    return hasPattern;
}

export function addPatternDependencies(type: string, layers: PatternStyleLayers, patternFeature: BucketFeature, parameters: { zoom: number; globalState: Record<string, any> }, options: PopulateParameters) {
    const {zoom, globalState} = parameters;
    const patterns = options.patternDependencies;
    const dashes = options.dashDependencies;

    for (const layer of layers) {
        const patternProperty = (layer.paint  as PossiblyEvaluated<any, any>).get(`${type}-pattern`);

        const patternPropertyValue = patternProperty.value;
        if (patternPropertyValue.kind !== 'constant') {
            let min = patternPropertyValue.evaluate({zoom: zoom - 1, globalState}, patternFeature, {}, options.availableImages);
            let mid = patternPropertyValue.evaluate({zoom, globalState}, patternFeature, {}, options.availableImages);
            let max = patternPropertyValue.evaluate({zoom: zoom + 1, globalState}, patternFeature, {}, options.availableImages);
            min = min && min.name ? min.name : min;
            mid = mid && mid.name ? mid.name : mid;
            max = max && max.name ? max.name : max;
            // add to patternDependencies
            patterns[min] = true;
            patterns[mid] = true;
            patterns[max] = true;

            // save for layout
            patternFeature.patterns[layer.id] = {min, mid, max};
        }

        // Handle data-driven dasharray
        if (type === 'line') {
            const dasharrayProperty = (layer.paint as PossiblyEvaluated<any, any>).get('line-dasharray');
            if (dasharrayProperty && dasharrayProperty.value.kind !== 'constant') {
                const round = false;

                const min = {dasharray: dasharrayProperty.value.evaluate({zoom: zoom - 1}, patternFeature, {}), round};
                const mid = {dasharray: dasharrayProperty.value.evaluate({zoom}, patternFeature, {}), round};
                const max = {dasharray: dasharrayProperty.value.evaluate({zoom: zoom + 1}, patternFeature, {}), round};

                const minKey = JSON.stringify(min);
                const midKey = JSON.stringify(mid);
                const maxKey = JSON.stringify(max);

                dashes[minKey] = min;
                dashes[midKey] = mid;
                dashes[maxKey] = max;

                patternFeature.dashes[layer.id] = {min: minKey, mid: midKey, max: maxKey};
            }
        }
    }
    return patternFeature;
}

