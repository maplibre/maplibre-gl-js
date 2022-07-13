import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../source/tile_id';
import SymbolBucket from '../data/bucket/symbol_bucket';
import SourceCache from '../source/source_cache';
import Tile from '../source/tile';
import SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import Painter from './painter';
import Program from './program';
import drawSymbol from './draw_symbol';
import * as symbolProjection from '../symbol/projection';
import type ZoomHistory from '../style/zoom_history';
import type Map from '../ui/map';
import Transform from '../geo/transform';
import type EvaluationParameters from '../style/evaluation_parameters';
import type {SymbolLayerSpecification} from '../style-spec/types.g';
import Style from '../style/style';

jest.mock('./painter');
jest.mock('./program');
jest.mock('../source/source_cache');
jest.mock('../source/tile');
jest.mock('../data/bucket/symbol_bucket');
jest.mock('../symbol/projection');

describe('drawSymbol', () => {
    test('should not do anything', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'opaque';

        drawSymbol(mockPainter, null, null, null, null);

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
        painterMock.transform = {pitch: 0, labelPlaneMatrix: mat4.create()} as any as Transform;
        painterMock.options = {} as any;
        painterMock.style = {} as any as Style;

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
        tileId.posMatrix = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null);
        (painterMock.useProgram as jest.Mock).mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null);
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            }
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

        drawSymbol(painterMock, sourceCacheMock, layer, [tileId], null);

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
        painterMock.transform = {pitch: 0, labelPlaneMatrix: mat4.create()} as any as Transform;
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
        tileId.posMatrix = mat4.create();
        const programMock = new Program(null, null, null, null, null, null, null);
        (painterMock.useProgram as jest.Mock).mockReturnValue(programMock);
        const bucketMock = new SymbolBucket(null);
        bucketMock.icon = {
            programConfigurations: {
                get: () => { }
            },
            segments: {
                get: () => [1]
            }
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
        painterMock.style = {} as any as Style;

        const spy = jest.spyOn(symbolProjection, 'updateLineLabels');
        drawSymbol(painterMock, sourceCacheMock, layer, [tileId], null);

        expect(spy.mock.calls[0][9]).toBeFalsy(); // rotateToLine === false
    });
});
