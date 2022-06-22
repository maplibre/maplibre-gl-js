import Point from '@mapbox/point-geometry';
import Terrain from './terrain';
import gl from 'gl';
import Context from '../gl/context';
import {RGBAImage} from '../util/image';
import Texture from './texture';
import type Style from '../style/style';
import type SourceCache from '../source/source_cache';
import type TerrainSourceCache from '../source/terrain_source_cache';
import type {TerrainSpecification} from '../style-spec/types.g';
import type DEMData from '../data/dem_data';
import Tile from '../source/tile';

describe('Terrain', () => {
    test('pointCoordiate should not return null', () => {
        const style = {
            map: {
                painter: {
                    context: new Context(gl(1, 1)),
                    width: 1,
                    height: 1
                }
            }
        } as any as Style;
        const sourceCache = {
            getTileByID: (tileID) => {
                if (tileID !== 'abcd') {
                    return null;
                }
                return {
                    tileID: {
                        canonical: {
                            x: 0,
                            y: 0,
                            z: 0
                        }
                    }
                };
            }
        } as any as TerrainSourceCache;
        const terrain = new Terrain(style, {} as any as SourceCache, {} as any as TerrainSpecification);
        terrain.sourceCache = sourceCache;
        const context = style.map.painter.context as Context;
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
        const terrain = new Terrain(
            {} as any as Style,
            {} as any as SourceCache,
            {exaggeration: 2, elevationOffset: 50} as any as TerrainSpecification,
        );
        const tile = {dem: {min: 0, max: 100} as any as DEMData} as any as Tile;
        const {minElevation, maxElevation} = terrain.getMinMaxElevation(tile);

        expect(minElevation).toBe(100);
        expect(maxElevation).toBe(300);
    });

    test('Return null elevation values when no tile or DEM', () => {
        const terrain = new Terrain(
            {} as any as Style,
            {} as any as SourceCache,
            {exaggeration: 2, elevationOffset: 50} as any as TerrainSpecification,
        );
        const tile = {dem: null as any as DEMData} as any as Tile;

        const minMaxNoTile = terrain.getMinMaxElevation(null as any as Tile);
        const minMaxNoDEM = terrain.getMinMaxElevation(tile);

        expect(minMaxNoTile.minElevation).toBeNull();
        expect(minMaxNoTile.maxElevation).toBeNull();
        expect(minMaxNoDEM.minElevation).toBeNull();
        expect(minMaxNoDEM.maxElevation).toBeNull();
    });
});
