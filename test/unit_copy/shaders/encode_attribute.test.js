import {test} from '../../util/test';
import {packUint8ToFloat} from '../../../rollup/build/tsc/shaders/encode_attribute';

test('packUint8ToFloat', (t) => {
    expect(packUint8ToFloat(0, 0)).toBe(0);
    expect(packUint8ToFloat(255, 255)).toBe(65535);
    expect(packUint8ToFloat(123, 45)).toBe(31533);

    expect(packUint8ToFloat(-1, -1)).toBe(0);
    expect(packUint8ToFloat(256, 256)).toBe(65535);

    t.end();
});
