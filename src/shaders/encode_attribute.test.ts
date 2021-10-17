import {packUint8ToFloat} from './encode_attribute';

test('packUint8ToFloat', () => {
    expect(packUint8ToFloat(0, 0)).toBe(0);
    expect(packUint8ToFloat(255, 255)).toBe(65535);
    expect(packUint8ToFloat(123, 45)).toBe(31533);

    expect(packUint8ToFloat(-1, -1)).toBe(0);
    expect(packUint8ToFloat(256, 256)).toBe(65535);

});
