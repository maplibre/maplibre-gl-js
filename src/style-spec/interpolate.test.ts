import {test} from '../../util/test';
import * as interpolate from '../../../rollup/build/tsc/src/style-spec/util/interpolate';
import Color from '../../../rollup/build/tsc/src/style-spec/util/color';

test('interpolate.number', (t) => {
    expect(interpolate.number(0, 1, 0.5)).toBe(0.5);
    t.end();
});

test('interpolate.color', (t) => {
    expect(interpolate.color(new Color(0, 0, 0, 0), new Color(1, 2, 3, 4), 0.5)).toEqual(new Color(0.5, 1, 3 / 2, 2));
    t.end();
});

test('interpolate.array', (t) => {
    expect(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5)).toEqual([0.5, 1, 3 / 2, 2]);
    t.end();
});
