import {describe, test, expect, vi, type Mock} from 'vitest';
import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {SymbolBucket} from '../../data/bucket/symbol_bucket.ts';
import {TileManager} from '../../tile/tile_manager.ts';
import {Tile} from '../../tile/tile.ts';
import {SymbolStyleLayer} from '../../style/style_layer/symbol_style_layer.ts';
import {Painter, type RenderOptions} from '../../render/painter.ts';
import {Program} from '../program.ts';
import {drawSymbols} from './draw_symbol.ts';
import * as symbolProjection from '../../symbol/projection.ts';
import type {ZoomHistory} from '../../style/zoom_history.ts';
import type {Map} from '../../ui/map.ts';
import {type IReadonlyTransform} from '../../geo/transform_interface.ts';
import type {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type Style} from '../../style/style.ts';
import {MercatorProjection} from '../../geo/projection/mercator_projection.ts';
import type {ProjectionData} from '../../geo/projection/projection_data.ts';

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
(symbolProjection.getPitchedLabelPlaneMatrix as Mock).mockReturnValue(mat4.create());

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
            };
        },
    } as any as IReadonlyTransform;
}

describe('drawSymbol', () => {
    test('should not do anything', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'opaque';

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(mockPainter, null, null, null, null, renderOptions);

        expect(mockPainter.colorModeForRenderPass).not.toHaveBeenCalled();
    });

    test('should call program.draw', () => {
        const painterMock = new Painter(null, null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = createMockTransform();
        painterMock.options = {} as any;
        painterMock.style = {
            map: {},
            projection: new MercatorProjection()
        } as any as Style;

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
        tileId.terrainRttPosMatrix32f = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (painterMock.useProgram as Mock).mockReturnValue(programMock);
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

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], null, renderOptions);

        expect(programMock.draw).toHaveBeenCalledTimes(1);
    });

    test('should call updateLineLabels with rotateToLine === false if text-rotation-alignment is viewport-glyph', () => {

        const painterMock = new Painter(null, null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = createMockTransform();
        painterMock.options = {} as any;

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
        tileId.terrainRttPosMatrix32f = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (painterMock.useProgram as Mock).mockReturnValue(programMock);
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
        (tile.getBucket as Mock).mockReturnValue(bucketMock);
        const tileManagerMock = new TileManager(null, null, null);
        (tileManagerMock.getTile as Mock).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;
        painterMock.style = {
            map: {},
            projection: new MercatorProjection()
        } as any as Style;

        const spy = vi.spyOn(symbolProjection, 'updateLineLabels');
        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], null, renderOptions);

        expect(spy.mock.calls[0][7]).toBeFalsy(); // rotateToLine === false
    });

    test('transparent tile optimization should prevent program.draw from being called', () => {

        const painterMock = new Painter(null, null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => { }
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = createMockTransform();
        painterMock.options = {} as any;
        painterMock.style = {
            projection: new MercatorProjection()
        } as any as Style;

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
        tileId.terrainRttPosMatrix32f = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (painterMock.useProgram as Mock).mockReturnValue(programMock);
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
        (tile.getBucket as Mock).mockReturnValue(bucketMock);
        const tileManagerMock = new TileManager(null, null, null);
        (tileManagerMock.getTile as Mock).mockReturnValue(tile);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawSymbols(painterMock, tileManagerMock, layer, [tileId], null, renderOptions);

        expect(programMock.draw).toHaveBeenCalledTimes(0);
    });
});
