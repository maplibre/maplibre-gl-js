import {test} from '../../util/test';
import declass from '../../../rollup/build/tsc/style-spec/declass';

test('declass a style, one class', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': {base: 2, stops: [[0, 'red'], [22, 'yellow']]},
                'fill-outline-color': 'green'
            },
            'paint.one': {
                'fill-color': {base: 1},
                'fill-opacity': 0.5
            }
        }]
    };

    const declassed = declass(style, ['one']);

    expect(declassed).not.toBe(style);
    expect(declassed.layers).not.toBe(style.layers);
    expect(declassed.layers[0]).not.toBe(style.layers[0]);
    expect(declassed.layers[0].paint).not.toBe(style.layers[0].paint);

    expect(declassed).toEqual({
        layers: [{
            id: 'a',
            paint: {
                'fill-color': {base: 1},
                'fill-outline-color': 'green',
                'fill-opacity': 0.5
            }
        }]
    });

    t.end();
});

test('declass a style, missing class ==> noop', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            }
        }]
    };

    expect(declass(style, ['one'])).toEqual({
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            }
        }]
    });

    t.end();
});

test('declass a style, multiple classes', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            },
            'paint.one': {
                'fill-color': 'blue',
                'fill-opacity': 0.5
            },
            'paint.two': {
                'fill-opacity': 0.75,
                'fill-something-else': true
            }
        }]
    };

    expect(declass(style, ['one', 'two'])).toEqual({
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'blue',
                'fill-outline-color': 'green',
                'fill-opacity': 0.75,
                'fill-something-else': true
            }
        }]
    });

    t.end();
});

test('declassing a style removes paint.CLASS definitions, whether or not they are applied', (t) => {
    const style = {
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            },
            'paint.one': {}
        }]
    };

    expect(declass(style, ['one'])).toEqual({
        layers: [{
            id: 'a',
            paint: {
                'fill-color': 'red',
                'fill-outline-color': 'green'
            }
        }]
    });

    t.end();
});
