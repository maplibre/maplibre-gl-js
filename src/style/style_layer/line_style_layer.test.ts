import {describe, test, expect, vi} from 'vitest';
import {createStyleLayer} from '../create_style_layer.ts';
import {extend} from '../../util/util.ts';
import {type LineStyleLayer} from './line_style_layer.ts';
import {type Framebuffer} from '../../webgl/framebuffer.ts';
import {type EvaluationParameters} from '../evaluation_parameters.ts';
import {type ZoomHistory} from '../zoom_history.ts';

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

    describe('lineFbo', () => {
        test('resize destroys lineFbo and sets it to null', () => {
            const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
            const destroy = vi.fn();
            lineLayer.lineFbo = {destroy} as unknown as Framebuffer;
    
            lineLayer.resize();
    
            expect(destroy).toHaveBeenCalledOnce();
            expect(lineLayer.lineFbo).toBeNull();
        });
        
        test('resize is a no-op when lineFbo is null', () => {
            const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
            
            lineLayer.resize();
            expect(lineLayer.lineFbo).toBeNull();
        });
        
        test('does not exist by default', () => {
            const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
            
            expect(lineLayer.lineFbo).toBeNull();
        });
    
        test('onRemove destroys lineFbo', () => {
            const lineLayer = createStyleLayer(createLineLayer(), {}) as LineStyleLayer;
            const destroy = vi.fn();
            lineLayer.lineFbo = {destroy} as unknown as Framebuffer;

            lineLayer.onRemove();

            expect(destroy).toHaveBeenCalledOnce();
            expect(lineLayer.lineFbo).toBeNull();
        });
    });

    describe('hasOffscreenPass', () => {
        function createEvaluatedLineLayer(paint: Record<string, any>) {
            const lineLayer = createStyleLayer(createLineLayer({paint}), {}) as LineStyleLayer;
            lineLayer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
            return lineLayer;
        }

        test('returns false by default (layer-opacity defaults to 1)', () => {
            const lineLayer = createEvaluatedLineLayer({'line-color': 'red', 'line-width': 14});
            expect(lineLayer.hasOffscreenPass()).toBe(false);
        });

        test('returns true when layer-opacity is between 0 and 1', () => {
            const lineLayer = createEvaluatedLineLayer({'line-color': 'red', 'line-width': 14, 'layer-opacity': 0.5});
            expect(lineLayer.hasOffscreenPass()).toBe(true);
        });

        test('returns false when layer-opacity is 0', () => {
            const lineLayer = createEvaluatedLineLayer({'line-color': 'red', 'line-width': 14, 'layer-opacity': 0});
            expect(lineLayer.hasOffscreenPass()).toBe(false);
        });

        test('returns false when layer-opacity is 1', () => {
            const lineLayer = createEvaluatedLineLayer({'line-color': 'red', 'line-width': 14, 'layer-opacity': 1});
            expect(lineLayer.hasOffscreenPass()).toBe(false);
        });
    });
});
