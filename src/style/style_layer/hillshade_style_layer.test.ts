import {describe, test, expect} from 'vitest';
import {HillshadeStyleLayer} from './hillshade_style_layer';
import {Color, type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {createStyleLayer} from '../create_style_layer';
import {degreesToRadians, extend} from '../../util/util';

function createLayerSpec(properties?): LayerSpecification {
    return extend({
        type: 'hillshade',
        id: 'hillshade',
        source: 'hillshadeSource'
    }, properties);
}

describe('HillshadeStyleLayer', () => {

    test('default', () => {
        const layerSpec = createLayerSpec();
        const layer = createStyleLayer(layerSpec, {});
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);

        const illumination = (layer as HillshadeStyleLayer).getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(335)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(45)]);
        expect(illumination.highlightColor).toEqual([Color.white]);
        expect(illumination.shadowColor).toEqual([Color.black]);
    });

    test('single-value illumination parameters', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'hillshade-illumination-direction': 3,
                'hillshade-illumination-altitude': 4,
                'hillshade-highlight-color': '#FF0000',
                'hillshade-shadow-color': '#FFFFFF',
            }
        });

        const layer = createStyleLayer(layerSpec, {});
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);

        const illumination = (layer as HillshadeStyleLayer).getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(3)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(4)]);
        expect(illumination.highlightColor).toEqual([Color.red]);
        expect(illumination.shadowColor).toEqual([Color.white]);
    });

    test('array-value illumination parameters', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'hillshade-illumination-direction': [6, 7],
                'hillshade-illumination-altitude': [8, 9],
                'hillshade-highlight-color': ['#FF0000','#FF0000'],
                'hillshade-shadow-color': ['#FF0000', '#FFFFFF'],
            }
        });

        const layer = createStyleLayer(layerSpec, {});
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);

        const illumination = (layer as HillshadeStyleLayer).getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(6), degreesToRadians(7)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(8), degreesToRadians(9)]);
        expect(illumination.highlightColor).toEqual([Color.red, Color.red]);
        expect(illumination.shadowColor).toEqual([Color.red, Color.white]);
    });

    test('mixed illumination parameters: number, color, and arrays', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'hillshade-illumination-direction': [6, 7],
                'hillshade-illumination-altitude': 23,
                'hillshade-highlight-color': ['#FF0000'],
                'hillshade-shadow-color': '#000000',
            }
        });

        const layer = createStyleLayer(layerSpec, {});
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);

        const illumination = (layer as HillshadeStyleLayer).getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(6), degreesToRadians(7)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(23), degreesToRadians(23)]);
        expect(illumination.highlightColor).toEqual([Color.red, Color.red]);
        expect(illumination.shadowColor).toEqual([Color.black, Color.black]);
    });

    test('mixed illumination parameters: default, number, and arrays', () => {
        const layerSpec = createLayerSpec({
            paint: {
                'hillshade-illumination-altitude': 23,
                'hillshade-highlight-color': ['#FF0000'],
                'hillshade-shadow-color': ['#000000', '#FFFFFF'],
            }
        });

        const layer = createStyleLayer(layerSpec, {});
        expect(layer).toBeInstanceOf(HillshadeStyleLayer);

        const illumination = (layer as HillshadeStyleLayer).getIlluminationProperties();
        expect(illumination.directionRadians).toEqual([degreesToRadians(335), degreesToRadians(335)]);
        expect(illumination.altitudeRadians).toEqual([degreesToRadians(23), degreesToRadians(23)]);
        expect(illumination.highlightColor).toEqual([Color.red, Color.red]);
        expect(illumination.shadowColor).toEqual([Color.black, Color.white]);
    });
});
