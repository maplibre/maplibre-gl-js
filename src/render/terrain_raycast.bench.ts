import {bench, describe} from 'vitest';
import Point from '@mapbox/point-geometry';
import {DEMData} from '../data/dem_data.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RGBAImage} from '../util/image.ts';
import {Terrain} from './terrain.ts';
import type {Tile} from '../tile/tile.ts';
import type {Painter} from './painter.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';

const DEM_DIM = 256;

function createDEM(heightFn: (x: number, y: number) => number): DEMData {
    const stride = DEM_DIM + 2;
    const pixels = new Uint8Array(stride * stride * 4);
    for (let y = 0; y < DEM_DIM; y++) {
        for (let x = 0; x < DEM_DIM; x++) {
            const value = heightFn(x, y) + 32768;
            const index = ((y + 1) * stride + x + 1) * 4;
            pixels[index] = Math.floor(value / 256);
            pixels[index + 1] = Math.floor(value) % 256;
            pixels[index + 2] = Math.round((value - Math.floor(value)) * 256);
            pixels[index + 3] = 255;
        }
    }
    return new DEMData('dem', new RGBAImage({width: stride, height: stride}, pixels), 'terrarium');
}

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

    const dem = createDEM(heightFn);
    const terrain = new Terrain({} as Painter, {_source: {tileSize: 512, minzoom: 0, maxzoom: 22}} as TileManager, {exaggeration: 1} as TerrainSpecification);
    terrain.tileManager.getRenderableTiles = () => tileIDs.map(tileID => ({tileID}) as Tile);
    terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem}) as Tile;
    terrain.tileManager.getSource = () => ({minzoom: 0, maxzoom: 22}) as any;
    return {terrain, transform};
}

const flat = (zoom: number) => createScene(zoom, () => 800, 50);
const sloped = (zoom: number) => createScene(zoom, (x, y) => 400 + 8 * x + 6 * y, 50);
const sky = (zoom: number) => createScene(zoom, () => 0, 80);

function pick(scene: {terrain: Terrain; transform: MercatorTransform}, p: Point): void {
    scene.transform.screenTerrainPointToMercatorCoordinate(p, scene.terrain);
}

describe('terrain raycast', () => {
    for (const zoom of [2, 10, 16]) {
        const flatScene = flat(zoom);
        bench(`flat hit z${zoom}`, () => {
            pick(flatScene, new Point(512, 600));
        });

        const slopedScene = sloped(zoom);
        bench(`sloped hit z${zoom}`, () => {
            pick(slopedScene, new Point(512, 600));
        });

        const skyScene = sky(zoom);
        bench(`sky miss z${zoom}`, () => {
            pick(skyScene, new Point(512, 20));
        });
    }
});
