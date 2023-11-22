import Point from '@mapbox/point-geometry';
import {Terrain} from './terrain';
import gl from 'gl';
import {Context} from '../gl/context';
import {RGBAImage} from '../util/image';
import {Texture} from './texture';
import type {SourceCache} from '../source/source_cache';
import {OverscaledTileID} from '../source/tile_id';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {DEMData} from '../data/dem_data';
import {Tile} from '../source/tile';
import {Painter} from './painter';
import {mat4} from 'gl-matrix';
import {LngLat} from '../geo/lng_lat';

describe('Terrain', () => {
    test('pointCoordiate should not return null', () => {
        expect.assertions(1);
        const painter = {
            context: new Context(gl(1, 1) as any),
            width: 1,
            height: 1,
            transform: {center: {lng: 0}}
        } as any as Painter;
        const sourceCache = {} as SourceCache;
        const getTileByID = (tileID) : Tile => {
            if (tileID !== 'abcd') {
                return null as any as Tile;
            }
            return {
                tileID: {
                    canonical: {
                        x: 0,
                        y: 0,
                        z: 0
                    }
                }
            } as any as Tile;
        };
        const terrain = new Terrain(painter, sourceCache, {} as any as TerrainSpecification);
        terrain.sourceCache.getTileByID = getTileByID;
        const context = painter.context as Context;
        const pixels = new Uint8Array([0, 0, 255, 255]);
        const image = new RGBAImage({width: 1, height: 1}, pixels);
        const imageTexture = new Texture(context, image, context.gl.RGBA);
        terrain.getFramebuffer('coords'); // allow init of frame buffers
        terrain._fboCoordsTexture.texture = imageTexture.texture;
        terrain.coordsIndex.push('abcd');

        const coordinate = terrain.pointCoordinate(new Point(0, 0));

        expect(coordinate).not.toBeNull();
    });

    const setupMercatorOverflow = (centerLng: number) => {
        const WORLD_WIDTH = 4;
        const painter = {
            context: new Context(gl(WORLD_WIDTH, 1) as any),
            width: WORLD_WIDTH,
            height: 1,
            transform: {center: {lng: centerLng}}
        } as any as Painter;
        const sourceCache = {} as SourceCache;
        const terrain = new Terrain(painter, sourceCache, {} as any as TerrainSpecification);
        const mockTile = {tileID: {canonical: {x: 0, y: 0, z: 0}}};
        terrain.sourceCache.getTileByID = () => mockTile as any as Tile;
        terrain.getElevation = () => 0;
        terrain.coordsIndex = ['abcd'];
        terrain._coordsTextureSize = WORLD_WIDTH;
        const pixels = new Uint8Array([2, 0, 0, 255, 3, 0, 0, 255, 0, 0, 0, 255, 1, 0, 0, 255]);
        const image = new RGBAImage({width: WORLD_WIDTH, height: 1}, pixels);
        const imageTexture = new Texture(painter.context, image, painter.context.gl.RGBA);
        terrain.getFramebuffer('coords'); // allow init of frame buffers
        terrain._fboCoordsTexture.texture = imageTexture.texture;
        return terrain;
    };

    test(
        `pointCoordiate should return negative mercator x
        if center.lng is to the right of 180 meridian
        and a given point is to the left of 180`,
        () => {
            expect.assertions(2);
            const centerLng = -170;
            const pointX = 1; // x in the left half of the 4-px world
            const terrain = setupMercatorOverflow(centerLng);
            const coordinate = terrain.pointCoordinate(new Point(pointX, 0));

            expect(coordinate.x).toBeLessThan(0);
            expect(coordinate.x).toBeGreaterThan(-1);
        });

    test(
        `pointCoordiate should return mercator x greater than 1
        if center.lng is to the left of 180 meridian
        and a given point is to the right of 180`,
        () => {
            expect.assertions(2);
            const centerLng = 170;
            const pointX = 3; // x in the right half of the 4-px world
            const terrain = setupMercatorOverflow(centerLng);
            const coordinate = terrain.pointCoordinate(new Point(pointX, 0));

            expect(coordinate.x).toBeGreaterThan(1);
            expect(coordinate.x).toBeLessThan(2);
        });

    test('Calculate tile minimum and maximum elevation', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const tile = new Tile(tileID, 256);
        tile.dem = {
            min: 0,
            max: 100,
            getPixels: () => new RGBAImage({width: 1, height: 1}, new Uint8Array(1 * 4)),
            getUnpackVector: () => [6553.6, 25.6, 0.1, 10000.0],
        } as any as DEMData;
        const painter = {
            context: new Context(gl(1, 1) as any),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const sourceCache = {
            _source: {maxzoom: 12},
            _cache: {max: 10},
            getTileByID: () => {
                return tile;
            },
        } as any as SourceCache;
        const terrain = new Terrain(
            painter,
            sourceCache,
            {exaggeration: 2} as any as TerrainSpecification,
        );

        terrain.sourceCache._tiles[tileID.key] = tile;
        const {minElevation, maxElevation} = terrain.getMinMaxElevation(tileID);

        expect(minElevation).toBe(0);
        expect(maxElevation).toBe(200);
    });

    test('Return null elevation values when no tile', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const painter = {
            context: new Context(gl(1, 1) as any),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const sourceCache = {
            _source: {maxzoom: 12},
            _cache: {max: 10},
            getTileByID: () => null,
        } as any as SourceCache;
        const terrain = new Terrain(
            painter,
            sourceCache,
            {exaggeration: 2} as any as TerrainSpecification,
        );

        const minMaxNoTile = terrain.getMinMaxElevation(tileID);

        expect(minMaxNoTile.minElevation).toBeNull();
        expect(minMaxNoTile.maxElevation).toBeNull();
    });

    test('Return null elevation values when no DEM', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const tile = new Tile(tileID, 256);
        tile.dem = null as any as DEMData;
        const painter = {
            context: new Context(gl(1, 1) as any),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const sourceCache = {
            _source: {maxzoom: 12},
            _cache: {max: 10},
            getTileByID: () => {
                return tile;
            },
        } as any as SourceCache;
        const terrain = new Terrain(
            painter,
            sourceCache,
            {exaggeration: 2} as any as TerrainSpecification,
        );
        const minMaxNoDEM = terrain.getMinMaxElevation(tileID);

        expect(minMaxNoDEM.minElevation).toBeNull();
        expect(minMaxNoDEM.maxElevation).toBeNull();
    });

    test('create mesh with border', () => {
        let actualIndexArray;
        let actualVertexArray;
        const painter = {
            context: {
                createIndexBuffer: array => { actualIndexArray = Array.from(array.uint16); },
                createVertexBuffer: array => { actualVertexArray = Array.from(array.int16); }
            },
            width: 1,
            height: 1,
        } as any as Painter;
        const sourceCache = {
            _source: {maxzoom: 12},
            _cache: {max: 10}
        } as any as SourceCache;
        const terrain = new Terrain(
            painter,
            sourceCache,
            {exaggeration: 1} as any as TerrainSpecification,
        );
        terrain.meshSize = 4;
        terrain.getTerrainMesh();
        expect(terrain.getMeshFrameDelta(16)).toBe(122.16256373312942);
        expect(actualIndexArray).toStrictEqual([0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 8, 2, 8, 3, 3, 8, 9, 3, 9, 4, 5, 10, 11, 5, 11, 6, 6, 11, 12, 6, 12, 7, 7, 12, 13, 7, 13, 8, 8, 13, 14, 8, 14, 9, 10, 15, 16, 10, 16, 11, 11, 16, 17, 11, 17, 12, 12, 17, 18, 12, 18, 13, 13, 18, 19, 13, 19, 14, 15, 20, 21, 15, 21, 16, 16, 21, 22, 16, 22, 17, 17, 22, 23, 17, 23, 18, 18, 23, 24, 18, 24, 19, 35, 36, 38, 35, 38, 37, 25, 28, 26, 25, 27, 28, 37, 38, 40, 37, 40, 39, 27, 30, 28, 27, 29, 30, 39, 40, 42, 39, 42, 41, 29, 32, 30, 29, 31, 32, 41, 42, 44, 41, 44, 43, 31, 34, 32, 31, 33, 34, 45, 46, 48, 45, 48, 47, 55, 58, 56, 55, 57, 58, 47, 48, 50, 47, 50, 49, 57, 60, 58, 57, 59, 60, 49, 50, 52, 49, 52, 51, 59, 62, 60, 59, 61, 62, 51, 52, 54, 51, 54, 53, 61, 64, 62, 61, 63, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(actualVertexArray).toStrictEqual([0, 0, 0, 2048, 0, 0, 4096, 0, 0, 6144, 0, 0, 8192, 0, 0, 0, 2048, 0, 2048, 2048, 0, 4096, 2048, 0, 6144, 2048, 0, 8192, 2048, 0, 0, 4096, 0, 2048, 4096, 0, 4096, 4096, 0, 6144, 4096, 0, 8192, 4096, 0, 0, 6144, 0, 2048, 6144, 0, 4096, 6144, 0, 6144, 6144, 0, 8192, 6144, 0, 0, 8192, 0, 2048, 8192, 0, 4096, 8192, 0, 6144, 8192, 0, 8192, 8192, 0, 0, 0, 0, 0, 0, 1, 2048, 0, 0, 2048, 0, 1, 4096, 0, 0, 4096, 0, 1, 6144, 0, 0, 6144, 0, 1, 8192, 0, 0, 8192, 0, 1, 0, 8192, 0, 0, 8192, 1, 2048, 8192, 0, 2048, 8192, 1, 4096, 8192, 0, 4096, 8192, 1, 6144, 8192, 0, 6144, 8192, 1, 8192, 8192, 0, 8192, 8192, 1, 0, 0, 0, 0, 0, 1, 0, 2048, 0, 0, 2048, 1, 0, 4096, 0, 0, 4096, 1, 0, 6144, 0, 0, 6144, 1, 0, 8192, 0, 0, 8192, 1, 8192, 0, 0, 8192, 0, 1, 8192, 2048, 0, 8192, 2048, 1, 8192, 4096, 0, 8192, 4096, 1, 8192, 6144, 0, 8192, 6144, 1, 8192, 8192, 0, 8192, 8192, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    test('interpolation works', () => {
        const mockTerrain = {
            getDEMElevation: Terrain.prototype.getDEMElevation,
            getTerrainData() {
                return {
                    // eslint-disable-next-line camelcase
                    u_terrain_matrix: mat4.create(),
                    tile: {
                        dem: {
                            dim: 1,
                            get(x:number, y:number) {
                                expect(x % 1).toBe(0);
                                expect(y % 1).toBe(0);
                                return 100 * x + 10 * y;
                            }
                        }
                    }
                };
            }
        };
        expect(mockTerrain.getDEMElevation(null, 0, 0)).toBeCloseTo(0);
        expect(mockTerrain.getDEMElevation(null, 1, 1)).toBeCloseTo(110);
        expect(mockTerrain.getDEMElevation(null, 0, 0.5)).toBeCloseTo(5);
        expect(mockTerrain.getDEMElevation(null, 1, 0.5)).toBeCloseTo(105);
        expect(mockTerrain.getDEMElevation(null, 0.5, 0)).toBeCloseTo(50);
        expect(mockTerrain.getDEMElevation(null, 0.5, 1)).toBeCloseTo(60);
        expect(mockTerrain.getDEMElevation(null, 0.4, 0.2)).toBeCloseTo(42);
    });

    test('getElevationForLngLatZoom with lng less than -180 wraps correctly', () => {
        const terrain = new Terrain(null, {} as any, {} as any);

        const OVERSCALETILEID_DOES_NOT_THROW = 4;
        terrain.getElevation = () => OVERSCALETILEID_DOES_NOT_THROW;
        expect(terrain.getElevationForLngLatZoom(new LngLat(-183, 40), 0)).toBe(OVERSCALETILEID_DOES_NOT_THROW);
    });

    test('getMinTileElevationForLngLatZoom with lng less than -180 wraps correctly', () => {
        const terrain = new Terrain(null, {} as any, {} as any);

        const OVERSCALETILEID_DOES_NOT_THROW = 4;
        terrain.getMinMaxElevation = () => ({minElevation: OVERSCALETILEID_DOES_NOT_THROW, maxElevation: 42});
        expect(terrain.getMinTileElevationForLngLatZoom(new LngLat(-183, 40), 0)).toBe(OVERSCALETILEID_DOES_NOT_THROW);
    });

});
