import {test, expect, describe} from 'vitest';
import {CanonicalTileID} from './tile_id';
import {tileIdToLngLatBounds} from './tile_id_to_lng_lat_bounds';

describe('tileIdToLngLatBounds', () => {
    test('tile 0/0/0 covers the full world', () => {
        const bounds =  tileIdToLngLatBounds(new CanonicalTileID(0, 0, 0));
        expect(bounds.getWest()).toBeCloseTo(-180, 0);
        expect(bounds.getEast()).toBeCloseTo(180, 0);
        expect(bounds.getSouth()).toBeCloseTo(-85, 0);
        expect(bounds.getNorth()).toBeCloseTo(85, 0);
    });

    test('tile 1/1/1', () => {
        const bounds = tileIdToLngLatBounds(new CanonicalTileID(1, 1, 1));
        expect(bounds.getWest()).toBeCloseTo(0, 0);
        expect(bounds.getEast()).toBeCloseTo(180, 0);
        expect(bounds.getSouth()).toBeCloseTo(-85, 0);
        expect(bounds.getNorth()).toBeCloseTo(0, 0);
    });

    test('with buffer', () => {
        const bounds = tileIdToLngLatBounds(new CanonicalTileID(1, 0, 0), 0.25);
        const boundsNoBuffer = tileIdToLngLatBounds(new CanonicalTileID(1, 0, 0), 0);

        // With buffer, bounds should extend beyond the no-buffer bounds
        expect(bounds.getWest()).toBeLessThan(boundsNoBuffer.getWest());
        expect(bounds.getEast()).toBeGreaterThan(boundsNoBuffer.getEast());
        expect(bounds.getSouth()).toBeLessThan(boundsNoBuffer.getSouth());
        expect(bounds.getNorth()).toBeGreaterThan(boundsNoBuffer.getNorth());
    });
});
