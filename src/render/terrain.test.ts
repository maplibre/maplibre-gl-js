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
});
