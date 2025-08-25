import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {beforeMapTest, createMap} from '../../util/test/util';
import {type Map} from '../map';

let map: Map;

beforeEach(async () => {
    beforeMapTest();
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

describe('Map.coveringTiles', () => {
    test('returns an array of tile IDs covering the viewport', () => {
        const tiles = map.coveringTiles({tileSize: 512});
        expect(Array.isArray(tiles)).toBe(true);
        expect(tiles.length).toBeGreaterThan(0);
    });

    test('respects the maxzoom parameter', () => {
        map.setZoom(5);
        const tiles = map.coveringTiles({tileSize: 512, maxzoom: 4});

        expect(tiles.every(tile => tile.canonical.z === 4)).toBeTruthy();
    });
});