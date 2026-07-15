import {describe, expect, test} from 'vitest';
import {CustomStyleLayer, validateCustomStyleLayer, type CustomLayerInterface} from './custom_style_layer.ts';

describe('validateCustomStyleLayer', () => {
    test('reports nothing for a valid custom layer', () => {
        const layer: CustomLayerInterface = {id: 'custom', type: 'custom', renderingMode: '3d', render() {}};

        expect(validateCustomStyleLayer(layer)).toEqual([]);
    });

    test('reports every missing or invalid part of a custom layer, as errors', () => {
        const errors = validateCustomStyleLayer({renderingMode: 'nonsense'} as any as CustomLayerInterface);

        expect(errors.map(({message}) => message)).toEqual([
            'layers.undefined: missing required property "id"',
            'layers.undefined: missing required method "render"',
            'layers.undefined: property "renderingMode" must be either "2d" or "3d"'
        ]);
        expect(errors.map(({severity}) => severity)).toEqual(['error', 'error', 'error']);
    });
});

describe('CustomStyleLayer', () => {
    test('set visibility', () => {
        const layerSpec: CustomLayerInterface = {
            id: '',
            type: 'custom',
            render() {}
        };
        const layer = new CustomStyleLayer(layerSpec, {});
        layer.setLayoutProperty('visibility', 'visible');
        expect(layer.getLayoutProperty('visibility')).toBe('visible');
        layer.setLayoutProperty('visibility', 'none');
        expect(layer.getLayoutProperty('visibility')).toBe('none');
    });
});
