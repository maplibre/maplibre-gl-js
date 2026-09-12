import {describe, test, expect, vi} from 'vitest';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {TileManager} from '../../tile/tile_manager.ts';
import {Tile} from '../../tile/tile.ts';
import {Painter} from '../../render/painter.ts';
import {createRenderOptions} from '../../render/render_options.ts';
import {Program} from '../program.ts';
import {ZoomHistory} from '../../style/zoom_history.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {type IReadonlyTransform} from '../../geo/transform_interface.ts';
import type {LineLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type Style} from '../../style/style.ts';
import {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import {drawLine} from './draw_line.ts';
import {LineBucket} from '../../data/bucket/line_bucket.ts';
import {type ProgramConfiguration, type ProgramConfigurationSet} from '../../data/program_configuration.ts';
import type {ProjectionData} from '../../geo/projection/projection_data.ts';
import {createIdentityMat4f32} from '../../util/util.ts';

vi.mock(import('../../render/painter'));
vi.mock(import('../program'));
vi.mock(import('../../tile/tile_manager'));
vi.mock(import('../../tile/tile'));

describe('drawLine', () => {
    test('should use the to position for both pattern positions when the atlas holds only the to sprite', () => {
        const painterMock: Painter = constructMockPainter();
        const layer: LineStyleLayer = constructMockPatternLayer();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (vi.mocked(painterMock.useProgram)).mockReturnValue(programMock);

        const toPosition = {x: 1, y: 2};
        const mockTile = constructMockTile(layer, {'patternB': toPosition});

        const tileManagerMock = new TileManager(null, null, null);
        (vi.mocked(tileManagerMock.getTile)).mockReturnValue(mockTile);

        drawLine(painterMock, tileManagerMock, layer, [mockTile.tileID], painterMock.renderOptions);

        const bucket: LineBucket = (mockTile.getBucket(layer) as any);
        const programConfiguration = bucket.programConfigurations.get(layer.id);

        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalledTimes(1);
        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalledWith(toPosition, toPosition);
    });

    test('should use both distinct positions when the atlas holds both sprites', () => {
        const painterMock: Painter = constructMockPainter();
        const layer: LineStyleLayer = constructMockPatternLayer();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (vi.mocked(painterMock.useProgram)).mockReturnValue(programMock);

        const toPosition = {x: 1, y: 2};
        const fromPosition = {x: 3, y: 4};
        const mockTile = constructMockTile(layer, {'patternA': fromPosition, 'patternB': toPosition});

        const tileManagerMock = new TileManager(null, null, null);
        (vi.mocked(tileManagerMock.getTile)).mockReturnValue(mockTile);

        drawLine(painterMock, tileManagerMock, layer, [mockTile.tileID], painterMock.renderOptions);

        const bucket: LineBucket = (mockTile.getBucket(layer) as any);
        const programConfiguration = bucket.programConfigurations.get(layer.id);

        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalledTimes(1);
        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalledWith(toPosition, fromPosition);
    });

    test('should use the from position for both pattern positions when the atlas holds only the from sprite', () => {
        const painterMock: Painter = constructMockPainter();
        const layer: LineStyleLayer = constructMockPatternLayer();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (vi.mocked(painterMock.useProgram)).mockReturnValue(programMock);

        const fromPosition = {x: 3, y: 4};
        const mockTile = constructMockTile(layer, {'patternA': fromPosition});

        const tileManagerMock = new TileManager(null, null, null);
        (vi.mocked(tileManagerMock.getTile)).mockReturnValue(mockTile);

        drawLine(painterMock, tileManagerMock, layer, [mockTile.tileID], painterMock.renderOptions);

        const bucket: LineBucket = (mockTile.getBucket(layer) as any);
        const programConfiguration = bucket.programConfigurations.get(layer.id);

        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalledTimes(1);
        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalledWith(fromPosition, fromPosition);
    });

    test('should not bind pattern positions when neither sprite is in the atlas', () => {
        const painterMock: Painter = constructMockPainter();
        const layer: LineStyleLayer = constructMockPatternLayer();
        const programMock = new Program(null, null, null, null, null, null, null, null);
        (vi.mocked(painterMock.useProgram)).mockReturnValue(programMock);

        const mockTile = constructMockTile(layer, {});

        const tileManagerMock = new TileManager(null, null, null);
        (vi.mocked(tileManagerMock.getTile)).mockReturnValue(mockTile);

        drawLine(painterMock, tileManagerMock, layer, [mockTile.tileID], painterMock.renderOptions);

        const bucket: LineBucket = (mockTile.getBucket(layer) as any);
        const programConfiguration = bucket.programConfigurations.get(layer.id);

        expect(programConfiguration.setConstantPatternPositions).not.toHaveBeenCalled();
    });

    function constructMockPatternLayer(): LineStyleLayer {
        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'line',
            layout: {},
            'paint': {
                'line-width': 10,
                'line-pattern': ['step', ['zoom'], 'patternA', 13, 'patternB']
            }
        } as LineLayerSpecification;
        const layer = new LineStyleLayer(layerSpec, {});

        const zoomHistory = new ZoomHistory();
        zoomHistory.update(13.1, 0);
        layer.recalculate(new EvaluationParameters(13.1, {zoomHistory}), []);

        return layer;
    }

    function constructMockPainter(): Painter {
        const painterMock = new Painter(null, null);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => {}
            },
            program: {
                get: () => null
            }
        } as any;
        painterMock.transform = {
            pitch: 0,
            zoom: 13.1,
            tileZoom: 13,
            angle: 0,
            maxZoom: 24,
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
            getPixelScale: () => 1
        } as any as IReadonlyTransform;
        painterMock.renderOptions = createRenderOptions(painterMock.transform, undefined, null);
        painterMock.renderOptions.currentPass = 'translucent';
        painterMock.options = {} as any;
        painterMock.style = {
            map: {
                projection: {}
            }
        } as any as Style;

        return painterMock;
    }

    function constructMockTile(layer: LineStyleLayer, patternPositions: Record<string, unknown>): Tile {
        const tileId = new OverscaledTileID(13, 0, 13, 0, 0);
        tileId.terrainRttPosMatrix32f = createIdentityMat4f32();

        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;

        tile.imageAtlas = {
            patternPositions
        } as any;
        tile.imageAtlasTexture = {
            size: [0, 0],
            bind: () => {}
        } as any;

        const bucketMock = constructMockBucket(layer);

        (vi.mocked(tile.getBucket)).mockReturnValue(bucketMock);
        (vi.mocked(tile.patternsLoaded)).mockReturnValue(true);
        return tile;
    }

    function constructMockBucket(layer: LineStyleLayer) {
        const bucketMock = new LineBucket({
            layers: [layer]
        } as any);

        const mockProgramConfigurations: ProgramConfigurationSet<LineStyleLayer> = {} as any;
        const mockProgramConfiguration: ProgramConfiguration = {} as any;
        mockProgramConfiguration.updatePaintBuffers = () => {};
        mockProgramConfiguration.setConstantPatternPositions = vi.fn();

        mockProgramConfigurations.get = () => mockProgramConfiguration;

        bucketMock.programConfigurations = mockProgramConfigurations;

        return bucketMock;
    }
});
