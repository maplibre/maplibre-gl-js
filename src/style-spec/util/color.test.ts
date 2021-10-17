import Color from './color';

test('Color.parse', () => {
    expect(Color.parse('red')).toEqual(new Color(1, 0, 0, 1));
    expect(Color.parse('#ff00ff')).toEqual(new Color(1, 0, 1, 1));
    expect(Color.parse('invalid')).toEqual(undefined);
    expect(Color.parse(null)).toEqual(undefined);
    expect(Color.parse(undefined)).toEqual(undefined);
});

test('Color#toString', () => {
    const purple = Color.parse('purple');
    expect(purple && purple.toString()).toBe('rgba(128,0,128,1)');
    const translucentGreen = Color.parse('rgba(26, 207, 26, .73)');
    expect(translucentGreen && translucentGreen.toString()).toBe('rgba(26,207,26,0.73)');
});
