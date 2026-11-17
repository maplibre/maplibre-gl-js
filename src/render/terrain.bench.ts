import {test} from 'vitest';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {Tile} from '../tile/tile.ts';
import {Terrain} from './terrain.ts';
import {createDEM, createRasterDEMTileManager} from '../util/test/util.ts';

/** How many times a frame asks for the elevations of the tiles it tests: once per source, the terrain and the background. */
const LOOKUPS_PER_FRAME = 6;

const tileIDs: OverscaledTileID[] = [];
for (let x = 540; x < 552; x++) {
    for (let y = 350; y < 360; y++) {
        tileIDs.push(new OverscaledTileID(10, 0, 10, x, y));
    }
}

function createTerrain(): Terrain {
    return new Terrain(null, createRasterDEMTileManager(), {source: 'dem'});
}

function getMinMaxElevations(terrain: Terrain): void {
    for (let i = 0; i < LOOKUPS_PER_FRAME; i++) {
        for (const tileID of tileIDs) {
            terrain.getMinMaxElevation(tileID);
        }
    }
}

test('getMinMaxElevation', async ({bench}) => {
    const withoutDEM = createTerrain();
    const withoutDEMReset = createTerrain();
    const withDEM = createTerrain();
    const demTile = new Tile(tileIDs[0], 512);
    demTile.dem = createDEM(() => 1500);
    withDEM.tileManager.findTileInCaches = () => demTile;

    await bench.compare(
        bench('tiles without DEM data', () => {
            getMinMaxElevations(withoutDEM);
        }),
        bench('tiles without DEM data, after resetElevationCache', () => {
            withoutDEMReset.resetElevationCache();
            getMinMaxElevations(withoutDEMReset);
        }),
        bench('tiles with DEM data', () => {
            getMinMaxElevations(withDEM);
        }),
    );
});
