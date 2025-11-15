import {describe, test, expect} from 'vitest';
import {type Tile} from './tile';
import {BoundedLRUCache} from './tile_cache';
import {OverscaledTileID} from './tile_id';

const _idA = new OverscaledTileID(10, 0, 10, 0, 1);
const _idB = new OverscaledTileID(10, 0, 10, 0, 2);
const _idC = new OverscaledTileID(10, 0, 10, 0, 3);
const _idD = new OverscaledTileID(10, 0, 10, 0, 4);
const idA = _idA.key;
const idB = _idB.key;
const idC = _idC.key;
const idD = _idD.key
const tileA = {tileID: _idA} as Tile;
const tileA2 = {tileID: _idA} as Tile;
const tileB = {tileID: _idB} as Tile;
const tileC = {tileID: _idC} as Tile;
const tileD = {tileID: _idD} as Tile;

function keysExpected(cache: BoundedLRUCache<string, Tile>, ids: string[]): void {
    expect(cache.getKeys()).toEqual(ids);
}
describe('BoundedLRUCache', () => {
    test('complex flow', () => {
        const cache = new BoundedLRUCache<string, Tile>(10, (removed) => {
            expect(removed).toBe(tileA);
        });
        expect(cache.get(idC)).toBeUndefined();
        cache.set(idA, tileA);
        keysExpected(cache, [idA]);
        expect(cache.get(idA)).toBe(tileA);
        cache.remove(idA);
        expect(cache.get(idA)).toBeUndefined();
        keysExpected(cache, []);
    });

    test('get without removing', () => {
        const cache = new BoundedLRUCache<string, Tile>(10, () => {
            throw new Error('test "get without removing" failed');
        });
        cache.set(idA, tileA);
        expect(cache.get(idA)).toBe(tileA);
        keysExpected(cache, [idA]);
        expect(cache.get(idA)).toBe(tileA);
    });

    test('duplicate set', () => {
        const cache = new BoundedLRUCache<string, Tile>(10);
        cache.set(idA, tileA);
        cache.set(idA, tileA2);

        keysExpected(cache, [idA]);
        expect(cache.get(idA)).toBe(tileA2);
    });

    test('remove', () => {
        const cache = new BoundedLRUCache<string, Tile>(10, () => {});

        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);

        keysExpected(cache, [idA, idB, idC]);
        expect(cache.get(idB)).toBe(tileB);
        cache.remove(idB);

        keysExpected(cache, [idA, idC]);
        expect(cache.get(idB)).toBeUndefined();
        expect(() => cache.remove(idB)).not.toThrow();
    });

    test('overflow', () => {
        const cache = new BoundedLRUCache<string, Tile>(1, (removed) => {
            expect(removed).toBe(tileA);
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);

        expect(cache.get(idB)).toBeTruthy();
        expect(cache.get(idA)).toBeFalsy();
    });

    test('.reset', () => {
        let called;
        const cache = new BoundedLRUCache<string, Tile>(10, (removed) => {
            expect(removed).toBe(tileA);
            called = true;
        });
        cache.set(idA, tileA);
        cache.clear();
        expect(cache.get(idA)).toBeUndefined();
        expect(called).toBeTruthy();
    });

    test('.setMaxSize', () => {
        let numRemoved = 0;
        const cache = new BoundedLRUCache<string, Tile>(10, () => {
            numRemoved++;
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);
        expect(numRemoved).toBe(0);
        cache.setMaxSize(15);
        expect(numRemoved).toBe(0);
        cache.setMaxSize(1);
        expect(numRemoved).toBe(2);
        cache.set(idD, tileD);
        expect(numRemoved).toBe(3);
    });
});

describe('BoundedLRUCache', () => {
    test('evicts least-recently-used item when capacity exceeded', () => {
        const cache = new BoundedLRUCache<string, number>(2);

        cache.set('a', 1);
        cache.set('b', 2);

        // Access 'a' to make it most-recently-used
        expect(cache.get('a')).toBe(1);

        // Insert 'c' -> should evict 'b' (the least recently used)
        cache.set('c', 3);

        expect(cache.get('b')).toBeUndefined();
        expect(cache.get('a')).toBe(1);
        expect(cache.get('c')).toBe(3);
    });

    test('setting an existing key updates value and makes it most-recently-used', () => {
        const cache = new BoundedLRUCache<string, number>(2);

        cache.set('a', 1);
        cache.set('b', 2);

        // Update 'a' value and it should become most-recently-used
        cache.set('a', 10);
        // Insert 'c' -> should evict 'b'
        cache.set('c', 3);

        expect(cache.get('b')).toBeUndefined();
        expect(cache.get('a')).toBe(10);
        expect(cache.get('c')).toBe(3);
    });

    test('capacity 1 evicts previous entry on new set', () => {
        const cache = new BoundedLRUCache<string, string>(1);

        cache.set('x', 'first');
        expect(cache.get('x')).toBe('first');

        cache.set('y', 'second');
        expect(cache.get('x')).toBeUndefined();
        expect(cache.get('y')).toBe('second');
    });

    test('clear removes all entries', () => {
        const cache = new BoundedLRUCache<number, string>(3);
        cache.set(1, 'one');
        cache.set(2, 'two');

        expect(cache.get(1)).toBe('one');
        expect(cache.get(2)).toBe('two');

        cache.clear();

        expect(cache.get(1)).toBeUndefined();
        expect(cache.get(2)).toBeUndefined();
    });
});
