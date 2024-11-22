import {createStyleLayer} from '../create_style_layer';
import {extend} from '../../util/util';
import {LineStyleLayer} from './line_style_layer';

describe('LineStyleLayer', () => {
    function createLineLayer(layer?) {
        return extend({
            type: 'line',
            source: 'line',
            id: 'line',
            paint: {
                'line-color': 'red',
                'line-width': 14,
                'line-gradient': [
                    'interpolate',
                    ['linear'],
                    ['line-progress'],
                    0,
                    'blue',
                    1,
                    'red'
                ]
            }
        }, layer);
    }

    test('updating with valid line-gradient updates this.gradientVersion', () => {
        const lineLayer = createStyleLayer(createLineLayer()) as LineStyleLayer;
        const gradientVersion = lineLayer.gradientVersion;

        lineLayer.setPaintProperty('line-gradient', [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            'red',
            1,
            'blue'
        ]);
        expect(lineLayer.gradientVersion).toBeGreaterThan(gradientVersion);
    });

    test('updating with invalid line-gradient updates this.gradientVersion', () => {
        const lineLayer = createStyleLayer(createLineLayer()) as LineStyleLayer;
        const gradientVersion = lineLayer.gradientVersion;

        lineLayer.setPaintProperty('line-gradient', null);
        expect(lineLayer.gradientVersion).toBeGreaterThan(gradientVersion);
    });
});
