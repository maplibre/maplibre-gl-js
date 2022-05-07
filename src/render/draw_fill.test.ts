import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../source/tile_id';
import SourceCache from '../source/source_cache';
import Tile from '../source/tile';
import Painter from './painter';
import Program from './program';
import type ZoomHistory from '../style/zoom_history';
import type Map from '../ui/map';
import type EvaluationParameters from '../style/evaluation_parameters';
import type {FillLayerSpecification} from '../style-spec/types.g';
import FillStyleLayer from '../style/style_layer/fill_style_layer';
import drawFill from './draw_fill';
import FillBucket from '../data/bucket/fill_bucket';

jest.mock('./painter');
jest.mock('./program');
jest.mock('../source/source_cache');
jest.mock('../source/tile');
jest.mock('../data/bucket/fill_bucket');
jest.mock('../symbol/projection');

const layerSpec = {
    id: 'mock-layer',
    source: 'empty-source',
    type: 'fill',
    layout: {},
    paint: {
        'fill-color': 'red',
        'fill-opacity': 0
    }
} as FillLayerSpecification;

describe('drawFill', () => {
    let tileId, sourceCacheMock;
    beforeEach(() => {
        tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.posMatrix = mat4.create();
        const bucketMock = new FillBucket(null);
        bucketMock.programConfigurations = {
            get: () => {
                return {
                    updatePaintBuffers: () => {}
                };
            }
        } as any;
        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;
        tile.imageAtlasTexture = {
            bind: () => {}
        } as any;
        (tile.getBucket as jest.Mock).mockReturnValue(bucketMock);
        sourceCacheMock = new SourceCache(null, null, null);
        (sourceCacheMock.getTile as jest.Mock).mockReturnValue(tile);
        sourceCacheMock.map = {showCollisionBoxes: false} as any as Map;
    });

    test('should not do anything when fill-opacity is 0', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'opaque';

        const layer = new FillStyleLayer(layerSpec);

        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        drawFill(mockPainter, null, layer, null);

        expect(mockPainter.colorModeForRenderPass).not.toHaveBeenCalled();
    });

    test('should use fill and fillOutline programs', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'translucent';

        mockPainter.context = {
            gl: {},
            activeTexture: {
                set: () => {}
            }
        } as any;

        mockPainter.transform = {
            zoom: 1
        } as any;

        const layer = new FillStyleLayer(
            {
                ...layerSpec,
                paint: {
                    'fill-color': 'red',
                    'fill-opacity': 0.5
                }
            }
        );

        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        const fillProgramMock = new Program(null, null, null, null, null, null);
        const fillOutlineProgramMock = new Program(null, null, null, null, null, null);
        mockPainter.useProgram = (programName) => {
            switch (programName) {
                case 'fill': {
                    return fillProgramMock;
                }
                case 'fillOutline': {
                    return fillOutlineProgramMock;
                }
                default:
                    return null;
            }
        };

        drawFill(mockPainter, sourceCacheMock, layer, [tileId]);

        expect(fillProgramMock.draw).toHaveBeenCalledTimes(1);
        expect(fillOutlineProgramMock.draw).toHaveBeenCalledTimes(1);
    });

    test('should call bindFramebuffer in offscreen render pass', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'offscreen';

        const bindFramebuffer = {
            set: () => {}
        } as any;
        const mockFn = () => {};
        mockPainter.context = {
            gl: {
                bindTexture: mockFn
            },
            clear: mockFn,
            viewport: {
                set: mockFn
            },
            activeTexture: {
                set: mockFn
            },
            bindFramebuffer,
            setColorMode: mockFn
        } as any;

        mockPainter.transform = {
            zoom: 1
        } as any;

        const layer = new FillStyleLayer(
            {
                ...layerSpec,
                paint: {
                    'fill-color': 'red',
                    'fill-opacity': 0.5,
                    'fill-per-layer-opacity': true
                }
            }
        );

        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        layer.fillFbo = {
            colorAttachment: {
                get: () => {}
            }
        } as any;

        const fillProgramMock = new Program(null, null, null, null, null, null);
        const fillfboProgramMock = new Program(null, null, null, null, null, null);
        mockPainter.useProgram = (programName) => {
            switch (programName) {
                case 'fill': {
                    return fillProgramMock;
                }
                case 'fillfbo': {
                    return fillfboProgramMock;
                }
                default:
                    return null;
            }
        };

        const spy = jest.spyOn(bindFramebuffer, 'set');
        drawFill(mockPainter, sourceCacheMock, layer, [tileId]);

        expect(spy.mock.calls[0]).toBeTruthy();
    });

    test('should render texture of fbo to screen if fill-per-layer-opacity is true and render pass is translucent ', () => {
        const mockPainter = new Painter(null, null);
        mockPainter.renderPass = 'translucent';

        const bindFramebuffer = {
            set: () => {}
        } as any;
        mockPainter.context = {
            gl: {
                bindTexture: () => {}
            },
            activeTexture: {
                set: () => {}
            },
            bindFramebuffer,
            setColorMode: () => {}
        } as any;

        mockPainter.transform = {
            zoom: 1
        } as any;

        const layer = new FillStyleLayer(
            {
                ...layerSpec,
                paint: {
                    'fill-color': 'red',
                    'fill-opacity': 0.5,
                    'fill-per-layer-opacity': true
                }
            }
        );

        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        layer.fillFbo = {
            colorAttachment: {
                get: () => {}
            }
        } as any;

        const fillProgramMock = new Program(null, null, null, null, null, null);
        const fillfboProgramMock = new Program(null, null, null, null, null, null);
        mockPainter.useProgram = (programName) => {
            switch (programName) {
                case 'fill': {
                    return fillProgramMock;
                }
                case 'fillfbo': {
                    return fillfboProgramMock;
                }
                default:
                    return null;
            }
        };

        drawFill(mockPainter, sourceCacheMock, layer, [tileId]);

        expect(fillProgramMock.draw).toHaveBeenCalledTimes(0);
        expect(fillfboProgramMock.draw).toHaveBeenCalledTimes(1);
    });
});
