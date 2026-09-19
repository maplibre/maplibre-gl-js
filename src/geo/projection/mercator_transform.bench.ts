import {test} from 'vitest';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {createDEM, createDEMTerrain} from '../../util/test/util.ts';
import {coveringTiles} from './covering_tiles.ts';

import type {Terrain} from '../../render/terrain.ts';
import type {Tile} from '../../tile/tile.ts';

const DEM_DIM = 256;

function createScene(zoom: number, heightFn: (x: number, y: number) => number, pitch: number): {terrain: Terrain; transform: MercatorTransform} {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    transform.resize(1024, 1024);
    transform.setCenter(new LngLat(11.4, 47.3));
    transform.setZoom(zoom);
    transform.setPitch(pitch);

    const tileZoom = Math.max(Math.floor(zoom) - 1, 0);
    const scale = 1 << tileZoom;
    const center = MercatorCoordinate.fromLngLat(transform.center);
    const centerX = Math.floor(center.x * scale);
    const centerY = Math.floor(center.y * scale);
    const tileIDs: OverscaledTileID[] = [];
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (x < 0 || y < 0 || x >= scale || y >= scale) continue;
            tileIDs.push(new OverscaledTileID(tileZoom, 0, tileZoom, x, y));
        }
    }

    const terrain = createDEMTerrain(tileIDs, createDEM(heightFn, DEM_DIM));
    return {terrain, transform};
}

const scenes = [2, 10, 16].flatMap(zoom => [
    {name: `flat hit z${zoom}`, point: new Point(512, 600), ...createScene(zoom, () => 800, 50)},
    {name: `sloped hit z${zoom}`, point: new Point(512, 600), ...createScene(zoom, (x, y) => 400 + 8 * x + 6 * y, 50)},
    {name: `sky miss z${zoom}`, point: new Point(512, 20), ...createScene(zoom, () => 0, 80)},
]);

test('terrain raycast', async ({bench}) => {
    await bench.compare(...scenes.map(({name, point, transform, terrain}) => bench(name, () => {
        transform.screenTerrainPointToMercatorCoordinate(point, terrain);
    })));
});

// A whole-screen sweep of a steeply pitched terrain view, the way an application samples what is
// on screen (e.g. to decide which tiles to load first): the renderable terrain tiles are the
// real covering set of the view — fine near the camera, coarse towards the horizon — so the
// raycasts cross many tiles and zoom levels, which is what the coverage index lookup costs.
const sweeps = [45, 70].map(pitch => {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    transform.resize(1280, 800);
    transform.setCenter(new LngLat(-25.1138, 72.87232));
    transform.setZoom(13.59);
    transform.setPitch(pitch);
    const tiles = coveringTiles(transform, {tileSize: 256, minzoom: 4, maxzoom: 15});
    const terrain = createDEMTerrain(tiles, createDEM((x, y) => 400 + 300 * Math.sin(x / 20) * Math.cos(y / 30), DEM_DIM));
    // coastal relief: most tiles flat sea, one in four mountains — rays spend most of their
    // length far above the tiles they cross (what empty-space skipping is for)
    const sea = createDEM(() => 0, DEM_DIM);
    const peak = createDEM((x, y) => 900 + 600 * Math.sin(x / 20) * Math.cos(y / 30), DEM_DIM);
    const coast = createDEMTerrain(tiles, sea);
    coast.tileManager.getSourceTile = (tileID) =>
        ({tileID, dem: (tileID.canonical.x * 7 + tileID.canonical.y * 3) % 4 === 0 ? peak : sea}) as Tile;
    return [{name: `16x12 grid, pitch ${pitch} (${tiles.length} tiles)`, transform, terrain},
        {name: `16x12 grid, pitch ${pitch}, coast`, transform, terrain: coast}];
}).flat();

test('terrain raycast, pitched screen sweep', async ({bench}) => {
    await bench.compare(...sweeps.map(({name, transform, terrain}) => bench(name, () => {
        for (let iy = 0; iy <= 12; iy++) for (let ix = 0; ix <= 16; ix++) {
            transform.screenTerrainPointToMercatorCoordinate(new Point(1280 * ix / 16, 800 * iy / 12), terrain);
        }
    })));
});
