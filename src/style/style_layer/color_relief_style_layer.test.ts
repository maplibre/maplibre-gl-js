import {describe, test, expect} from 'vitest';
import {ColorReliefStyleLayer} from './color_relief_style_layer';
import {Color, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {createStyleLayer} from '../create_style_layer';
import {extend} from '../../util/util';
import {EvaluationParameters} from '../evaluation_parameters';

function createLayerSpec(properties?): LayerSpecification {
    return extend({
        type: 'color-relief',
        id: 'colorRelief',
        source: 'colorReliefSource'
    }, properties);
}

describe('ColorReliefStyleLayer', () => {

    test('default', () => {
        const layerSpec = createLayerSpec();
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;
        expect(colorReliefStyleLayer.paint.get('color-relief-opacity')).toEqual(1);
    });

    test('parameters specified', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'color-relief-opacity': 0.5,
                'color-relief-color': [
                    "interpolate",
                    ["linear"],
                    ["elevation"],
                    0, "#000000",
                    1000, "#ffffff"
                ]
            }
        });
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(ColorReliefStyleLayer);
        const colorReliefStyleLayer = layer as ColorReliefStyleLayer;
        expect(colorReliefStyleLayer.elevationStops).toEqual([0,1000]);
        expect(colorReliefStyleLayer.colorStops).toEqual([Color.black,Color.white]);

        colorReliefStyleLayer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        expect(colorReliefStyleLayer.paint.get('color-relief-opacity')).toEqual(0.5);
    });
});
