import {describe, test, expect} from 'vitest';
import {type Tile} from './tile';
import {BoundedLRUCache} from './bounded_lru_cache';
import {OverscaledTileID} from './tile_id';

const _idA = new OverscaledTileID(10, 0, 10, 0, 1);
const _idB = new OverscaledTileID(10, 0, 10, 0, 2);
const _idC = new OverscaledTileID(10, 0, 10, 0, 3);
const _idD = new OverscaledTileID(10, 0, 10, 0, 4);
const idA = _idA.key;
const idB = _idB.key;
const idC = _idC.key;
const idD = _idD.key;
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
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: (removed) => {
                expect(removed).toBe(tileA);
            }
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
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                removeCount++;
            }
        });
        cache.set(idA, tileA);
        expect(cache.get(idA)).toBe(tileA);
        keysExpected(cache, [idA]);
        expect(cache.get(idA)).toBe(tileA);
        expect(removeCount).toBe(0);
    });

    test('remove tile calls onRemove', () => {
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                removeCount++;
            }
        });
        cache.set(idA, tileA);
        cache.remove(idA);
        expect(removeCount).toBe(1);
    });

    test('set of same tile id using the same tile retains tile and moves to end without calling remove', () => {
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                removeCount++;
            }
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        keysExpected(cache, [idA, idB]);

        // Set the same tile reference again, but it should not call remove.
        cache.set(idA, tileA);
        expect(removeCount).toBe(0);
        keysExpected(cache, [idB, idA]);
        expect(cache.get(idA)).toBe(tileA);
    });

    test('set of same tile id using a new tile removes previous tile reference and calls remove', () => {
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                removeCount++;
            }
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        keysExpected(cache, [idA, idB]);

        // Set the same tile id but with new tile, remove should be called
        cache.set(idA, tileA2);
        expect(removeCount).toBe(1);
        keysExpected(cache, [idB, idA]);
        expect(cache.get(idA)).toBe(tileA2);
    });

    test('duplicate set of same tile id updates entry to most recently added tile', () => {
        const cache = new BoundedLRUCache<string, Tile>({maxEntries: 10});
        cache.set(idA, tileA);
        cache.set(idA, tileA2);

        keysExpected(cache, [idA]);
        expect(cache.get(idA)).toBe(tileA2);
    });

    test('set of tile over max entries trims the cache', () => {
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 1,
            onRemove: () => {
                removeCount++;
            }
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        keysExpected(cache, [idB]);
        expect(cache.get(idB)).toBe(tileB);

        cache.set(idA, tileA2);
        keysExpected(cache, [idA]);
        expect(cache.get(idA)).toBe(tileA2);

        expect(removeCount).toBe(2);
    });

    test('removes tiles', () => {
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {}
        });

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

    test('removeOldest removes the oldest entry', () => {
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {}
        });

        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);

        cache.removeOldest();
        keysExpected(cache, [idB, idC]);

        cache.set(idC, tileC);
        cache.set(idB, tileB);
        cache.set(idA, tileA);

        cache.removeOldest();
        keysExpected(cache, [idB, idA]);
    });

    test('filters tiles using provided function', () => {
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                removeCount++;
            }
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);
        cache.set(idD, tileD);

        cache.filter(tile => tile.tileID.canonical.y === 2 || tile.tileID.canonical.y === 3);
        keysExpected(cache, [idB, idC]);
        expect(removeCount).toBe(2);

        removeCount = 0;
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);
        cache.set(idD, tileD);
        cache.filter(tile => tile.tileID.canonical.y === 1 || tile.tileID.canonical.y === 4);
        keysExpected(cache, [idA, idD]);
        expect(removeCount).toBe(2);
    });

    test('clear tiles call onRemove on all tiles', () => {
        let removeCount = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                removeCount++;
            }
        });

        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);

        cache.clear();
        keysExpected(cache, []);
        expect(removeCount).toBe(3);
    });

    test('.clear removes all tiles', () => {
        let called;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: (removed) => {
                expect(removed).toBe(tileA);
                called = true;
            }
        });
        cache.set(idA, tileA);
        cache.clear();
        expect(cache.get(idA)).toBeUndefined();
        expect(called).toBeTruthy();
    });

    test('overflow automatically evicts', () => {
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 1,
            onRemove: (removed) => {
                expect(removed).toBe(tileA);
            }
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);

        expect(cache.get(idB)).toBeTruthy();
        expect(cache.get(idA)).toBeFalsy();
    });

    test('.setMaxSize trims tile count', () => {
        let numRemoved = 0;
        const cache = new BoundedLRUCache<string, Tile>({
            maxEntries: 10,
            onRemove: () => {
                numRemoved++;
            }
        });
        cache.set(idA, tileA);
        cache.set(idB, tileB);
        cache.set(idC, tileC);
        expect(numRemoved).toBe(0);
        cache.setMaxSize(15);
        expect(numRemoved).toBe(0);
        cache.setMaxSize(1);
        expect(numRemoved).toBe(2);
        keysExpected(cache, [idC]);
        cache.set(idD, tileD);
        expect(numRemoved).toBe(3);
        keysExpected(cache, [idD]);
    });

    test('evicts least-recently-used item when capacity exceeded', () => {
        const cache = new BoundedLRUCache<string, number>({maxEntries: 2});

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
        const cache = new BoundedLRUCache<string, number>({maxEntries: 2});

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
        const cache = new BoundedLRUCache<string, string>({maxEntries: 1});

        cache.set('x', 'first');
        expect(cache.get('x')).toBe('first');

        cache.set('y', 'second');
        expect(cache.get('x')).toBeUndefined();
        expect(cache.get('y')).toBe('second');
    });

    test('clear removes all entries', () => {
        const cache = new BoundedLRUCache<number, string>({maxEntries: 3});
        cache.set(1, 'one');
        cache.set(2, 'two');

        expect(cache.get(1)).toBe('one');
        expect(cache.get(2)).toBe('two');

        cache.clear();

        expect(cache.get(1)).toBeUndefined();
        expect(cache.get(2)).toBeUndefined();
    });
});
