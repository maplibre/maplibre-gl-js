import {describe, beforeAll, beforeEach, afterAll, test, expect, vi, type MockInstance} from 'vitest';
import {TerrainSourceCache} from './terrain_source_cache';
import {Style} from '../style/style';
import {RequestManager} from '../util/request_manager';
import {type Dispatcher} from '../util/dispatcher';
import {fakeServer, type FakeServer} from 'nise';
import {RasterDEMTileSource} from './raster_dem_tile_source';
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

describe('TerrainSourceCache', () => {
    let server: FakeServer;
    let style: Style;
    let tsc: TerrainSourceCache;

    beforeAll(() => new Promise<void>(done => {
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
        style.on('style.load', () => {
            const source = createSource({url: '/source.json'});
            server.respond();
            style.addSource('terrain', source as any);
            tsc = new TerrainSourceCache(style.sourceCaches.terrain);
            done();
        });
        style.loadJSON({
            'version': 8,
            'sources': {},
            'layers': []
        });
    }));

    afterAll(() => {
        server.restore();
    });

    test('#constructor', () => {
        expect(tsc.sourceCache.usedForTerrain).toBeTruthy();
        expect(tsc.sourceCache.tileSize).toBe(tsc.sourceCache._source.tileSize * 2 ** tsc.deltaZoom);
    });

    test('#getSourceTile', () => {
        const tileID = new OverscaledTileID(5, 0, 5, 17, 11);
        const tile = new Tile(tileID, 256);
        tile.dem = {} as DEMData;
        tsc.sourceCache._tiles[tileID.key] = tile;
        expect(tsc.deltaZoom).toBe(1);
        expect(tsc.getSourceTile(tileID)).toBeFalsy();
        expect(tsc.getSourceTile(tileID.children(12)[0])).toBeTruthy();
        expect(tsc.getSourceTile(tileID.children(12)[0].children(12)[0])).toBeFalsy();
        expect(tsc.getSourceTile(tileID.children(12)[0].children(12)[0], true)).toBeTruthy();
    });

    describe('#getTerrainCoords', () => {
        let getCoordsRegularTileSpy: MockInstance;
        let getCoordsOversizedTileSpy: MockInstance;

        beforeAll(() => {
            getCoordsRegularTileSpy = vi.spyOn(tsc, '_getTerrainCoordsForRegularTile');
            getCoordsOversizedTileSpy = vi.spyOn(tsc, '_getTerrainCoordsForOversizedTile');
        });

        beforeEach(() => {
            getCoordsRegularTileSpy.mockClear();
            getCoordsOversizedTileSpy.mockClear();
        });

        test('should call _getTerrainCoordsForRegularTile for tile without custom range', () => {
            const tile = new OverscaledTileID(5, 0, 5, 17, 11);
            tsc.getTerrainCoords(tile);
            expect(getCoordsRegularTileSpy).toHaveBeenCalled();
            expect(getCoordsOversizedTileSpy).not.toHaveBeenCalled();
        });

        test('should call _getTerrainCoordsForOversizedTile for tile with custom range', () => {
            const tile = new OverscaledTileID(5, 0, 5, 17, 11);
            tile.terrainTileRanges = {1: {minTileX: 0, maxTileX: 1, minTileY: 0, maxTileY: 1}};
            tsc.getTerrainCoords(tile);
            expect(getCoordsRegularTileSpy).not.toHaveBeenCalled();
            expect(getCoordsOversizedTileSpy).toHaveBeenCalled();
        });
    });

    describe('#_getTerrainCoordsForRegularTile', () => {
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

            const result = tsc._getTerrainCoordsForRegularTile(testTile);
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

            const result = tsc._getTerrainCoordsForRegularTile(testTile);
            expect(result[terrainRenderableTile.key]).toBeTruthy();
            expect(result[terrainNonRenderableTile.key]).toBeFalsy();
        });
    });

    describe('#_getTerrainCoordsForOversizedTile', () => {
        test('includes only overlapping tiles', () => {
            const testTileOverlapping = new OverscaledTileID(2, 0, 2, 1, 1);
            vi.spyOn(testTileOverlapping, 'isOverlappingTerrainTile').mockReturnValue(true);
            const testTileNotOverlapping = new OverscaledTileID(2, 0, 2, 1, 1);
            vi.spyOn(testTileNotOverlapping, 'isOverlappingTerrainTile').mockReturnValue(false);

            const terrainTileRenderable = new OverscaledTileID(3, 0, 3, 3, 2);
            tsc._tiles = {
                [terrainTileRenderable.key]: new Tile(terrainTileRenderable, 256)
            };
            tsc._renderableTilesKeys = [terrainTileRenderable.key];

            const resultOverlapping = tsc._getTerrainCoordsForOversizedTile(testTileOverlapping);
            expect(resultOverlapping[terrainTileRenderable.key]).toBeTruthy();

            const resultNotOverlapping = tsc._getTerrainCoordsForOversizedTile(testTileNotOverlapping);
            expect(resultNotOverlapping[terrainTileRenderable.key]).toBeFalsy();
        });

        test('includes only renderable tiles', () => {
            const testTile = new OverscaledTileID(2, 0, 2, 1, 1);
            vi.spyOn(testTile, 'isOverlappingTerrainTile').mockReturnValue(true);

            const terrainRenderableTile = new OverscaledTileID(3, 0, 3, 3, 2);
            const terrainNonRenderableTile = new OverscaledTileID(3, 0, 3, 2, 2);

            tsc._tiles = {
                [terrainRenderableTile.key]: new Tile(terrainRenderableTile, 256),
                [terrainNonRenderableTile.key]: new Tile(terrainNonRenderableTile, 256)
            };
            tsc._renderableTilesKeys = [terrainRenderableTile.key];

            const result = tsc._getTerrainCoordsForOversizedTile(testTile);
            expect(result[terrainRenderableTile.key]).toBeTruthy();
            expect(result[terrainNonRenderableTile.key]).toBeFalsy();
        });
    });
});
