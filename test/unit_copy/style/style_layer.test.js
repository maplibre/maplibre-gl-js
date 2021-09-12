import '../../stub_loader';
import {test} from '../../util/test';
import createStyleLayer from '../../../rollup/build/tsc/style/create_style_layer';
import FillStyleLayer from '../../../rollup/build/tsc/style/style_layer/fill_style_layer';
import {extend} from '../../../rollup/build/tsc/util/util';
import Color from '../../../rollup/build/tsc/style-spec/util/color';

test('StyleLayer', (t) => {
    t.test('instantiates the correct subclass', (t) => {
        const layer = createStyleLayer({type: 'fill'});

        expect(layer instanceof FillStyleLayer).toBeTruthy();
        t.end();
    });

    t.end();
});

test('StyleLayer#setPaintProperty', (t) => {
    t.test('sets new property value', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toEqual('blue');
        t.end();
    });

    t.test('updates property value', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toEqual('blue');
        t.end();
    });

    t.test('unsets value', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red",
                "background-opacity": 1
            }
        });

        layer.setPaintProperty('background-color', null);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        expect(layer.paint.get('background-color')).toEqual(new Color(0, 0, 0, 1));
        expect(layer.getPaintProperty('background-color')).toBe(undefined);
        expect(layer.paint.get('background-opacity')).toBe(1);
        expect(layer.getPaintProperty('background-opacity')).toBe(1);

        t.end();
    });

    t.test('preserves existing transition', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red",
                "background-color-transition": {
                    duration: 600
                }
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 600});
        t.end();
    });

    t.test('sets transition', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "red"
            }
        });

        layer.setPaintProperty('background-color-transition', {duration: 400});

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 400});
        t.end();
    });

    t.test('emits on an invalid property value', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background"
        });

        layer.on('error', () => {
            expect(layer.getPaintProperty('background-opacity')).toBe(undefined);
            t.end();
        });

        layer.setPaintProperty('background-opacity', 5);
    });

    t.test('emits on an invalid transition property value', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background"
        });

        layer.on('error', () => {
            t.end();
        });

        layer.setPaintProperty('background-opacity-transition', {
            duration: -10
        });
    });

    t.test('can unset fill-outline-color #2886', (t) => {
        const layer = createStyleLayer({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        });

        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});
        expect(layer.paint.get('fill-outline-color').value).toEqual({kind: 'constant', value: new Color(1, 0, 0, 1)});

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});
        expect(layer.paint.get('fill-outline-color').value).toEqual({kind: 'constant', value: new Color(0, 0, 1, 1)});

        t.end();
    });

    t.test('can transition fill-outline-color from undefined to a value #3657', (t) => {
        const layer = createStyleLayer({
            id: 'building',
            type: 'fill',
            source: 'streets',
            paint: {
                'fill-color': '#00f'
            }
        });

        // setup: set and then unset fill-outline-color so that, when we then try
        // to re-set it, StyleTransition#calculate() attempts interpolation
        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        layer.setPaintProperty('fill-outline-color', undefined);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        // re-set fill-outline-color and get its value, triggering the attempt
        // to interpolate between undefined and #f00
        layer.setPaintProperty('fill-outline-color', '#f00');
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        layer.paint.get('fill-outline-color');

        t.end();
    });

    t.test('sets null property value', (t) => {
        const layer = createStyleLayer({
            "id": "background",
            "type": "background"
        });

        layer.setPaintProperty('background-color-transition', null);

        expect(layer.getPaintProperty('background-color-transition')).toEqual(null);
        t.end();
    });

    t.end();
});

test('StyleLayer#setLayoutProperty', (t) => {
    t.test('sets new property value', (t) => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol"
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toEqual('lowercase');
        t.end();
    });

    t.test('emits on an invalid property value', (t) => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol"
        });

        layer.on('error', () => {
            t.end();
        });

        layer.setLayoutProperty('text-transform', 'mapboxcase');
    });

    t.test('updates property value', (t) => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toEqual('lowercase');
        t.end();
    });

    t.test('unsets property value', (t) => {
        const layer = createStyleLayer({
            "id": "symbol",
            "type": "symbol",
            "layout": {
                "text-transform": "uppercase"
            }
        });

        layer.setLayoutProperty('text-transform', null);
        layer.recalculate({zoom: 0, zoomHistory: {}});

        expect(layer.layout.get('text-transform').value).toEqual({kind: 'constant', value: 'none'});
        expect(layer.getLayoutProperty('text-transform')).toBe(undefined);
        t.end();
    });

    t.end();
});

test('StyleLayer#serialize', (t) => {

    function createSymbolLayer(layer) {
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

    t.test('serializes layers', (t) => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
        t.end();
    });

    t.test('serializes functions', (t) => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
        t.end();
    });

    t.test('serializes added paint properties', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toBe('orange');
        expect(layer.serialize().paint['text-color']).toBe('blue');

        t.end();
    });

    t.test('serializes added layout properties', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toBe('uppercase');
        expect(layer.serialize().layout['text-size']).toBe(20);

        t.end();
    });

    t.test('serializes "visibility" of "visible"', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'visible');

        expect(layer.serialize().layout['visibility']).toBe('visible');

        t.end();
    });

    t.test('serializes "visibility" of "none"', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'none');

        expect(layer.serialize().layout['visibility']).toBe('none');

        t.end();
    });

    t.test('serializes "visibility" of undefined', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', undefined);

        expect(layer.serialize().layout['visibility']).toBe(undefined);

        t.end();
    });

    t.end();
});

test('StyleLayer#serialize', (t) => {

    function createSymbolLayer(layer) {
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

    t.test('serializes layers', (t) => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
        t.end();
    });

    t.test('serializes functions', (t) => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
        t.end();
    });

    t.test('serializes added paint properties', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toBe('orange');
        expect(layer.serialize().paint['text-color']).toBe('blue');

        t.end();
    });

    t.test('serializes added layout properties', (t) => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toBe('uppercase');
        expect(layer.serialize().layout['text-size']).toBe(20);

        t.end();
    });

    t.test('layer.paint is never undefined', (t) => {
        const layer = createStyleLayer({type: 'fill'});
        // paint is never undefined
        expect(layer.paint).toBeTruthy();
        t.end();
    });

    t.end();
});
