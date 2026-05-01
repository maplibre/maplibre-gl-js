import {describe, test, expect, vi, type Mock} from 'vitest';
import {OverscaledTileID} from '../../tile/tile_id';
import {TileManager} from '../../tile/tile_manager';
import {Tile} from '../../tile/tile';
import {Painter, type RenderOptions} from '../../render/painter';
import type {Map} from '../../ui/map';
import {drawCustom} from './draw_custom';
import {CustomStyleLayer} from '../../style/style_layer/custom_style_layer';
import {MercatorTransform} from '../../geo/projection/mercator_transform';
import {MercatorProjection} from '../../geo/projection/mercator_projection';
import {type CustomRenderMethodInput} from '../../style/style_layer/custom_style_layer';
import {expectToBeCloseToArray} from '../../util/test/util';

vi.mock('../../render/painter');
vi.mock('../program');
vi.mock('../../tile/tile_manager');
vi.mock('../../tile/tile');
vi.mock('../../data/bucket/symbol_bucket', () => {
    return {
        SymbolBucket: vi.fn()
    };
});
vi.mock('../../symbol/projection');

describe('drawCustom', () => {
    test('should return custom render method inputs', () => {
        // same transform setup as in transform.test.ts 'creates a transform', so matrices of transform should be the same
        const transform = new MercatorTransform({minZoom: 0, maxZoom: 22, minPitch: 0, maxPitch: 60, renderWorldCopies: true});
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
        const tileManagerMock = new TileManager(null, null, null);
        (tileManagerMock.getTile as Mock).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;

        let result: {
            gl: WebGLRenderingContext | WebGL2RenderingContext;
            args: CustomRenderMethodInput;
        };
        const mockLayer = new CustomStyleLayer({
            id: 'custom-layer',
            type: 'custom',
            render(gl, args) {
                result = {
                    gl,
                    args
                };
            },
        }, {});
        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawCustom(mockPainter, tileManagerMock, mockLayer, renderOptions);
        expect(result.gl).toBeDefined();
        expect(result.args.farZ).toBeCloseTo(804.8028169246645, 6);
        expect(result.args.farZ).toBe(mockPainter.transform.farZ);
        expect(result.args.nearZ).toBe(mockPainter.transform.nearZ);
        expect(result.args.fov).toBe(mockPainter.transform.fov * Math.PI / 180);
        expect(result.args.modelViewProjectionMatrix).toEqual(mockPainter.transform.modelViewProjectionMatrix);
        expect(result.args.projectionMatrix).toEqual(mockPainter.transform.projectionMatrix);
        expectToBeCloseToArray(result.args.defaultProjectionData.tileMercatorCoords, [0, 0, 1, 1]);
        expect(result.args.defaultProjectionData.mainMatrix[0]).toEqual(1536);
        expect(result.args.defaultProjectionData.mainMatrix[5]).toEqual(-1512.6647086267515);
        expect(result.args.defaultProjectionData.mainMatrix[15]).toEqual(794.4539334827342);
        expect(result.args.defaultProjectionData.projectionTransition).toEqual(0);
        expect(result.args.defaultProjectionData.mainMatrix).toEqual(result.args.defaultProjectionData.fallbackMatrix);
        const tileProjectionData = result.args.getProjectionData({
            tileID: {
                wrap: 1,
                canonical: {
                    z: 1,
                    x: 1,
                    y: 0,
                }
            }
        });
        expectToBeCloseToArray(tileProjectionData.tileMercatorCoords, [0.5, 0, 0.00006103515625, 0.00006103515625]);
        expect(tileProjectionData.mainMatrix[0]).toBeCloseTo(0.09375, 6);
        expect(tileProjectionData.mainMatrix[5]).toBeCloseTo(-0.09232572466135025, 6);
        expect(tileProjectionData.mainMatrix[15]).toBeCloseTo(794.4539184570312, 6);
        expect(tileProjectionData.projectionTransition).toEqual(0);
        expect(tileProjectionData.mainMatrix).toEqual(tileProjectionData.fallbackMatrix);
    });
});
