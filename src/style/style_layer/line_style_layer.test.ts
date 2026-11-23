import {describe, test, expect} from 'vitest';
import {createStyleLayer} from '../create_style_layer.ts';

import type {LineStyleLayer} from './line_style_layer.ts';

describe('LineStyleLayer', () => {
    function createLineLayer(layer?) {
        return {
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
            },
            ...layer,
        };
    }

    test('updating with valid line-gradient updates this.gradientVersion', () => {
        const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
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
        const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
        const gradientVersion = lineLayer.gradientVersion;

        lineLayer.setPaintProperty('line-gradient', null);
        expect(lineLayer.gradientVersion).toBeGreaterThan(gradientVersion);
    });

    test('setPaintProperty asks for a relayout when line-offset starts to offset a dashed line', () => {
        const lineLayer = createStyleLayer({type: 'line', source: 'line', id: 'line', paint: {'line-dasharray': [2, 2]}}, {}) as LineStyleLayer;

        expect(lineLayer.setPaintProperty('line-offset', 4)).toBe(true);
        expect(lineLayer.setPaintProperty('line-offset', 8)).toBe(false);
        expect(lineLayer.setPaintProperty('line-offset', 0)).toBe(false);
        expect(lineLayer.setPaintProperty('line-offset', ['interpolate', ['linear'], ['zoom'], 5, 0, 6, 20])).toBe(true);
    });

    test('setPaintProperty does not ask for a relayout when line-offset starts to offset a line without dashes', () => {
        const lineLayer = createStyleLayer({type: 'line', source: 'line', id: 'line'}, {}) as LineStyleLayer;

        expect(lineLayer.setPaintProperty('line-offset', 4)).toBe(false);
    });

});
