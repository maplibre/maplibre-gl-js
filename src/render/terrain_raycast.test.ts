import {describe, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {DEMData} from '../data/dem_data.ts';
import {EXTENT} from '../data/extent.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {GlobeTransform} from '../geo/projection/globe_transform.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {RGBAImage} from '../util/image.ts';
import {Terrain} from './terrain.ts';
import {raycastTerrainGlobe, raycastTerrainMercator} from './terrain_raycast.ts';
import type {Tile} from '../tile/tile.ts';
import type {Painter} from './painter.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';

const DEM_DIM = 8;

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

function createTerrain(tileIDs: OverscaledTileID[], dem: DEMData | null, exaggeration: number = 1): Terrain {
    const painter = {} as Painter;
    const tileManager = {_source: {tileSize: 512, minzoom: 0, maxzoom: 22}} as TileManager;
    const terrain = new Terrain(painter, tileManager, {exaggeration} as TerrainSpecification);
    terrain.tileManager.getRenderableTiles = () => tileIDs.map(tileID => ({tileID}) as Tile);
    terrain.tileManager.getSourceTile = (tileID) => (dem ? {tileID, dem} as Tile : undefined);
    terrain.tileManager.getSource = () => ({minzoom: 0, maxzoom: 22}) as any;
    return terrain;
}

function createMercatorTransform(center: LngLat, zoom: number, pitch: number = 0): MercatorTransform {
    const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
    transform.resize(512, 512);
    transform.setCenter(center);
    transform.setZoom(zoom);
    transform.setPitch(pitch);
    return transform;
}

function createRayTransform(near: number[], far: number[], worldSize: number): MercatorTransform {
    return {worldSize, getRaySegmentFromPixel: () => ({near, far})} as any as MercatorTransform;
}

function expectWorldPixelsClose(actual: MercatorCoordinate, expected: MercatorCoordinate, worldSize: number): void {
    expect(Math.abs(actual.x - expected.x) * worldSize).toBeLessThan(1e-3);
    expect(Math.abs(actual.y - expected.y) * worldSize).toBeLessThan(1e-3);
}

describe('raycastTerrainMercator', () => {
    test('matches the plane intersection for a flat DEM', () => {
        const height = 500;
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height));
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 45);

        for (const p of [new Point(256, 256), new Point(100, 400), new Point(400, 300)]) {
            const result = raycastTerrainMercator(transform, terrain, p);
            expect(result).not.toBeNull();
            expectWorldPixelsClose(result, transform.screenPointToMercatorCoordinateAtZ(p, height), transform.worldSize);
            expect(result.z).toBeCloseTo(height, 10);
        }
    });

    test('applies the terrain exaggeration to the hit elevation', () => {
        const height = 300;
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => height), 2.5);
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 30);

        const result = raycastTerrainMercator(transform, terrain, new Point(256, 256));

        expect(result.z).toBeCloseTo(height * 2.5, 10);
        expectWorldPixelsClose(result, transform.screenPointToMercatorCoordinateAtZ(new Point(256, 256), height * 2.5), transform.worldSize);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createTerrain([tileID], createDEM((x) => x * 400));
        const transform = createMercatorTransform(new LngLat(0, 0), 3, 60);

        for (const p of [new Point(200, 300), new Point(256, 350), new Point(330, 420)]) {
            const result = raycastTerrainMercator(transform, terrain, p);
            expect(result).not.toBeNull();
            const elevation = terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT);
            expect(elevation).toBeCloseTo(result.z, 6);
        }
    });

    test('follows a ramp across a tile boundary', () => {
        const tileIDs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => new OverscaledTileID(1, 0, 1, x, y));
        const terrain = createTerrain(tileIDs, createDEM((x) => x * 200));
        const transform = createMercatorTransform(new LngLat(0, 40), 2, 50);
        const crossed = new Set<number>();

        for (const p of [new Point(180, 300), new Point(256, 300), new Point(340, 300)]) {
            const result = raycastTerrainMercator(transform, terrain, p);
            expect(result).not.toBeNull();
            const tileX = Math.floor(result.x * 2);
            const tileY = Math.floor(result.y * 2);
            crossed.add(tileX);
            const tileID = new OverscaledTileID(1, 0, 1, tileX, tileY);
            const elevation = terrain.getElevation(tileID, (result.x * 2 - tileX) * EXTENT, (result.y * 2 - tileY) * EXTENT, EXTENT);
            expect(elevation).toBeCloseTo(result.z, 6);
        }

        expect(crossed.size).toBe(2);
    });

    test('returns null for a ray into the sky', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 80);

        expect(raycastTerrainMercator(transform, terrain, new Point(256, 0))).toBeNull();
    });

    test('returns null when nothing is renderable', () => {
        const terrain = createTerrain([], null);
        const transform = createMercatorTransform(new LngLat(0, 0), 4);

        expect(raycastTerrainMercator(transform, terrain, new Point(256, 256))).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 40);
        const p = new Point(256, 300);

        const result = raycastTerrainMercator(transform, terrain, p);

        expect(result.z).toBe(0);
        expectWorldPixelsClose(result, transform.screenPointToMercatorCoordinateAtZ(p, 0), transform.worldSize);
    });

    test('returns coordinates outside the central world for wrapped copies', () => {
        const tileIDs = [-1, 0, 1, 2].map(wrap => new OverscaledTileID(0, wrap, 0, 0, 0));
        const terrain = createTerrain(tileIDs, createDEM(() => 0));
        const transform = createMercatorTransform(new LngLat(0, 0), 0);
        transform.resize(2048, 512);

        const leftPoint = new Point(600, 256);
        const rightPoint = new Point(1500, 256);
        const left = raycastTerrainMercator(transform, terrain, leftPoint);
        const right = raycastTerrainMercator(transform, terrain, rightPoint);

        expect(left.x).toBeLessThan(0);
        expect(right.x).toBeGreaterThan(1);
        expectWorldPixelsClose(left, transform.screenPointToMercatorCoordinateAtZ(leftPoint, 0), transform.worldSize);
        expectWorldPixelsClose(right, transform.screenPointToMercatorCoordinateAtZ(rightPoint, 0), transform.worldSize);
    });

    test('samples overscaled tiles from their parent DEM', () => {
        const tileID = new OverscaledTileID(15, 0, 14, 8192, 8192);
        const parent = new OverscaledTileID(13, 0, 13, 4096, 4096);
        const dem = createDEM((x) => x * 100);
        const terrain = createTerrain([tileID], dem);
        terrain.tileManager.getSourceTile = () => ({tileID: parent, dem}) as Tile;
        const scale = 1 << tileID.canonical.z;
        const center = new MercatorCoordinate((tileID.canonical.x + 0.5) / scale, (tileID.canonical.y + 0.5) / scale).toLngLat();
        const transform = createMercatorTransform(center, 15, 30);

        const result = raycastTerrainMercator(transform, terrain, new Point(256, 256));

        expect(result).not.toBeNull();
        expect(result.z).toBeGreaterThan(0);
    });

    test('samples the far tile edge without throwing', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createTerrain([tileID], createDEM(() => 100));

        expect(() => terrain.getElevation(tileID, EXTENT - 1e-9, EXTENT - 1e-9, EXTENT)).not.toThrow();

        const transform = createMercatorTransform(new LngLat(179.999, -85), 6, 0);
        expect(() => raycastTerrainMercator(transform, terrain, new Point(256, 256))).not.toThrow();
    });

    test('skips renderable tiles that have no terrain tile yet', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 100));
        const tiles = terrain.tileManager.getRenderableTiles();
        terrain.tileManager.getRenderableTiles = () => [null, ...tiles];
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 30);

        expect(raycastTerrainMercator(transform, terrain, new Point(256, 256)).z).toBeCloseTo(100, 6);
    });

    test('samples the highest zoom tile covering the position', () => {
        const parentID = new OverscaledTileID(0, 0, 0, 0, 0);
        const childID = new OverscaledTileID(1, 0, 1, 0, 0);
        const parentDEM = createDEM(() => 100);
        const childDEM = createDEM(() => 900);
        const terrain = createTerrain([parentID, childID], parentDEM);
        terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem: tileID.canonical.z === 1 ? childDEM : parentDEM}) as Tile;
        const transform = createMercatorTransform(new LngLat(0, 0), 1, 0);

        expect(raycastTerrainMercator(transform, terrain, new Point(128, 128)).z).toBeCloseTo(900, 6);
        expect(raycastTerrainMercator(transform, terrain, new Point(384, 384)).z).toBeCloseTo(100, 6);
    });

    test('returns null for a ray leaving the world vertically', () => {
        const terrain = createTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const transform = createMercatorTransform(new LngLat(0, 0), 1, 0);

        expect(raycastTerrainMercator(transform, terrain, new Point(400, 400))).toBeNull();
    });

    test('handles a ray with no vertical component', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createTerrain([tileID], createDEM((x) => x * 200));
        const worldSize = 512;

        const crossing = createRayTransform([0, 256, 500], [512, 256, 500], worldSize);
        expect(raycastTerrainMercator(crossing, terrain, new Point(0, 0))).not.toBeNull();

        const aboveEverything = createRayTransform([0, 256, 5000], [512, 256, 5000], worldSize);
        expect(raycastTerrainMercator(aboveEverything, terrain, new Point(0, 0))).toBeNull();
    });

    test('returns null while the ray stays inside the terrain', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createTerrain([tileID], createDEM(() => 100));
        const transform = createRayTransform([256, 256, -100], [300, 256, 100], 512);

        expect(raycastTerrainMercator(transform, terrain, new Point(0, 0))).toBeNull();
    });

    test('does not read the painter', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 100));
        Object.defineProperty(terrain, 'painter', {
            get() { throw new Error('the raycast must not touch the painter'); }
        });
        const transform = createMercatorTransform(new LngLat(0, 0), 4, 30);

        expect(raycastTerrainMercator(transform, terrain, new Point(256, 256))).not.toBeNull();
    });
});

describe('raycastTerrainGlobe', () => {
    function createGlobeTransform(center: LngLat, zoom: number): GlobeTransform {
        const transform = new GlobeTransform();
        transform.resize(512, 512);
        transform.setCenter(center);
        transform.setZoom(zoom);
        return transform;
    }

    test('hits the terrain under the globe center', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 1000));
        const transform = createGlobeTransform(new LngLat(0, 0), 1);

        const result = raycastTerrainGlobe(transform, terrain, new Point(256, 256));

        expect(result).not.toBeNull();
        expect(result.z).toBeCloseTo(1000, 6);
        expect(result.x).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).x, 6);
        expect(result.y).toBeCloseTo(MercatorCoordinate.fromLngLat(new LngLat(0, 0)).y, 6);
    });

    test('returns null for a ray that misses the planet', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createGlobeTransform(new LngLat(0, 0), 0);

        expect(raycastTerrainGlobe(transform, terrain, new Point(0, 0))).toBeNull();
    });

    test('caps the poles at elevation zero', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 2000));
        const transform = createGlobeTransform(new LngLat(0, 90), 1);

        expect(raycastTerrainGlobe(transform, terrain, new Point(256, 256)).z).toBeCloseTo(2000, 6);

        const beyondTheMercatorEdge = raycastTerrainGlobe(transform, terrain, new Point(256, 200));

        expect(beyondTheMercatorEdge).not.toBeNull();
        expect(beyondTheMercatorEdge.z).toBe(0);
    });

    test('returns null when nothing is renderable', () => {
        const terrain = createTerrain([], null);
        const transform = createGlobeTransform(new LngLat(0, 0), 1);

        expect(raycastTerrainGlobe(transform, terrain, new Point(256, 256))).toBeNull();
    });

    test('returns null for a ray that hits the planet outside the renderable tiles', () => {
        const terrain = createTerrain([new OverscaledTileID(1, 0, 1, 0, 0)], createDEM(() => 0));
        const transform = createGlobeTransform(new LngLat(90, -45), 1);

        expect(raycastTerrainGlobe(transform, terrain, new Point(256, 256))).toBeNull();
    });

    test('hits a renderable tile whose DEM has not loaded at elevation zero', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], null);
        const transform = createGlobeTransform(new LngLat(0, 0), 1);

        const result = raycastTerrainGlobe(transform, terrain, new Point(256, 256));

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
        expect(result.x).toBeCloseTo(0.5, 6);
        expect(result.y).toBeCloseTo(0.5, 6);
    });

    test('hits entirely flat terrain at elevation zero', () => {
        const terrain = createTerrain([new OverscaledTileID(0, 0, 0, 0, 0)], createDEM(() => 0));
        const transform = createGlobeTransform(new LngLat(0, 0), 1);

        const result = raycastTerrainGlobe(transform, terrain, new Point(256, 256));

        expect(result).not.toBeNull();
        expect(result.z).toBe(0);
    });

    test('the hit elevation matches the terrain elevation at the hit position', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const terrain = createTerrain([tileID], createDEM((x, y) => 500 * x + 300 * y));
        const transform = createGlobeTransform(new LngLat(0, 0), 2);

        for (const p of [new Point(256, 256), new Point(230, 280), new Point(300, 220)]) {
            const result = raycastTerrainGlobe(transform, terrain, p);
            expect(result).not.toBeNull();
            expect(terrain.getElevation(tileID, result.x * EXTENT, result.y * EXTENT, EXTENT)).toBeCloseTo(result.z, 3);
        }
    });
});
