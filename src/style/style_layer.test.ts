import createStyleLayer from './create_style_layer';
import FillStyleLayer from './style_layer/fill_style_layer';
import {extend} from '../util/util';
import Color from '../style-spec/util/color';
import {LayerSpecification} from '../style-spec/types.g';
import EvaluationParameters from './evaluation_parameters';
import {TransitionParameters} from './properties';
import BackgroundStyleLayer from './style_layer/background_style_layer';
import SymbolStyleLayer from './style_layer/symbol_style_layer';

describe('StyleLayer', () => {
    test('instantiates the correct subclass', () => {
        const layer = createStyleLayer({type: 'fill'} as LayerSpecification);

        expect(layer instanceof FillStyleLayer).toBeTruthy();
    });
});

describe('StyleLayer#setPaintProperty', () => {
    test('sets new property value', () => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toBe('blue');
    });

    test('updates property value', () => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red'
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toBe('blue');
    });

    test('unsets value', () => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red',
                'background-opacity': 1
            }
        }) as BackgroundStyleLayer;

        layer.setPaintProperty('background-color', null);
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        expect(layer.paint.get('background-color')).toEqual(new Color(0, 0, 0, 1));
        expect(layer.getPaintProperty('background-color')).toBeUndefined();
        expect(layer.paint.get('background-opacity')).toBe(1);
        expect(layer.getPaintProperty('background-opacity')).toBe(1);
    });

    test('preserves existing transition', () => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red',
                'background-color-transition': {
                    duration: 600
                }
            } as any
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 600});
    });

    test('sets transition', () => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red'
            }
        });

        layer.setPaintProperty('background-color-transition', {duration: 400});

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 400});
    });

    test('emits on an invalid property value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.on('error', () => {
            expect(layer.getPaintProperty('background-opacity')).toBeUndefined();
            done();
        });

        layer.setPaintProperty('background-opacity', 5);
    });

    test('emits on an invalid transition property value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.on('error', () => {
            done();
        });

        layer.setPaintProperty('background-opacity-transition', {
            duration: -10
        });
    });

    test('can unset fill-outline-color #2886', () => {
        const layer = createStyleLayer({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        }) as FillStyleLayer;

        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        expect(layer.paint.get('fill-outline-color').value).toEqual({kind: 'constant', value: new Color(1, 0, 0, 1)});

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        expect(layer.paint.get('fill-outline-color').value).toEqual({kind: 'constant', value: new Color(0, 0, 1, 1)});

    });

    test('can transition fill-outline-color from undefined to a value #3657', () => {
        const layer = createStyleLayer({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        }) as FillStyleLayer;

        // setup: set and then unset fill-outline-color so that, when we then try
        // to re-set it, StyleTransition#calculate() attempts interpolation
        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        // re-set fill-outline-color and get its value, triggering the attempt
        // to interpolate between undefined and #f00
        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({} as TransitionParameters);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        layer.paint.get('fill-outline-color');

    });

    test('sets null property value', () => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.setPaintProperty('background-color-transition', null);

        expect(layer.getPaintProperty('background-color-transition')).toBeUndefined();
    });

});

describe('StyleLayer#setLayoutProperty', () => {
    test('sets new property value', () => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol'
        } as LayerSpecification);

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toBe('lowercase');
    });

    test('emits on an invalid property value', done => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol'
        } as LayerSpecification);

        layer.on('error', () => {
            done();
        });

        layer.setLayoutProperty('text-transform', 'invalidValue');
    });

    test('updates property value', () => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol',
            'layout': {
                'text-transform': 'uppercase'
            }
        } as LayerSpecification);

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toBe('lowercase');
    });

    test('unsets property value', () => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol',
            'layout': {
                'text-transform': 'uppercase'
            }
        } as LayerSpecification) as SymbolStyleLayer;

        layer.setLayoutProperty('text-transform', null);
        layer.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);

        expect(layer.layout.get('text-transform').value).toEqual({kind: 'constant', value: 'none'});
        expect(layer.getLayoutProperty('text-transform')).toBeUndefined();
    });
});

describe('StyleLayer#serialize', () => {

    function createSymbolLayer(layer?) {
        return extend({
            id: 'symbol',
            type: 'symbol',
            paint: {
                'text-color': 'blue'
            },
            layout: {
                'text-transform': 'uppercase'
            }
        }, layer);
    }

    test('serializes layers', () => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
    });

    test('serializes functions', () => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
    });

    test('serializes added paint properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toBe('orange');
        expect(layer.serialize().paint['text-color']).toBe('blue');

    });

    test('serializes added layout properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toBe('uppercase');
        expect(layer.serialize().layout['text-size']).toBe(20);

    });

    test('serializes "visibility" of "visible"', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'visible');

        expect(layer.serialize().layout['visibility']).toBe('visible');

    });

    test('serializes "visibility" of "none"', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'none');

        expect(layer.serialize().layout['visibility']).toBe('none');

    });

    test('serializes "visibility" of undefined', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', undefined);

        expect(layer.serialize().layout['visibility']).toBeUndefined();

    });

});

describe('StyleLayer#serialize', () => {

    function createSymbolLayer(layer?) {
        return extend({
            id: 'symbol',
            type: 'symbol',
            paint: {
                'text-color': 'blue'
            },
            layout: {
                'text-transform': 'uppercase'
            }
        }, layer);
    }

    test('serializes layers', () => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
    });

    test('serializes functions', () => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
    });

    test('serializes added paint properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toBe('orange');
        expect(layer.serialize().paint['text-color']).toBe('blue');

    });

    test('serializes added layout properties', () => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toBe('uppercase');
        expect(layer.serialize().layout['text-size']).toBe(20);

    });

    test('layer.paint is never undefined', () => {
        const layer = createStyleLayer({type: 'fill'} as LayerSpecification);
        // paint is never undefined
        expect(layer.paint).toBeTruthy();
    });
});
