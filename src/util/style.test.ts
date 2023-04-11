import {coerceSpriteToArray} from './style';

describe('style utils', () => {
    describe('#coerceSpriteToArray', () => {
        test('input === output when array', () => {
            const inputSpriteArray = [{id: 'id', url: 'url'}];
            const outputSpriteArray = coerceSpriteToArray(inputSpriteArray);
            expect(outputSpriteArray).toHaveLength(1);
            expect(outputSpriteArray[0].id).toBe('id');
            expect(outputSpriteArray[0].url).toBe('url');
        });

        test('coerced to array when string', () => {
            const expected = [{id: 'default', url: 'url'}];
            expect(coerceSpriteToArray('url')).toEqual(expected);
        });

        test('returns an empty array when nothing\'s passed in', () => {
            expect(coerceSpriteToArray()).toEqual([]);
        });

        test('duplicated entries should be removed', () => {
            const spriteWithDuplicatedEntries = [
                {id: 'sprite1', url: 'http://www.dummy.com'},
                {id: 'sprite1', url: 'http://www.dummy.com'}];

            const result = coerceSpriteToArray(spriteWithDuplicatedEntries);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('sprite1');
            expect(result[0].url).toBe('http://www.dummy.com');
        });
    });
});
