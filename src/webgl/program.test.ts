import {describe, test, expect, vi} from 'vitest';
import {getIntegerAttributes} from './program.ts';
import {createNullGL} from '../util/test/null_gl.ts';

describe('getIntegerAttributes', () => {
    test('collects integer-typed active attributes and skips float-typed ones', () => {
        const gl = createNullGL();
        const activeAttributes = [
            {name: 'a_pos_normal', type: gl.INT_VEC2, size: 1},
            {name: 'a_data', type: gl.UNSIGNED_INT_VEC4, size: 1},
            {name: 'a_uv_x', type: gl.FLOAT, size: 1},
            {name: 'a_color', type: gl.FLOAT_VEC4, size: 1}
        ];
        vi.spyOn(gl, 'getProgramParameter').mockImplementation((_program, pname) => {
            return pname === gl.ACTIVE_ATTRIBUTES ? activeAttributes.length : true;
        });
        vi.spyOn(gl, 'getActiveAttrib').mockImplementation((_program, index) => {
            return activeAttributes[index];
        });

        const result = getIntegerAttributes(gl, {});

        expect(result).toEqual({a_pos_normal: true, a_data: true});
    });

    test('returns an empty map when no attributes are active', () => {
        const gl = createNullGL();
        vi.spyOn(gl, 'getProgramParameter').mockReturnValue(0);

        expect(getIntegerAttributes(gl, {})).toEqual({});
    });
});
