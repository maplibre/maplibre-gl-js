import {SymbolBucket} from '../../../src/data/bucket/symbol_bucket';
import {SymbolStyleLayer} from '../../../src/style/style_layer/symbol_style_layer';
import {featureFilter, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type EvaluationParameters} from '../../../src/style/evaluation_parameters';
import {type BucketParameters} from '../../../src/data/bucket';

export function createSymbolBucket(layerId, font, text, collisionBoxArray) {
    const layer = new SymbolStyleLayer({
        id: layerId,
        type: 'symbol',
        layout: {'text-font': [font], 'text-field': text},
        filter: featureFilter(undefined)
    } as any as LayerSpecification);
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [layer]
    } as BucketParameters<SymbolStyleLayer>);
}

export function createSymbolIconBucket(layerId, iconProperty, collisionBoxArray) {
    const layer = new SymbolStyleLayer({
        id: layerId,
        type: 'symbol',
        layout: {'icon-image': ['get', iconProperty]},
        filter: featureFilter(undefined)
    } as any as LayerSpecification);
    layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

    return new SymbolBucket({
        overscaling: 1,
        zoom: 0,
        collisionBoxArray,
        layers: [layer]
    } as BucketParameters<SymbolStyleLayer>);
}
