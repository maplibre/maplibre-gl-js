import TileCache from '../source/tile_cache';
import {OverscaledTileID} from '../source/tile_id';

const idA = new OverscaledTileID(10, 0, 10, 0, 1);
const idB = new OverscaledTileID(10, 0, 10, 0, 2);
const idC = new OverscaledTileID(10, 0, 10, 0, 3);
const idD = new OverscaledTileID(10, 0, 10, 0, 4);
const tileA = {tileID: idA};
const tileA2 = {tileID: idA};
const tileB = {tileID: idB};
const tileC = {tileID: idC};
const tileD = {tileID: idD};

function keysExpected(t, cache, ids) {
    expect(cache.order).toEqual(ids.map((id) => id.key));
}

describe('TileCache', () => {
    const cache = new TileCache(10, (removed) => {
        expect(removed).toBe('dc');
    });
    expect(cache.getAndRemove(idC)).toBe(null);
    expect(cache.add(idA, tileA)).toBe(cache);
    keysExpected(t, cache, [idA]);
    expect(cache.has(idA)).toBe(true);
    expect(cache.getAndRemove(idA)).toBe(tileA);
    expect(cache.getAndRemove(idA)).toBe(null);
    expect(cache.has(idA)).toBe(false);
    keysExpected(t, cache, []);
});

describe('TileCache - getWithoutRemoving', () => {
    const cache = new TileCache(10, () => {
        t.fail();
    });
    expect(cache.add(idA, tileA)).toBe(cache);
    expect(cache.get(idA)).toBe(tileA);
    keysExpected(t, cache, [idA]);
    expect(cache.get(idA)).toBe(tileA);
});

describe('TileCache - duplicate add', () => {
    const cache = new TileCache(10, () => {
        t.fail();
    });

    cache.add(idA, tileA);
    cache.add(idA, tileA2);

    keysExpected(t, cache, [idA, idA]);
    expect(cache.has(idA)).toBeTruthy();
    expect(cache.getAndRemove(idA)).toBe(tileA);
    expect(cache.has(idA)).toBeTruthy();
    expect(cache.getAndRemove(idA)).toBe(tileA2);
});

describe('TileCache - expiry', () => {
    const cache = new TileCache(10, (removed) => {
        expect(cache.has(idB)).toBeTruthy();
        expect(removed).toBe(tileA2);
    });

    cache.add(idB, tileB, 0);
    cache.getAndRemove(idB);
    // removing clears the expiry timeout
    cache.add(idB);

    cache.add(idA, tileA);
    cache.add(idA, tileA2, 0); // expires immediately and `onRemove` is called.
});

describe('TileCache - remove', () => {
    const cache = new TileCache(10, () => {});

    cache.add(idA, tileA);
    cache.add(idB, tileB);
    cache.add(idC, tileC);

    keysExpected(t, cache, [idA, idB, idC]);
    expect(cache.has(idB)).toBeTruthy();

    cache.remove(idB);

    keysExpected(t, cache, [idA, idC]);
    expect(cache.has(idB)).toBeFalsy();

    expect(cache.remove(idB)).toBeTruthy();

});

describe('TileCache - overflow', () => {
    const cache = new TileCache(1, (removed) => {
        expect(removed).toBe(tileA);
    });
    cache.add(idA, tileA);
    cache.add(idB, tileB);

    expect(cache.has(idB)).toBeTruthy();
    expect(cache.has(idA)).toBeFalsy();
});

describe('TileCache#reset', () => {
    let called;
    const cache = new TileCache(10, (removed) => {
        expect(removed).toBe(tileA);
        called = true;
    });
    cache.add(idA, tileA);
    expect(cache.reset()).toBe(cache);
    expect(cache.has(idA)).toBe(false);
    expect(called).toBeTruthy();
});

describe('TileCache#setMaxSize', () => {
    let numRemoved = 0;
    const cache = new TileCache(10, () => {
        numRemoved++;
    });
    cache.add(idA, tileA);
    cache.add(idB, tileB);
    cache.add(idC, tileC);
    expect(numRemoved).toBe(0);
    cache.setMaxSize(15);
    expect(numRemoved).toBe(0);
    cache.setMaxSize(1);
    expect(numRemoved).toBe(2);
    cache.add(idD, tileD);
    expect(numRemoved).toBe(3);
});
