import {describe, expect, test} from 'vitest';
import {EXTENT} from '../../data/extent.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {getTileAntimeridianClip} from './projection_data.ts';

describe('getTileAntimeridianClip', () => {
    test('clips the zoom 0 tile to its extent', () => {
        expect(getTileAntimeridianClip(new OverscaledTileID(0, 0, 0, 0, 0))).toEqual([0, EXTENT]);
    });

    test('clips overscaled tiles with a canonical zoom of 0', () => {
        expect(getTileAntimeridianClip(new OverscaledTileID(3, 0, 0, 0, 0))).toEqual([0, EXTENT]);
    });

    test('does not clip tiles at zoom 1+, including antimeridian-edge tiles', () => {
        for (const tileID of [
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(4, 0, 4, 0, 7),
            new OverscaledTileID(4, 0, 4, 15, 7),
            new OverscaledTileID(4, 0, 4, 5, 5),
        ]) {
            const [min, max] = getTileAntimeridianClip(tileID);
            expect(min).toBeLessThan(-EXTENT);
            expect(max).toBeGreaterThan(2 * EXTENT);
        }
    });

    test('does not clip when no tile ID is given', () => {
        const [min, max] = getTileAntimeridianClip(null);
        expect(min).toBeLessThan(-EXTENT);
        expect(max).toBeGreaterThan(2 * EXTENT);
    });
});
