import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer';

import type {
    BucketFeature,
    PopulateParameters
} from '../bucket';
import {type PossiblyEvaluated} from '../../style/properties';
import type {LineAtlas} from '../../render/line_atlas';
import type {ImagePositionLike} from '../../render/image_atlas';
import {GetDashesResponse} from '../../util/actor_messages';

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

export function addPatternDependencies(type: string, layers: PatternStyleLayers, patternFeature: BucketFeature, zoom: number, options: PopulateParameters) {
    const patterns = options.patternDependencies;
    const dasharrays = options.dasharrayDependencies;

    for (const layer of layers) {
        const patternProperty = (layer.paint  as PossiblyEvaluated<any, any>).get(`${type}-pattern`);

        const patternPropertyValue = patternProperty.value;
        if (patternPropertyValue.kind !== 'constant') {
            let min = patternPropertyValue.evaluate({zoom: zoom - 1}, patternFeature, {}, options.availableImages);
            let mid = patternPropertyValue.evaluate({zoom}, patternFeature, {}, options.availableImages);
            let max = patternPropertyValue.evaluate({zoom: zoom + 1}, patternFeature, {}, options.availableImages);
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
                const round = false; // TODO handle round caps if needed

                const dasharrayPropertyValue = dasharrayProperty.value;
                const min = {dasharray: dasharrayPropertyValue.evaluate({zoom: zoom - 1}, patternFeature, {}), round};
                const mid = {dasharray: dasharrayPropertyValue.evaluate({zoom}, patternFeature, {}), round};
                const max = {dasharray: dasharrayPropertyValue.evaluate({zoom: zoom + 1}, patternFeature, {}), round};

                dasharrays.push(min);
                dasharrays.push(mid);
                dasharrays.push(max);

                patternFeature.patterns[layer.id] = {min, mid, max};
            }
        }
    }
    return patternFeature;
}

export function addDasharrayDependencies(buckets: {[_: string]: any}, dashes: GetDashesResponse): {[_: string]: ImagePositionLike} {
    const dasharrayPositions: {[_: string]: ImagePositionLike} = {};

    for (const key in buckets) {
        const bucket = buckets[key];
        if (bucket.hasPattern && bucket.patternFeatures) {
            for (const patternFeature of bucket.patternFeatures) {
                for (const layer of bucket.layers) {
                    const dasharrayPattern = patternFeature.patterns[layer.id];

                    // Check if this is a dasharray pattern (arrays vs string pattern names)
                    if (dasharrayPattern) {
                        const round = layer.layout.get('line-cap') === 'round';
                        const {min, mid, max} = dasharrayPattern;

                        // Generate dash positions for min, mid, max zoom levels
                        const dashMin = dashes.find(d => JSON.stringify(d.dasharray) === JSON.stringify(min.dasharray) && d.round === min.round);
                        const dashMid = dashes.find(d => JSON.stringify(d.dasharray) === JSON.stringify(mid.dasharray) && d.round === mid.round);
                        const dashMax = dashes.find(d => JSON.stringify(d.dasharray) === JSON.stringify(max.dasharray) && d.round === max.round);

                        // Create unique keys for each dash pattern
                        const minKey = `dash_${JSON.stringify(min)}_${round}_min`;
                        const midKey = `dash_${JSON.stringify(mid)}_${round}_mid`;
                        const maxKey = `dash_${JSON.stringify(max)}_${round}_max`;

                        dasharrayPositions[minKey] = {tlbr: [0, dashMin.y, dashMin.height, dashMin.width], pixelRatio: 1};
                        dasharrayPositions[midKey] = {tlbr: [0, dashMid.y, dashMid.height, dashMid.width], pixelRatio: 1};
                        dasharrayPositions[maxKey] = {tlbr: [0, dashMax.y, dashMax.height, dashMax.width], pixelRatio: 1};

                        // Update the pattern feature to reference these new keys
                        patternFeature.patterns[layer.id] = {min: minKey, mid: midKey, max: maxKey};
                    }
                }
            }
        }
    }

    return dasharrayPositions;
}
