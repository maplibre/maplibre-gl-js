import Point from '@mapbox/point-geometry';
import Terrain from './terrain';
import gl from 'gl';
import Context from '../gl/context';
import {RGBAImage} from '../util/image';
import Texture from './texture';
import type SourceCache from '../source/source_cache';
import {OverscaledTileID} from '../source/tile_id';
import type {TerrainSpecification} from '../style-spec/types.g';
import type DEMData from '../data/dem_data';
import Tile from '../source/tile';
import Painter from './painter';

describe('Terrain', () => {
    test('pointCoordiate should not return null', () => {
        const painter = {
            context: new Context(gl(1, 1)),
            width: 1,
            height: 1
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
            context: new Context(gl(1, 1)),
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
            context: new Context(gl(1, 1)),
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
            context: new Context(gl(1, 1)),
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
});
