import {describe, expect, test} from 'vitest';
import {DrawableCollection} from './drawable.ts';

const TRIANGLES = 0x0004;

describe('DrawableCollection', () => {
    test('keeps requested drawables and removes the ones not requested since the previous removal', () => {
        const collection = new DrawableCollection();

        collection.request('first', null, null, 'layer', TRIANGLES);
        const second = collection.request('second', null, null, 'layer', TRIANGLES);
        collection.removeUnrequested();
        expect([...collection.entries.keys()]).toEqual(['first', 'second']);

        expect(collection.request('second', null, null, 'layer', TRIANGLES)).toBe(second);
        collection.removeUnrequested();
        expect([...collection.entries.keys()]).toEqual(['second']);

        collection.removeUnrequested();
        expect(collection.entries.size).toBe(0);
    });
});
