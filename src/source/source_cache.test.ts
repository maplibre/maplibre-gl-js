import SourceCache from './source_cache';
import {setSourceType} from './source';
import Tile from './tile';
import {OverscaledTileID} from './tile_id';
import Transform from '../geo/transform';
import LngLat from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import {Event, ErrorEvent, Evented} from '../util/evented';
import {extend} from '../util/util';
import browser from '../util/browser';
import Dispatcher from '../util/dispatcher';
import {Callback} from '../types/callback';

class SourceMock extends Evented {
    id: string;
    minzoom: number;
    maxzoom: number;
    hasTile: (tileID: OverscaledTileID) => boolean;
    sourceOptions: any;

    constructor(id: string, sourceOptions: any, _dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.minzoom = 0;
        this.maxzoom = 22;
        extend(this, sourceOptions);
        this.sourceOptions = sourceOptions;
        this.setEventedParent(eventedParent);
        if (sourceOptions.hasTile) {
            this.hasTile = sourceOptions.hasTile;
        }
    }
    loadTile(tile: Tile, callback: Callback<void>) {
        if (this.sourceOptions.expires) {
            tile.setExpiryData({
                expires: this.sourceOptions.expires
            });
        }
        setTimeout(callback, 0);
    }
    loaded() {
        return true;
    }
    onAdd() {
        if (this.sourceOptions.noLoad) return;
        if (this.sourceOptions.error) {
            this.fire(new ErrorEvent(this.sourceOptions.error));
        } else {
            this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
        }
    }
    abortTile() {}
    unloadTile() {}
    serialize() {}
}

// Add a mocked source type for use in these tests
function createSource(id: string, sourceOptions: any, _dispatcher: any, eventedParent: Evented) {
    // allow tests to override mocked methods/properties by providing
    // them in the source definition object that's given to Source.create()
    const source = new SourceMock(id, sourceOptions, _dispatcher, eventedParent);

    return source;
}

setSourceType('mock-source-type', createSource as any);

function createSourceCache(options?, used?) {
    const sc = new SourceCache('id', extend({
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        type: 'mock-source-type'
    }, options), {} as Dispatcher);
    sc.used = typeof used === 'boolean' ? used : true;
    return sc;
}

afterEach(() => {
    jest.clearAllMocks();
});

describe('SourceCache#addTile', () => {
    test('loads tile when uncached', done => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({
            loadTile(tile) {
                expect(tile.tileID).toEqual(tileID);
                expect(tile.uses).toBe(0);
                done();
            }
        });
        sourceCache.onAdd(undefined);
        sourceCache._addTile(tileID);
    });

    test('adds tile when uncached', done => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({}).on('dataloading', (data) => {
            expect(data.tile.tileID).toEqual(tileID);
            expect(data.tile.uses).toBe(1);
            done();
        });
        sourceCache.onAdd(undefined);
        sourceCache._addTile(tileID);
    });

    test('updates feature state on added uncached tile', done => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let updateFeaturesSpy;
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                sourceCache.on('data', () => {
                    expect(updateFeaturesSpy).toHaveBeenCalledTimes(1);
                    done();
                });
                updateFeaturesSpy = jest.spyOn(tile, 'setFeatureState');
                tile.state = 'loaded';
                callback();
            }
        });
        sourceCache.onAdd(undefined);
        sourceCache._addTile(tileID);
    });

    test('uses cached tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        }).on('dataloading', () => { add++; });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);
        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        expect(load).toBe(1);
        expect(add).toBe(1);

    });

    test('updates feature state on cached tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                callback();
            }
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = sourceCache._addTile(tileID);
        const updateFeaturesSpy = jest.spyOn(tile, 'setFeatureState');

        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        expect(updateFeaturesSpy).toHaveBeenCalledTimes(1);

    });

    test('moves timers when adding tile from cache', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const time = new Date();
        time.setSeconds(time.getSeconds() + 5);

        const sourceCache = createSourceCache();
        sourceCache._setTileReloadTimer = (id) => {
            sourceCache._timers[id] = setTimeout(() => {}, 0);
        };
        sourceCache._loadTile = (tile, callback) => {
            tile.state = 'loaded';
            tile.getExpiryTimeout = () => 1000 * 60;
            sourceCache._setTileReloadTimer(tileID.key, tile);
            callback();
        };

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const id = tileID.key;
        expect(sourceCache._timers[id]).toBeFalsy();
        expect(sourceCache._cache.has(tileID)).toBeFalsy();

        sourceCache._addTile(tileID);

        expect(sourceCache._timers[id]).toBeTruthy();
        expect(sourceCache._cache.has(tileID)).toBeFalsy();

        sourceCache._removeTile(tileID.key);

        expect(sourceCache._timers[id]).toBeFalsy();
        expect(sourceCache._cache.has(tileID)).toBeTruthy();

        sourceCache._addTile(tileID);

        expect(sourceCache._timers[id]).toBeTruthy();
        expect(sourceCache._cache.has(tileID)).toBeFalsy();

    });

    test('does not reuse wrapped tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        }).on('dataloading', () => { add++; });

        const t1 = sourceCache._addTile(tileID);
        const t2 = sourceCache._addTile(new OverscaledTileID(0, 1, 0, 0, 0));

        expect(load).toBe(2);
        expect(add).toBe(2);
        expect(t1).not.toBe(t2);

    });

    test('should load tiles with identical overscaled Z but different canonical Z', () => {
        const sourceCache = createSourceCache();

        const tileIDs = [
            new OverscaledTileID(1, 0, 0, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)
        ];

        for (let i = 0; i < tileIDs.length; i++)
            sourceCache._addTile(tileIDs[i]);

        for (let i = 0; i < tileIDs.length; i++) {
            const id = tileIDs[i];
            const key = id.key;

            expect(sourceCache._tiles[key]).toBeTruthy();
            expect(sourceCache._tiles[key].tileID).toEqual(id);
        }

    });
});

describe('SourceCache#removeTile', () => {
    test('removes tile', done => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({});
        sourceCache._addTile(tileID);
        sourceCache.on('data', () => {
            sourceCache._removeTile(tileID.key);
            expect(sourceCache._tiles[tileID.key]).toBeFalsy();
            done();
        });
    });

    test('caches (does not unload) loaded tile', done => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({
            loadTile(tile) {
                tile.state = 'loaded';
            },
            unloadTile() {
                done('test failed: unloadTile has been called');
            }
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        done();
    });

    test('aborts and unloads unfinished tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache({
            abortTile(tile) {
                expect(tile.tileID).toEqual(tileID);
                abort++;
            },
            unloadTile(tile) {
                expect(tile.tileID).toEqual(tileID);
                unload++;
            }
        });

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        expect(abort).toBe(1);
        expect(unload).toBe(1);

    });

    test('_tileLoaded after _removeTile skips tile.added', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.added = undefined;
                sourceCache._removeTile(tileID.key);
                callback();
            }
        });
        sourceCache.map = {painter: {crossTileSymbolIndex: '', tileExtentVAO: {}}} as any;

        sourceCache._addTile(tileID);
    });

    test('fires dataabort event', done => {
        const sourceCache = createSourceCache({
            loadTile() {
                // Do not call back in order to make sure the tile is removed before it is loaded.
            }
        });
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const tile = sourceCache._addTile(tileID);
        sourceCache.once('dataabort', event => {
            expect(event.dataType).toBe('source');
            expect(event.tile).toBe(tile);
            expect(event.coord).toBe(tileID);
            done();
        });
        sourceCache._removeTile(tileID.key);
    });

    test('does not fire dataabort event when the tile has already been loaded', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                callback();
            }
        });
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(tileID);
        const onAbort = jest.fn();
        sourceCache.once('dataabort', onAbort);
        sourceCache._removeTile(tileID.key);
        expect(onAbort).toHaveBeenCalledTimes(0);
    });

    test('does not fire data event when the tile has already been aborted', () => {
        const onData = jest.fn();
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                sourceCache.once('dataabort', () => {
                    tile.state = 'loaded';
                    callback();
                    expect(onData).toHaveBeenCalledTimes(0);
                });
            }
        });
        sourceCache.once('data', onData);
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
    });

});

describe('SourceCache / Source lifecycle', () => {
    test('does not fire load or change before source load event', done => {
        const sourceCache = createSourceCache({noLoad: true})
            .on('data', () => done('test failed: data event fired'));
        sourceCache.onAdd(undefined);
        setTimeout(() => done(), 1);
    });

    test('forward load event', done => {
        const sourceCache = createSourceCache({}).on('data', (e) => {
            if (e.sourceDataType === 'metadata') done();
        });
        sourceCache.onAdd(undefined);
    });

    test('forward change event', done => {
        const sourceCache = createSourceCache().on('data', (e) => {
            if (e.sourceDataType === 'metadata') done();
        });
        sourceCache.onAdd(undefined);
        sourceCache.getSource().fire(new Event('data'));
    });

    test('forward error event', done => {
        const sourceCache = createSourceCache({error: 'Error loading source'}).on('error', (err) => {
            expect(err.error).toBe('Error loading source');
            done();
        });
        sourceCache.onAdd(undefined);
    });

    test('suppress 404 errors', done => {
        const sourceCache = createSourceCache({status: 404, message: 'Not found'})
            .on('error', () => done('test failed: error event fired'));
        sourceCache.onAdd(undefined);
        done();
    });

    test('loaded() true after source error', done => {
        const sourceCache = createSourceCache({error: 'Error loading source'}).on('error', () => {
            expect(sourceCache.loaded()).toBeTruthy();
            done();
        });
        sourceCache.onAdd(undefined);
    });

    test('loaded() true after tile error', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        const sourceCache = createSourceCache({
            loadTile (tile, callback) {
                callback('error');
            }
        }).on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        }).on('error', () => {
            expect(sourceCache.loaded()).toBeTruthy();
            done();
        });

        sourceCache.onAdd(undefined);
    });

    test('loaded() false after source begins loading following error', done => {
        const sourceCache = createSourceCache({error: 'Error loading source'}).on('error', () => {
            sourceCache.on('dataloading', () => {
                expect(sourceCache.loaded()).toBeFalsy();
                done();
            });
            sourceCache.getSource().fire(new Event('dataloading'));
        });

        sourceCache.onAdd(undefined);
    });

    test('loaded() false when error occurs while source is not loaded', done => {
        const sourceCache = createSourceCache({
            error: 'Error loading source',

            loaded() {
                return false;
            }
        }).on('error', () => {
            expect(sourceCache.loaded()).toBeFalsy();
            done();
        });

        sourceCache.onAdd(undefined);
    });

    test('reloads tiles after a data event where source is updated', () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const expected = [new OverscaledTileID(0, 0, 0, 0, 0).key, new OverscaledTileID(0, 0, 0, 0, 0).key];
        expect.assertions(expected.length);

        const sourceCache = createSourceCache({
            loadTile (tile, callback) {
                expect(tile.tileID.key).toBe(expected.shift());
                tile.loaded = true;
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });

        sourceCache.onAdd(undefined);
    });

    test('does not reload errored tiles', () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const sourceCache = createSourceCache({
            loadTile (tile, callback) {
                // this transform will try to load the four tiles at z1 and a single z0 tile
                // we only expect _reloadTile to be called with the 'loaded' z0 tile
                tile.state = tile.tileID.canonical.z === 1 ? 'errored' : 'loaded';
                callback();
            }
        });

        const reloadTileSpy = jest.spyOn(sourceCache, '_reloadTile');
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });
        sourceCache.onAdd(undefined);
        // we expect the source cache to have five tiles, but only to have reloaded one
        expect(Object.keys(sourceCache._tiles)).toHaveLength(5);
        expect(reloadTileSpy).toHaveBeenCalledTimes(1);

    });

});

describe('SourceCache#update', () => {
    test('loads no tiles if used is false', done => {
        const transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 0;

        const sourceCache = createSourceCache({}, false);
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([]);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('loads covering tiles', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({});
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('respects Source#hasTile method if it is present', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const sourceCache = createSourceCache({
            hasTile: (coord) => (coord.canonical.x !== 0)
        });
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds().sort()).toEqual([
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 1, 1).key
                ].sort());
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('removes unused tiles', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({
            loadTile: (tile, callback) => {
                tile.state = 'loaded';
                callback(null);
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);

                transform.zoom = 1;
                sourceCache.update(transform);

                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(1, 0, 1, 1, 1).key,
                    new OverscaledTileID(1, 0, 1, 0, 1).key,
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 0, 0).key
                ]);
                done();
            }
        });

        sourceCache.onAdd(undefined);
    });

    test('retains parent tiles for pending children', done => {
        const transform = new Transform();
        (transform as any)._test = 'retains';
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = (tile.tileID.key === new OverscaledTileID(0, 0, 0, 0, 0).key) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);

                transform.zoom = 1;
                sourceCache.update(transform);

                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(0, 0, 0, 0, 0).key,
                    new OverscaledTileID(1, 0, 1, 1, 1).key,
                    new OverscaledTileID(1, 0, 1, 0, 1).key,
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 0, 0).key
                ]);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('retains parent tiles for pending children (wrapped)', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        transform.center = new LngLat(360, 0);

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = (tile.tileID.key === new OverscaledTileID(0, 1, 0, 0, 0).key) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 1, 0, 0, 0).key]);

                transform.zoom = 1;
                sourceCache.update(transform);

                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(0, 1, 0, 0, 0).key,
                    new OverscaledTileID(1, 1, 1, 1, 1).key,
                    new OverscaledTileID(1, 1, 1, 0, 1).key,
                    new OverscaledTileID(1, 1, 1, 1, 0).key,
                    new OverscaledTileID(1, 1, 1, 0, 0).key
                ]);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('retains covered child tiles while parent tile is fading in', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 2;

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        (sourceCache._source as any).type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(2, 0, 2, 2, 2).key,
                    new OverscaledTileID(2, 0, 2, 1, 2).key,
                    new OverscaledTileID(2, 0, 2, 2, 1).key,
                    new OverscaledTileID(2, 0, 2, 1, 1).key
                ]);

                transform.zoom = 0;
                sourceCache.update(transform);

                expect(sourceCache.getRenderableIds()).toHaveLength(5);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('retains a parent tile for fading even if a tile is partially covered by children', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        (sourceCache._source as any).type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                transform.zoom = 2;
                sourceCache.update(transform);

                transform.zoom = 1;
                sourceCache.update(transform);

                expect(sourceCache._coveredTiles[(new OverscaledTileID(0, 0, 0, 0, 0).key)]).toBe(true);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('retains children for fading when tile.fadeEndTime is not set', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Date.now();
                tile.state = 'loaded';
                callback();
            }
        });

        (sourceCache._source as any).type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                transform.zoom = 0;
                sourceCache.update(transform);

                expect(sourceCache.getRenderableIds()).toHaveLength(5);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('retains children when tile.fadeEndTime is in the future', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const fadeTime = 100;

        const start = Date.now();
        let time = start;
        jest.spyOn(browser, 'now').mockImplementation(() => time);

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = browser.now();
                tile.state = 'loaded';
                tile.fadeEndTime = browser.now() + fadeTime;
                callback();
            }
        });

        (sourceCache._source as any).type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                // load children
                sourceCache.update(transform);

                transform.zoom = 0;
                sourceCache.update(transform);

                expect(sourceCache.getRenderableIds()).toHaveLength(5);

                time = start + 98;
                sourceCache.update(transform);
                expect(sourceCache.getRenderableIds()).toHaveLength(5);

                time = start + fadeTime + 1;
                sourceCache.update(transform);
                expect(sourceCache.getRenderableIds()).toHaveLength(1);
                done();
            }
        });

        sourceCache.onAdd(undefined);
    });

    test('retains overscaled loaded children', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;

        // use slightly offset center so that sort order is better defined
        transform.center = new LngLat(-0.001, 0.001);

        const sourceCache = createSourceCache({
            reparseOverscaled: true,
            loadTile(tile, callback) {
                tile.state = tile.tileID.overscaledZ === 16 ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getRenderableIds()).toEqual([
                    new OverscaledTileID(16, 0, 14, 8192, 8192).key,
                    new OverscaledTileID(16, 0, 14, 8191, 8192).key,
                    new OverscaledTileID(16, 0, 14, 8192, 8191).key,
                    new OverscaledTileID(16, 0, 14, 8191, 8191).key
                ]);

                transform.zoom = 15;
                sourceCache.update(transform);

                expect(sourceCache.getRenderableIds()).toEqual([
                    new OverscaledTileID(16, 0, 14, 8192, 8192).key,
                    new OverscaledTileID(16, 0, 14, 8191, 8192).key,
                    new OverscaledTileID(16, 0, 14, 8192, 8191).key,
                    new OverscaledTileID(16, 0, 14, 8191, 8191).key
                ]);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('reassigns tiles for large jumps in longitude', done => {

        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({});
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                transform.center = new LngLat(360, 0);
                const tileID = new OverscaledTileID(0, 1, 0, 0, 0);
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([tileID.key]);
                const tile = sourceCache.getTile(tileID);

                transform.center = new LngLat(0, 0);
                const wrappedTileID = new OverscaledTileID(0, 0, 0, 0, 0);
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([wrappedTileID.key]);
                expect(sourceCache.getTile(wrappedTileID)).toBe(tile);
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

});

describe('SourceCache#_updateRetainedTiles', () => {

    test('loads ideal tiles if they exist', () => {
        const stateCache = {};
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = stateCache[tile.tileID.key] || 'errored';
                callback();
            }
        });

        const getTileSpy = jest.spyOn(sourceCache, 'getTile');
        const idealTile = new OverscaledTileID(1, 0, 1, 1, 1);
        stateCache[idealTile.key] = 'loaded';
        sourceCache._updateRetainedTiles([idealTile], 1);
        expect(getTileSpy).not.toHaveBeenCalled();
        expect(sourceCache.getIds()).toEqual([idealTile.key]);
    });

    test('retains all loaded children ', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'errored';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'errored';

        const loadedChildren = [
            new OverscaledTileID(4, 0, 4, 2, 4),
            new OverscaledTileID(4, 0, 4, 3, 4),
            new OverscaledTileID(4, 0, 4, 2, 5),
            new OverscaledTileID(5, 0, 5, 6, 10),
            new OverscaledTileID(5, 0, 5, 7, 10),
            new OverscaledTileID(5, 0, 5, 6, 11),
            new OverscaledTileID(5, 0, 5, 7, 11)
        ];

        for (const t of loadedChildren) {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        }

        const retained = sourceCache._updateRetainedTiles([idealTile], 3);
        expect(Object.keys(retained).sort()).toEqual([
            // parents are requested because ideal ideal tile is not completely covered by
            // loaded child tiles
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 1),
            new OverscaledTileID(1, 0, 1, 0, 0),
            idealTile
        ].concat(loadedChildren).map(t => t.key).sort());

    });

    test('adds parent tile if ideal tile errors and no child tiles are loaded', () => {
        const stateCache = {};
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = stateCache[tile.tileID.key] || 'errored';
                callback();
            }
        });

        jest.spyOn(sourceCache, '_addTile');
        const getTileSpy = jest.spyOn(sourceCache, 'getTile');

        const idealTiles = [new OverscaledTileID(1, 0, 1, 1, 1), new OverscaledTileID(1, 0, 1, 0, 1)];
        stateCache[idealTiles[0].key] = 'loaded';
        const retained = sourceCache._updateRetainedTiles(idealTiles, 1);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // when child tiles aren't found, check and request parent tile
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        // retained tiles include all ideal tiles and any parents that were loaded to cover
        // non-existant tiles
        expect(retained).toEqual({
            // 1/0/1
            '211': new OverscaledTileID(1, 0, 1, 0, 1),
            // 1/1/1
            '311': new OverscaledTileID(1, 0, 1, 1, 1),
            // parent
            '000': new OverscaledTileID(0, 0, 0, 0, 0)
        });
    });

    test('don\'t use wrong parent tile', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'errored';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'errored';

        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key] = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), undefined);
        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key].state = 'loaded';

        const addTileSpy = jest.spyOn(sourceCache, '_addTile');
        const getTileSpy = jest.spyOn(sourceCache, 'getTile');

        sourceCache._updateRetainedTiles([idealTile], 2);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0), // not found
            new OverscaledTileID(0, 0, 0, 0, 0)  // not found
        ]);

        expect(addTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // ideal tile
            new OverscaledTileID(2, 0, 2, 0, 0),
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0), // not found
            new OverscaledTileID(0, 0, 0, 0, 0)  // not found
        ]);
    });

    test('use parent tile when ideal tile is not loaded', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 1);
        const parentTile = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'loading';
        sourceCache._tiles[parentTile.key] = new Tile(parentTile, undefined);
        sourceCache._tiles[parentTile.key].state = 'loaded';

        const addTileSpy = jest.spyOn(sourceCache, '_addTile');
        const getTileSpy = jest.spyOn(sourceCache, 'getTile');

        const retained = sourceCache._updateRetainedTiles([idealTile], 1);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parents
            new OverscaledTileID(0, 0, 0, 0, 0), // found
        ]);

        expect(retained).toEqual({
            // parent of ideal tile 0/0/0
            '000': new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id 1/0/1
            '211': new OverscaledTileID(1, 0, 1, 0, 1)
        });

        addTileSpy.mockClear();
        getTileSpy.mockClear();

        // now make sure we don't retain the parent tile when the ideal tile is loaded
        sourceCache._tiles[idealTile.key].state = 'loaded';
        const retainedLoaded = sourceCache._updateRetainedTiles([idealTile], 1);

        expect(getTileSpy).not.toHaveBeenCalled();
        expect(retainedLoaded).toEqual({
            // only ideal tile retained
            '211': new OverscaledTileID(1, 0, 1, 0, 1)
        });
    });

    test('don\'t load parent if all immediate children are loaded', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(2, 0, 2, 1, 1);
        const loadedTiles = [new OverscaledTileID(3, 0, 3, 2, 2), new OverscaledTileID(3, 0, 3, 3, 2), new OverscaledTileID(3, 0, 3, 2, 3), new OverscaledTileID(3, 0, 3, 3, 3)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = jest.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);
        // parent tile isn't requested because all covering children are loaded
        expect(getTileSpy).not.toHaveBeenCalled();
        expect(Object.keys(retained)).toEqual([idealTile.key].concat(loadedTiles.map(t => t.key)));
    });

    test('prefer loaded child tiles to parent tiles', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 0);
        const loadedTiles = [new OverscaledTileID(0, 0, 0, 0, 0), new OverscaledTileID(2, 0, 2, 0, 0)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = jest.spyOn(sourceCache, 'getTile');
        let retained = sourceCache._updateRetainedTiles([idealTile], 1);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parent
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        expect(retained).toEqual({
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '000': new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id (1, 0, 0)
            '011': new OverscaledTileID(1, 0, 1, 0, 0),
            // loaded child tile (2, 0, 0)
            '022': new OverscaledTileID(2, 0, 2, 0, 0)
        });

        getTileSpy.mockClear();
        // remove child tile and check that it only uses parent tile
        delete sourceCache._tiles['022'];
        retained = sourceCache._updateRetainedTiles([idealTile], 1);

        expect(retained).toEqual({
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '000': new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id (1, 0, 0)
            '011': new OverscaledTileID(1, 0, 1, 0, 0)
        });

    });

    test('don\'t use tiles below minzoom', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            minzoom: 2
        });
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        const loadedTiles = [new OverscaledTileID(1, 0, 1, 0, 0)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = jest.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([]);

        expect(retained).toEqual({
            // ideal tile id (2, 0, 0)
            '022': new OverscaledTileID(2, 0, 2, 0, 0)
        });

    });

    test('use overzoomed tile above maxzoom', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            maxzoom: 2
        });
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);

        const getTileSpy = jest.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // overzoomed child
            new OverscaledTileID(3, 0, 2, 0, 0),
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        expect(retained).toEqual({
            // ideal tile id (2, 0, 0)
            '022': new OverscaledTileID(2, 0, 2, 0, 0)
        });

    });

    test('dont\'t ascend multiple times if a tile is not found', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTiles = [new OverscaledTileID(8, 0, 8, 0, 0), new OverscaledTileID(8, 0, 8, 1, 0)];

        const getTileSpy = jest.spyOn(sourceCache, 'getTile');
        sourceCache._updateRetainedTiles(idealTiles, 8);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parent tile ascent
            new OverscaledTileID(7, 0, 7, 0, 0),
            new OverscaledTileID(6, 0, 6, 0, 0),
            new OverscaledTileID(5, 0, 5, 0, 0),
            new OverscaledTileID(4, 0, 4, 0, 0),
            new OverscaledTileID(3, 0, 3, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(0, 0, 0, 0, 0),
        ]);

        getTileSpy.mockClear();

        const loadedTiles = [new OverscaledTileID(4, 0, 4, 0, 0)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        sourceCache._updateRetainedTiles(idealTiles, 8);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parent tile ascent
            new OverscaledTileID(7, 0, 7, 0, 0),
            new OverscaledTileID(6, 0, 6, 0, 0),
            new OverscaledTileID(5, 0, 5, 0, 0),
            new OverscaledTileID(4, 0, 4, 0, 0), // tile is loaded, stops ascent
        ]);

    });

    test('adds correct leaded parent tiles for overzoomed tiles', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            maxzoom: 7
        });
        const loadedTiles = [new OverscaledTileID(7, 0, 7, 0, 0), new OverscaledTileID(7, 0, 7, 1, 0)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const idealTiles = [new OverscaledTileID(8, 0, 7, 0, 0), new OverscaledTileID(8, 0, 7, 1, 0)];
        const retained = sourceCache._updateRetainedTiles(idealTiles, 8);

        expect(Object.keys(retained)).toEqual([
            new OverscaledTileID(7, 0, 7, 1, 0).key,
            new OverscaledTileID(8, 0, 7, 1, 0).key,
            new OverscaledTileID(8, 0, 7, 0, 0).key,
            new OverscaledTileID(7, 0, 7, 0, 0).key
        ]);

    });

});

describe('SourceCache#clearTiles', () => {
    test('unloads tiles', () => {
        const coord = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache({
            abortTile(tile) {
                expect(tile.tileID).toEqual(coord);
                abort++;
            },
            unloadTile(tile) {
                expect(tile.tileID).toEqual(coord);
                unload++;
            }
        });
        sourceCache.onAdd(undefined);

        sourceCache._addTile(coord);
        sourceCache.clearTiles();

        expect(abort).toBe(1);
        expect(unload).toBe(1);

    });
});

describe('SourceCache#tilesIn', () => {
    test('graceful response before source loaded', () => {
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        tr._calcMatrices();
        const sourceCache = createSourceCache({noLoad: true});
        sourceCache.transform = tr;
        sourceCache.onAdd(undefined);
        expect(sourceCache.tilesIn([
            new Point(0, 0),
            new Point(512, 256)
        ], 10, true)).toEqual([]);

    });

    function round(queryGeometry) {
        return queryGeometry.map((p) => {
            return p.round();
        });
    }

    test('regular tiles', done => {
        const transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 1;
        transform.center = new LngLat(0, 1);

        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                tile.additionalRadius = 0;
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(1, 0, 1, 1, 1).key,
                    new OverscaledTileID(1, 0, 1, 0, 1).key,
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 0, 0).key
                ]);

                transform._calcMatrices();
                const tiles = sourceCache.tilesIn([
                    new Point(0, 0),
                    new Point(512, 256)
                ], 1, true);

                tiles.sort((a, b) => { return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x; });
                tiles.forEach((result) => { delete result.tile.uid; });

                expect(tiles[0].tile.tileID.key).toBe('011');
                expect(tiles[0].tile.tileSize).toBe(512);
                expect(tiles[0].scale).toBe(1);
                expect(round(tiles[0].queryGeometry)).toEqual([{x: 4096, y: 4050}, {x: 12288, y: 8146}]);

                expect(tiles[1].tile.tileID.key).toBe('111');
                expect(tiles[1].tile.tileSize).toBe(512);
                expect(tiles[1].scale).toBe(1);
                expect(round(tiles[1].queryGeometry)).toEqual([{x: -4096, y: 4050}, {x: 4096, y: 8146}]);

                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('reparsed overscaled tiles', () => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                tile.additionalRadius = 0;
                callback();
            },
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const transform = new Transform();
                transform.resize(1024, 1024);
                transform.zoom = 2.0;
                transform.center = new LngLat(0, 1);
                sourceCache.update(transform);

                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(2, 0, 1, 1, 1).key,
                    new OverscaledTileID(2, 0, 1, 0, 1).key,
                    new OverscaledTileID(2, 0, 1, 1, 0).key,
                    new OverscaledTileID(2, 0, 1, 0, 0).key
                ]);

                const tiles = sourceCache.tilesIn([
                    new Point(0, 0),
                    new Point(1024, 512)
                ], 1, true);

                tiles.sort((a, b) => { return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x; });
                tiles.forEach((result) => { delete result.tile.uid; });

                expect(tiles[0].tile.tileID.key).toBe('012');
                expect(tiles[0].tile.tileSize).toBe(1024);
                expect(tiles[0].scale).toBe(1);
                expect(round(tiles[0].queryGeometry)).toEqual([{x: 4096, y: 4050}, {x: 12288, y: 8146}]);

                expect(tiles[1].tile.tileID.key).toBe('112');
                expect(tiles[1].tile.tileSize).toBe(1024);
                expect(tiles[1].scale).toBe(1);
                expect(round(tiles[1].queryGeometry)).toEqual([{x: -4096, y: 4050}, {x: 4096, y: 8146}]);

            }
        });
        sourceCache.onAdd(undefined);
    });

    test('overscaled tiles', done => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) { tile.state = 'loaded'; callback(); },
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const transform = new Transform();
                transform.resize(512, 512);
                transform.zoom = 2.0;
                sourceCache.update(transform);

                done();
            }
        });
        sourceCache.onAdd(undefined);
    });
});

describe('source cache loaded', () => {
    test('SourceCache#loaded (no errors)', done => {
        const sourceCache = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const coord = new OverscaledTileID(0, 0, 0, 0, 0);
                sourceCache._addTile(coord);

                expect(sourceCache.loaded()).toBeTruthy();
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('SourceCache#loaded (with errors)', done => {
        const sourceCache = createSourceCache({
            loadTile(tile) {
                tile.state = 'errored';
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const coord = new OverscaledTileID(0, 0, 0, 0, 0);
                sourceCache._addTile(coord);

                expect(sourceCache.loaded()).toBeTruthy();
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });
});

describe('souce cache get ids', () => {
    test('SourceCache#getIds (ascending order by zoom level)', done => {
        const ids = [
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(3, 0, 3, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 0)
        ];

        const sourceCache = createSourceCache({});
        sourceCache.transform = new Transform();
        for (let i = 0; i < ids.length; i++) {
            sourceCache._tiles[ids[i].key] = {tileID: ids[i]} as any as Tile;
        }
        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
            new OverscaledTileID(2, 0, 2, 0, 0).key,
            new OverscaledTileID(3, 0, 3, 0, 0).key
        ]);
        done();
    });
});

describe('SourceCache#findLoadedParent', () => {

    test('adds from previously used tiles (sourceCache._tiles)', () => {
        const sourceCache = createSourceCache({});
        sourceCache.onAdd(undefined);
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = {
            tileID: new OverscaledTileID(1, 0, 1, 0, 0),
            hasData() { return true; }
        } as any as Tile;

        sourceCache._tiles[tile.tileID.key] = tile;

        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0)).toBeUndefined();
        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0)).toEqual(tile);
    });

    test('retains parents', () => {
        const sourceCache = createSourceCache({});
        sourceCache.onAdd(undefined);
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512);
        sourceCache._cache.add(tile.tileID, tile);

        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0)).toBeUndefined();
        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0)).toBe(tile);
        expect(sourceCache._cache.order).toHaveLength(1);

    });

    test('Search cache for loaded parent tiles', () => {
        const sourceCache = createSourceCache({});
        sourceCache.onAdd(undefined);
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const mockTile = id => {
            const tile = {
                tileID: id,
                hasData() { return true; }
            } as any as Tile;
            sourceCache._tiles[id.key] = tile;
        };

        const tiles = [
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(2, 0, 2, 0, 0),
            new OverscaledTileID(2, 0, 2, 1, 0),
            new OverscaledTileID(2, 0, 2, 2, 0),
            new OverscaledTileID(2, 0, 2, 1, 2)
        ];

        tiles.forEach(t => mockTile(t));
        sourceCache._updateLoadedParentTileCache();

        // Loaded tiles excluding the root should be in the cache
        expect(sourceCache.findLoadedParent(tiles[0], 0)).toBeUndefined();
        expect(sourceCache.findLoadedParent(tiles[1], 0).tileID).toBe(tiles[0]);
        expect(sourceCache.findLoadedParent(tiles[2], 0).tileID).toBe(tiles[0]);
        expect(sourceCache.findLoadedParent(tiles[3], 0).tileID).toBe(tiles[0]);
        expect(sourceCache.findLoadedParent(tiles[4], 0).tileID).toBe(tiles[1]);
        expect(sourceCache.findLoadedParent(tiles[5], 0).tileID).toBe(tiles[0]);

        expect(tiles[0].key in sourceCache._loadedParentTiles).toBe(false);
        expect(tiles[1].key in sourceCache._loadedParentTiles).toBe(true);
        expect(tiles[2].key in sourceCache._loadedParentTiles).toBe(true);
        expect(tiles[3].key in sourceCache._loadedParentTiles).toBe(true);
        expect(tiles[4].key in sourceCache._loadedParentTiles).toBe(true);
        expect(tiles[5].key in sourceCache._loadedParentTiles).toBe(true);

        // Arbitray tiles should not in the cache
        const notLoadedTiles = [
            new OverscaledTileID(2, 1, 2, 0, 0),
            new OverscaledTileID(2, 0, 2, 3, 0),
            new OverscaledTileID(2, 0, 2, 3, 3),
            new OverscaledTileID(3, 0, 3, 2, 1)
        ];

        expect(sourceCache.findLoadedParent(notLoadedTiles[0], 0)).toBeUndefined();
        expect(sourceCache.findLoadedParent(notLoadedTiles[1], 0).tileID).toBe(tiles[1]);
        expect(sourceCache.findLoadedParent(notLoadedTiles[2], 0).tileID).toBe(tiles[0]);
        expect(sourceCache.findLoadedParent(notLoadedTiles[3], 0).tileID).toBe(tiles[3]);

        expect(notLoadedTiles[0].key in sourceCache._loadedParentTiles).toBe(false);
        expect(notLoadedTiles[1].key in sourceCache._loadedParentTiles).toBe(false);
        expect(notLoadedTiles[2].key in sourceCache._loadedParentTiles).toBe(false);
        expect(notLoadedTiles[3].key in sourceCache._loadedParentTiles).toBe(false);

    });

});

describe('SourceCache#reload', () => {
    test('before loaded', () => {
        const sourceCache = createSourceCache({noLoad: true});
        sourceCache.onAdd(undefined);

        expect(() => {
            sourceCache.reload();
        }).not.toThrow();

    });

});

describe('SourceCache reloads expiring tiles', () => {
    test('calls reloadTile when tile expires', done => {
        const coord = new OverscaledTileID(1, 0, 1, 0, 1);

        const expiryDate = new Date();
        expiryDate.setMilliseconds(expiryDate.getMilliseconds() + 50);
        const sourceCache = createSourceCache({expires: expiryDate});

        sourceCache._reloadTile = (id, state) => {
            expect(state).toBe('expired');
            done();
        };

        sourceCache._addTile(coord);
    });

});

describe('SourceCache sets max cache size correctly', () => {
    test('sets cache size based on 512 tiles', () => {
        const sourceCache = createSourceCache({
            tileSize: 256
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 3 * 3 * 5
        expect(sourceCache._cache.max).toBe(45);
    });

    test('sets cache size based on 256 tiles', () => {
        const sourceCache = createSourceCache({
            tileSize: 512
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 2 * 2 * 5
        expect(sourceCache._cache.max).toBe(20);
    });

});

describe('SourceCache#onRemove', () => {
    test('clears tiles', () => {
        const sourceCache = createSourceCache();
        jest.spyOn(sourceCache, 'clearTiles');

        sourceCache.onRemove(undefined);

        expect(sourceCache.clearTiles).toHaveBeenCalled();
    });

    test('calls onRemove on source', () => {
        const sourceOnRemove = jest.fn();
        const sourceCache = createSourceCache({
            onRemove: sourceOnRemove
        });

        sourceCache.onRemove(undefined);

        expect(sourceOnRemove).toHaveBeenCalled();
    });
});

describe('SourceCache#usedForTerrain', () => {
    test('loads covering tiles with usedForTerrain with source zoom 0-14', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 10;

        const sourceCache = createSourceCache({});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        expect(sourceCache.usedForTerrain).toBeTruthy();
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
                    ['2tc099', '2tbz99', '2sxs99', '2sxr99', 'pds88', 'eo55', 'pdr88', 'en55', 'p6o88', 'ds55', 'p6n88', 'dr55']
                );
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('loads covering tiles with usedForTerrain with source zoom 8-14', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 10;

        const sourceCache = createSourceCache({minzoom: 8, maxzoom: 14});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
                    ['2tc099', '2tbz99', '2sxs99', '2sxr99', 'pds88', 'pdr88', 'p6o88', 'p6n88']
                );
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('loads covering tiles with usedForTerrain with source zoom 0-4', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 10;

        const sourceCache = createSourceCache({minzoom: 0, maxzoom: 4});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
                    ['1033', '3s44', '3r44', '3c44', '3b44', 'z33', 's33', 'r33']
                );
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('loads covering tiles with usedForTerrain with source zoom 4-4', done => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 10;

        const sourceCache = createSourceCache({minzoom: 4, maxzoom: 4});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
                    ['3s44', '3r44', '3c44', '3b44']
                );
                done();
            }
        });
        sourceCache.onAdd(undefined);
    });
});
