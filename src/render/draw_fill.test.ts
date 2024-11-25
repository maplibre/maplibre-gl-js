import {describe, test, expect, vi, type Mock} from 'vitest';
import {mat4} from 'gl-matrix';
import {OverscaledTileID} from '../source/tile_id';
import {SourceCache} from '../source/source_cache';
import {Tile} from '../source/tile';
import {Painter, type RenderOptions} from './painter';
import {Program} from './program';
import type {ZoomHistory} from '../style/zoom_history';
import type {Map} from '../ui/map';
import {type IReadonlyTransform} from '../geo/transform_interface';
import type {EvaluationParameters} from '../style/evaluation_parameters';
import type {FillLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {type Style} from '../style/style';
import {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import {drawFill} from './draw_fill';
import {FillBucket} from '../data/bucket/fill_bucket';
import {type ProgramConfiguration, type ProgramConfigurationSet} from '../data/program_configuration';
import type {ProjectionData} from '../geo/projection/projection_data';

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

describe('drawFill', () => {
    test('should call programConfiguration.setConstantPatternPositions for transitioning fill-pattern', () => {

        const painterMock: Painter = constructMockPainter();
        const layer: FillStyleLayer = constructMockLayer();

        const programMock = new Program(null as any, null as any, null as any, null as any, null as any, null as any, null as any, null as any);
        (painterMock.useProgram as Mock).mockReturnValue(programMock);

        const mockTile = constructMockTile(layer);

        const sourceCacheMock = new SourceCache(null as any, null as any, null as any);
        (sourceCacheMock.getTile as Mock).mockReturnValue(mockTile);
        sourceCacheMock.map = {showCollisionBoxes: false} as any as Map;

        const renderOptions: RenderOptions = {isRenderingToTexture: false, isRenderingGlobe: false};
        drawFill(painterMock, sourceCacheMock, layer, [mockTile.tileID], renderOptions);

        // twice: first for fill, second for stroke
        expect(programMock.draw).toHaveBeenCalledTimes(2);

        const bucket: FillBucket = (mockTile.getBucket(layer) as any);
        const programConfiguration = bucket.programConfigurations.get(layer.id);

        expect(programConfiguration.setConstantPatternPositions).toHaveBeenCalled();
    });

    function constructMockLayer(): FillStyleLayer {
        const layerSpec = {
            id: 'mock-layer',
            source: 'empty-source',
            type: 'fill',
            layout: {},
            'paint': {
                'fill-pattern': 'pattern0'
            }
        } as FillLayerSpecification;
        const layer = new FillStyleLayer(layerSpec);
        layer.getCrossfadeParameters = () => ({} as any);
        layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);

        // Important: this setup is on purpose -- to NOT match layerspec
        // 'fill-pattern': 'pattern0'
        // so tile.imageAtlas.patternPositions['pattern0'] would return nothing
        // mimicing the transitioning fill-pattern value
        layer.getPaintProperty = () => {
            return 'pattern1';
        };

        return layer;
    }

    function constructMockPainter(): Painter {
        const painterMock = new Painter(null as any, null as any);
        painterMock.context = {
            gl: {},
            activeTexture: {
                set: () => {}
            }
        } as any;
        painterMock.renderPass = 'translucent';
        painterMock.transform = {
            pitch: 0,
            labelPlaneMatrix: mat4.create(),
            zoom: 0,
            angle: 0,
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
        painterMock.options = {} as any;
        painterMock.style = {
            map: {
                projection: {}
            }
        } as any as Style;

        return painterMock;
    }

    function constructMockTile(layer: FillStyleLayer): Tile {
        const tileId = new OverscaledTileID(1, 0, 1, 0, 0);
        tileId.terrainRttPosMatrix32f = mat4.create();

        const tile = new Tile(tileId, 256);
        tile.tileID = tileId;

        // Important: this setup is on purpose -- to NOT match layerspec
        // 'fill-pattern': 'pattern0'
        // so tile.imageAtlas.patternPositions['pattern0'] would return nothing
        // mimicing the transitioning fill-pattern value
        tile.imageAtlas = {
            patternPositions: {
                'pattern1': {}
            }
        } as any;
        tile.imageAtlasTexture = {
            bind: () => {}
        } as any;

        const bucketMock = constructMockBucket(layer);

        (tile.getBucket as Mock).mockReturnValue(bucketMock);
        (tile.patternsLoaded as Mock).mockReturnValue(true);
        return tile;
    }

    function constructMockBucket(layer: FillStyleLayer) {
        const bucketMock = new FillBucket({
            layers: [layer]
        } as any);

        const mockProgramConfigurations: ProgramConfigurationSet<FillStyleLayer> = {} as any;
        const mockProgramConfiguration: ProgramConfiguration = {} as any;
        mockProgramConfiguration.updatePaintBuffers = () => {};
        mockProgramConfiguration.setConstantPatternPositions = vi.fn();

        mockProgramConfigurations.get = () => mockProgramConfiguration;

        bucketMock.programConfigurations = mockProgramConfigurations;

        return bucketMock;
    }
});
