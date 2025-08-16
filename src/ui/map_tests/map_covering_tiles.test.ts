import {describe, vi, expect, test} from 'vitest';
import {createMap} from '../../util/test/util';

vi.stubGlobal('ResizeObserver', vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
})));

describe('Map#coveringTiles', () => {
    test('returns an array of tile IDs covering the viewport', () => {
        const map = createMap({
            center: [0, 0],
            zoom: 2,
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });

        map.on('load', () => {
            const tiles = map.coveringTiles({tileSize: 512});
            expect(Array.isArray(tiles)).toBe(true);
            expect(tiles.length).toBeGreaterThan(0);
            expect(tiles[0]).toHaveProperty('canonical');
            map.remove();
        });
    });

    test('respects the maxzoom parameter', () => {
        const map = createMap({
            zoom: 5,
            style: {version: 8, sources: {}, layers: []}
        });

        map.on('load', () => {
            const tiles = map.coveringTiles({tileSize: 512, maxzoom: 4});
            tiles.forEach(tile => {
                expect(tile.canonical.z).toBe(4);
            });
            map.remove();
        });
    });
});