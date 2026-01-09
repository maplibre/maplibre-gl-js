import {describe, beforeAll, afterAll, test, expect} from 'vitest';
import {TerrainTileManager} from './terrain_tile_manager';
import {Style} from '../style/style';
import {RequestManager} from '../util/request_manager';
import {type Dispatcher} from '../util/dispatcher';
import {fakeServer, type FakeServer} from 'nise';
import {RasterDEMTileSource} from '../source/raster_dem_tile_source';
import {OverscaledTileID} from './tile_id';
import {Tile} from './tile';
import {type DEMData} from '../data/dem_data';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {StubMap} from '../util/test/util';

const transform = new MercatorTransform();

function createSource(options, transformCallback?) {
    const source = new RasterDEMTileSource('id', options, {send() {}} as any as Dispatcher, null);
    source.onAdd({
        transform,
        _requestManager: new RequestManager(transformCallback),
        getPixelRatio() { return 1; }
    } as any);

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

describe('TerrainTileManager', () => {
    let server: FakeServer;
    let style: Style;
    let tsc: TerrainTileManager;

    beforeAll(async () => {
        global.fetch = null;
        server = fakeServer.create();
        server.respondWith('/source.json', JSON.stringify({
            minzoom: 5,
            maxzoom: 12,
            attribution: 'MapLibre',
            tiles: ['http://example.com/{z}/{x}/{y}.pngraw'],
            bounds: [-47, -7, -45, -5]
        }));
        const map = new StubMap();
        style = new Style(map as any);
        const loadPromise = style.once('style.load');
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': []
        });
        await loadPromise;
        const source = createSource({url: '/source.json'});
        server.respond();
        style.addSource('terrain', source as any);
        tsc = new TerrainTileManager(style.tileManagers.terrain);
    });

    afterAll(() => {
        server.restore();
    });

    test('constructor', () => {
        expect(tsc.tileManager.usedForTerrain).toBeTruthy();
        expect(tsc.tileManager.tileSize).toBe(tsc.tileManager._source.tileSize * 2 ** tsc.deltaZoom);
    });

    test('getSourceTile', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const tile = new Tile(tileID, 256);
        tile.dem = {} as DEMData;
        tsc.tileManager._inViewTiles.setTile(tileID.key, tile);
        expect(tsc.deltaZoom).toBe(1);
        expect(tsc.getSourceTile(tileID)).toBeFalsy();
        expect(tsc.getSourceTile(tileID.children(12)[0])).toBeTruthy();
        expect(tsc.getSourceTile(tileID.children(12)[0].children(12)[0])).toBeFalsy();
        expect(tsc.getSourceTile(tileID.children(12)[0].children(12)[0], true)).toBeTruthy();
    });

    test('getSourceTile should get tile from out of view cache when tile in not in view', () => {
        const tileID = new OverscaledTileID(6, 0, 6, 0, 0);
        const underzoomTileID = tileID.scaledTo(tileID.canonical.z - tsc.deltaZoom);
        const tile = new Tile(underzoomTileID, 256);
        tile.dem = {} as DEMData;
        tsc.tileManager._outOfViewCache.setMaxSize(1);
        tsc.tileManager._outOfViewCache.add(underzoomTileID, tile);
        expect(tsc.tileManager._inViewTiles.getTileById(underzoomTileID.key)).toBeUndefined();
        expect(tsc.getSourceTile(tileID, true).tileID.key).toBe(underzoomTileID.key);
    });

    describe('getTerrainCoords', () => {
        describe('tile without custom range', () => {
            test('includes only overlapping tiles', () => {
                const testTile = new OverscaledTileID(2, 0, 2, 1, 1);
                const terrainChildTile = new OverscaledTileID(3, 0, 3, 3, 2);
                const terrainParentTile = new OverscaledTileID(1, 0, 1, 0, 0);
                const terrainSameTile = new OverscaledTileID(2, 0, 2, 1, 1);
                const terrainNonOverlappingTile = new OverscaledTileID(3, 0, 3, 0, 0);

                tsc._tiles = {
                    [terrainChildTile.key]: new Tile(terrainChildTile, 256),
                    [terrainParentTile.key]: new Tile(terrainParentTile, 256),
                    [terrainSameTile.key]: new Tile(terrainSameTile, 256),
                    [terrainNonOverlappingTile.key]: new Tile(terrainNonOverlappingTile, 256),
                };
                tsc._renderableTilesKeys = [
                    terrainChildTile.key,
                    terrainParentTile.key,
                    terrainSameTile.key,
                    terrainNonOverlappingTile.key
                ];

                const result = tsc.getTerrainCoords(testTile);
                expect(result[terrainChildTile.key]).toBeTruthy();
                expect(result[terrainParentTile.key]).toBeTruthy();
                expect(result[terrainSameTile.key]).toBeTruthy();
                expect(result[terrainNonOverlappingTile.key]).toBeFalsy();
            });

            test('includes only renderable tiles', () => {
                const testTile = new OverscaledTileID(2, 0, 2, 1, 1);
                const terrainRenderableTile = new OverscaledTileID(3, 0, 3, 3, 2);
                const terrainNonRenderableTile = new OverscaledTileID(3, 0, 3, 2, 2);

                tsc._tiles = {
                    [terrainRenderableTile.key]: new Tile(terrainRenderableTile, 256),
                    [terrainNonRenderableTile.key]: new Tile(terrainNonRenderableTile, 256)
                };
                tsc._renderableTilesKeys = [terrainRenderableTile.key];

                const result = tsc.getTerrainCoords(testTile);
                expect(result[terrainRenderableTile.key]).toBeTruthy();
                expect(result[terrainNonRenderableTile.key]).toBeFalsy();
            });
        });

        describe('tile with custom range', () => {
            test('includes overlapping terrain tiles', () => {
                const testTileOverlapping = new OverscaledTileID(2, 0, 2, 0, 0);
                const terrainTileRenderable = new OverscaledTileID(3, 0, 3, 3, 2);
                tsc._tiles = {
                    [terrainTileRenderable.key]: new Tile(terrainTileRenderable, 256)
                };
                tsc._renderableTilesKeys = [terrainTileRenderable.key];

                const terrainTileRanges = {
                    3: {
                        minTileX: 2,
                        maxTileX: 4,
                        minTileY: 1,
                        maxTileY: 3,
                        minTileXWrapped: 2,
                        maxTileXWrapped: 4,
                        minWrap: 0,
                        maxWrap: 0
                    }
                };
                const resultOverlapping = tsc.getTerrainCoords(testTileOverlapping, terrainTileRanges);
                expect(resultOverlapping[terrainTileRenderable.key]).toBeTruthy();
            });

            test('ignores non-overlapping terrain tiles', () => {
                const testTileOverlapping = new OverscaledTileID(2, 0, 2, 0, 0);
                const terrainTileRenderable = new OverscaledTileID(3, 0, 3, 3, 2);
                tsc._tiles = {
                    [terrainTileRenderable.key]: new Tile(terrainTileRenderable, 256)
                };
                tsc._renderableTilesKeys = [terrainTileRenderable.key];

                const terrainTileRanges = {
                    3: {
                        minTileX: 4,
                        maxTileX: 6,
                        minTileY: 1,
                        maxTileY: 3,
                        minTileXWrapped: 4,
                        maxTileXWrapped: 6,
                        minWrap: 0,
                        maxWrap: 0
                    }
                };
                const resultOverlapping = tsc.getTerrainCoords(testTileOverlapping, terrainTileRanges);
                expect(resultOverlapping[terrainTileRenderable.key]).toBeFalsy();
            });

            test('includes only renderable tiles', () => {
                const testTile = new OverscaledTileID(2, 0, 2, 1, 1);
                const terrainRenderableTile = new OverscaledTileID(3, 0, 3, 3, 2);
                const terrainNonRenderableTile = new OverscaledTileID(3, 0, 3, 2, 2);

                tsc._tiles = {
                    [terrainRenderableTile.key]: new Tile(terrainRenderableTile, 256),
                    [terrainNonRenderableTile.key]: new Tile(terrainNonRenderableTile, 256)
                };
                tsc._renderableTilesKeys = [terrainRenderableTile.key];

                const terrainTileRanges = {
                    3: {
                        minTileX: 2,
                        maxTileX: 4,
                        minTileY: 1,
                        maxTileY: 3,
                        minTileXWrapped: 2,
                        maxTileXWrapped: 4,
                        minWrap: 0,
                        maxWrap: 0
                    }
                };
                const result = tsc.getTerrainCoords(testTile, terrainTileRanges);
                expect(result[terrainRenderableTile.key]).toBeTruthy();
                expect(result[terrainNonRenderableTile.key]).toBeFalsy();
            });
        });
    });

});
