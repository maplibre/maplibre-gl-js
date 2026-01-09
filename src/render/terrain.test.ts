import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {mat4} from 'gl-matrix';
import {Terrain} from './terrain';
import {Context} from '../gl/context';
import {RGBAImage} from '../util/image';
import {OverscaledTileID} from '../tile/tile_id';
import {Tile} from '../tile/tile';
import {LngLat} from '../geo/lng_lat';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from '../util/util';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import type {TileManager} from '../tile/tile_manager';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {DEMData} from '../data/dem_data';
import type {Painter} from './painter';

describe('Terrain', () => {
    let gl: WebGLRenderingContext;

    beforeEach(() => {
        gl = document.createElement('canvas').getContext('webgl');
        vi.spyOn(gl, 'checkFramebufferStatus').mockReturnValue(gl.FRAMEBUFFER_COMPLETE);
        vi.spyOn(gl, 'readPixels').mockImplementation((_1, _2, _3, _4, _5, _6, rgba) => {
            rgba[0] = 0;
            rgba[1] = 0;
            rgba[2] = 255;
            rgba[3] = 255;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('pointCoordinate should not return null', () => {
        expect.assertions(2);
        const painter = {
            context: new Context(gl),
            width: 1,
            height: 1,
            pixelRatio: 1,
            transform: {center: {lng: 0}},
            maybeDrawDepthAndCoords: vi.fn(),
        } as any as Painter;
        const tileManager = {_source: {tileSize: 512}} as TileManager;
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
        const terrain = new Terrain(painter, tileManager, {} as any as TerrainSpecification);
        terrain.tileManager.getTileByID = getTileByID;
        terrain.coordsIndex.push('abcd');

        const coordinate = terrain.pointCoordinate(new Point(0, 0));

        expect(coordinate).not.toBeNull();
        expect(painter.maybeDrawDepthAndCoords).toHaveBeenCalled();

    });

    const setupMercatorOverflow = (pixelRatio: number = 1) => {
        const WORLD_WIDTH = 4;
        const painter = {
            context: new Context(gl),
            width: WORLD_WIDTH,
            height: 1,
            maybeDrawDepthAndCoords: vi.fn(),
            pixelRatio,
        } as any as Painter;
        const tileManager = {_source: {tileSize: 512}} as TileManager;
        const terrain = new Terrain(painter, tileManager, {} as any as TerrainSpecification);
        const tileIdsToWraps = {a: -1, b: 0, c: 1, d: 2};
        terrain.tileManager.getTileByID = (id) => {
            return {
                tileID: {
                    canonical: {x: 0, y: 0, z: 0},
                    wrap: tileIdsToWraps[id]
                }
            } as any as Tile;
        };
        terrain.getElevation = () => 0;
        terrain.coordsIndex = Object.keys(tileIdsToWraps);
        vi.spyOn(gl, 'readPixels').mockImplementation((x, _2, _3, _4, _5, _6, rgba) => {
            rgba[0] = 0;
            rgba[1] = 0;
            rgba[2] = 0;
            rgba[3] = 255 - x / pixelRatio;
        });
        return terrain;
    };

    test(
        `pointCoordinate should return negative mercator x
        if the point is on the LEFT outside the central globe`,
        () => {
            expect.assertions(2);
            const pointX = 0;
            const terrain = setupMercatorOverflow();
            const coordinate = terrain.pointCoordinate(new Point(pointX, 0));

            expect(coordinate.x).toBe(-1);
            expect(terrain.painter.maybeDrawDepthAndCoords).toHaveBeenCalled();
        });

    test(
        `pointCoordinate should return mercator x greater than 1
        if the point is on the RIGHT outside the central globe`,
        () => {
            expect.assertions(2);
            const pointX = 3;
            const terrain = setupMercatorOverflow();
            const coordinate = terrain.pointCoordinate(new Point(pointX, 0));

            expect(coordinate.x).toBe(2);
            expect(terrain.painter.maybeDrawDepthAndCoords).toHaveBeenCalled();
        });

    test(
        'pointCoordinate should respect painter.pixelRatio',
        () => {
            const terrain = setupMercatorOverflow(2);

            let pointX = 0;
            let coordinate = terrain.pointCoordinate(new Point(pointX, 0));
            expect(coordinate.x).toBe(-1);
            expect(terrain.painter.maybeDrawDepthAndCoords).toHaveBeenCalled();

            pointX = 3;
            coordinate = terrain.pointCoordinate(new Point(pointX, 0));
            expect(coordinate.x).toBe(2);
            expect(terrain.painter.maybeDrawDepthAndCoords).toHaveBeenCalled();
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
            context: new Context(gl),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const tileManager = {
            _source: {maxzoom: 12, tileSize: 512},
            _cache: {max: 10},
            getTileByID: () => {
                return tile;
            },
        } as any as TileManager;
        const terrain = new Terrain(
            painter,
            tileManager,
            {exaggeration: 2} as any as TerrainSpecification,
        );

        terrain.tileManager._tiles[tileID.key] = tile;
        const {minElevation, maxElevation} = terrain.getMinMaxElevation(tileID);

        expect(minElevation).toBe(0);
        expect(maxElevation).toBe(200);
    });

    test('Return null elevation values when no tile', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const painter = {
            context: new Context(gl),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const tileManager = {
            _source: {maxzoom: 12, tileSize: 512},
            _cache: {max: 10},
            getTileByID: () => null,
            _outOfViewCache: {
                getByKey: () => null,
            },
        } as any as TileManager;
        const terrain = new Terrain(
            painter,
            tileManager,
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
            context: new Context(gl),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const tileManager = {
            _source: {maxzoom: 12, tileSize: 512},
            _cache: {max: 10},
            getTileByID: () => {
                return tile;
            },
        } as any as TileManager;
        const terrain = new Terrain(
            painter,
            tileManager,
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
            style: {
                projection: {
                    transitionState: 0,
                }
            }
        } as any as Painter;
        const tileManager = {
            _source: {maxzoom: 12, tileSize: 512},
            _cache: {max: 10}
        } as any as TileManager;
        const terrain = new Terrain(
            painter,
            tileManager,
            {exaggeration: 1} as any as TerrainSpecification,
        );
        terrain.meshSize = 4;
        terrain.getTerrainMesh(new OverscaledTileID(2, 0, 2, 1, 1));
        expect(terrain.getMeshFrameDelta(16)).toBe(122.16256373312942);
        expect(actualIndexArray).toStrictEqual([0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 8, 2, 8, 3, 3, 8, 9, 3, 9, 4, 5, 10, 11, 5, 11, 6, 6, 11, 12, 6, 12, 7, 7, 12, 13, 7, 13, 8, 8, 13, 14, 8, 14, 9, 10, 15, 16, 10, 16, 11, 11, 16, 17, 11, 17, 12, 12, 17, 18, 12, 18, 13, 13, 18, 19, 13, 19, 14, 15, 20, 21, 15, 21, 16, 16, 21, 22, 16, 22, 17, 17, 22, 23, 17, 23, 18, 18, 23, 24, 18, 24, 19, 20, 30, 31, 20, 31, 21, 0, 26, 25, 0, 1, 26, 21, 31, 32, 21, 32, 22, 1, 27, 26, 1, 2, 27, 22, 32, 33, 22, 33, 23, 2, 28, 27, 2, 3, 28, 23, 33, 34, 23, 34, 24, 3, 29, 28, 3, 4, 29, 35, 36, 38, 35, 38, 37, 45, 48, 46, 45, 47, 48, 37, 38, 40, 37, 40, 39, 47, 50, 48, 47, 49, 50, 39, 40, 42, 39, 42, 41, 49, 52, 50, 49, 51, 52, 41, 42, 44, 41, 44, 43, 51, 54, 52, 51, 53, 54, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(actualVertexArray).toStrictEqual([0, 0, 0, 2048, 0, 0, 4096, 0, 0, 6144, 0, 0, 8192, 0, 0, 0, 2048, 0, 2048, 2048, 0, 4096, 2048, 0, 6144, 2048, 0, 8192, 2048, 0, 0, 4096, 0, 2048, 4096, 0, 4096, 4096, 0, 6144, 4096, 0, 8192, 4096, 0, 0, 6144, 0, 2048, 6144, 0, 4096, 6144, 0, 6144, 6144, 0, 8192, 6144, 0, 0, 8192, 0, 2048, 8192, 0, 4096, 8192, 0, 6144, 8192, 0, 8192, 8192, 0, 0, 0, 1, 2048, 0, 1, 4096, 0, 1, 6144, 0, 1, 8192, 0, 1, 0, 8192, 1, 2048, 8192, 1, 4096, 8192, 1, 6144, 8192, 1, 8192, 8192, 1, 0, 0, 0, 0, 0, 1, 0, 2048, 0, 0, 2048, 1, 0, 4096, 0, 0, 4096, 1, 0, 6144, 0, 0, 6144, 1, 0, 8192, 0, 0, 8192, 1, 8192, 0, 0, 8192, 0, 1, 8192, 2048, 0, 8192, 2048, 1, 8192, 4096, 0, 8192, 4096, 1, 8192, 6144, 0, 8192, 6144, 1, 8192, 8192, 0, 8192, 8192, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    test('interpolation works', () => {
        const mockTerrain = {
            getDEMElevation: Terrain.prototype.getDEMElevation,
            getTerrainData() {
                return {
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

    test('getElevationForLngLat uses covering tiles to get the right zoom', () => {
        const zoom = 10;
        const painter = {
            context: new Context(gl),
            width: 1,
            height: 1,
            getTileTexture: () => null
        } as any as Painter;
        const tileManager = {
            _source: {minzoom: 3, maxzoom: 22, tileSize: 512},
            _cache: {max: 10},
            getTileByID: () => {
                return new Tile(new OverscaledTileID(zoom, 0, 0, 0, 0), 256);
            },
        } as any as TileManager;
        const terrain = new Terrain(
            painter,
            tileManager,
            {exaggeration: 2} as any as TerrainSpecification,
        );

        const spy = vi.fn();
        terrain.getElevation = spy;
        const transform = new MercatorTransform({minZoom: 3, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(200, 200);
        transform.setZoom(zoom);
        terrain.getElevationForLngLat(new LngLat(0, 0), transform);

        expect(spy).toHaveBeenCalled();
        expect((spy.mock.calls[0][0] as OverscaledTileID).canonical.z).toBe(zoom);
    });

    test('getElevationForLngLatZoom with lng less than -180 wraps correctly', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);

        terrain.getElevation = () => 1;
        expect(terrain.getElevationForLngLatZoom(new LngLat(-183, 40), 0)).toBe(1);
    });

    test('getMinTileElevationForLngLatZoom with lng less than -180 wraps correctly', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);

        terrain.getMinMaxElevation = () => ({minElevation: 1, maxElevation: 42});
        expect(terrain.getMinTileElevationForLngLatZoom(new LngLat(-183, 40), 0)).toBe(1);
    });

    describe('getElevationForLngLatZoom returns 0 for out of bounds', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);

        test('lng', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(180, 0), 0)).toBe(0);
        });

        test('lat', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(0, 88), 0)).toBe(0);
        });

        test('zoom', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(0, 0), MIN_TILE_ZOOM - 1)).toBe(0);
        });

        test('zoom', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(0, 0), MAX_TILE_ZOOM + 1)).toBe(0);
        });
    });

});
