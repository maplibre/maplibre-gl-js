import format from '../style-spec/format';

function roundtrip(style) {
    return JSON.parse(format(style));
}

describe('orders top-level keys', () => {
    expect(Object.keys(roundtrip({
        'layers': [],
        'other': {},
        'sources': {},
        'glyphs': '',
        'sprite': '',
        'version': 6
    }))).toEqual(['version', 'sources', 'sprite', 'glyphs', 'layers', 'other']);
});

describe('orders layer keys', () => {
    expect(Object.keys(roundtrip({
        'layers': [{
            'paint': {},
            'layout': {},
            'id': 'id',
            'type': 'type'
        }]
    }).layers[0])).toEqual(['id', 'type', 'layout', 'paint']);
});
