import {describe, test, expect, vi} from 'vitest';
import {createSymbolBucket} from '../../test/unit/lib/create_symbol_layer';
import {Tile} from '../source/tile';
import {GeoJSONWrapper, type Feature} from '../source/geojson_wrapper';
import {OverscaledTileID} from '../source/tile_id';
import fs from 'fs';
import path from 'path';
import vtpbf from 'vt-pbf';
import {FeatureIndex} from '../data/feature_index';
import {CollisionBoxArray} from '../data/array_types.g';
import {extend} from '../util/util';
import {serialize, deserialize} from '../util/web_worker_transfer';

describe('querySourceFeatures', () => {
    const features = [{
        type: 1,
        geometry: [0, 0],
        tags: {oneway: true}
    } as any as Feature];

    test('geojson tile', () => {
        const tile = new Tile(new OverscaledTileID(3, 0, 2, 1, 2), undefined);
        let result;

        result = [];
        tile.querySourceFeatures(result);
        expect(result).toHaveLength(0);

        const geojsonWrapper = new GeoJSONWrapper(features);
        geojsonWrapper.name = '_geojsonTileLayer';
        tile.loadVectorData(
            createVectorData({rawTileData: vtpbf({layers: {'_geojsonTileLayer': geojsonWrapper}})}),
            createPainter()
        );

        result = [];
        tile.querySourceFeatures(result);
        expect(result).toHaveLength(1);
        expect(result[0].geometry.coordinates[0]).toEqual([-90, 0]);
        result = [];
        tile.querySourceFeatures(result, {} as any);
        expect(result).toHaveLength(1);
        expect(result[0].properties).toEqual(features[0].tags);
        result = [];
        tile.querySourceFeatures(result, {sourceLayer: undefined, filter: ['==', 'oneway', true]});
        expect(result).toHaveLength(1);
        result = [];
        tile.querySourceFeatures(result, {sourceLayer: undefined, filter: ['!=', 'oneway', true]});
        expect(result).toHaveLength(0);
        result = [];
        const polygon = {type: 'Polygon',  coordinates: [[[-91, -1], [-89, -1], [-89, 1], [-91, 1], [-91, -1]]]};
        tile.querySourceFeatures(result, {sourceLayer: undefined, filter: ['within', polygon]});
        expect(result).toHaveLength(1);
    });

    test('empty geojson tile', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        let result;

        result = [];
        tile.querySourceFeatures(result);
        expect(result).toHaveLength(0);

        const geojsonWrapper = new GeoJSONWrapper([]);
        geojsonWrapper.name = '_geojsonTileLayer';

        result = [];
        expect(() => { tile.querySourceFeatures(result); }).not.toThrow();
        expect(result).toHaveLength(0);
    });

    test('vector tile', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        let result;

        result = [];
        tile.querySourceFeatures(result);
        expect(result).toHaveLength(0);

        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData()}),
            createPainter()
        );

        result = [];
        tile.querySourceFeatures(result, {sourceLayer: 'does-not-exist', filter: undefined});
        expect(result).toHaveLength(0);

        result = [];
        tile.querySourceFeatures(result, {sourceLayer: 'road', filter: undefined});
        expect(result).toHaveLength(3);

        result = [];
        tile.querySourceFeatures(result, {sourceLayer: 'road', filter: ['==', 'class', 'main']});
        expect(result).toHaveLength(1);
        result = [];
        tile.querySourceFeatures(result, {sourceLayer: 'road', filter: ['!=', 'class', 'main']});
        expect(result).toHaveLength(2);

    });

    test('loadVectorData unloads existing data before overwriting it', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        tile.state = 'loaded';
        const spy = vi.spyOn(tile, 'unloadVectorData');
        const painter = {};

        tile.loadVectorData(null, painter);

        expect(spy).toHaveBeenCalledWith();
    });

    test('loadVectorData preserves the most recent rawTileData', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        tile.state = 'loaded';

        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData()}),
            createPainter()
        );
        tile.loadVectorData(
            createVectorData(),
            createPainter()
        );

        const features = [];
        tile.querySourceFeatures(features, {sourceLayer: 'road', filter: undefined});
        expect(features).toHaveLength(3);

    });

});

describe('Tile#isLessThan', () => {
    test('correctly sorts tiles', () => {
        const tiles = [
            new OverscaledTileID(9, 0, 9, 146, 195),
            new OverscaledTileID(9, 0, 9, 147, 195),
            new OverscaledTileID(9, 0, 9, 148, 195),
            new OverscaledTileID(9, 0, 9, 149, 195),
            new OverscaledTileID(9, 1, 9, 144, 196),
            new OverscaledTileID(9, 0, 9, 145, 196),
            new OverscaledTileID(9, 0, 9, 146, 196),
            new OverscaledTileID(9, 1, 9, 147, 196),
            new OverscaledTileID(9, 0, 9, 145, 194),
            new OverscaledTileID(9, 0, 9, 149, 196),
            new OverscaledTileID(10, 0, 10, 293, 391),
            new OverscaledTileID(10, 0, 10, 291, 390),
            new OverscaledTileID(10, 1, 10, 293, 390),
            new OverscaledTileID(10, 0, 10, 294, 390),
            new OverscaledTileID(10, 0, 10, 295, 390),
            new OverscaledTileID(10, 0, 10, 291, 391),
        ];

        const sortedTiles = tiles.sort((a, b) => { return a.isLessThan(b) ? -1 : b.isLessThan(a) ? 1 : 0; });

        expect(sortedTiles).toEqual([
            new OverscaledTileID(9, 0, 9, 145, 194),
            new OverscaledTileID(9, 0, 9, 145, 196),
            new OverscaledTileID(9, 0, 9, 146, 195),
            new OverscaledTileID(9, 0, 9, 146, 196),
            new OverscaledTileID(9, 0, 9, 147, 195),
            new OverscaledTileID(9, 0, 9, 148, 195),
            new OverscaledTileID(9, 0, 9, 149, 195),
            new OverscaledTileID(9, 0, 9, 149, 196),
            new OverscaledTileID(10, 0, 10, 291, 390),
            new OverscaledTileID(10, 0, 10, 291, 391),
            new OverscaledTileID(10, 0, 10, 293, 391),
            new OverscaledTileID(10, 0, 10, 294, 390),
            new OverscaledTileID(10, 0, 10, 295, 390),
            new OverscaledTileID(9, 1, 9, 144, 196),
            new OverscaledTileID(9, 1, 9, 147, 196),
            new OverscaledTileID(10, 1, 10, 293, 390),
        ]);
    });
});

describe('expiring tiles', () => {
    test('regular tiles do not expire', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        expect(tile.getExpiryTimeout()).toBeFalsy();

    });

    test('set, get expiry', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        tile.setExpiryData({
            cacheControl: 'max-age=60'
        });

        // times are fuzzy, so we'll give this a little leeway:
        let expiryTimeout = tile.getExpiryTimeout();
        expect(expiryTimeout >= 56000 && expiryTimeout <= 60000).toBeTruthy();

        const date = new Date();
        date.setMinutes(date.getMinutes() + 10);
        date.setMilliseconds(0);

        tile.setExpiryData({
            expires: date.toString()
        });

        expiryTimeout = tile.getExpiryTimeout();
        expect(expiryTimeout > 598000 && expiryTimeout < 600000).toBeTruthy();

    });

    test('exponential backoff handling', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        tile.setExpiryData({
            cacheControl: 'max-age=10'
        });

        const expiryTimeout = tile.getExpiryTimeout();
        expect(expiryTimeout >= 8000 && expiryTimeout <= 10000).toBeTruthy();

        const justNow = new Date();
        justNow.setSeconds(justNow.getSeconds() - 1);

        // every time we set a tile's expiration to a date already expired,
        // it assumes it comes from a new HTTP response, so this is counted
        // as an extra expired tile request
        tile.setExpiryData({
            expires: justNow
        });
        expect(tile.getExpiryTimeout()).toBe(1000);

        tile.setExpiryData({
            expires: justNow
        });
        expect(tile.getExpiryTimeout()).toBe(2000);
        tile.setExpiryData({
            expires: justNow
        });
        expect(tile.getExpiryTimeout()).toBe(4000);

        tile.setExpiryData({
            expires: justNow
        });
        expect(tile.getExpiryTimeout()).toBe(8000);

    });

});

describe('rtl text detection', () => {
    test('Tile#hasRTLText is true when a tile loads a symbol bucket with rtl text', () => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1), undefined);
        // Create a stub symbol bucket
        const symbolBucket = createSymbolBucket('test', 'Test', 'test', new CollisionBoxArray());
        // symbolBucket has not been populated yet so we force override the value in the stub
        symbolBucket.hasRTLText = true;
        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData(), buckets: [symbolBucket]}),
            createPainter({
                getLayer() {
                    return symbolBucket.layers[0];
                }
            })
        );

        expect(tile.hasRTLText).toBeTruthy();
    });

});

function createRawTileData() {
    return fs.readFileSync(path.join(__dirname, '../../test/unit/assets/mbsv5-6-18-23.vector.pbf'));
}

function createVectorData(options?) {
    const collisionBoxArray = new CollisionBoxArray();
    return extend({
        collisionBoxArray: deserialize(serialize(collisionBoxArray)),
        featureIndex: deserialize(serialize(new FeatureIndex(new OverscaledTileID(1, 0, 1, 1, 1)))),
        buckets: []
    }, options);
}

function createPainter(styleStub = {}) {
    return {style: styleStub};
}
