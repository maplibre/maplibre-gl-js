import type {StyleSpecification} from '@maplibre/maplibre-gl-style-spec';
import {describe, beforeEach, afterEach, test, expect, vi} from 'vitest';
import {SourceCache} from './source_cache';
import {type Source, addSourceType} from './source';
import {Tile, FadingRoles, FadingDirections} from './tile';
import {CanonicalTileID, OverscaledTileID} from './tile_id';
import {LngLat} from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import {Event, ErrorEvent, Evented} from '../util/evented';
import {extend} from '../util/util';
import {type Dispatcher} from '../util/dispatcher';
import {TileBounds} from './tile_bounds';
import {sleep, waitForEvent, beforeMapTest, createMap as globalCreateMap} from '../util/test/util';

import {type Map} from '../ui/map';
import {type TileCache} from './tile_cache';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {GlobeTransform} from '../geo/projection/globe_transform';
import {coveringTiles} from '../geo/projection/covering_tiles';

class SourceMock extends Evented implements Source {
    id: string;
    minzoom: number;
    maxzoom: number;
    hasTile: (tileID: OverscaledTileID) => boolean;
    sourceOptions: any;
    type: string;
    tileSize: number;

    constructor(id: string, sourceOptions: any, _dispatcher: Dispatcher, eventedParent: Evented) {
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
        if (sourceOptions.raster) {
            this.type = 'raster';
        }
    }
    loadTile(tile: Tile): Promise<void> {
        if (this.sourceOptions.expires) {
            tile.setExpiryData({
                expires: this.sourceOptions.expires
            });
        }
        return sleep(0);
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
    async abortTile() {}
    async unloadTile() {}
    serialize() {}
    hasTransition(): boolean {
        return false;
    }
}

// Add a mocked source type for use in these tests
function createSource(id: string, sourceOptions: any, _dispatcher: any, eventedParent: Evented) {
    // allow tests to override mocked methods/properties by providing
    // them in the source definition object that's given to Source.create()
    const source = new SourceMock(id, sourceOptions, _dispatcher, eventedParent);

    return source;
}

addSourceType('mock-source-type', createSource as any);

function createSourceCache(options?, used?) {
    const sc = new SourceCache('id', extend({
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        type: 'mock-source-type'
    }, options), {} as Dispatcher);
    const scWithTestLogic = extend(sc, {
        used: typeof used === 'boolean' ? used : true,
        addTile(tileID: OverscaledTileID): Tile {
            return this._addTile(tileID);
        },
        getCache(): TileCache {
            return this._cache;
        },
        getTiles(): { [_: string]: Tile } {
            return this._tiles;
        }
    });
    return scWithTestLogic;
}

type MapOptions = {
    style: StyleSpecification;
};

function createMap(options: MapOptions) {
    const container = window.document.createElement('div');
    window.document.body.appendChild(container);
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    return globalCreateMap({container, ...options});
}

beforeEach(() => {
    beforeMapTest();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('SourceCache.addTile', () => {
    test('loads tile when uncached', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache();
        const spy = vi.fn();
        sourceCache._source.loadTile = spy;
        
        sourceCache.onAdd(undefined);
        sourceCache._addTile(tileID);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].tileID).toEqual(tileID);
        expect(spy.mock.calls[0][0].uses).toBe(1);
    });

    test('adds tile when uncached', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({});
        const dataLoadingPromise = sourceCache.once('dataloading');
        sourceCache.onAdd(undefined);
        sourceCache._addTile(tileID);
        const data = await dataLoadingPromise;
        expect(data.tile.tileID).toEqual(tileID);
        expect(data.tile.uses).toBe(1);
    });

    test('updates feature state on added uncached tile', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let updateFeaturesSpy;
        const sourceCache = createSourceCache({});
        let dataPromise: any;
        sourceCache._source.loadTile = async (tile) => {
            dataPromise = sourceCache.once('data');
            updateFeaturesSpy = vi.spyOn(tile, 'setFeatureState');
            tile.state = 'loaded';
        };
        sourceCache.onAdd(undefined);
        sourceCache._addTile(tileID);
        await dataPromise;
        expect(updateFeaturesSpy).toHaveBeenCalledTimes(1);
    });

    test('uses cached tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
            load++;
        };
        sourceCache.on('dataloading', () => { add++; });

        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.updateCacheSize(tr);
        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        expect(load).toBe(1);
        expect(add).toBe(1);

    });

    test('updates feature state on cached tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const sourceCache = createSourceCache({});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.updateCacheSize(tr);

        const tile = sourceCache._addTile(tileID);
        const updateFeaturesSpy = vi.spyOn(tile, 'setFeatureState');

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
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
            tile.getExpiryTimeout = () => 1000 * 60;
            sourceCache._setTileReloadTimer(tileID.key, tile);
        };

        const tr = new MercatorTransform();
        tr.resize(512, 512);
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

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
            load++;
        };
        sourceCache.on('dataloading', () => { add++; });

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

describe('SourceCache.removeTile', () => {
    test('removes tile', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({});
        sourceCache._addTile(tileID);
        await sourceCache.once('data');
        sourceCache._removeTile(tileID.key);
        expect(sourceCache._tiles[tileID.key]).toBeFalsy();
    });

    test('caches (does not unload) loaded tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };
        sourceCache._source.unloadTile = vi.fn();

        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.updateCacheSize(tr);

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        expect(sourceCache._source.unloadTile).not.toHaveBeenCalled();
    });

    test('aborts and unloads unfinished tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache();
        sourceCache._source.abortTile = async (tile) => {
            expect(tile.tileID).toEqual(tileID);
            abort++;
        };
        sourceCache._source.unloadTile = async (tile) => {
            expect(tile.tileID).toEqual(tileID);
            unload++;
        };

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        expect(abort).toBe(1);
        expect(unload).toBe(1);

    });

    test('_tileLoaded after _removeTile skips tile.added', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async () => {
            sourceCache._removeTile(tileID.key);
        };
        sourceCache.map = {painter: {crossTileSymbolIndex: '', tileExtentVAO: {}}} as any;

        sourceCache._addTile(tileID);
    });

    test('fires dataabort event', async () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = () => {
            // Do not call back in order to make sure the tile is removed before it is loaded.
            return new Promise(() => {});
        };
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const tile = sourceCache._addTile(tileID);
        const abortPromise = sourceCache.once('dataabort');
        sourceCache._removeTile(tileID.key);
        const event = await abortPromise;
        expect(event.dataType).toBe('source');
        expect(event.tile).toBe(tile);
        expect(event.coord).toBe(tileID);
    });

    test('does not fire dataabort event when the tile has already been loaded', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(tileID);
        const onAbort = vi.fn();
        sourceCache.once('dataabort', onAbort);
        sourceCache._removeTile(tileID.key);
        expect(onAbort).toHaveBeenCalledTimes(0);
    });

    test('does not fire data event when the tile has already been aborted', () => {
        const onData = vi.fn();
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            sourceCache.once('dataabort', () => {
                tile.state = 'loaded';
                expect(onData).toHaveBeenCalledTimes(0);
            });
        };
        sourceCache.once('data', onData);
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
    });

});

describe('SourceCache / Source lifecycle', () => {
    test('does not fire load or change before source load event', async () => {
        const sourceCache = createSourceCache({noLoad: true});
        const spy = vi.fn();
        sourceCache.on('data', spy);
        sourceCache.onAdd(undefined);
        await sleep(1);
        expect(spy).not.toHaveBeenCalled();
    });

    test('forward load event', async () => {
        const sourceCache = createSourceCache({});
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await expect(dataPromise).resolves.toBeDefined();
    });

    test('forward change event', async () => {
        const sourceCache = createSourceCache();
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        sourceCache.getSource().fire(new Event('data'));
        await expect(dataPromise).resolves.toBeDefined();
    });

    test('forward error event', async () => {
        const sourceCache = createSourceCache({error: 'Error loading source'});
        const errorPromise = sourceCache.once('error');
        sourceCache.onAdd(undefined);
        const err = await errorPromise;
        expect(err.error).toBe('Error loading source');
    });

    test('suppress 404 errors', () => {
        const sourceCache = createSourceCache({status: 404, message: 'Not found'});
        sourceCache.on('error', () => { throw new Error('test failed: error event fired'); });
        sourceCache.onAdd(undefined);
    });

    test('loaded() true after source error', async () => {
        const sourceCache = createSourceCache({error: 'Error loading source'});
        const errorPromise = sourceCache.once('error');
        sourceCache.onAdd(undefined);
        await errorPromise;
        expect(sourceCache.loaded()).toBeTruthy();
    });

    test('loaded() true after tile error', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(0);
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async () => {
            throw new Error('Error loading tile');
        };
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        });
        const errorPromise = sourceCache.once('error');

        sourceCache.onAdd(undefined);
        await errorPromise;
        expect(sourceCache.loaded()).toBeTruthy();
    });

    test('loaded() false after source begins loading following error', async () => {
        const sourceCache = createSourceCache({error: 'Error loading source'});
        const errorPromise = sourceCache.once('error');
        sourceCache.onAdd(undefined);
        await errorPromise;
        const dataLoadingProimse = sourceCache.once('dataloading');
        sourceCache.getSource().fire(new Event('dataloading'));
        await dataLoadingProimse;
        expect(sourceCache.loaded()).toBeFalsy();
    });

    test('loaded() false when error occurs while source is not loaded', async () => {
        const sourceCache = createSourceCache({
            error: 'Error loading source',

            loaded() {
                return false;
            }
        });
        const errorPromise = sourceCache.once('error');
        sourceCache.onAdd(undefined);
        await errorPromise;
        expect(sourceCache.loaded()).toBeFalsy();
    });

    test('reloads tiles after a data event where source is updated', () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(0);

        const expected = [new OverscaledTileID(0, 0, 0, 0, 0).key, new OverscaledTileID(0, 0, 0, 0, 0).key];
        expect.assertions(expected.length);

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            expect(tile.tileID.key).toBe(expected.shift());
            tile.state = 'loaded';
        };

        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });

        sourceCache.onAdd(undefined);
    });

    test('does not reload errored tiles', () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(1);

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            // this transform will try to load the four tiles at z1 and a single z0 tile
            // we only expect _reloadTile to be called with the 'loaded' z0 tile
            tile.state = tile.tileID.canonical.z === 1 ? 'errored' : 'loaded';
        };

        const reloadTileSpy = vi.spyOn(sourceCache, '_reloadTile');
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

    test('does reload errored tiles, if event is source data change', () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(1);

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            // this transform will try to load the four tiles at z1 and a single z0 tile
            // we only expect _reloadTile to be called with the 'loaded' z0 tile
            tile.state = tile.tileID.canonical.z === 1 ? 'errored' : 'loaded';
        };

        const reloadTileSpy = vi.spyOn(sourceCache, '_reloadTile');
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content', sourceDataChanged: true}));
            }
        });
        sourceCache.onAdd(undefined);
        // We expect the source cache to have five tiles, and for all of them
        // to be reloaded
        expect(Object.keys(sourceCache._tiles)).toHaveLength(5);
        expect(reloadTileSpy).toHaveBeenCalledTimes(5);

    });

});

describe('SourceCache.update', () => {
    test('loads no tiles if used is false', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(0);

        const sourceCache = createSourceCache({}, false);
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');

        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([]);
    });

    test('loads covering tiles', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(0);

        const sourceCache = createSourceCache({});
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);
    });

    test('adds ideal (covering) tiles only once for zoom level on raster maps', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(1);

        const sourceCache = createSourceCache({raster: true});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const addSpy = vi.spyOn(sourceCache, '_addTile');
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;

        // on update at zoom 1 there should be 4 ideal tiles added through _addTiles
        sourceCache.update(transform);
        expect(addSpy).toHaveBeenCalledTimes(4);
    });

    test('bypasses fading logic when raster fading is disabled', async () => {
        const map = createMap({
            style: {
                version: 8,
                sources: {rasterSource: {type: 'raster', tiles: [], tileSize: 256}},
                layers: [{id: 'rasterLayer', type: 'raster', source: 'rasterSource',
                    paint: {'raster-fade-duration': 0}
                }]
            }
        });
        await map.once('styledata');

        const style = map.style;
        const sourceCache = style.sourceCaches['rasterSource'];
        const spy = vi.spyOn(sourceCache, '_updateFadingTiles');
        sourceCache._loadTile = async () => {};

        const fakeTile = new Tile(new OverscaledTileID(3, 0, 3, 1, 2), undefined);
        (fakeTile as any).texture = {bind: () => {}, size: [256, 256]};
        fakeTile.state = 'loaded';
        sourceCache._tiles[fakeTile.tileID.key] = fakeTile;

        await map.once('render');
        map.setZoom(3);
        await map.once('render');

        expect(spy).not.toHaveBeenCalled();
    });

    test('respects Source.hasTile method if it is present', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(1);

        const sourceCache = createSourceCache({
            hasTile: (coord) => (coord.canonical.x !== 0)
        });
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
                
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getIds().sort()).toEqual([
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key
        ].sort());
    });

    test('removes unused tiles', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(0);

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);

        transform.setZoom(1);
        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(1, 0, 1, 1, 1).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key
        ]);
    });

    test('retains parent tiles for pending children', async () => {
        const transform = new MercatorTransform();
        (transform as any)._test = 'retains';
        transform.resize(511, 511);
        transform.setZoom(0);

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = (tile.tileID.key === new OverscaledTileID(0, 0, 0, 0, 0).key) ? 'loaded' : 'loading';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');

        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);

        transform.setZoom(1);
        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key
        ]);
    });

    test('retains parent tiles for pending children (wrapped)', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(0);
        transform.setCenter(new LngLat(360, 0));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = (tile.tileID.key === new OverscaledTileID(0, 1, 0, 0, 0).key) ? 'loaded' : 'loading';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 1, 0, 0, 0).key]);

        transform.setZoom(1);
        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(0, 1, 0, 0, 0).key,
            new OverscaledTileID(1, 1, 1, 1, 1).key,
            new OverscaledTileID(1, 1, 1, 0, 1).key,
            new OverscaledTileID(1, 1, 1, 1, 0).key,
            new OverscaledTileID(1, 1, 1, 0, 0).key
        ]);
    });

    test('retains children tiles for pending parents', () => {
        const transform = new GlobeTransform();
        transform.resize(511, 511);
        transform.setZoom(1);
        transform.setCenter(new LngLat(360, 0));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = (tile.tileID.key === new OverscaledTileID(0, 1, 0, 0, 0).key) ? 'loading' : 'loaded';
        };

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(1, 1, 1, 1, 1).key,
                    new OverscaledTileID(1, 1, 1, 0, 1).key,
                    new OverscaledTileID(1, 1, 1, 1, 0).key,
                    new OverscaledTileID(1, 1, 1, 0, 0).key
                ]);

                transform.setZoom(0);
                sourceCache.update(transform);

                expect(sourceCache.getIds()).toEqual([
                    new OverscaledTileID(0, 1, 0, 0, 0).key,
                    new OverscaledTileID(1, 1, 1, 1, 1).key,
                    new OverscaledTileID(1, 1, 1, 0, 1).key,
                    new OverscaledTileID(1, 1, 1, 1, 0).key,
                    new OverscaledTileID(1, 1, 1, 0, 0).key
                ]);
            }
        });
        sourceCache.onAdd(undefined);
    });

    test('retains overscaled loaded children', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(16);

        // use slightly offset center so that sort order is better defined
        transform.setCenter(new LngLat(-0.001, 0.001));

        const sourceCache = createSourceCache({reparseOverscaled: true});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = tile.tileID.overscaledZ === 16 ? 'loaded' : 'loading';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(sourceCache.getRenderableIds()).toEqual([
            new OverscaledTileID(16, 0, 14, 8192, 8192).key,
            new OverscaledTileID(16, 0, 14, 8191, 8192).key,
            new OverscaledTileID(16, 0, 14, 8192, 8191).key,
            new OverscaledTileID(16, 0, 14, 8191, 8191).key
        ]);

        transform.setZoom(15);
        sourceCache.update(transform);

        expect(sourceCache.getRenderableIds()).toEqual([
            new OverscaledTileID(16, 0, 14, 8192, 8192).key,
            new OverscaledTileID(16, 0, 14, 8191, 8192).key,
            new OverscaledTileID(16, 0, 14, 8192, 8191).key,
            new OverscaledTileID(16, 0, 14, 8191, 8191).key
        ]);
    });

    test('reassigns tiles for large jumps in longitude', async () => {

        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(0);

        const sourceCache = createSourceCache({});
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        transform.setCenter(new LngLat(360, 0));
        const tileID = new OverscaledTileID(0, 1, 0, 0, 0);
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([tileID.key]);
        const tile = sourceCache.getTile(tileID);

        transform.setCenter(new LngLat(0, 0));
        const wrappedTileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache.update(transform);
        expect(sourceCache.getIds()).toEqual([wrappedTileID.key]);
        expect(sourceCache.getTile(wrappedTileID)).toBe(tile);
    });

    test('retains fading children and applies fading logic when zooming out', async () => {
        const transform = new MercatorTransform();
        transform.resize(1024, 1024);
        transform.setZoom(10);

        const sourceCache = createSourceCache({raster: true});
        const loadedTiles: Record<string, Tile> = {};
        sourceCache._source.loadTile = async (tile) => {
            loadedTiles[tile.tileID.key] = tile;
            tile.state = 'loaded';
        };
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        });
        sourceCache.setRasterFadeDuration(300);
        sourceCache.onAdd(undefined);

        // get default zoom ideal tiles at zoom specified above
        await sleep(0);
        // ideal tiles will become fading children when zooming out
        const children: Tile[] = Object.values(loadedTiles);

        // zoom out 1 level - ideal tiles (new children) should fade out
        transform.setZoom(9);
        sourceCache.update(transform);
        await sleep(0);

        // ensure that the loaded child was retained and fading logic was applied
        for (const child of children) {
            expect(loadedTiles).toHaveProperty(child.tileID.key);
            expect(child.fadingRole).toEqual(FadingRoles.Base);
            expect(child.fadingDirection).toEqual(FadingDirections.Departing);
            expect(child.fadingParentID).toBeInstanceOf(OverscaledTileID);
        }
    });

    test('retains fading grandchildren and applies fading logic when zooming out', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(10);

        const sourceCache = createSourceCache({raster: true});
        const loadedTiles: Record<string, Tile> = {};
        sourceCache._source.loadTile = async (tile) => {
            loadedTiles[tile.tileID.key] = tile;
            tile.state = 'loaded';
        };
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        });
        sourceCache.setRasterFadeDuration(300);
        sourceCache.onAdd(undefined);

        // get default zoom ideal tiles at zoom specified above
        await sleep(0);
        // ideal tiles will become fading grandchildren when zooming out
        const grandChildren: Tile[] = Object.values(loadedTiles);

        // zoom out 2 levels - ideal tiles (new grandchildren) should fade out
        transform.setZoom(8);
        sourceCache.update(transform);
        await sleep(0);

        // ensure that the loaded grandchild was retained and fading logic was applied
        for (const grandChild of grandChildren) {
            expect(loadedTiles).toHaveProperty(grandChild.tileID.key);
            expect(grandChild.fadingRole).toEqual(FadingRoles.Base);
            expect(grandChild.fadingDirection).toEqual(FadingDirections.Departing);
            expect(grandChild.fadingParentID).toBeInstanceOf(OverscaledTileID);
        }
    });

    test('retains fading parent and applies fading logic when zooming in', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(10);

        const sourceCache = createSourceCache({raster: true});
        const loadedTiles: Record<string, Tile> = {};
        sourceCache._source.loadTile = async (tile) => {
            loadedTiles[tile.tileID.key] = tile;
            tile.state = 'loaded';
        };
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        });
        sourceCache.setRasterFadeDuration(300);
        sourceCache.onAdd(undefined);

        // get default zoom ideal tiles at zoom specified above
        await sleep(0);
        // ideal tiles will become fading parent when zooming in
        const parents: Tile[] = Object.values(loadedTiles);
        const parentKeys = new Set(parents.map(p => p.tileID.key));

        // zoom in 1 level - ideal tiles (new parent) should fade out
        transform.setZoom(11);
        sourceCache.update(transform);
        await sleep(0);

        // ensure that the loaded parents were retained and fading logic was applied
        for (const parent of parents) {
            expect(loadedTiles).toHaveProperty(parent.tileID.key);
            expect(parent.fadingRole).toEqual(FadingRoles.Parent);
            expect(parent.fadingDirection).toEqual(FadingDirections.Departing);
        }

        // check incoming tiles
        const incoming = Object.values(loadedTiles).filter(tile => !parentKeys.has(tile.tileID.key));
        for (const tile of incoming) {
            expect(tile.fadingRole).toEqual(FadingRoles.Base);
            expect(tile.fadingDirection).toEqual(FadingDirections.Incoming);
            expect(tile.fadingParentID).toBeInstanceOf(OverscaledTileID);
        }
    });

    test('retains fading grandparent and applies fading logic when zooming in', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(10);

        const sourceCache = createSourceCache({raster: true});
        const loadedTiles: Record<string, Tile> = {};
        sourceCache._source.loadTile = async (tile) => {
            loadedTiles[tile.tileID.key] = tile;
            tile.state = 'loaded';
        };
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        });
        sourceCache.setRasterFadeDuration(300);
        sourceCache.onAdd(undefined);

        // get default zoom ideal tiles at zoom specified above
        await sleep(0);
        // ideal tiles will become fading grandparent when zooming in
        const grandParents: Tile[] = Object.values(loadedTiles);
        const grandParentKeys = new Set(grandParents.map(p => p.tileID.key));

        // zoom in 2 levels - ideal tiles (new grandparent) should fade out
        transform.setZoom(12);
        sourceCache.update(transform);
        await sleep(0);

        // ensure that the loaded grandparents were retained and fading logic was applied
        for (const grandParent of grandParents) {
            expect(loadedTiles).toHaveProperty(grandParent.tileID.key);
            expect(grandParent.fadingRole).toEqual(FadingRoles.Parent);
            expect(grandParent.fadingDirection).toEqual(FadingDirections.Departing);
        }

        // check incoming tiles
        const incoming = Object.values(loadedTiles).filter(tile => !grandParentKeys.has(tile.tileID.key));
        for (const tile of incoming) {
            expect(tile.fadingRole).toEqual(FadingRoles.Base);
            expect(tile.fadingDirection).toEqual(FadingDirections.Incoming);
            expect(tile.fadingParentID).toBeInstanceOf(OverscaledTileID);
        }
    });
});

describe('SourceCache._updateRetainedTiles', () => {

    test('loads ideal tiles if they exist', () => {
        const stateCache = {};
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = stateCache[tile.tileID.key] || 'errored';
        };

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const idealTile = new OverscaledTileID(1, 0, 1, 1, 1);
        stateCache[idealTile.key] = 'loaded';
        sourceCache._updateRetainedTiles([idealTile], 1);
        expect(getTileSpy).not.toHaveBeenCalled();
        expect(sourceCache.getIds()).toEqual([idealTile.key]);
    });

    test('_updateRetainedTiles retains all loaded children (and parent when coverage is incomplete)', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
        };

        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'errored';

        const loadedTiles = [
            // loaded children - topmost zoom partially covered
            new OverscaledTileID(4, 0, 4, 2, 4),  //topmost child
            new OverscaledTileID(4, 0, 4, 3, 4),  //topmost child
            new OverscaledTileID(4, 0, 4, 2, 5),  //topmost child
            // loaded children - 2nd topmost zoom fully covered
            new OverscaledTileID(5, 0, 5, 6, 10),
            new OverscaledTileID(5, 0, 5, 7, 10),
            new OverscaledTileID(5, 0, 5, 6, 11),
            new OverscaledTileID(5, 0, 5, 7, 11),
            // loaded parents - to be requested because ideal tile is not completely covered by children (z=4)
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 1),  //parent
            new OverscaledTileID(1, 0, 1, 0, 0)
        ];
        for (const t of loadedTiles) {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        }

        const expectedTiles = [
            new OverscaledTileID(4, 0, 4, 2, 4),  //topmost child
            new OverscaledTileID(4, 0, 4, 3, 4),  //topmost child
            new OverscaledTileID(4, 0, 4, 2, 5),  //topmost child
            new OverscaledTileID(2, 0, 2, 0, 1),  //parent
            idealTile
        ];

        const retained = sourceCache._updateRetainedTiles([idealTile], 3);
        expect(Object.keys(retained).sort()).toEqual(expectedTiles.map(t => t.key).sort());
    });

    test('_updateRetainedTiles does not retain parents when 2nd generation children are loaded', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
        };

        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'errored';

        const secondGeneration = idealTile
            .children(10)
            .flatMap(child => child.children(10));
        expect(secondGeneration.length).toEqual(16);

        for (const id of secondGeneration) {
            sourceCache._tiles[id.key] = new Tile(id, undefined);
            sourceCache._tiles[id.key].state = 'loaded';
        }
        const expectedTiles = [...secondGeneration, idealTile];

        const retained = sourceCache._updateRetainedTiles([idealTile], 3);
        expect(Object.keys(retained).sort()).toEqual(expectedTiles.map(t => t.key).sort());
    });

    for (const pitch of [0, 20, 40, 65, 75, 85]) {
        test(`retains loaded children for pitch: ${pitch}`, () => {
            const transform = new MercatorTransform();
            transform.resize(512, 512);
            transform.setZoom(10);
            transform.setMaxPitch(90);
            transform.setPitch(pitch);

            const sourceCache = createSourceCache();
            sourceCache._source.loadTile = async (tile) => {
                tile.state = 'errored';  //all ideal tiles generated from coveringTiles should be unavailable
            };

            //see covering tile logic in source_cache.update
            const idealTileIDs = coveringTiles(transform, {
                tileSize: sourceCache.usedForTerrain ? sourceCache.tileSize : sourceCache._source.tileSize,
                minzoom: sourceCache._source.minzoom,
                maxzoom: sourceCache._source.maxzoom,
                roundZoom: sourceCache._source.roundZoom,
                reparseOverscaled: sourceCache._source.reparseOverscaled,
                calculateTileZoom: sourceCache._source.calculateTileZoom
            });

            const idealChildIDs = idealTileIDs.flatMap(id => id.children(sourceCache._source.maxzoom));
            for (const idealID of idealChildIDs) {
                const tile = new Tile(idealID, undefined);
                tile.state = 'loaded';  //all children are loaded to be retained for missing ideal tiles
                sourceCache._tiles[idealID.key] = tile;
            }

            const retain: {[key: string]: OverscaledTileID} = {};
            const missingTiles: {[key: string]: OverscaledTileID} = {};

            // mark all ideal tiles as retained and also as missing with no data for child retainment
            for (const idealID of idealTileIDs) {
                retain[idealID.key] = idealID;
                missingTiles[idealID.key] = idealID;
            }
            sourceCache._retainLoadedChildren(missingTiles, retain);

            expect(Object.keys(retain).sort()).toEqual(idealChildIDs.concat(idealTileIDs).map(id => id.key).sort());
        });
    }

    test('retains only uppermost zoom children when multiple zoom levels are loaded', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
        };

        const idealTileID = new OverscaledTileID(2, 0, 2, 1, 1);
        const idealTiles: {[key: string]: OverscaledTileID} = {[idealTileID.key]: idealTileID};

        const children = [
            new OverscaledTileID(3, 0, 3, 2, 2),  //keep
            new OverscaledTileID(3, 0, 3, 3, 2),  //keep
            new OverscaledTileID(4, 0, 4, 4, 4),  //discard
            new OverscaledTileID(5, 0, 5, 8, 8),  //discard
        ];
        for (const child of children) {
            const tile = new Tile(child, undefined);
            tile.state = 'loaded';
            sourceCache._tiles[child.key] = tile;
        }

        const retain: {[key: string]: OverscaledTileID} = {};
        sourceCache._retainLoadedChildren(idealTiles, retain);

        const expectedKeys = children
            .filter(child => child.overscaledZ === 3)
            .map(child => child.key)
            .sort();

        expect(Object.keys(retain).sort()).toEqual(expectedKeys);
    });

    test('retains overscaled loaded children with coveringZoom < maxzoom', () => {
        const sourceCache = createSourceCache({maxzoom: 3});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
        };

        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'errored';

        const loadedChildren = [
            new OverscaledTileID(4, 0, 3, 1, 2)
        ];

        for (const t of loadedChildren) {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        }

        const retained = sourceCache._updateRetainedTiles([idealTile], 2);
        expect(Object.keys(retained).sort()).toEqual([idealTile].concat(loadedChildren).map(t => t.key).sort());
    });

    test('_areDescendentsComplete returns true when descendents fully cover a generation', () => {
        const sourceCache = createSourceCache();
        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);

        const firstGen = idealTile.children(10);
        expect(sourceCache._areDescendentsComplete(firstGen, 4, 3)).toBe(true);

        const secondGen = idealTile.children(10).flatMap(c => c.children(10));
        expect(sourceCache._areDescendentsComplete(secondGen, 5, 3)).toBe(true);
    });

    test('_areDescendentsComplete returns false when descendents are incomplete', () => {
        const sourceCache = createSourceCache();
        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);

        const firstGenPartial = idealTile.children(10).slice(0, 3);
        expect(sourceCache._areDescendentsComplete(firstGenPartial, 4, 3)).toBe(false);

        const secondGenPartial = idealTile.children(10).flatMap(c => c.children(10)).slice(0, 15);
        expect(sourceCache._areDescendentsComplete(secondGenPartial, 5, 3)).toBe(false);
    });

    test('_areDescendentsComplete properly handles overscaled tiles', () => {
        const sourceCache = createSourceCache();

        const correct = new OverscaledTileID(4, 0, 3, 1, 2);
        expect(sourceCache._areDescendentsComplete([correct], 4, 3)).toBe(true);

        const wrong = new OverscaledTileID(5, 0, 3, 1, 2);
        expect(sourceCache._areDescendentsComplete([wrong], 4, 3)).toBe(false);
    });

    test('adds parent tile if ideal tile errors and no child tiles are loaded', () => {
        const stateCache = {};
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = stateCache[tile.tileID.key] || 'errored';
        };

        vi.spyOn(sourceCache, '_addTile');
        const getTileSpy = vi.spyOn(sourceCache, 'getTile');

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
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
        };

        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'errored';

        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key] = new Tile(new OverscaledTileID(1, 0, 1, 1, 0), undefined);
        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key].state = 'loaded';

        const addTileSpy = vi.spyOn(sourceCache, '_addTile');
        const getTileSpy = vi.spyOn(sourceCache, 'getTile');

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
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 1);
        const parentTile = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile, undefined);
        sourceCache._tiles[idealTile.key].state = 'loading';
        sourceCache._tiles[parentTile.key] = new Tile(parentTile, undefined);
        sourceCache._tiles[parentTile.key].state = 'loaded';

        const addTileSpy = vi.spyOn(sourceCache, '_addTile');
        const getTileSpy = vi.spyOn(sourceCache, 'getTile');

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
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };

        const idealTile = new OverscaledTileID(2, 0, 2, 1, 1);
        const loadedTiles = [new OverscaledTileID(3, 0, 3, 2, 2), new OverscaledTileID(3, 0, 3, 3, 2), new OverscaledTileID(3, 0, 3, 2, 3), new OverscaledTileID(3, 0, 3, 3, 3)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);
        // parent tile isn't requested because all covering children are loaded
        expect(getTileSpy).not.toHaveBeenCalled();
        expect(Object.keys(retained)).toEqual([idealTile.key].concat(loadedTiles.map(t => t.key)));
    });

    test('prefer loaded child tiles to parent tiles', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 0);
        const loadedTiles = [new OverscaledTileID(0, 0, 0, 0, 0), new OverscaledTileID(2, 0, 2, 0, 0)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
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
        const sourceCache = createSourceCache({minzoom: 2});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        const loadedTiles = [new OverscaledTileID(1, 0, 1, 0, 0)];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        sleep(10);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([]);

        expect(retained).toEqual({
            // ideal tile id (2, 0, 0)
            '022': new OverscaledTileID(2, 0, 2, 0, 0)
        });

    });

    test('use overzoomed tile above maxzoom', () => {
        const sourceCache = createSourceCache({maxzoom: 2});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);

        const loadedTiles = [
            new OverscaledTileID(3, 0, 2, 0, 0),  // overzoomed child
            new OverscaledTileID(1, 0, 1, 0, 0),  // parent
            new OverscaledTileID(0, 0, 0, 0, 0)   // parent
        ];
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        expect(retained).toEqual({
            '022': new OverscaledTileID(2, 0, 2, 0, 0),  // ideal
            '023': new OverscaledTileID(3, 0, 2, 0, 0)   // overzoomed
        });
    });

    test('don\'t ascend multiple times if a tile is not found', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };
        const idealTiles = [new OverscaledTileID(8, 0, 8, 0, 0), new OverscaledTileID(8, 0, 8, 1, 0)];

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
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

    test('Retain, then cancel loading tiles when zooming in', () => {
        const sourceCache = createSourceCache();
        // Disabling pending tile canceling (thus retaining) in Map mock:
        const map = {cancelPendingTileRequestsWhileZooming: false} as Map;
        sourceCache.onAdd(map);
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };

        let idealTiles = [new OverscaledTileID(9, 0, 9, 0, 0), new OverscaledTileID(9, 0, 9, 1, 0)];
        sourceCache._updateRetainedTiles(idealTiles, 9);
        idealTiles = [new OverscaledTileID(10, 0, 10, 0, 0), new OverscaledTileID(10, 0, 10, 1, 0)];
        let retained = sourceCache._updateRetainedTiles(idealTiles, 10);
        expect(Object.keys(retained).sort()).toEqual([
            new OverscaledTileID(9, 0, 9, 0, 0).key,    // retained
            new OverscaledTileID(10, 0, 10, 0, 0).key,
            new OverscaledTileID(10, 0, 10, 1, 0).key
        ]);

        // Canceling pending tiles now via runtime map property:
        map.cancelPendingTileRequestsWhileZooming = true;
        retained = sourceCache._updateRetainedTiles(idealTiles, 10);
        // Parent loading tiles from z=9 not retained:
        expect(Object.keys(retained).sort()).toEqual([
            new OverscaledTileID(10, 0, 10, 0, 0).key,
            new OverscaledTileID(10, 0, 10, 1, 0).key
        ]);
    });

    test('Cancel, then retain, then cancel loading tiles when zooming in', () => {
        const sourceCache = createSourceCache();
        // Applying tile canceling default behavior in Map mock:
        const map = {cancelPendingTileRequestsWhileZooming: true} as Map;
        sourceCache.onAdd(map);
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };

        let idealTiles = [new OverscaledTileID(9, 0, 9, 0, 0), new OverscaledTileID(9, 0, 9, 1, 0)];
        let retained = sourceCache._updateRetainedTiles(idealTiles, 9);
        // Parent loading tiles from z=8 not retained
        expect(Object.keys(retained).sort()).toEqual(
            idealTiles.map((tile) => tile.key).sort()
        );

        idealTiles = [new OverscaledTileID(10, 0, 10, 0, 0), new OverscaledTileID(10, 0, 10, 1, 0)];
        retained = sourceCache._updateRetainedTiles(idealTiles, 10);
        // Parent loading tiles from z=9 not retained
        expect(Object.keys(retained).sort()).toEqual(
            idealTiles.map((tile) => tile.key).sort()
        );

        // Stopping tile canceling via runtime map property:
        map.cancelPendingTileRequestsWhileZooming = false;
        retained = sourceCache._updateRetainedTiles(idealTiles, 10);

        expect(Object.keys(retained).sort()).toEqual([
            new OverscaledTileID(9, 0, 9, 0, 0).key,    // retained
            new OverscaledTileID(10, 0, 10, 0, 0).key,
            new OverscaledTileID(10, 0, 10, 1, 0).key
        ]);

        // Resuming tile canceling via runtime map property:
        map.cancelPendingTileRequestsWhileZooming = true;

        const loadedTiles = idealTiles;
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        idealTiles = [new OverscaledTileID(11, 0, 11, 0, 0), new OverscaledTileID(11, 0, 11, 1, 0)];
        retained = sourceCache._updateRetainedTiles(idealTiles, 11);
        // Parent loaded tile in the view port from z=10 was retained
        expect(Object.keys(retained).sort()).toEqual([
            new OverscaledTileID(10, 0, 10, 0, 0).key, // Parent loaded tile
            new OverscaledTileID(11, 0, 11, 0, 0).key,
            new OverscaledTileID(11, 0, 11, 1, 0).key
        ].sort());

    });

    test('Only retain loaded child tile when zooming out', () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };

        let idealTiles = [new OverscaledTileID(7, 0, 7, 0, 0), new OverscaledTileID(7, 0, 7, 1, 0)];
        let retained = sourceCache._updateRetainedTiles(idealTiles, 7);
        // Client tiles from z=6 not retained
        expect(Object.keys(retained).sort()).toEqual(
            idealTiles.map((tile) => tile.key).sort()
        );

        idealTiles = [new OverscaledTileID(6, 0, 6, 0, 0), new OverscaledTileID(6, 0, 6, 1, 0)];
        retained = sourceCache._updateRetainedTiles(idealTiles, 6);
        // Client tiles from z=6 not retained
        expect(Object.keys(retained).sort()).toEqual(
            idealTiles.map((tile) => tile.key).sort()
        );

        const loadedTiles = idealTiles;
        loadedTiles.forEach(t => {
            sourceCache._tiles[t.key] = new Tile(t, undefined);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        idealTiles = [new OverscaledTileID(5, 0, 5, 0, 0), new OverscaledTileID(5, 0, 5, 1, 0)];
        retained = sourceCache._updateRetainedTiles(idealTiles, 5);
        // Child loaded tile in the view port from z=6 was retained
        expect(Object.keys(retained).sort()).toEqual([
            new OverscaledTileID(6, 0, 6, 0, 0).key,
            new OverscaledTileID(6, 0, 6, 1, 0).key,
            new OverscaledTileID(5, 0, 5, 0, 0).key,
            new OverscaledTileID(5, 0, 5, 1, 0).key
        ].sort());
    });

    test('adds correct loaded parent tiles for overzoomed tiles', () => {
        const sourceCache = createSourceCache({maxzoom: 7});
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
        };
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

describe('SourceCache.clearTiles', () => {
    test('unloads tiles', () => {
        const coord = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache();
        sourceCache._source.abortTile = async (tile) => {
            expect(tile.tileID).toEqual(coord);
            abort++;
        };
        sourceCache._source.unloadTile = async (tile) => {
            expect(tile.tileID).toEqual(coord);
            unload++;
        };
        sourceCache.onAdd(undefined);

        sourceCache._addTile(coord);
        sourceCache.clearTiles();

        expect(abort).toBe(1);
        expect(unload).toBe(1);

    });
});

describe('SourceCache.tilesIn', () => {
    test('graceful response before source loaded', () => {
        const tr = new MercatorTransform();
        tr.resize(512, 512);
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

    test('regular tiles', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(1);
        transform.setCenter(new LngLat(0, 1));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(1, 0, 1, 1, 1).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key
        ]);

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
    });

    test('reparsed overscaled tiles', () => {
        const sourceCache = createSourceCache({
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const transform = new MercatorTransform();
                transform.resize(1024, 1024);
                transform.setZoom(2);
                transform.setCenter(new LngLat(0, 1));
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

    test('overscaled tiles', async () => {
        const sourceCache = createSourceCache({
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(2.0);
        sourceCache.update(transform);
    });

    test('globe wrap', async () => {
        const transform = new GlobeTransform();
        transform.resize(512, 512);
        transform.setZoom(1.05);
        transform.setCenter(new LngLat(179.9, 0.1));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;

        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(1, 1, 1, 0, 1).key,
            new OverscaledTileID(1, 1, 1, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
        ]);

        expect(sourceCache.tilesIn([new Point(200, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 1, 0).key]);
        expect(sourceCache.tilesIn([new Point(300, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 0, 0).key]);
        expect(sourceCache.tilesIn([new Point(200, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 1, 1).key]);
        expect(sourceCache.tilesIn([new Point(300, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 0, 1).key]);

        transform.setCenter(new LngLat(-179.9, 0.1));
        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(1, -1, 1, 1, 1).key,
            new OverscaledTileID(1, -1, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
        ]);

        expect(sourceCache.tilesIn([new Point(200, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 1, 0).key]);
        expect(sourceCache.tilesIn([new Point(300, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 0, 0).key]);
        expect(sourceCache.tilesIn([new Point(200, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 1, 1).key]);
        expect(sourceCache.tilesIn([new Point(300, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 0, 1).key]);
    });

    test('globe wrap bounding box spanning antimeridian from 179.9°E', async () => {
        const transform = new GlobeTransform();
        transform.resize(512, 512);
        transform.setZoom(1.05);
        transform.setCenter(new LngLat(179.9, 0.1));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;

        sourceCache.update(transform);

        expect(sourceCache.tilesIn([
            new Point(200, 200),
            new Point(300, 200),
            new Point(300, 300),
            new Point(200, 300),
            new Point(200, 200),
        ], 1, false).map(tile => [tile.tileID.key, tile.queryGeometry.map(p => p.round())]))
            .toEqual([
                [new OverscaledTileID(1, 0, 1, 0, 1).key, [
                    new Point(-973, -931),
                    new Point(745, -925),
                    new Point(721, 703),
                    new Point(-941, 707),
                    new Point(-973, -931),
                ]],
                [new OverscaledTileID(1, 0, 1, 0, 0).key, [
                    new Point(-973, 7261),
                    new Point(745, 7267),
                    new Point(721, 8895),
                    new Point(-941, 8899),
                    new Point(-973, 7261),
                ]],
                [new OverscaledTileID(1, 0, 1, 1, 1).key, [
                    new Point(7219, -931),
                    new Point(8937, -925),
                    new Point(8913, 703),
                    new Point(7251, 707),
                    new Point(7219, -931),
                ]],
                [new OverscaledTileID(1, 0, 1, 1, 0).key, [
                    new Point(7219, 7261),
                    new Point(8937, 7267),
                    new Point(8913, 8895),
                    new Point(7251, 8899),
                    new Point(7219, 7261),
                ]]
            ]);
    });

    test('globe wrap bounding box spanning antimeridian from 179.9°W', async () => {
        const transform = new GlobeTransform();
        transform.resize(512, 512);
        transform.setZoom(1.05);
        transform.setCenter(new LngLat(-179.9, 0.1));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;

        sourceCache.update(transform);

        expect(sourceCache.tilesIn([
            new Point(200, 200),
            new Point(300, 200),
            new Point(300, 300),
            new Point(200, 300),
            new Point(200, 200),
        ], 1, false).map(tile => [tile.tileID.key, tile.queryGeometry.map(p => p.round())]))
            .toEqual([
                [new OverscaledTileID(1, 0, 1, 1, 1).key, [
                    new Point(7228, -931),
                    new Point(8946, -925),
                    new Point(8922, 703),
                    new Point(7260, 707),
                    new Point(7228, -931),
                ]],
                [new OverscaledTileID(1, 0, 1, 1, 0).key, [
                    new Point(7228, 7261),
                    new Point(8946, 7267),
                    new Point(8922, 8895),
                    new Point(7260, 8899),
                    new Point(7228, 7261),
                ]],
                [new OverscaledTileID(1, 0, 1, 0, 1).key, [
                    new Point(-964, -931),
                    new Point(754, -925),
                    new Point(730, 703),
                    new Point(-932, 707),
                    new Point(-964, -931),
                ]],
                [new OverscaledTileID(1, 0, 1, 0, 0).key, [
                    new Point(-964, 7261),
                    new Point(754, 7267),
                    new Point(730, 8895),
                    new Point(-932, 8899),
                    new Point(-964, 7261),
                ]]
            ]);
    });

    test('mercator wrap', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(1.05);
        transform.setCenter(new LngLat(179.9, 0.1));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;

        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(1, 1, 1, 0, 1).key,
            new OverscaledTileID(1, 1, 1, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 1, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
        ]);

        expect(sourceCache.tilesIn([new Point(200, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 1, 0).key]);
        expect(sourceCache.tilesIn([new Point(300, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 1, 1, 0, 0).key]);
        expect(sourceCache.tilesIn([new Point(200, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 1, 1).key]);
        expect(sourceCache.tilesIn([new Point(300, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 1, 1, 0, 1).key]);

        transform.setCenter(new LngLat(-179.9, 0.1));
        sourceCache.update(transform);

        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(1, -1, 1, 1, 1).key,
            new OverscaledTileID(1, -1, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
        ]);

        expect(sourceCache.tilesIn([new Point(200, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, -1, 1, 1, 0).key]);
        expect(sourceCache.tilesIn([new Point(300, 200),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 0, 0).key]);
        expect(sourceCache.tilesIn([new Point(200, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, -1, 1, 1, 1).key]);
        expect(sourceCache.tilesIn([new Point(300, 300),], 1, false).map(tile => tile.tileID.key))
            .toEqual([new OverscaledTileID(1, 0, 1, 0, 1).key]);
    });

    test('mercator wrap bounding box spanning antimeridian from 179.9°E', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(1.05);
        transform.setCenter(new LngLat(179.9, 0.1));

        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;

        sourceCache.update(transform);

        expect(sourceCache.tilesIn([
            new Point(200, 200),
            new Point(300, 200),
            new Point(300, 300),
            new Point(200, 300),
            new Point(200, 200),
        ], 1, false).map(tile => [tile.tileID.key, tile.queryGeometry.map(p => p.round())]))
            .toEqual([
                [new OverscaledTileID(1, 1, 1, 0, 1).key, [
                    new Point(-870, -870),
                    new Point(675, -870),
                    new Point(675, 675),
                    new Point(-870, 675),
                    new Point(-870, -870),
                ]],
                [new OverscaledTileID(1, 1, 1, 0, 0).key, [
                    new Point(-870, 7322),
                    new Point(675, 7322),
                    new Point(675, 8867),
                    new Point(-870, 8867),
                    new Point(-870, 7322),
                ]],
                [new OverscaledTileID(1, 0, 1, 1, 1).key, [
                    new Point(7322, -870),
                    new Point(8867, -870),
                    new Point(8867, 675),
                    new Point(7322, 675),
                    new Point(7322, -870),
                ]],
                [new OverscaledTileID(1, 0, 1, 1, 0).key, [
                    new Point(7322, 7322),
                    new Point(8867, 7322),
                    new Point(8867, 8867),
                    new Point(7322, 8867),
                    new Point(7322, 7322),
                ]],
            ]);
    });

    test('mercator wrap bounding box spanning antimeridian from 179.9°W', async () => {
        const transform = new MercatorTransform();
        transform.resize(512, 512);
        transform.setZoom(1.05);
        transform.setCenter(new LngLat(-179.9, 0.1));
    
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };
    
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
    
        sourceCache.update(transform);

        expect(sourceCache.tilesIn([
            new Point(200, 200),
            new Point(300, 200),
            new Point(300, 300),
            new Point(200, 300),
            new Point(200, 200),
        ], 1, false).map(tile => [tile.tileID.key, tile.queryGeometry.map(p => p.round())]))
            .toEqual([
                [new OverscaledTileID(1, -1, 1, 1, 1).key, [
                    new Point(7331, -870),
                    new Point(8877, -870),
                    new Point(8877, 675),
                    new Point(7331, 675),
                    new Point(7331, -870),
                ]],
                [new OverscaledTileID(1, -1, 1, 1, 0).key, [
                    new Point(7331, 7322),
                    new Point(8877, 7322),
                    new Point(8877, 8867),
                    new Point(7331, 8867),
                    new Point(7331, 7322),
                ]],
                [new OverscaledTileID(1, 0, 1, 0, 1).key, [
                    new Point(-861, -870),
                    new Point(685, -870),
                    new Point(685, 675),
                    new Point(-861, 675),
                    new Point(-861, -870),
                ]],
                [new OverscaledTileID(1, 0, 1, 0, 0).key, [
                    new Point(-861, 7322),
                    new Point(685, 7322),
                    new Point(685, 8867),
                    new Point(-861, 8867),
                    new Point(-861, 7322),
                ]],
            ]);
    });
});

describe('source cache loaded', () => {
    test('SourceCache.loaded (no errors)', async () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.update(tr);

        const coord = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(coord);

        expect(sourceCache.loaded()).toBeTruthy();
    });

    test('SourceCache.loaded (with errors)', async () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
            throw new Error('Error');
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.update(tr);

        const coord = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(coord);

        expect(sourceCache.loaded()).toBeTruthy();
    });

    test('SourceCache.loaded (unused)', async () => {
        const sourceCache = createSourceCache(undefined, false);
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
            throw new Error('Error');
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        expect(sourceCache.loaded()).toBeTruthy();
    });

    test('SourceCache.loaded (unusedForTerrain)', async () => {
        const sourceCache = createSourceCache(undefined, false);
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
            throw new Error('Error');
        };
        sourceCache.usedForTerrain = false;

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        expect(sourceCache.loaded()).toBeTruthy();
    });

    test('SourceCache.loaded (not loaded when no update)', async () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'errored';
            throw new Error('Error');
        };

        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        expect(sourceCache.loaded()).toBeFalsy();
    });

    test('SourceCache.loaded (on last tile load)', async () => {
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
            return new Promise((resolve) => {
                setTimeout(() => {
                    tile.state = 'loaded';
                    resolve();
                });
            });
        };
        sourceCache._source.hasTile = function (tileID: OverscaledTileID) {
            return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
        };

        const tr = new MercatorTransform();
        tr.setZoom(10);
        tr.resize(512, 512);

        const sourceLoadedPromise = waitForEvent(sourceCache, 'data', () => sourceCache.loaded());
        const spy = vi.fn();
        sourceCache.on('data', spy);

        sourceCache.onAdd(undefined);
        sourceCache.update(tr);

        await sourceLoadedPromise;
        expect(spy.mock.calls.length).toBe(5); // 4 tiles + 1 source loaded
    });

    test('SourceCache.loaded (tiles outside bounds, idle)', async () => {
        const japan = new TileBounds([122.74, 19.33, 149.0, 45.67]);
        const sourceCache = createSourceCache();
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loading';
            return new Promise((resolve) => {
                setTimeout(() => {
                    tile.state = 'loaded';
                    resolve();
                });
            });
        };
        sourceCache._source.onAdd = function() {
            if (this.sourceOptions.noLoad) return;
            if (this.sourceOptions.error) {
                this.fire(new ErrorEvent(this.sourceOptions.error));
            } else {
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        };
        sourceCache._source.hasTile = (tileID: OverscaledTileID) => {
            return japan.contains(tileID.canonical);
        };

        const sourceLoadedPromise = waitForEvent(sourceCache, 'data', () => sourceCache.loaded());

        sourceCache.on('data', (e) => {
            if (e.sourceDataType !== 'idle') {
                expect(sourceCache.loaded()).toBeFalsy();
                // 'idle' emission when source bounds are outside of viewport bounds
            }
        });

        sourceCache.onAdd(undefined);
        const tr = new MercatorTransform();
        tr.setZoom(10);
        tr.resize(512, 512);
        sourceCache.update(tr);
        await sourceLoadedPromise;
    });
});

describe('source cache get ids', () => {
    test('SourceCache.getIds (ascending order by zoom level)', () => {
        const ids = [
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(3, 0, 3, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 0)
        ];

        const sourceCache = createSourceCache({});
        sourceCache.transform = new MercatorTransform();
        for (let i = 0; i < ids.length; i++) {
            sourceCache._tiles[ids[i].key] = {tileID: ids[i]} as any as Tile;
        }
        expect(sourceCache.getIds()).toEqual([
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
            new OverscaledTileID(2, 0, 2, 0, 0).key,
            new OverscaledTileID(3, 0, 3, 0, 0).key
        ]);
    });
});

describe('SourceCache.reload', () => {
    test('before loaded', () => {
        const sourceCache = createSourceCache({noLoad: true});
        sourceCache.onAdd(undefined);

        expect(() => {
            sourceCache.reload();
        }).not.toThrow();

    });

});

describe('SourceCache reloads expiring tiles', () => {
    test('calls reloadTile when tile expires', async () => {
        const coord = new OverscaledTileID(1, 0, 1, 0, 1);

        const expiryDate = new Date();
        expiryDate.setMilliseconds(expiryDate.getMilliseconds() + 50);
        const sourceCache = createSourceCache({expires: expiryDate});

        const spy = vi.fn();
        sourceCache._reloadTile = spy;

        sourceCache._addTile(coord);
        await sleep(100);
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][1]).toBe('expired');
    });

});

describe('SourceCache sets max cache size correctly', () => {
    test('sets cache size based on 512 tiles', () => {
        const sourceCache = createSourceCache({
            tileSize: 256
        });

        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 3 * 3 * 5
        expect(sourceCache._cache.max).toBe(45);
    });

    test('sets cache size based on 256 tiles', () => {
        const sourceCache = createSourceCache({
            tileSize: 512
        });

        const tr = new MercatorTransform();
        tr.resize(512, 512);
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 2 * 2 * 5
        expect(sourceCache._cache.max).toBe(20);
    });

});

describe('SourceCache.onRemove', () => {
    test('clears tiles', () => {
        const sourceCache = createSourceCache();
        vi.spyOn(sourceCache, 'clearTiles');

        sourceCache.onRemove(undefined);

        expect(sourceCache.clearTiles).toHaveBeenCalled();
    });

    test('calls onRemove on source', () => {
        const sourceOnRemove = vi.fn();
        const sourceCache = createSourceCache({
            onRemove: sourceOnRemove
        });

        sourceCache.onRemove(undefined);

        expect(sourceOnRemove).toHaveBeenCalled();
    });
});

describe('SourceCache.usedForTerrain', () => {
    test('loads covering tiles with usedForTerrain with source zoom 0-14', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(10);

        const sourceCache = createSourceCache({});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        expect(sourceCache.usedForTerrain).toBeTruthy();
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
            ['2tc099', '2tbz99', '2sxs99', '2sxr99', 'pds88', 'eo55', 'pdr88', 'en55', 'p6o88', 'ds55', 'p6n88', 'dr55']
        );
    });

    test('loads covering tiles with usedForTerrain with source zoom 8-14', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(10);

        const sourceCache = createSourceCache({minzoom: 8, maxzoom: 14});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
            ['2tc099', '2tbz99', '2sxs99', '2sxr99', 'pds88', 'pdr88', 'p6o88', 'p6n88']
        );
    });

    test('loads covering tiles with usedForTerrain with source zoom 0-4', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(10);

        const sourceCache = createSourceCache({minzoom: 0, maxzoom: 4});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
            ['1033', '3s44', '3r44', '3c44', '3b44', 'z33', 's33', 'r33']
        );
    });

    test('loads covering tiles with usedForTerrain with source zoom 4-4', async () => {
        const transform = new MercatorTransform();
        transform.resize(511, 511);
        transform.setZoom(10);

        const sourceCache = createSourceCache({minzoom: 4, maxzoom: 4});
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = 1024;
        const dataPromise = waitForEvent(sourceCache, 'data', e => e.sourceDataType === 'metadata');
        sourceCache.onAdd(undefined);
        await dataPromise;
        sourceCache.update(transform);
        expect(Object.values(sourceCache._tiles).map(t => t.tileID.key)).toEqual(
            ['3s44', '3r44', '3c44', '3b44']
        );
    });

});
    
describe('SourceCache::refreshTiles', () => {
    test('calls reloadTile when tile exists', async () => {
        const coord = new OverscaledTileID(1, 0, 1, 0, 1);
        const sourceCache = createSourceCache();

        const spy = vi.fn();
        sourceCache._reloadTile = spy;
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        sourceCache._addTile(coord);
        sourceCache.refreshTiles([new CanonicalTileID(1, 0, 1)]);
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][1]).toBe('expired');
    });
    
    test('does not call reloadTile when tile does not exist', async () => {
        const coord = new OverscaledTileID(1, 0, 1, 1, 1);
        const sourceCache = createSourceCache();

        const spy = vi.fn();
        sourceCache._reloadTile = spy;
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        sourceCache._addTile(coord);
        sourceCache.refreshTiles([new CanonicalTileID(1, 0, 1)]);
        expect(spy).toHaveBeenCalledTimes(0);
    });

    test('calls reloadTile when wrapped tile exists', async () => {
        const coord = new OverscaledTileID(1, 1, 1, 0, 1);
        const sourceCache = createSourceCache();

        const spy = vi.fn();
        sourceCache._reloadTile = spy;
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        sourceCache._addTile(coord);
        sourceCache.refreshTiles([new CanonicalTileID(1, 0, 1)]);
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][1]).toBe('expired');
    });

    test('calls reloadTile when overscaled tile exists', async () => {
        const coord = new OverscaledTileID(2, 0, 1, 0, 1);
        const sourceCache = createSourceCache();

        const spy = vi.fn();
        sourceCache._reloadTile = spy;
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        sourceCache._addTile(coord);
        sourceCache.refreshTiles([new CanonicalTileID(1, 0, 1)]);
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][1]).toBe('expired');
    });

    test('calls reloadTile for standard, wrapped, and overscaled tiles', async () => {
        const sourceCache = createSourceCache();

        const spy = vi.fn();
        sourceCache._reloadTile = spy;
        sourceCache._source.loadTile = async (tile) => {
            tile.state = 'loaded';
        };

        sourceCache._addTile(new OverscaledTileID(1, 0, 1, 0, 1));
        sourceCache._addTile(new OverscaledTileID(1, 1, 1, 0, 1));
        sourceCache._addTile(new OverscaledTileID(2, 0, 1, 0, 1));
        sourceCache._addTile(new OverscaledTileID(2, 1, 1, 0, 1));
        sourceCache.refreshTiles([new CanonicalTileID(1, 0, 1)]);
        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls[0][1]).toBe('expired');
        expect(spy.mock.calls[1][1]).toBe('expired');
        expect(spy.mock.calls[2][1]).toBe('expired');
        expect(spy.mock.calls[3][1]).toBe('expired');
    });
});
