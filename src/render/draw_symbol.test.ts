import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../source/tile_id';
import {SymbolBucket} from '../data/bucket/symbol_bucket';
import {SourceCache} from '../source/source_cache';
import {Tile} from '../source/tile';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {Painter} from './painter';
import {Program} from './program';
import {drawSymbols} from './draw_symbol';
import * as symbolProjection from '../symbol/projection';
import type {ZoomHistory} from '../style/zoom_history';
import type {Map} from '../ui/map';
import {ITransform} from '../geo/transform_interface';
import type {EvaluationParameters} from '../style/evaluation_parameters';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {Style} from '../style/style';
import {MercatorProjection} from '../geo/projection/mercator';
import {translatePosition} from '../geo/projection/mercator_utils';

jest.mock('./painter');
jest.mock('./program');
jest.mock('../source/source_cache');
jest.mock('../source/tile');
jest.mock('../data/bucket/symbol_bucket');
jest.mock('../symbol/projection');
(symbolProjection.getPitchedLabelPlaneMatrix as jest.Mock).mockReturnValue(mat4.create());

function createMockTransform() {
    return {
        pitch: 0,
        labelPlaneMatrix: mat4.create(),
        getCircleRadiusCorrection: () => 1,
        angle: 0,
        zoom: 0,
        getProjectionData(_canonical, fallback) {
            return {
                'u_projection_matrix': fallback,
                'u_projection_tile_mercator_coords': [0, 0, 1, 1],
                'u_projection_clipping_plane': [0, 0, 0, 0],
                'u_projection_transition': 0.0,
                'u_projection_fallback_matrix': fallback,
            };
        },
        translatePosition(tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number] {
            return translatePosition({angle: 0, zoom: 0}, tile, translate, translateAnchor);
        }
    } as any as ITransform;
}

describe('drawSymbol', () => {
    test('should not do anything', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'opaque';

        drawSymbols(mockPainter, null, null, null, null);

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
        const layer = new SymbolStyleLayer(layerSpec);
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (painterMock.useProgram as jest.Mock).mockReturnValue(programMock);
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
        const sourceCacheMock = new SourceCache(null, null, null);
        sourceCacheMock.map = {showCollisionBoxes: false} as any as Map;
        sourceCacheMock.getTile = (_a) => tile;

        drawSymbols(painterMock, sourceCacheMock, layer, [tileId], null);

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
        const layer = new SymbolStyleLayer(layerSpec);
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (painterMock.useProgram as jest.Mock).mockReturnValue(programMock);
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
        (tile.getBucket as jest.Mock).mockReturnValue(bucketMock);
        const sourceCacheMock = new SourceCache(null, null, null);
        (sourceCacheMock.getTile as jest.Mock).mockReturnValue(tile);
        sourceCacheMock.map = {showCollisionBoxes: false} as any as Map;
        painterMock.style = {
            map: {},
            projection: new MercatorProjection()
        } as any as Style;

        const spy = jest.spyOn(symbolProjection, 'updateLineLabels');
        drawSymbols(painterMock, sourceCacheMock, layer, [tileId], null);

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
        const layer = new SymbolStyleLayer(layerSpec);
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (painterMock.useProgram as jest.Mock).mockReturnValue(programMock);
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
        (tile.getBucket as jest.Mock).mockReturnValue(bucketMock);
        const sourceCacheMock = new SourceCache(null, null, null);
        (sourceCacheMock.getTile as jest.Mock).mockReturnValue(tile);
        sourceCacheMock.map = {showCollisionBoxes: false} as any as Map;

        drawSymbols(painterMock, sourceCacheMock, layer, [tileId], null);

        expect(programMock.draw).toHaveBeenCalledTimes(0);
    });
});
