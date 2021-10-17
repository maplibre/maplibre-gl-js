import * as interpolate from '../style-spec/util/interpolate';
import Color from '../style-spec/util/color';

describe('interpolate.number', () => {
    expect(interpolate.number(0, 1, 0.5)).toBe(0.5);
});

describe('interpolate.color', () => {
    expect(interpolate.color(new Color(0, 0, 0, 0), new Color(1, 2, 3, 4), 0.5)).toEqual(new Color(0.5, 1, 3 / 2, 2));
});

describe('interpolate.array', () => {
    expect(interpolate.array([0, 0, 0, 0], [1, 2, 3, 4], 0.5)).toEqual([0.5, 1, 3 / 2, 2]);
});
