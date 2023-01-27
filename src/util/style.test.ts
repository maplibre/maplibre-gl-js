import {coerceSpriteToArray} from './style';

describe('style utils', () => {
    describe('#coerceSpriteToArray', () => {
        test('input === output when array', () => {
            const sprite = [{id: 'id', url: 'url'}];
            expect(coerceSpriteToArray(sprite)).toBe(sprite);
        });

        test('coerced to array when string', () => {
            const expected = [{id: 'default', url: 'url'}];
            expect(coerceSpriteToArray('url')).toEqual(expected);
        });

        test('returns an empty array when nothing\'s passed in', () => {
            expect(coerceSpriteToArray()).toEqual([]);
        });
    });
});
