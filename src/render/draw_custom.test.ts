import {describe, test, expect, vi, type Mock} from 'vitest';
import {OverscaledTileID} from '../source/tile_id';
import {SourceCache} from '../source/source_cache';
import {Tile} from '../source/tile';
import {Painter, type RenderOptions} from './painter';
import type {Map} from '../ui/map';
import {drawCustom} from './draw_custom';
import {CustomStyleLayer} from '../style/style_layer/custom_style_layer';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {MercatorProjection} from '../geo/projection/mercator_projection';

vi.mock('./painter');
vi.mock('./program');
vi.mock('../source/source_cache');
vi.mock('../source/tile');
vi.mock('../data/bucket/symbol_bucket', () => {
    return {
        SymbolBucket: vi.fn()
    };
});
vi.mock('../symbol/projection');

describe('drawCustom', () => {
    test('should return custom render method inputs', () => {
        // same transform setup as in transform.test.ts 'creates a transform', so matrices of transform should be the same
        const transform = new MercatorTransform(0, 22, 0, 60, true);
        transform.resize(500, 500);
        transform.setMinPitch(10);
        transform.setMaxPitch(10);
        const mockPainter = new Painter(null, null);
        mockPainter.style = {
            projection: new MercatorProjection(),
        } as any;
        mockPainter.renderPass = 'translucent';
        mockPainter.transform = transform;
        mockPainter.context = {
            gl: {},
            setColorMode: () => {},
            setStencilMode: () => {},
            setDepthMode: () => {},
            setDirty: () => {},
            bindFramebuffer: {
                set: () => {}
            }
        } as any;

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        const sourceCacheMock = new SourceCache(null, null, null);
        (sourceCacheMock.getTile as Mock).mockReturnValue(tile);
        sourceCacheMock.map = {showCollisionBoxes: false} as any as Map;

        let result;
        const mockLayer = new CustomStyleLayer({
            id: 'custom-layer',
            type: 'custom',
            render(gl, args) {
                result = {
                    gl,
                    args
                };
            },
        });
        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawCustom(mockPainter, sourceCacheMock, mockLayer, renderOptions);
        expect(result.gl).toBeDefined();
        expect(result.args.farZ).toBeCloseTo(804.8028169246645, 6);
        expect(result.args.farZ).toBe(mockPainter.transform.farZ);
        expect(result.args.nearZ).toBe(mockPainter.transform.nearZ);
        expect(result.args.fov).toBe(mockPainter.transform.fov * Math.PI / 180);
        expect(result.args.modelViewProjectionMatrix).toEqual(mockPainter.transform.modelViewProjectionMatrix);
        expect(result.args.projectionMatrix).toEqual(mockPainter.transform.projectionMatrix);
        // JP: TODO: test projection args
    });
});
