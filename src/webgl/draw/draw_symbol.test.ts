import {describe, test, expect, vi} from 'vitest';
import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {SymbolBucket} from '../../data/bucket/symbol_bucket.ts';
import {TileManager} from '../../tile/tile_manager.ts';
import {Tile} from '../../tile/tile.ts';
import {SymbolStyleLayer} from '../../style/style_layer/symbol_style_layer.ts';
import {Painter} from '../../render/painter.ts';
import {FrameRenderContext} from '../../render/frame_render_context.ts';
import {Program} from '../program.ts';
import {drawSymbols} from './draw_symbol.ts';
import * as symbolProjection from '../../symbol/projection.ts';
import {createIdentityMat4f32} from '../../util/util.ts';
import {createFrameRenderData} from '../../util/test/util.ts';

import type {IReadonlyTransform} from '../../geo/transform_interface.ts';
import type {ZoomHistory} from '../../style/zoom_history.ts';
import type {Map} from '../../ui/map.ts';
import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {ProjectionData} from '../../geo/projection/projection_data.ts';

vi.mock(import('../../render/painter'));
vi.mock(import('../program'));
vi.mock(import('../../tile/tile_manager'));
vi.mock(import('../../tile/tile'));
vi.mock(import('../../data/bucket/symbol_bucket'), () => {
    return {
        SymbolBucket: vi.fn()
    };
});

vi.mock(import('../../symbol/projection'));
(vi.mocked(symbolProjection.getPitchedLabelPlaneMatrix)).mockReturnValue(mat4.create());

function createMockTransform() {
    return {
        pitch: 0,
        labelPlaneMatrix: mat4.create(),
        getCircleRadiusCorrection: () => 1,
        angle: 0,
        zoom: 0,
        getProjectionData(_canonical, fallback): ProjectionData {
            return {
                mainMatrix: fallback,
                tileMercatorCoords: [0, 0, 1, 1],
                clippingPlane: [0, 0, 0, 0],
                projectionTransition: 0.0,
                fallbackMatrix: fallback,
                clipAntimeridian: false,
            };
        },
    } as any as IReadonlyTransform;
}

describe('drawSymbol', () => {
    test('should not do anything', () => {
        const mockPainter = new Painter(null);
        const frameRenderContext = new FrameRenderContext({transform: null, terrain: null, data: createFrameRenderData(), context: null, programCache: null, currentPass: 'opaque', projection: null});
        vi.spyOn(frameRenderContext, 'colorModeForRenderPass');

        drawSymbols(mockPainter, null, null, null, frameRenderContext);

        expect(frameRenderContext.colorModeForRenderPass).not.toHaveBeenCalled();
    });

    test('should call program.draw', () => {
        const painterMock = new Painter(null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        const frameRenderContext = new FrameRenderContext({transform: createMockTransform(), terrain: null, data: createFrameRenderData(), context: painterMock.context, programCache: null, currentPass: 'translucent', projection: null});

        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'symbol',
            layout: {},
            paint: {
                'text-opacity': 1
            }
        } as SymbolLayerSpecification;
        const layer = new SymbolStyleLayer(layerSpec, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = createIdentityMat4f32();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        vi.spyOn(frameRenderContext, 'useProgram').mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null);
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            },
            hasVisibleVertices: true
        } as any;
        bucketMock.iconSizeData = {
            kind: 'constant',
            layoutSize: 1
        };
        const tile = new Tile(tileId, 256);
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        tile.getBucket = () => bucketMock;
        tile.tileID = tileId;
        const tileManagerMock = new TileManager(null, null, null);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;
        tileManagerMock.getTile = (_a) => tile;

        drawSymbols(painterMock, tileManagerMock, layer, [tileId], frameRenderContext);

        expect(programMock.draw).toHaveBeenCalledTimes(1);
    });

    test('should call updateLineLabels with rotateToLine === false if text-rotation-alignment is viewport-glyph', () => {

        const painterMock = new Painter(null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        const frameRenderContext = new FrameRenderContext({transform: createMockTransform(), terrain: null, data: createFrameRenderData(), context: painterMock.context, programCache: null, currentPass: 'translucent', projection: null});

        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'symbol',
            layout: {
                'text-rotation-alignment': 'viewport-glyph',
                'text-field': 'ABC',
                'symbol-placement': 'line',
            },
            paint: {
                'text-opacity': 1
            }
        } as SymbolLayerSpecification;
        const layer = new SymbolStyleLayer(layerSpec, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = createIdentityMat4f32();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        vi.spyOn(frameRenderContext, 'useProgram').mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null);
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            },
            hasVisibleVertices: true
        } as any;
        bucketMock.iconSizeData = {
            kind: 'constant',
            layoutSize: 1
        };
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        (vi.mocked(tile.getBucket)).mockReturnValue(bucketMock);
        const tileManagerMock = new TileManager(null, null, null);
        (vi.mocked(tileManagerMock.getTile)).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;

        const spy = vi.spyOn(symbolProjection, 'updateLineLabels');
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], frameRenderContext);

        expect(spy.mock.calls[0][8]).toBeFalsy(); // rotateToLine === false
    });

    test('transparent tile optimization should prevent program.draw from being called', () => {

        const painterMock = new Painter(null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        const frameRenderContext = new FrameRenderContext({transform: createMockTransform(), terrain: null, data: createFrameRenderData(), context: painterMock.context, programCache: null, currentPass: 'translucent', projection: null});

        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'symbol',
            layout: {},
            paint: {
                'text-opacity': 1
            }
        } as SymbolLayerSpecification;
        const layer = new SymbolStyleLayer(layerSpec, {});
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = createIdentityMat4f32();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        vi.spyOn(frameRenderContext, 'useProgram').mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null);
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            },
            hasVisibleVertices: false // nark this bucket as having no visible vertices
        } as any;
        bucketMock.iconSizeData = {
            kind: 'constant',
            layoutSize: 1
        };
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        (vi.mocked(tile.getBucket)).mockReturnValue(bucketMock);
        const tileManagerMock = new TileManager(null, null, null);
        (vi.mocked(tileManagerMock.getTile)).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;

        drawSymbols(painterMock, tileManagerMock, layer, [tileId], frameRenderContext);

        expect(programMock.draw).toHaveBeenCalledTimes(0);
    });
});
