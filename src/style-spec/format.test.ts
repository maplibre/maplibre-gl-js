import {test} from '../../util/test';
import format from '../../../rollup/build/tsc/src/style-spec/format';

function roundtrip(style) {
    return JSON.parse(format(style));
}

test('orders top-level keys', (t) => {
    expect(Object.keys(roundtrip({
        "layers": [],
        "other": {},
        "sources": {},
        "glyphs": "",
        "sprite": "",
        "version": 6
    }))).toEqual(['version', 'sources', 'sprite', 'glyphs', 'layers', 'other']);
    t.end();
});

test('orders layer keys', (t) => {
    expect(Object.keys(roundtrip({
        "layers": [{
            "paint": {},
            "layout": {},
            "id": "id",
            "type": "type"
        }]
    }).layers[0])).toEqual(['id', 'type', 'layout', 'paint']);
    t.end();
});
