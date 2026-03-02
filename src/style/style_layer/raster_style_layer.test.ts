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

    test('sets "raster-resampling" undefined when instantiated with "resampling"', () => {
        const layerSpec = createLayerSpec({
            paint: {
                resampling: 'nearest',
            }
        });
        const layer = createStyleLayer(layerSpec, {});
    
        const rasterResampling = layer.getPaintProperty('raster-resampling');
        expect(rasterResampling).toEqual(undefined);
    });

    test('sets "resampling" undefined when instantiated with "raster-resampling"', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'raster-resampling': 'nearest',
            }
        });
        const layer = createStyleLayer(layerSpec, {});
    
        const resampling = layer.getPaintProperty('resampling');
        expect(resampling).toEqual(undefined);
    });

    test('warns when both "resampling" and "raster-resampling" are specified upon instantiation', () => {
        const originalWarn = console.warn;
        console.warn = vi.fn();

        const layerSpec = createLayerSpec({
            paint: {
                resampling: 'nearest',
                'raster-resampling': 'nearest',
            }
        });
        createStyleLayer(layerSpec, {});
        expect(console.warn).toHaveBeenCalledTimes(1);
        console.warn = originalWarn;
    });

});
