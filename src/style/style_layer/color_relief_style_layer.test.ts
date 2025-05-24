import {describe, test, expect} from 'vitest';
import {ColorReliefStyleLayer} from './color_relief_style_layer';
import {Color, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {createStyleLayer} from '../create_style_layer';
import {extend} from '../../util/util';
import {type EvaluationParameters} from '../evaluation_parameters';

function createColorReliefLayerSpec(properties?: {paint: {'color-relief-opacity'?: number; 'color-relief-color'?: Array<any>}}): LayerSpecification {
    return extend({
        type: 'color-relief',
        id: 'colorRelief',
        source: 'colorReliefSource'
    } as LayerSpecification, properties);
}

describe('ColorReliefStyleLayer', () => {

    test('default', () => {
        const layerSpec = createColorReliefLayerSpec();
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;
        expect(colorReliefStyleLayer.paint.get('color-relief-opacity')).toEqual(1);
        const colorRamp = colorReliefStyleLayer._createColorRamp(256);
        expect(colorRamp.elevationStops).toEqual([0,1]);
        expect(colorRamp.colorStops).toEqual([Color.transparent,Color.transparent]);
    });

    test('parameters specified', () => {
        const layerSpec = createColorReliefLayerSpec({
            paint: {
                'color-relief-opacity': 0.5,
                'color-relief-color': [
                    'interpolate',
                    ['linear'],
                    ['elevation'],
                    0, '#000000',
                    1000, '#ffffff'
                ]
            }
        });
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;
        const colorRamp = colorReliefStyleLayer._createColorRamp(256);
        expect(colorRamp.elevationStops).toEqual([0,1000]);
        expect(colorRamp.colorStops).toEqual([Color.black,Color.white]);

        colorReliefStyleLayer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        expect(colorReliefStyleLayer.paint.get('color-relief-opacity')).toEqual(0.5);
    });

    test('single color', () => {
        const layerSpec = createColorReliefLayerSpec({
            paint: {
                'color-relief-color': [
                    'interpolate',
                    ['linear'],
                    ['elevation'],
                    0, '#ff0000'
                ]
            }
        });
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;
        const colorRamp = colorReliefStyleLayer._createColorRamp(256);
        expect(colorRamp.elevationStops).toEqual([0,1]);
        expect(colorRamp.colorStops).toEqual([Color.red,Color.red]);
    });

    test('getColorRamp: no remapping', () => {
        const layerSpec = createColorReliefLayerSpec({
            paint: {
                'color-relief-color': [
                    'interpolate',
                    ['linear'],
                    ['elevation'],
                    0, '#000000',
                    1000, '#ff0000',
                    2000, '#ff0000',
                    3000, '#ffffff'
                ]
            }
        });
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;

        const colorRamp = colorReliefStyleLayer._createColorRamp(4);

        expect(colorRamp.elevationStops).toEqual([0, 1000, 2000, 3000]);
        expect(colorRamp.colorStops).toEqual([Color.black, Color.red, Color.red, Color.white]);
    });

    test('getColorRamp: with remapping', () => {
        const layerSpec = createColorReliefLayerSpec({
            paint: {
                'color-relief-color': [
                    'interpolate',
                    ['linear'],
                    ['elevation'],
                    0, '#000000',
                    1000, '#ff0000',
                    2000, '#ffffff',
                    3000, '#000000',
                    4000, '#ff0000'
                ]
            }
        });
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;

        const colorRamp = colorReliefStyleLayer._createColorRamp(4);

        expect(colorRamp.elevationStops).toEqual([0, 1000, 3000, 4000]);
        expect(colorRamp.colorStops).toEqual([Color.black, Color.red, Color.black, Color.red]);
    });
});
