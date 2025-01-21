
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

describe('#setSky', () => {
    test('calls style setSky when set', () => {
        const map = createMap();
        const spy = vi.fn();
        map.style.setSky = spy;
        map.setSky({'atmosphere-blend': 0.5});

        expect(spy).toHaveBeenCalled();
    });
});

describe('#getSky', () => {
    test('returns undefined when not set', () => {
        const map = createMap();
        expect(map.getSky()).toBeUndefined();
    });

    test('calls style getSky when invoked', () => {
        const map = createMap();
        const spy = vi.fn();
        map.style.getSky = spy;
        map.getSky();

        expect(spy).toHaveBeenCalled();
    });

    test('return previous style when set', async () => {
        const map = createMap();
        await map.once('style.load');
        map.setSky({'atmosphere-blend': 0.5});

        expect(map.getSky()).toEqual({'atmosphere-blend': 0.5});
    });

});
