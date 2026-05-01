import {describe, expect, test} from 'vitest';
import {CustomStyleLayer, type CustomLayerInterface} from './custom_style_layer';

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
