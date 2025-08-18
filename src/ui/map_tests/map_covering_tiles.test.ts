import {describe, vi, expect, test, beforeEach, afterEach} from 'vitest';
import {createMap} from '../../util/test/util';

vi.stubGlobal('ResizeObserver', vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
})));

let map;

beforeEach(async () => {
    map = createMap({
        center: [0, 0],
        zoom: 2,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    });
    await map.once('load');
});

afterEach(() => {
    if (map) map.remove();
});

describe('Map#coveringTiles', () => {
    test('returns an array of tile IDs covering the viewport', () => {
        const tiles = map.coveringTiles({tileSize: 512});
        expect(Array.isArray(tiles)).toBe(true);
        expect(tiles.length).toBeGreaterThan(0);
        expect(tiles[0]).toHaveProperty('canonical');
    });

    test('respects the maxzoom parameter', () => {
        map.setZoom(5);
        const tiles = map.coveringTiles({tileSize: 512, maxzoom: 4});
        for (let i = 0; i < tiles.length; i++) {
            expect(tiles[i].canonical.z).toBe(4);
        }
    });
});