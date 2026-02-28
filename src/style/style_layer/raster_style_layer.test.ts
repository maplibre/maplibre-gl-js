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

    test('automatically sets "raster-resampling" equal to "resampling" when instantiated with "resampling"', () => {
        const layerSpec = createLayerSpec({
            paint: {
                resampling: 'nearest',
            }
        });
        const layer = createStyleLayer(layerSpec, {});
    
        const rasterResampling = layer.getPaintProperty('raster-resampling');
        expect(rasterResampling).toEqual('nearest');
    });

    test('automatically sets "resampling" equal to "raster-resampling" when instantiated with "raster-resampling"', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'raster-resampling': 'nearest',
            }
        });
        const layer = createStyleLayer(layerSpec, {});
    
        const resampling = layer.getPaintProperty('resampling');
        expect(resampling).toEqual('nearest');
    });

    test('automatically sets "raster-resampling" equal to "resampling" when "resampling" is set', () => {
        const layerSpec = createLayerSpec();
        const layer = createStyleLayer(layerSpec, {});

        layer.setPaintProperty('resampling', 'nearest');
    
        const rasterResampling = layer.getPaintProperty('raster-resampling');
        expect(rasterResampling).toEqual('nearest');
    });

    test('automatically sets "resampling" equal to "raster-resampling" when "raster-resampling" is set', () => {
        const layerSpec = createLayerSpec();
        const layer = createStyleLayer(layerSpec, {});

        layer.setPaintProperty('raster-resampling', 'nearest');
    
        const resampling = layer.getPaintProperty('resampling');
        expect(resampling).toEqual('nearest');
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

    test('warns when both "resampling" and "raster-resampling" are specified and not equal upon instantiation', () => {
        const originalWarn = console.warn;
        console.warn = vi.fn();

        const layerSpec = createLayerSpec({
            paint: {
                resampling: 'linear',
                'raster-resampling': 'nearest',
            }
        });
        createStyleLayer(layerSpec, {});
        expect(console.warn).toHaveBeenCalledTimes(2);
        console.warn = originalWarn;
    });

    test('automatically uses "resampling" when both "resampling" and "raster-resampling" are specified and not equal upon instantiation', () => {
        const layerSpec = createLayerSpec({
            paint: {
                resampling: 'nearest',
                'raster-resampling': 'linear',
            }
        });
        const layer = createStyleLayer(layerSpec, {});
    
        const resampling = layer.getPaintProperty('resampling');
        const rasterResampling = layer.getPaintProperty('raster-resampling');
        expect(resampling).toEqual('nearest');
        expect(rasterResampling).toEqual('nearest');
    });

});
