import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer';

import type {
    BucketFeature,
    PopulateParameters
} from '../bucket';
import {type PossiblyEvaluated} from '../../style/properties';
import type {LineAtlas} from '../../render/line_atlas';
import {ImagePosition} from '../../render/image_atlas';

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
                const dasharrayPropertyValue = dasharrayProperty.value;
                const min = dasharrayPropertyValue.evaluate({zoom: zoom - 1}, patternFeature, {});
                const mid = dasharrayPropertyValue.evaluate({zoom}, patternFeature, {});
                const max = dasharrayPropertyValue.evaluate({zoom: zoom + 1}, patternFeature, {});

                // Store dasharray values directly under layer.id since lines cannot have both pattern and dasharray
                patternFeature.patterns[layer.id] = {min, mid, max};
            }
        }
    }
    return patternFeature;
}

export function addDasharrayDependencies(buckets: {[_: string]: any}, lineAtlas: LineAtlas): {[_: string]: ImagePosition} {
    const dasharrayPositions: {[_: string]: ImagePosition} = {};

    for (const key in buckets) {
        const bucket = buckets[key];
        if (bucket.hasPattern && bucket.patternFeatures) {
            for (const patternFeature of bucket.patternFeatures) {
                for (const layer of bucket.layers) {
                    const dasharrayPattern = patternFeature.patterns[layer.id];

                    // Check if this is a dasharray pattern (arrays vs string pattern names)
                    if (dasharrayPattern && Array.isArray(dasharrayPattern.min)) {
                        const round = layer.layout.get('line-cap') === 'round';
                        const {min, mid, max} = dasharrayPattern;

                        // Generate dash positions for min, mid, max zoom levels
                        const dashMin = lineAtlas.getDash(min, round);
                        const dashMid = lineAtlas.getDash(mid, round);
                        const dashMax = lineAtlas.getDash(max, round);

                        // Create unique keys for each dash pattern
                        const minKey = `dash_${JSON.stringify(min)}_${round}_min`;
                        const midKey = `dash_${JSON.stringify(mid)}_${round}_mid`;
                        const maxKey = `dash_${JSON.stringify(max)}_${round}_max`;

                        // Create ImagePosition objects for the dash patterns
                        // Convert raw LineAtlas pixel coordinates to normalized texture coordinates
                        const height = Math.max(dashMin.height, 1);
                        const atlasWidth = lineAtlas.width;
                        const atlasHeight = lineAtlas.height;
                        
                        dasharrayPositions[minKey] = new ImagePosition(
                            {
                                x: 0 / atlasWidth, 
                                y: dashMin.y / atlasHeight, 
                                h: height / atlasHeight, 
                                w: dashMin.width / atlasWidth
                            },
                            {data: null, pixelRatio: 1, sdf: true}
                        );
                        dasharrayPositions[midKey] = new ImagePosition(
                            {
                                x: 0 / atlasWidth, 
                                y: dashMid.y / atlasHeight, 
                                h: height / atlasHeight, 
                                w: dashMid.width / atlasWidth
                            },
                            {data: null, pixelRatio: 1, sdf: true}
                        );
                        dasharrayPositions[maxKey] = new ImagePosition(
                            {
                                x: 0 / atlasWidth, 
                                y: dashMax.y / atlasHeight, 
                                h: height / atlasHeight, 
                                w: dashMax.width / atlasWidth
                            },
                            {data: null, pixelRatio: 1, sdf: true}
                        );

                        // Update the pattern feature to reference these new keys
                        patternFeature.patterns[layer.id] = {min: minKey, mid: midKey, max: maxKey};
                    }
                }
            }
        }
    }

    return dasharrayPositions;
}
