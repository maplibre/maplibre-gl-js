import Color from './color';

describe('Color', () => {
    test('Color.parse', () => {
        expect(Color.parse('red')).toEqual(new Color(1, 0, 0, 1));
        expect(Color.parse('#ff00ff')).toEqual(new Color(1, 0, 1, 1));
        expect(Color.parse('invalid')).toBeUndefined();
        expect(Color.parse(null)).toBeUndefined();
        expect(Color.parse(undefined)).toBeUndefined();
    });

    test('Color#toString', () => {
        const purple = Color.parse('purple');
        expect(purple && purple.toString()).toBe('rgba(128,0,128,1)');
        const translucentGreen = Color.parse('rgba(26, 207, 26, .73)');
        expect(translucentGreen && translucentGreen.toString()).toBe('rgba(26,207,26,0.73)');
    });
});
