import { mat4 } from 'gl-matrix';
import { OverscaledTileID } from '../source/tile_id';
import SourceCache from '../source/source_cache';
import Tile from '../source/tile';
import Painter from './painter';
import drawCustom from './draw_custom';
import Transform from '../geo/transform';
import CustomStyleLayer from '../style/style_layer/custom_style_layer';
import Context from '../gl/context';

jest.mock('./painter');
jest.mock('./program');
jest.mock('../source/source_cache');
jest.mock('../source/tile');
jest.mock('../data/bucket/symbol_bucket');
jest.mock('../symbol/projection');

describe('passing tile-data to render/prerender', () => {
    test('no sourceCache, no tile', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'translucent';
        mockPainter.context = {
            setColorMode: () => null,
            setStencilMode: () => null,
            setDepthMode: () => null,
            setDirty: () => null,
            bindFramebuffer: {
                set: () => null,
            },
        } as any as Context;
        mockPainter.transform = {
            customLayerMatrix: () => null,
        } as any as Transform;

        // array to store tiles passed from drawCustom
        let passedTiles;
        const mockLayer = {
            implementation: {
                render: (_, __, tiles) => (passedTiles = tiles),
            },
        } as any as CustomStyleLayer;

        drawCustom(mockPainter, null, mockLayer, []);
        expect(Array.isArray(passedTiles)).toBeTruthy();
        expect(passedTiles.length).toBe(0);
    });

    test('passing tile to render', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'translucent';
        mockPainter.context = {
            setColorMode: () => null,
            setStencilMode: () => null,
            setDepthMode: () => null,
            setDirty: () => null,
            bindFramebuffer: {
                set: () => null,
            },
        } as any as Context;
        mockPainter.transform = {
            customLayerMatrix: () => null,
        } as any as Transform;

        // array to store tiles passed from drawCustom
        let passedTiles;
        const mockLayer = {
            implementation: {
                render: (_, __, tiles) => (passedTiles = tiles),
            },
        } as any as CustomStyleLayer;

        // make tile
        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.posMatrix = mat4.create();
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;

        const sourceCacheMock = new SourceCache(null, null, null);
        (sourceCacheMock.getTile as jest.Mock).mockReturnValue(tile);

        drawCustom(mockPainter, sourceCacheMock, mockLayer, [tileId]);
        expect(Array.isArray(passedTiles)).toBeTruthy();
        expect(passedTiles.length).toBe(1);
    });

    test('passing tile to prerender', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'offscreen';
        mockPainter.context = {
            setColorMode: () => null,
            setStencilMode: () => null,
            setDepthMode: () => null,
            setDirty: () => null,
            bindFramebuffer: {
                set: () => null,
            },
        } as any as Context;
        mockPainter.transform = {
            customLayerMatrix: () => null,
        } as any as Transform;

        // array to store tiles passed from drawCustom
        let passedTiles;
        const mockLayer = {
            implementation: {
                prerender: (_, __, tiles) => (passedTiles = tiles),
            },
        } as any as CustomStyleLayer;

        // make tile
        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.posMatrix = mat4.create();
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;

        const sourceCacheMock = new SourceCache(null, null, null);
        (sourceCacheMock.getTile as jest.Mock).mockReturnValue(tile);

        drawCustom(mockPainter, sourceCacheMock, mockLayer, [tileId]);
        expect(Array.isArray(passedTiles)).toBeTruthy();
        expect(passedTiles.length).toBe(1);
    });
});
