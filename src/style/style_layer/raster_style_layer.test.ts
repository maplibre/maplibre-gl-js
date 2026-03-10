import {describe, test, expect, vi} from 'vitest';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {createStyleLayer} from '../create_style_layer';
import {extend} from '../../util/util';

function createLayerSpec(properties?): LayerSpecification {
    return extend({
        type: 'raster',
        id: 'raster',
        source: 'rasterSource'
    }, properties);
}

describe('RasterStyleLayer correctly handles "resampling" and "raster-resampling" paint properties', () => {

    test('"raster-resampling" is undefined when instantiated with "resampling"', () => {
        const layerSpec = createLayerSpec();
        const layer = createStyleLayer(layerSpec, {});
    
        const rasterResampling = layer.getPaintProperty('raster-resampling');
        expect(rasterResampling).toEqual(undefined);
    });

    test('"resampling" is undefined when instantiated with "raster-resampling"', () => {
        const layerSpec = createLayerSpec();
        const layer = createStyleLayer(layerSpec, {});
    
        const resampling = layer.getPaintProperty('resampling');
        expect(resampling).toEqual(undefined);
    });

});
