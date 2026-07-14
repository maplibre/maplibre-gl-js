import {describe, test, expect, vi, type Mock} from 'vitest';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {TileManager} from '../../tile/tile_manager.ts';
import {Tile} from '../../tile/tile.ts';
import {Painter, type RenderOptions} from '../../render/painter.ts';
import type {Map} from '../../ui/map.ts';
import {drawCustom, getCustomLayerTiles} from './draw_custom.ts';
import {CustomStyleLayer} from '../../style/style_layer/custom_style_layer.ts';
import {MercatorTransform} from '../../geo/projection/mercator_transform.ts';
import {MercatorProjection} from '../../geo/projection/mercator_projection.ts';
import {type CustomRenderMethodInput} from '../../style/style_layer/custom_style_layer.ts';
import {expectToBeCloseToArray} from '../../util/test/util.ts';
import {GEOJSON_TILE_LAYER_NAME} from '../../data/feature_index.ts';

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
        const features = {length: 1, feature: vi.fn()};
        const loadVTLayers = vi.fn().mockReturnValue({buildings: features});
        tile.latestFeatureIndex = {
            rawTileData: new ArrayBuffer(1),
            loadVTLayers
        } as any;
        tile.imageAtlasTexture = {
            bind: () => { }
        } as any;
        const tileManagerMock = new TileManager(null, null, null);
        (tileManagerMock.getSource as Mock).mockReturnValue({type: 'vector'});
        (tileManagerMock.getTile as Mock).mockReturnValue(tile);
        (tileManagerMock.getVisibleCoordinates as Mock).mockReturnValue([tileId]);
        tileManagerMock.map = {showCollisionBoxes: false} as any as Map;

        let result: {
            gl: WebGLRenderingContext | WebGL2RenderingContext;
            args: CustomRenderMethodInput;
        };
        const mockLayer = new CustomStyleLayer({
            id: 'custom-layer',
            type: 'custom',
            source: 'models',
            'source-layer': 'buildings',
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
        expect(result.args.tiles).toHaveLength(1);
        expect(result.args.tiles[0].tileID).toEqual({wrap: 0, canonical: {z: 1, x: 0, y: 0}});
        expect(result.args.tiles[0].data).toEqual({type: 'vector', features});
        expect(loadVTLayers).toHaveBeenCalledOnce();
        expect(result.args.modelViewProjectionMatrix).toEqual(mockPainter.transform.modelViewProjectionMatrix);
        expect(result.args.projectionMatrix).toEqual(mockPainter.transform.projectionMatrix);
        expectToBeCloseToArray(result.args.defaultProjectionData.tileMercatorCoords, [0, 0, 1, 1]);
        expect(result.args.defaultProjectionData.mainMatrix).toBeInstanceOf(Float64Array);
        expect(result.args.defaultProjectionData.fallbackMatrix).toBeInstanceOf(Float64Array);
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
        expect(tileProjectionData.mainMatrix).toBeInstanceOf(Float32Array);
        expect(tileProjectionData.fallbackMatrix).toBeInstanceOf(Float32Array);
        expect(tileProjectionData.mainMatrix[0]).toBeCloseTo(0.09375, 6);
        expect(tileProjectionData.mainMatrix[5]).toBeCloseTo(-0.09232572466135025, 6);
        expect(tileProjectionData.mainMatrix[15]).toBeCloseTo(794.4539184570312, 6);
        expect(tileProjectionData.projectionTransition).toEqual(0);
        expect(tileProjectionData.mainMatrix).toEqual(tileProjectionData.fallbackMatrix);
    });
});

describe('getCustomLayerTiles', () => {
    test('omits visible coordinates whose tile has been removed', () => {
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'vector'});
        (tileManager.getVisibleCoordinates as Mock).mockReturnValue([tileID]);
        (tileManager.getTile as Mock).mockReturnValue(undefined);

        expect(getCustomLayerTiles(tileManager, 'buildings')).toEqual([]);
    });

    test('omits a tile while it has no decoded source layer', () => {
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        const tile = new Tile(tileID, 256);
        tile.latestFeatureIndex = undefined;
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'vector'});
        (tileManager.getVisibleCoordinates as Mock).mockReturnValue([tileID]);
        (tileManager.getTile as Mock).mockReturnValue(tile);

        expect(getCustomLayerTiles(tileManager, 'buildings')).toEqual([]);
    });

    test('provides GeoJSON features', () => {
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        const tile = new Tile(tileID, 256);
        const geoJSONFeatures = {length: 1, feature: vi.fn()};
        tile.latestFeatureIndex = {
            rawTileData: new ArrayBuffer(1),
            loadVTLayers: vi.fn().mockReturnValue({
                [GEOJSON_TILE_LAYER_NAME]: geoJSONFeatures,
                ignored: {length: 2, feature: vi.fn()}
            })
        } as any;
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'geojson'});
        (tileManager.getVisibleCoordinates as Mock).mockReturnValue([tileID]);
        (tileManager.getTile as Mock).mockReturnValue(tile);

        const tiles = getCustomLayerTiles(tileManager, '');

        expect(tiles).toHaveLength(1);
        expect(tiles[0].data).toEqual({type: 'vector', features: geoJSONFeatures});
    });

    test('provides the configured vector source layer', () => {
        const tileID = new OverscaledTileID(1, 0, 1, 0, 0);
        const tile = new Tile(tileID, 256);
        const buildings = {length: 1, feature: vi.fn()};
        tile.latestFeatureIndex = {
            rawTileData: new ArrayBuffer(1),
            loadVTLayers: vi.fn().mockReturnValue({
                buildings,
                roads: {length: 2, feature: vi.fn()}
            })
        } as any;
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'vector'});
        (tileManager.getVisibleCoordinates as Mock).mockReturnValue([tileID]);
        (tileManager.getTile as Mock).mockReturnValue(tile);

        const renderedTiles = getCustomLayerTiles(tileManager, 'buildings');
        expect(renderedTiles[0].data).toEqual({type: 'vector', features: buildings});
    });

    test('passes an empty tile list to a source-less custom layer', () => {
        expect(getCustomLayerTiles(undefined, '')).toEqual([]);
    });

    test('rejects unsupported source types', () => {
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'raster'});

        expect(() => getCustomLayerTiles(tileManager, '')).toThrow('Custom layers do not support source type "raster"');
    });

    test('requires a source layer for vector sources', () => {
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'vector'});

        expect(() => getCustomLayerTiles(tileManager, '')).toThrow('Custom layers using a vector source must specify "source-layer"');
    });

    test('preserves visible tile order and world wraps', () => {
        const tileIDs = [
            new OverscaledTileID(1, -1, 1, 0, 0),
            new OverscaledTileID(1, 1, 1, 0, 0)
        ];
        const tiles = tileIDs.map((tileID) => {
            const tile = new Tile(tileID, 256);
            tile.tileID = tileID;
            tile.latestFeatureIndex = {
                rawTileData: new ArrayBuffer(1),
                loadVTLayers: vi.fn().mockReturnValue({points: {length: 1, feature: vi.fn()}})
            } as any;
            return tile;
        });
        const tileManager = new TileManager(null, null, null);
        (tileManager.getSource as Mock).mockReturnValue({type: 'vector'});
        (tileManager.getVisibleCoordinates as Mock).mockReturnValue(tileIDs);
        (tileManager.getTile as Mock).mockImplementation((tileID) => tiles.find((tile) => tile.tileID.wrap === tileID.wrap));

        const renderedTiles = getCustomLayerTiles(tileManager, 'points');

        expect(renderedTiles.map((tile) => tile.tileID)).toEqual([
            {wrap: -1, canonical: {z: 1, x: 0, y: 0}},
            {wrap: 1, canonical: {z: 1, x: 0, y: 0}}
        ]);
    });
});
