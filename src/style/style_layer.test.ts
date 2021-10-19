import '../../stub_loader';
import createStyleLayer from '../style/create_style_layer';
import FillStyleLayer from '../style/style_layer/fill_style_layer';
import {extend} from '../util/util';
import Color from '../style-spec/util/color';

describe('StyleLayer', done => {
    test('instantiates the correct subclass', done => {
        const layer = createStyleLayer({type: 'fill'});

        expect(layer instanceof FillStyleLayer).toBeTruthy();
        done();
    });

    done();
});

describe('StyleLayer#setPaintProperty', done => {
    test('sets new property value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toEqual('blue');
        done();
    });

    test('updates property value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red'
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color')).toEqual('blue');
        done();
    });

    test('unsets value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red',
                'background-opacity': 1
            }
        });

        layer.setPaintProperty('background-color', null);
        layer.updateTransitions({});
        layer.recalculate({zoom: 0, zoomHistory: {}});

        expect(layer.paint.get('background-color')).toEqual(new Color(0, 0, 0, 1));
        expect(layer.getPaintProperty('background-color')).toBe(undefined);
        expect(layer.paint.get('background-opacity')).toBe(1);
        expect(layer.getPaintProperty('background-opacity')).toBe(1);

        done();
    });

    test('preserves existing transition', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red',
                'background-color-transition': {
                    duration: 600
                }
            }
        });

        layer.setPaintProperty('background-color', 'blue');

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 600});
        done();
    });

    test('sets transition', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background',
            'paint': {
                'background-color': 'red'
            }
        });

        layer.setPaintProperty('background-color-transition', {duration: 400});

        expect(layer.getPaintProperty('background-color-transition')).toEqual({duration: 400});
        done();
    });

    test('emits on an invalid property value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.on('error', () => {
            expect(layer.getPaintProperty('background-opacity')).toBe(undefined);
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

    test('can unset fill-outline-color #2886', done => {
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

        done();
    });

    test('can transition fill-outline-color from undefined to a value #3657', done => {
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

        done();
    });

    test('sets null property value', done => {
        const layer = createStyleLayer({
            'id': 'background',
            'type': 'background'
        });

        layer.setPaintProperty('background-color-transition', null);

        expect(layer.getPaintProperty('background-color-transition')).toEqual(null);
        done();
    });

    done();
});

describe('StyleLayer#setLayoutProperty', done => {
    test('sets new property value', done => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol'
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toEqual('lowercase');
        done();
    });

    test('emits on an invalid property value', done => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol'
        });

        layer.on('error', () => {
            done();
        });

        layer.setLayoutProperty('text-transform', 'mapboxcase');
    });

    test('updates property value', done => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol',
            'layout': {
                'text-transform': 'uppercase'
            }
        });

        layer.setLayoutProperty('text-transform', 'lowercase');

        expect(layer.getLayoutProperty('text-transform')).toEqual('lowercase');
        done();
    });

    test('unsets property value', done => {
        const layer = createStyleLayer({
            'id': 'symbol',
            'type': 'symbol',
            'layout': {
                'text-transform': 'uppercase'
            }
        });

        layer.setLayoutProperty('text-transform', null);
        layer.recalculate({zoom: 0, zoomHistory: {}});

        expect(layer.layout.get('text-transform').value).toEqual({kind: 'constant', value: 'none'});
        expect(layer.getLayoutProperty('text-transform')).toBe(undefined);
        done();
    });

    done();
});

describe('StyleLayer#serialize', done => {

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

    test('serializes layers', done => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
        done();
    });

    test('serializes functions', done => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
        done();
    });

    test('serializes added paint properties', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toBe('orange');
        expect(layer.serialize().paint['text-color']).toBe('blue');

        done();
    });

    test('serializes added layout properties', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toBe('uppercase');
        expect(layer.serialize().layout['text-size']).toBe(20);

        done();
    });

    test('serializes "visibility" of "visible"', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'visible');

        expect(layer.serialize().layout['visibility']).toBe('visible');

        done();
    });

    test('serializes "visibility" of "none"', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', 'none');

        expect(layer.serialize().layout['visibility']).toBe('none');

        done();
    });

    test('serializes "visibility" of undefined', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('visibility', undefined);

        expect(layer.serialize().layout['visibility']).toBe(undefined);

        done();
    });

    done();
});

describe('StyleLayer#serialize', done => {

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

    test('serializes layers', done => {
        expect(createStyleLayer(createSymbolLayer()).serialize()).toEqual(createSymbolLayer());
        done();
    });

    test('serializes functions', done => {
        const layerPaint = {
            'text-color': {
                base: 2,
                stops: [[0, 'red'], [1, 'blue']]
            }
        };

        expect(createStyleLayer(createSymbolLayer({paint: layerPaint})).serialize().paint).toEqual(layerPaint);
        done();
    });

    test('serializes added paint properties', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setPaintProperty('text-halo-color', 'orange');

        expect(layer.serialize().paint['text-halo-color']).toBe('orange');
        expect(layer.serialize().paint['text-color']).toBe('blue');

        done();
    });

    test('serializes added layout properties', done => {
        const layer = createStyleLayer(createSymbolLayer());
        layer.setLayoutProperty('text-size', 20);

        expect(layer.serialize().layout['text-transform']).toBe('uppercase');
        expect(layer.serialize().layout['text-size']).toBe(20);

        done();
    });

    test('layer.paint is never undefined', done => {
        const layer = createStyleLayer({type: 'fill'});
        // paint is never undefined
        expect(layer.paint).toBeTruthy();
        done();
    });

    done();
});
