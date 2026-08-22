import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import Point from '@mapbox/point-geometry';
import {Terrain} from './terrain.ts';
import {Context} from '../webgl/context.ts';
import {RGBAImage} from '../util/image.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {Tile} from '../tile/tile.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {EXTENT} from '../data/extent.ts';
import {MAX_TILE_ZOOM, MIN_TILE_ZOOM} from '../util/util.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {GlobeTransform} from '../geo/projection/globe_transform.ts';
import {VerticalPerspectiveTransform} from '../geo/projection/vertical_perspective_transform.ts';
import type {TileManager} from '../tile/tile_manager.ts';
import type {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {DEMData} from '../data/dem_data.ts';
import type {Painter} from './painter.ts';
import {createNullGL} from '../util/test/null_gl.ts';
import {createDEM} from '../util/test/util.ts';

describe('Terrain', () => {
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
        gl = createNullGL();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function createFlatTerrain(elevation: number) {
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 85, renderWorldCopies: true});
        transform.resize(2048, 512);
        transform.setCenter(new LngLat(0, 0));
        transform.setZoom(0);
        const painter = {
            context: new Context(gl),
            width: 2048,
            height: 512,
            transform,
        } as any as Painter;
        const tileManager = {_source: {tileSize: 512, minzoom: 0, maxzoom: 22}} as TileManager;
        const terrain = new Terrain(painter, tileManager, {} as any as TerrainSpecification);
        const dem = createDEM(() => elevation);
        const tileIDs = [-2, -1, 0, 1, 2].map(wrap => new OverscaledTileID(0, wrap, 0, 0, 0));
        terrain.tileManager.getRenderableTiles = () => tileIDs.map(tileID => ({tileID}) as any as Tile);
        terrain.tileManager.getSourceTile = (tileID) => ({tileID, dem}) as any as Tile;
        terrain.tileManager.getSource = () => ({minzoom: 0, maxzoom: 22}) as any;
        return terrain;
    }

    test('screenPointToMercatorCoordinate returns the terrain hit instead of the flat plane', () => {
        const terrain = createFlatTerrain(1000);
        const p = new Point(1024, 256);

        expect(terrain.painter.transform.screenPointToMercatorCoordinate(p).z).toBe(0);
        expect(terrain.painter.transform.screenPointToMercatorCoordinate(p, terrain).z).toBeCloseTo(1000, 6);
    });

    test('a globe transform that renders mercator picks with the mercator raycast', () => {
        const terrain = createFlatTerrain(0);
        const globeTransform = new GlobeTransform();
        globeTransform.resize(2048, 512);
        globeTransform.setZoom(0);
        globeTransform.setTransitionState(0);

        const coordinate = globeTransform.screenTerrainPointToMercatorCoordinate(new Point(1024, 256), terrain);

        expect(coordinate).not.toBeNull();
        expect(coordinate.x).toBeCloseTo(0.5, 10);
        expect(coordinate.y).toBeCloseTo(0.5, 10);
        expect(coordinate.z).toBeCloseTo(0, 10);
    });

    test('a globe transform that renders the globe picks with the globe raycast', () => {
        const terrain = createFlatTerrain(0);
        const globeTransform = new GlobeTransform();
        globeTransform.resize(2048, 512);
        globeTransform.setZoom(1);
        const p = new Point(1100, 280);

        const coordinate = globeTransform.screenTerrainPointToMercatorCoordinate(p, terrain);
        const verticalPerspective = new VerticalPerspectiveTransform();
        verticalPerspective.apply(globeTransform, false);
        const expected = verticalPerspective.screenTerrainPointToMercatorCoordinate(p, terrain);

        expect(expected).not.toBeNull();
        expect(coordinate).not.toBeNull();
        expect(coordinate.x).toBeCloseTo(expected.x, 12);
        expect(coordinate.y).toBeCloseTo(expected.y, 12);
        expect(coordinate.z).toBeCloseTo(expected.z, 12);
    });

    test('depthAtPoint decodes the depth framebuffer readback', () => {
        const terrain = createFlatTerrain(0);
        vi.spyOn(terrain, 'getFramebuffer').mockReturnValue({framebuffer: null} as any);
        vi.spyOn(terrain.painter.context.gl, 'readPixels').mockImplementation((_x, _y, _w, _h, _f, _t, rgba) => {
            (rgba as Uint8Array).set([0, 0, 0, 128]);
        });

        expect(terrain.depthAtPoint(new Point(10, 20))).toBeCloseTo(0.5, 10);
    });

    test('getCoverageIndex sees newly renderable tiles after resetElevationCache', () => {
        const terrain = createFlatTerrain(0);
        const renderableTiles = terrain.tileManager.getRenderableTiles;
        terrain.tileManager.getRenderableTiles = () => [];
        expect(terrain.getCoverageIndex()).toBeNull();

        terrain.tileManager.getRenderableTiles = renderableTiles;
        expect(terrain.getCoverageIndex()).toBeNull();

        terrain.resetElevationCache();
        expect(terrain.getCoverageIndex()).not.toBeNull();
    });

    test('Calculate tile minimum and maximum elevation', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const tile = new Tile(tileID, 256);
        tile.dem = {
            min: 10,
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

        const {minElevation, maxElevation} = terrain.getMinMaxElevation(tileID);

        expect(minElevation).toBe(20);
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
        tile.dem = null;
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
        expect(terrain.getSkirtLength(16)).toBe(122.16256373312942);
        expect(actualIndexArray).toStrictEqual([0, 5, 6, 0, 6, 1, 1, 6, 7, 1, 7, 2, 2, 7, 8, 2, 8, 3, 3, 8, 9, 3, 9, 4, 5, 10, 11, 5, 11, 6, 6, 11, 12, 6, 12, 7, 7, 12, 13, 7, 13, 8, 8, 13, 14, 8, 14, 9, 10, 15, 16, 10, 16, 11, 11, 16, 17, 11, 17, 12, 12, 17, 18, 12, 18, 13, 13, 18, 19, 13, 19, 14, 15, 20, 21, 15, 21, 16, 16, 21, 22, 16, 22, 17, 17, 22, 23, 17, 23, 18, 18, 23, 24, 18, 24, 19, 20, 30, 31, 20, 31, 21, 0, 26, 25, 0, 1, 26, 21, 31, 32, 21, 32, 22, 1, 27, 26, 1, 2, 27, 22, 32, 33, 22, 33, 23, 2, 28, 27, 2, 3, 28, 23, 33, 34, 23, 34, 24, 3, 29, 28, 3, 4, 29, 35, 36, 38, 35, 38, 37, 45, 48, 46, 45, 47, 48, 37, 38, 40, 37, 40, 39, 47, 50, 48, 47, 49, 50, 39, 40, 42, 39, 42, 41, 49, 52, 50, 49, 51, 52, 41, 42, 44, 41, 44, 43, 51, 54, 52, 51, 53, 54, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(actualVertexArray).toStrictEqual([0, 0, 0, 2048, 0, 0, 4096, 0, 0, 6144, 0, 0, 8192, 0, 0, 0, 2048, 0, 2048, 2048, 0, 4096, 2048, 0, 6144, 2048, 0, 8192, 2048, 0, 0, 4096, 0, 2048, 4096, 0, 4096, 4096, 0, 6144, 4096, 0, 8192, 4096, 0, 0, 6144, 0, 2048, 6144, 0, 4096, 6144, 0, 6144, 6144, 0, 8192, 6144, 0, 0, 8192, 0, 2048, 8192, 0, 4096, 8192, 0, 6144, 8192, 0, 8192, 8192, 0, 0, 0, 1, 2048, 0, 1, 4096, 0, 1, 6144, 0, 1, 8192, 0, 1, 0, 8192, 1, 2048, 8192, 1, 4096, 8192, 1, 6144, 8192, 1, 8192, 8192, 1, 0, 0, 0, 0, 0, 1, 0, 2048, 0, 0, 2048, 1, 0, 4096, 0, 0, 4096, 1, 0, 6144, 0, 0, 6144, 1, 0, 8192, 0, 0, 8192, 1, 8192, 0, 0, 8192, 0, 1, 8192, 2048, 0, 8192, 2048, 1, 8192, 4096, 0, 8192, 4096, 1, 8192, 6144, 0, 8192, 6144, 1, 8192, 8192, 0, 8192, 8192, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    test('getElevation interpolates and reuses DEM sampling setup until reset', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {exaggeration: 2} as any);
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        const sourceTile = {
            tileID,
            dem: {
                dim: 1,
                sampleBilinear: (x: number, y: number) => 100 * x + 10 * y
            }
        } as any as Tile;
        terrain.tileManager.getSourceTile = vi.fn(() => sourceTile);
        terrain.tileManager.getSource = vi.fn(() => ({minzoom: 0, maxzoom: 22}) as any);

        expect(terrain.getDEMElevation(tileID, EXTENT * 0.4, EXTENT * 0.2)).toBeCloseTo(42);
        expect(terrain.getElevation(tileID, EXTENT / 2, EXTENT / 2)).toBeCloseTo(110);
        expect(terrain.getElevation(tileID, EXTENT / 2, EXTENT / 2)).toBeCloseTo(110);
        expect(terrain.tileManager.getSourceTile).toHaveBeenCalledTimes(1);

        terrain.resetElevationCache();
        expect(terrain.getElevation(tileID, EXTENT / 2, EXTENT / 2)).toBeCloseTo(110);

        expect(terrain.tileManager.getSourceTile).toHaveBeenCalledTimes(2);
    });

    test('getDEMElevation samples the correct part of a parent DEM tile', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);
        const childTileID = new OverscaledTileID(2, 0, 2, 3, 3);
        const parentTileID = new OverscaledTileID(1, 0, 1, 1, 1);
        const sampleBilinear = vi.fn(() => 42);

        terrain.tileManager.getSourceTile = vi.fn(() => ({
            tileID: parentTileID,
            dem: {dim: 4, sampleBilinear}
        }) as any as Tile);
        terrain.tileManager.getSource = vi.fn(() => ({maxzoom: 22}) as any);

        expect(terrain.getDEMElevation(childTileID, EXTENT / 2, EXTENT / 2)).toBe(42);
        // The center of the bottom-right child is at 75% of both parent axes.
        expect(sampleBilinear).toHaveBeenCalledWith(3, 3);
    });

    test('getElevation retries sampling setup when DEM data becomes available', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {exaggeration: 1} as any);
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        let tileHasDem = false;

        terrain.tileManager.getSourceTile = vi.fn(() => ({
            tileID,
            dem: tileHasDem ? {
                dim: 1,
                sampleBilinear: (x: number, y: number) => 100 * x + 10 * y
            } : undefined
        }) as any as Tile);
        terrain.tileManager.getSource = vi.fn(() => ({minzoom: 0, maxzoom: 22}) as any);

        expect(terrain.getElevation(tileID, EXTENT / 2, EXTENT / 2)).toBe(0);

        tileHasDem = true;
        expect(terrain.getElevation(tileID, EXTENT / 2, EXTENT / 2)).toBeCloseTo(55);
        expect(terrain.tileManager.getSourceTile).toHaveBeenCalledTimes(2);
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

    test('getDEMElevation normalizes out-of-bounds coordinates to neighbor tile', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);
        const getSourceTile = vi.fn();
        terrain.tileManager.getSourceTile = getSourceTile;

        // tile (0,0,1) with x beyond EXTENT should normalize to tile (1,0,1)
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        terrain.getDEMElevation(tileID, EXTENT + 100, 50);

        expect(getSourceTile).toHaveBeenCalledTimes(1);
        const [calledTileID] = getSourceTile.mock.calls[0];
        expect(calledTileID.canonical.x).toBe(1);
        expect(calledTileID.canonical.y).toBe(0);
        expect(calledTileID.canonical.z).toBe(1);
    });

    test('getDEMElevation returns 0 for coordinates beyond tile grid', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);
        const getSourceTile = vi.fn();
        terrain.tileManager.getSourceTile = getSourceTile;

        // tile (0,0,0) with y beyond EXTENT — no tile exists below at z=0
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const result = terrain.getDEMElevation(tileID, 100, EXTENT + 100);

        expect(result).toBe(0);
        expect(getSourceTile).not.toHaveBeenCalled();
    });

    describe('getElevationForLngLatZoom returns 0 for out of bounds', () => {
        const terrain = new Terrain(null, {_source: {tileSize: 512}} as any, {} as any);

        test('lng', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(180, 0), 0)).toBe(0);
        });

        test('lat', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(0, 88), 0)).toBe(0);
        });

        test('zoom below the minimum', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(0, 0), MIN_TILE_ZOOM - 1)).toBe(0);
        });

        test('zoom above the maximum', () => {
            expect(terrain.getElevationForLngLatZoom(new LngLat(0, 0), MAX_TILE_ZOOM + 1)).toBe(0);
        });
    });

    test('destroy does not throw', () => {
        const context = new Context(gl);
        const painter = {
            context,
            width: 100,
            height: 100,
            pixelRatio: 1,
            style: {projection: null},
        } as any as Painter;
        const tileManager = {_source: {tileSize: 512}, destruct: vi.fn()} as any as TileManager;
        const terrain = new Terrain(painter, tileManager, {} as any as TerrainSpecification);

        terrain.getFramebuffer();
        terrain.getTerrainMesh(new OverscaledTileID(0, 0, 0, 0, 0));

        expect(() => terrain.destroy()).not.toThrow();
    });

});
