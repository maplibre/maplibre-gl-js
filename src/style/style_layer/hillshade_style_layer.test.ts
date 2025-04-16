import {describe, test, expect} from 'vitest';
import {HillshadeStyleLayer} from './hillshade_style_layer';
import {Color, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {createStyleLayer} from '../create_style_layer';
import {degreesToRadians} from '../../util/util';
import {EvaluationParameters} from '../evaluation_parameters';
import {TransitionParameters} from '../properties';

describe('HillshadeStyleLayer', () => {

    test('default', () => {
        let layerSpec = {
            type: 'hillshade',
            id: 'hillshade',
            source: 'hillshadeSource'
        } as LayerSpecification;
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);
        
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        const illumination = layer.getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(335)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(45)]);
        expect(illumination.shadowColor).toEqual([Color.black]);
        expect(illumination.highlightColor).toEqual([Color.white]);
    });

    test('single-value illumination parameters', () => {
        let layerSpec = {
            type: 'hillshade',
            id: 'hillshade',
            source: 'hillshadeSource',
            paint: {
                'hillshade-illumination-direction': 3,
                'hillshade-illumination-altitude': 4,
                'hillshade-highlight-color': '#FF0000',
                'hillshade-shadow-color': '#FFFFFF',
            }
        } as LayerSpecification;
        
        const layer = createStyleLayer(layerSpec);
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);
        
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        const illumination = layer.getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(3)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(4)]);
        expect(illumination.shadowColor).toEqual([Color.white]);
        expect(illumination.highlightColor).toEqual([Color.red]);
    });

   
});
