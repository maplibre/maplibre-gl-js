import Point from '@mapbox/point-geometry';
import Terrain from './terrain';
import gl from 'gl';
import Context from '../gl/context';
import {RGBAImage} from '../util/image';
import Texture from './texture';
import type Style from '../style/style';
import type SourceCache from '../source/source_cache';
import type {TerrainSpecification} from '../style-spec/types.g';
import TileCache from '../source/tile_cache';
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
            _cache: {max: 100} as TileCache
        } as SourceCache;
        const getTileByID = (tileID) : Tile => {
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
        };
        const terrain = new Terrain(style, sourceCache, {} as any as TerrainSpecification);
        terrain.sourceCache.getTileByID = getTileByID;
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
});
