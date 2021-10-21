import '../../stub_loader';
import {test} from '../../util/test';
import {createSymbolBucket} from '../../util/create_symbol_layer';
import Tile from '../../../rollup/build/tsc/src/source/tile';
import GeoJSONWrapper from '../../../rollup/build/tsc/src/source/geojson_wrapper';
import {OverscaledTileID} from '../../../rollup/build/tsc/src/source/tile_id';
import fs from 'fs';
import path, {dirname} from 'path';
import vtpbf from 'vt-pbf';
import FeatureIndex from '../../../rollup/build/tsc/src/data/feature_index';
import {CollisionBoxArray} from '../../../rollup/build/tsc/src/data/array_types';
import {extend} from '../../../rollup/build/tsc/src/util/util';
import {serialize, deserialize} from '../../../rollup/build/tsc/src/util/web_worker_transfer';
import {fileURLToPath} from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

test('querySourceFeatures', (t) => {
    const features = [{
        type: 1,
        geometry: [0, 0],
        tags: {oneway: true}
    }];

    t.test('geojson tile', (t) => {
        const tile = new Tile(new OverscaledTileID(3, 0, 2, 1, 2));
        let result;

        result = [];
        tile.querySourceFeatures(result, {});
        expect(result.length).toBe(0);

        const geojsonWrapper = new GeoJSONWrapper(features);
        geojsonWrapper.name = '_geojsonTileLayer';
        tile.loadVectorData(
            createVectorData({rawTileData: vtpbf({layers: {'_geojsonTileLayer': geojsonWrapper}})}),
            createPainter()
        );

        result = [];
        tile.querySourceFeatures(result);
        expect(result.length).toBe(1);
        expect(result[0].geometry.coordinates[0]).toEqual([-90, 0]);
        result = [];
        tile.querySourceFeatures(result, {});
        expect(result.length).toBe(1);
        expect(result[0].properties).toEqual(features[0].tags);
        result = [];
        tile.querySourceFeatures(result, {filter: ['==', 'oneway', true]});
        expect(result.length).toBe(1);
        result = [];
        tile.querySourceFeatures(result, {filter: ['!=', 'oneway', true]});
        expect(result.length).toBe(0);
        result = [];
        const polygon = {type: "Polygon",  coordinates: [[[-91, -1], [-89, -1], [-89, 1], [-91, 1], [-91, -1]]]};
        tile.querySourceFeatures(result, {filter: ['within', polygon]});
        expect(result.length).toBe(1);
        t.end();
    });

    t.test('empty geojson tile', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        let result;

        result = [];
        tile.querySourceFeatures(result, {});
        expect(result.length).toBe(0);

        const geojsonWrapper = new GeoJSONWrapper([]);
        geojsonWrapper.name = '_geojsonTileLayer';
        tile.rawTileData = vtpbf({layers: {'_geojsonTileLayer': geojsonWrapper}});
        result = [];
        expect(() => { tile.querySourceFeatures(result); }).not.toThrow();
        expect(result.length).toBe(0);
        t.end();
    });

    t.test('vector tile', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        let result;

        result = [];
        tile.querySourceFeatures(result, {});
        expect(result.length).toBe(0);

        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData()}),
            createPainter()
        );

        result = [];
        tile.querySourceFeatures(result, {'sourceLayer': 'does-not-exist'});
        expect(result.length).toBe(0);

        result = [];
        tile.querySourceFeatures(result, {'sourceLayer': 'road'});
        expect(result.length).toBe(3);

        result = [];
        tile.querySourceFeatures(result, {'sourceLayer': 'road', filter: ['==', 'class', 'main']});
        expect(result.length).toBe(1);
        result = [];
        tile.querySourceFeatures(result, {'sourceLayer': 'road', filter: ['!=', 'class', 'main']});
        expect(result.length).toBe(2);

        t.end();
    });

    t.test('loadVectorData unloads existing data before overwriting it', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        t.stub(tile, 'unloadVectorData');
        const painter = {};

        tile.loadVectorData(null, painter);

        expect(tile.unloadVectorData.calledWith()).toBeTruthy();
        t.end();
    });

    t.test('loadVectorData preserves the most recent rawTileData', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
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
        tile.querySourceFeatures(features, {'sourceLayer': 'road'});
        expect(features.length).toBe(3);

        t.end();
    });

    t.end();
});

test('Tile#isLessThan', (t) => {
    t.test('correctly sorts tiles', (t) => {
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
        t.end();
    });
    t.end();
});

test('expiring tiles', (t) => {
    t.test('regular tiles do not expire', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        expect(tile.cacheControl).toBeFalsy();
        expect(tile.expires).toBeFalsy();

        t.end();
    });

    t.test('set, get expiry', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        expect(tile.cacheControl).toBeFalsy();
        expect(tile.expires).toBeFalsy();

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

        t.end();
    });

    t.test('exponential backoff handling', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
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

        t.end();
    });

    t.end();
});

test('rtl text detection', (t) => {
    t.test('Tile#hasRTLText is true when a tile loads a symbol bucket with rtl text', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
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
        t.end();
    });

    t.end();
});

function createRawTileData() {
    return fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));
}

function createVectorData(options) {
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
