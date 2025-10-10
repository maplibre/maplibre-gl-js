define(['./shared'], (function (performance) { 'use strict';

function stringify(obj) {
    const type = typeof obj;
    if (type === 'number' || type === 'boolean' || type === 'string' || obj === undefined || obj === null)
        return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        let str = '[';
        for (const val of obj) {
            str += `${stringify(val)},`;
        }
        return `${str}]`;
    }
    const keys = Object.keys(obj).sort();
    let str = '{';
    for (let i = 0; i < keys.length; i++) {
        str += `${JSON.stringify(keys[i])}:${stringify(obj[keys[i]])},`;
    }
    return `${str}}`;
}
function getKey(layer) {
    let key = '';
    for (const k of performance.refProperties) {
        key += `/${stringify(layer[k])}`;
    }
    return key;
}
/**
 * Given an array of layers, return an array of arrays of layers where all
 * layers in each group have identical layout-affecting properties. These
 * are the properties that were formerly used by explicit `ref` mechanism
 * for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
 * 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @private
 * @param {Array<Layer>} layers
 * @param {Object} [cachedKeys] - an object to keep already calculated keys.
 * @returns {Array<Array<Layer>>}
 */
function groupByLayout(layers, cachedKeys) {
    const groups = {};
    for (let i = 0; i < layers.length; i++) {
        const k = (cachedKeys && cachedKeys[layers[i].id]) || getKey(layers[i]);
        // update the cache if there is one
        if (cachedKeys)
            cachedKeys[layers[i].id] = k;
        let group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }
    const result = [];
    for (const k in groups) {
        result.push(groups[k]);
    }
    return result;
}

class StyleLayerIndex {
    constructor(layerConfigs) {
        this.keyCache = {};
        if (layerConfigs) {
            this.replace(layerConfigs);
        }
    }
    replace(layerConfigs) {
        this._layerConfigs = {};
        this._layers = {};
        this.update(layerConfigs, []);
    }
    update(layerConfigs, removedIds) {
        for (const layerConfig of layerConfigs) {
            this._layerConfigs[layerConfig.id] = layerConfig;
            const layer = this._layers[layerConfig.id] = performance.createStyleLayer(layerConfig);
            layer._featureFilter = performance.createFilter(layer.filter);
            if (this.keyCache[layerConfig.id])
                delete this.keyCache[layerConfig.id];
        }
        for (const id of removedIds) {
            delete this.keyCache[id];
            delete this._layerConfigs[id];
            delete this._layers[id];
        }
        this.familiesBySource = {};
        const groups = groupByLayout(Object.values(this._layerConfigs), this.keyCache);
        for (const layerConfigs of groups) {
            const layers = layerConfigs.map((layerConfig) => this._layers[layerConfig.id]);
            const layer = layers[0];
            if (layer.visibility === 'none') {
                continue;
            }
            const sourceId = layer.source || '';
            let sourceGroup = this.familiesBySource[sourceId];
            if (!sourceGroup) {
                sourceGroup = this.familiesBySource[sourceId] = {};
            }
            const sourceLayerId = layer.sourceLayer || '_geojsonTileLayer';
            let sourceLayerFamilies = sourceGroup[sourceLayerId];
            if (!sourceLayerFamilies) {
                sourceLayerFamilies = sourceGroup[sourceLayerId] = [];
            }
            sourceLayerFamilies.push(layers);
        }
    }
}

const padding = 1;
class GlyphAtlas {
    constructor(stacks) {
        const positions = {};
        const bins = [];
        for (const stack in stacks) {
            const glyphs = stacks[stack];
            const stackPositions = positions[stack] = {};
            for (const id in glyphs) {
                const src = glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0)
                    continue;
                const bin = {
                    x: 0,
                    y: 0,
                    w: src.bitmap.width + 2 * padding,
                    h: src.bitmap.height + 2 * padding
                };
                bins.push(bin);
                stackPositions[id] = { rect: bin, metrics: src.metrics };
            }
        }
        const { w, h } = performance.potpack(bins);
        const image = new performance.AlphaImage({ width: w || 1, height: h || 1 });
        for (const stack in stacks) {
            const glyphs = stacks[stack];
            for (const id in glyphs) {
                const src = glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0)
                    continue;
                const bin = positions[stack][id].rect;
                performance.AlphaImage.copy(src.bitmap, image, { x: 0, y: 0 }, { x: bin.x + padding, y: bin.y + padding }, src.bitmap);
            }
        }
        this.image = image;
        this.positions = positions;
    }
}
performance.register('GlyphAtlas', GlyphAtlas);

class WorkerTile {
    constructor(params) {
        this.tileID = new performance.OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.overscaling = this.tileID.overscaleFactor();
        this.showCollisionBoxes = params.showCollisionBoxes;
        this.collectResourceTiming = !!params.collectResourceTiming;
        this.returnDependencies = !!params.returnDependencies;
        this.promoteId = params.promoteId;
    }
    parse(data, layerIndex, availableImages, actor, callback) {
        debugger;
        this.status = 'parsing';
        this.data = data;
        this.collisionBoxArray = new performance.CollisionBoxArray();
        const sourceLayerCoder = new performance.DictionaryCoder(Object.keys(data.layers).sort());
        const featureIndex = new performance.FeatureIndex(this.tileID, this.promoteId);
        featureIndex.bucketLayerIDs = [];
        const buckets = {};
        const options = {
            featureIndex,
            iconDependencies: {},
            patternDependencies: {},
            glyphDependencies: {},
            availableImages
        };
        const layerFamilies = layerIndex.familiesBySource[this.source];
        for (const sourceLayerId in layerFamilies) {
            const sourceLayer = data.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }
            if (sourceLayer.version === 1) {
                performance.warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                    'does not use vector tile spec v2 and therefore may have some rendering errors.');
            }
            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                const id = featureIndex.getId(feature, sourceLayerId);
                features.push({ feature, id, index, sourceLayerIndex });
            }
            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];
                performance.assert(layer.source === this.source);
                if (layer.minzoom && this.zoom < Math.floor(layer.minzoom))
                    continue;
                if (layer.maxzoom && this.zoom >= layer.maxzoom)
                    continue;
                if (layer.visibility === 'none')
                    continue;
                recalculateLayers(family, this.zoom, availableImages);
                const bucket = buckets[layer.id] = layer.createBucket({
                    index: featureIndex.bucketLayerIDs.length,
                    layers: family,
                    zoom: this.zoom,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray,
                    sourceLayerIndex,
                    sourceID: this.source
                });
                bucket.populate(features, options, this.tileID.canonical);
                featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
            }
        }
        let error;
        let glyphMap;
        let iconMap;
        let patternMap;
        const stacks = performance.mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
        if (Object.keys(stacks).length) {
            actor.send('getGlyphs', { uid: this.uid, stacks }, (err, result) => {
                if (!error) {
                    error = err;
                    glyphMap = result;
                    maybePrepare.call(this);
                }
            });
        }
        else {
            glyphMap = {};
        }
        const icons = Object.keys(options.iconDependencies);
        if (icons.length) {
            actor.send('getImages', { icons, source: this.source, tileID: this.tileID, type: 'icons' }, (err, result) => {
                if (!error) {
                    error = err;
                    iconMap = result;
                    maybePrepare.call(this);
                }
            });
        }
        else {
            iconMap = {};
        }
        const patterns = Object.keys(options.patternDependencies);
        if (patterns.length) {
            actor.send('getImages', { icons: patterns, source: this.source, tileID: this.tileID, type: 'patterns' }, (err, result) => {
                if (!error) {
                    error = err;
                    patternMap = result;
                    maybePrepare.call(this);
                }
            });
        }
        else {
            patternMap = {};
        }
        maybePrepare.call(this);
        function maybePrepare() {
            if (error) {
                return callback(error);
            }
            else if (glyphMap && iconMap && patternMap) {
                const glyphAtlas = new GlyphAtlas(glyphMap);
                const imageAtlas = new performance.ImageAtlas(iconMap, patternMap);
                for (const key in buckets) {
                    const bucket = buckets[key];
                    if (bucket instanceof performance.SymbolBucket) {
                        recalculateLayers(bucket.layers, this.zoom, availableImages);
                        performance.performSymbolLayout(bucket, glyphMap, glyphAtlas.positions, iconMap, imageAtlas.iconPositions, this.showCollisionBoxes, this.tileID.canonical);
                    }
                    else if (bucket.hasPattern &&
                        (bucket instanceof performance.LineBucket ||
                            bucket instanceof performance.FillBucket ||
                            bucket instanceof performance.FillExtrusionBucket)) {
                        recalculateLayers(bucket.layers, this.zoom, availableImages);
                        bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions);
                    }
                }
                this.status = 'done';
                callback(null, {
                    buckets: Object.values(buckets).filter(b => !b.isEmpty()),
                    featureIndex,
                    collisionBoxArray: this.collisionBoxArray,
                    glyphAtlasImage: glyphAtlas.image,
                    imageAtlas,
                    // Only used for benchmarking:
                    glyphMap: this.returnDependencies ? glyphMap : null,
                    iconMap: this.returnDependencies ? iconMap : null,
                    glyphPositions: this.returnDependencies ? glyphAtlas.positions : null
                });
            }
        }
    }
}
function recalculateLayers(layers, zoom, availableImages) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new performance.EvaluationParameters(zoom);
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}

/**
 * @private
 */
function loadVectorTile(params, callback) {
    const request = performance.getArrayBuffer(params.request, (err, data, cacheControl, expires) => {
        if (err) {
            callback(err);
        }
        else if (data) {
            callback(null, {
                vectorTile: new performance.vectorTile.VectorTile(new performance.pbf(data)),
                rawData: data,
                cacheControl,
                expires
            });
        }
    });
    return () => {
        request.cancel();
        callback();
    };
}
/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 *
 * @private
 */
class VectorTileWorkerSource {
    /**
     * @param [loadVectorData] Optional method for custom loading of a VectorTile
     * object based on parameters passed from the main-thread Source. See
     * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
     * loads the pbf at `params.url`.
     * @private
     */
    constructor(actor, layerIndex, availableImages, loadVectorData) {
        this.actor = actor;
        this.layerIndex = layerIndex;
        this.availableImages = availableImages;
        this.loadVectorData = loadVectorData || loadVectorTile;
        this.loading = {};
        this.loaded = {};
    }
    /**
     * Implements {@link WorkerSource#loadTile}. Delegates to
     * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
     * a `params.url` property) for fetching and producing a VectorTile object.
     * @private
     */
    loadTile(params, callback) {
        const uid = params.uid;
        if (!this.loading)
            this.loading = {};
        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new performance.RequestPerformance(params.request) : false;
        const workerTile = this.loading[uid] = new WorkerTile(params);
        workerTile.abort = this.loadVectorData(params, (err, response) => {
            delete this.loading[uid];
            if (err || !response) {
                workerTile.status = 'done';
                this.loaded[uid] = workerTile;
                return callback(err);
            }
            const rawTileData = response.rawData;
            const cacheControl = {};
            if (response.expires)
                cacheControl.expires = response.expires;
            if (response.cacheControl)
                cacheControl.cacheControl = response.cacheControl;
            const resourceTiming = {};
            if (perf) {
                const resourceTimingData = perf.finish();
                // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                // late evaluation in the main thread causes TypeError: illegal invocation
                if (resourceTimingData)
                    resourceTiming.resourceTiming = JSON.parse(JSON.stringify(resourceTimingData));
            }
            workerTile.vectorTile = response.vectorTile;
            workerTile.parse(response.vectorTile, this.layerIndex, this.availableImages, this.actor, (err, result) => {
                if (err || !result)
                    return callback(err);
                // Transferring a copy of rawTileData because the worker needs to retain its copy.
                callback(null, performance.extend({ rawTileData: rawTileData.slice(0) }, result, cacheControl, resourceTiming));
            });
            this.loaded = this.loaded || {};
            this.loaded[uid] = workerTile;
        });
    }
    /**
     * Implements {@link WorkerSource#reloadTile}.
     * @private
     */
    reloadTile(params, callback) {
        const loaded = this.loaded, uid = params.uid, vtSource = this;
        if (loaded && loaded[uid]) {
            const workerTile = loaded[uid];
            workerTile.showCollisionBoxes = params.showCollisionBoxes;
            const done = (err, data) => {
                const reloadCallback = workerTile.reloadCallback;
                if (reloadCallback) {
                    delete workerTile.reloadCallback;
                    workerTile.parse(workerTile.vectorTile, vtSource.layerIndex, this.availableImages, vtSource.actor, reloadCallback);
                }
                callback(err, data);
            };
            if (workerTile.status === 'parsing') {
                workerTile.reloadCallback = done;
            }
            else if (workerTile.status === 'done') {
                // if there was no vector tile data on the initial load, don't try and re-parse tile
                if (workerTile.vectorTile) {
                    workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, done);
                }
                else {
                    done();
                }
            }
        }
    }
    /**
     * Implements {@link WorkerSource#abortTile}.
     *
     * @param params
     * @param params.uid The UID for this tile.
     * @private
     */
    abortTile(params, callback) {
        const loading = this.loading, uid = params.uid;
        if (loading && loading[uid] && loading[uid].abort) {
            loading[uid].abort();
            delete loading[uid];
        }
        callback();
    }
    /**
     * Implements {@link WorkerSource#removeTile}.
     *
     * @param params
     * @param params.uid The UID for this tile.
     * @private
     */
    removeTile(params, callback) {
        const loaded = this.loaded, uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
        callback();
    }
}

class RasterDEMTileWorkerSource {
    constructor() {
        this.loaded = {};
    }
    loadTile(params, callback) {
        const { uid, encoding, rawImageData } = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        const imagePixels = performance.isImageBitmap(rawImageData) ? this.getImageData(rawImageData) : rawImageData;
        const dem = new performance.DEMData(uid, imagePixels, encoding);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
    }
    getImageData(imgBitmap) {
        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            this.offscreenCanvasContext = this.offscreenCanvas.getContext('2d');
        }
        this.offscreenCanvas.width = imgBitmap.width;
        this.offscreenCanvas.height = imgBitmap.height;
        this.offscreenCanvasContext.drawImage(imgBitmap, 0, 0, imgBitmap.width, imgBitmap.height);
        // Insert an additional 1px padding around the image to allow backfilling for neighboring data.
        const imgData = this.offscreenCanvasContext.getImageData(-1, -1, imgBitmap.width + 2, imgBitmap.height + 2);
        this.offscreenCanvasContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        return new performance.RGBAImage({ width: imgData.width, height: imgData.height }, imgData.data);
    }
    removeTile(params) {
        const loaded = this.loaded, uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

var geojsonRewind = rewind$1;

function rewind$1(gj, outer) {
    var type = gj && gj.type, i;

    if (type === 'FeatureCollection') {
        for (i = 0; i < gj.features.length; i++) rewind$1(gj.features[i], outer);

    } else if (type === 'GeometryCollection') {
        for (i = 0; i < gj.geometries.length; i++) rewind$1(gj.geometries[i], outer);

    } else if (type === 'Feature') {
        rewind$1(gj.geometry, outer);

    } else if (type === 'Polygon') {
        rewindRings(gj.coordinates, outer);

    } else if (type === 'MultiPolygon') {
        for (i = 0; i < gj.coordinates.length; i++) rewindRings(gj.coordinates[i], outer);
    }

    return gj;
}

function rewindRings(rings, outer) {
    if (rings.length === 0) return;

    rewindRing(rings[0], outer);
    for (var i = 1; i < rings.length; i++) {
        rewindRing(rings[i], !outer);
    }
}

function rewindRing(ring, dir) {
    var area = 0, err = 0;
    for (var i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
        var k = (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
        var m = area + k;
        err += Math.abs(area) >= Math.abs(k) ? area - m + k : k - m + area;
        area = m;
    }
    if (area + err >= 0 !== !!dir) ring.reverse();
}

const toGeoJSON = performance.vectorTile.VectorTileFeature.prototype.toGeoJSON;
class FeatureWrapper$1 {
    constructor(feature) {
        this._feature = feature;
        this.extent = performance.EXTENT;
        this.type = feature.type;
        this.properties = feature.tags;
        // If the feature has a top-level `id` property, copy it over, but only
        // if it can be coerced to an integer, because this wrapper is used for
        // serializing geojson feature data into vector tile PBF data, and the
        // vector tile spec only supports integer values for feature ids --
        // allowing non-integer values here results in a non-compliant PBF
        // that causes an exception when it is parsed with vector-tile-js
        if ('id' in feature && !isNaN(feature.id)) {
            this.id = parseInt(feature.id, 10);
        }
    }
    loadGeometry() {
        if (this._feature.type === 1) {
            const geometry = [];
            for (const point of this._feature.geometry) {
                geometry.push([new performance.pointGeometry(point[0], point[1])]);
            }
            return geometry;
        }
        else {
            const geometry = [];
            for (const ring of this._feature.geometry) {
                const newRing = [];
                for (const point of ring) {
                    newRing.push(new performance.pointGeometry(point[0], point[1]));
                }
                geometry.push(newRing);
            }
            return geometry;
        }
    }
    toGeoJSON(x, y, z) {
        return toGeoJSON.call(this, x, y, z);
    }
}
class GeoJSONWrapper$2 {
    constructor(features) {
        this.layers = { '_geojsonTileLayer': this };
        this.name = '_geojsonTileLayer';
        this.extent = performance.EXTENT;
        this.length = features.length;
        this._features = features;
    }
    feature(i) {
        return new FeatureWrapper$1(this._features[i]);
    }
}

var vtPbf = {exports: {}};

'use strict';

var Point = performance.pointGeometry;
var VectorTileFeature = performance.vectorTile.VectorTileFeature;

var geojson_wrapper = GeoJSONWrapper$1;

// conform to vectortile api
function GeoJSONWrapper$1 (features, options) {
  this.options = options || {};
  this.features = features;
  this.length = features.length;
}

GeoJSONWrapper$1.prototype.feature = function (i) {
  return new FeatureWrapper(this.features[i], this.options.extent)
};

function FeatureWrapper (feature, extent) {
  this.id = typeof feature.id === 'number' ? feature.id : undefined;
  this.type = feature.type;
  this.rawGeometry = feature.type === 1 ? [feature.geometry] : feature.geometry;
  this.properties = feature.tags;
  this.extent = extent || 4096;
}

FeatureWrapper.prototype.loadGeometry = function () {
  var rings = this.rawGeometry;
  this.geometry = [];

  for (var i = 0; i < rings.length; i++) {
    var ring = rings[i];
    var newRing = [];
    for (var j = 0; j < ring.length; j++) {
      newRing.push(new Point(ring[j][0], ring[j][1]));
    }
    this.geometry.push(newRing);
  }
  return this.geometry
};

FeatureWrapper.prototype.bbox = function () {
  if (!this.geometry) this.loadGeometry();

  var rings = this.geometry;
  var x1 = Infinity;
  var x2 = -Infinity;
  var y1 = Infinity;
  var y2 = -Infinity;

  for (var i = 0; i < rings.length; i++) {
    var ring = rings[i];

    for (var j = 0; j < ring.length; j++) {
      var coord = ring[j];

      x1 = Math.min(x1, coord.x);
      x2 = Math.max(x2, coord.x);
      y1 = Math.min(y1, coord.y);
      y2 = Math.max(y2, coord.y);
    }
  }

  return [x1, y1, x2, y2]
};

FeatureWrapper.prototype.toGeoJSON = VectorTileFeature.prototype.toGeoJSON;

var Pbf = performance.pbf;
var GeoJSONWrapper = geojson_wrapper;

vtPbf.exports = fromVectorTileJs;
var fromVectorTileJs_1 = vtPbf.exports.fromVectorTileJs = fromVectorTileJs;
var fromGeojsonVt_1 = vtPbf.exports.fromGeojsonVt = fromGeojsonVt;
var GeoJSONWrapper_1 = vtPbf.exports.GeoJSONWrapper = GeoJSONWrapper;

/**
 * Serialize a vector-tile-js-created tile to pbf
 *
 * @param {Object} tile
 * @return {Buffer} uncompressed, pbf-serialized tile data
 */
function fromVectorTileJs (tile) {
  var out = new Pbf();
  writeTile(tile, out);
  return out.finish()
}

/**
 * Serialized a geojson-vt-created tile to pbf.
 *
 * @param {Object} layers - An object mapping layer names to geojson-vt-created vector tile objects
 * @param {Object} [options] - An object specifying the vector-tile specification version and extent that were used to create `layers`.
 * @param {Number} [options.version=1] - Version of vector-tile spec used
 * @param {Number} [options.extent=4096] - Extent of the vector tile
 * @return {Buffer} uncompressed, pbf-serialized tile data
 */
function fromGeojsonVt (layers, options) {
  options = options || {};
  var l = {};
  for (var k in layers) {
    l[k] = new GeoJSONWrapper(layers[k].features, options);
    l[k].name = k;
    l[k].version = options.version;
    l[k].extent = options.extent;
  }
  return fromVectorTileJs({ layers: l })
}

function writeTile (tile, pbf) {
  for (var key in tile.layers) {
    pbf.writeMessage(3, writeLayer, tile.layers[key]);
  }
}

function writeLayer (layer, pbf) {
  pbf.writeVarintField(15, layer.version || 1);
  pbf.writeStringField(1, layer.name || '');
  pbf.writeVarintField(5, layer.extent || 4096);

  var i;
  var context = {
    keys: [],
    values: [],
    keycache: {},
    valuecache: {}
  };

  for (i = 0; i < layer.length; i++) {
    context.feature = layer.feature(i);
    pbf.writeMessage(2, writeFeature, context);
  }

  var keys = context.keys;
  for (i = 0; i < keys.length; i++) {
    pbf.writeStringField(3, keys[i]);
  }

  var values = context.values;
  for (i = 0; i < values.length; i++) {
    pbf.writeMessage(4, writeValue, values[i]);
  }
}

function writeFeature (context, pbf) {
  var feature = context.feature;

  if (feature.id !== undefined) {
    pbf.writeVarintField(1, feature.id);
  }

  pbf.writeMessage(2, writeProperties, context);
  pbf.writeVarintField(3, feature.type);
  pbf.writeMessage(4, writeGeometry, feature);
}

function writeProperties (context, pbf) {
  var feature = context.feature;
  var keys = context.keys;
  var values = context.values;
  var keycache = context.keycache;
  var valuecache = context.valuecache;

  for (var key in feature.properties) {
    var value = feature.properties[key];

    var keyIndex = keycache[key];
    if (value === null) continue // don't encode null value properties

    if (typeof keyIndex === 'undefined') {
      keys.push(key);
      keyIndex = keys.length - 1;
      keycache[key] = keyIndex;
    }
    pbf.writeVarint(keyIndex);

    var type = typeof value;
    if (type !== 'string' && type !== 'boolean' && type !== 'number') {
      value = JSON.stringify(value);
    }
    var valueKey = type + ':' + value;
    var valueIndex = valuecache[valueKey];
    if (typeof valueIndex === 'undefined') {
      values.push(value);
      valueIndex = values.length - 1;
      valuecache[valueKey] = valueIndex;
    }
    pbf.writeVarint(valueIndex);
  }
}

function command (cmd, length) {
  return (length << 3) + (cmd & 0x7)
}

function zigzag (num) {
  return (num << 1) ^ (num >> 31)
}

function writeGeometry (feature, pbf) {
  var geometry = feature.loadGeometry();
  var type = feature.type;
  var x = 0;
  var y = 0;
  var rings = geometry.length;
  for (var r = 0; r < rings; r++) {
    var ring = geometry[r];
    var count = 1;
    if (type === 1) {
      count = ring.length;
    }
    pbf.writeVarint(command(1, count)); // moveto
    // do not write polygon closing path as lineto
    var lineCount = type === 3 ? ring.length - 1 : ring.length;
    for (var i = 0; i < lineCount; i++) {
      if (i === 1 && type !== 1) {
        pbf.writeVarint(command(2, lineCount - 1)); // lineto
      }
      var dx = ring[i].x - x;
      var dy = ring[i].y - y;
      pbf.writeVarint(zigzag(dx));
      pbf.writeVarint(zigzag(dy));
      x += dx;
      y += dy;
    }
    if (type === 3) {
      pbf.writeVarint(command(7, 1)); // closepath
    }
  }
}

function writeValue (value, pbf) {
  var type = typeof value;
  if (type === 'string') {
    pbf.writeStringField(1, value);
  } else if (type === 'boolean') {
    pbf.writeBooleanField(7, value);
  } else if (type === 'number') {
    if (value % 1 !== 0) {
      pbf.writeDoubleField(3, value);
    } else if (value < 0) {
      pbf.writeSVarintField(6, value);
    } else {
      pbf.writeVarintField(5, value);
    }
  }
}

var vtpbf = vtPbf.exports;

function sortKD(ids, coords, nodeSize, left, right, depth) {
    if (right - left <= nodeSize) return;

    const m = (left + right) >> 1;

    select(ids, coords, m, left, right, depth % 2);

    sortKD(ids, coords, nodeSize, left, m - 1, depth + 1);
    sortKD(ids, coords, nodeSize, m + 1, right, depth + 1);
}

function select(ids, coords, k, left, right, inc) {

    while (right > left) {
        if (right - left > 600) {
            const n = right - left + 1;
            const m = k - left + 1;
            const z = Math.log(n);
            const s = 0.5 * Math.exp(2 * z / 3);
            const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            select(ids, coords, k, newLeft, newRight, inc);
        }

        const t = coords[2 * k + inc];
        let i = left;
        let j = right;

        swapItem(ids, coords, left, k);
        if (coords[2 * right + inc] > t) swapItem(ids, coords, left, right);

        while (i < j) {
            swapItem(ids, coords, i, j);
            i++;
            j--;
            while (coords[2 * i + inc] < t) i++;
            while (coords[2 * j + inc] > t) j--;
        }

        if (coords[2 * left + inc] === t) swapItem(ids, coords, left, j);
        else {
            j++;
            swapItem(ids, coords, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swapItem(ids, coords, i, j) {
    swap(ids, i, j);
    swap(coords, 2 * i, 2 * j);
    swap(coords, 2 * i + 1, 2 * j + 1);
}

function swap(arr, i, j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

function range(ids, coords, minX, minY, maxX, maxY, nodeSize) {
    const stack = [0, ids.length - 1, 0];
    const result = [];
    let x, y;

    while (stack.length) {
        const axis = stack.pop();
        const right = stack.pop();
        const left = stack.pop();

        if (right - left <= nodeSize) {
            for (let i = left; i <= right; i++) {
                x = coords[2 * i];
                y = coords[2 * i + 1];
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[i]);
            }
            continue;
        }

        const m = Math.floor((left + right) / 2);

        x = coords[2 * m];
        y = coords[2 * m + 1];

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[m]);

        const nextAxis = (axis + 1) % 2;

        if (axis === 0 ? minX <= x : minY <= y) {
            stack.push(left);
            stack.push(m - 1);
            stack.push(nextAxis);
        }
        if (axis === 0 ? maxX >= x : maxY >= y) {
            stack.push(m + 1);
            stack.push(right);
            stack.push(nextAxis);
        }
    }

    return result;
}

function within(ids, coords, qx, qy, r, nodeSize) {
    const stack = [0, ids.length - 1, 0];
    const result = [];
    const r2 = r * r;

    while (stack.length) {
        const axis = stack.pop();
        const right = stack.pop();
        const left = stack.pop();

        if (right - left <= nodeSize) {
            for (let i = left; i <= right; i++) {
                if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2) result.push(ids[i]);
            }
            continue;
        }

        const m = Math.floor((left + right) / 2);

        const x = coords[2 * m];
        const y = coords[2 * m + 1];

        if (sqDist(x, y, qx, qy) <= r2) result.push(ids[m]);

        const nextAxis = (axis + 1) % 2;

        if (axis === 0 ? qx - r <= x : qy - r <= y) {
            stack.push(left);
            stack.push(m - 1);
            stack.push(nextAxis);
        }
        if (axis === 0 ? qx + r >= x : qy + r >= y) {
            stack.push(m + 1);
            stack.push(right);
            stack.push(nextAxis);
        }
    }

    return result;
}

function sqDist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

const defaultGetX = p => p[0];
const defaultGetY = p => p[1];

class KDBush {
    constructor(points, getX = defaultGetX, getY = defaultGetY, nodeSize = 64, ArrayType = Float64Array) {
        this.nodeSize = nodeSize;
        this.points = points;

        const IndexArrayType = points.length < 65536 ? Uint16Array : Uint32Array;

        const ids = this.ids = new IndexArrayType(points.length);
        const coords = this.coords = new ArrayType(points.length * 2);

        for (let i = 0; i < points.length; i++) {
            ids[i] = i;
            coords[2 * i] = getX(points[i]);
            coords[2 * i + 1] = getY(points[i]);
        }

        sortKD(ids, coords, nodeSize, 0, ids.length - 1, 0);
    }

    range(minX, minY, maxX, maxY) {
        return range(this.ids, this.coords, minX, minY, maxX, maxY, this.nodeSize);
    }

    within(x, y, r) {
        return within(this.ids, this.coords, x, y, r, this.nodeSize);
    }
}

const defaultOptions = {
    minZoom: 0,   // min zoom to generate clusters on
    maxZoom: 16,  // max zoom level to cluster the points on
    minPoints: 2, // minimum points to form a cluster
    radius: 40,   // cluster radius in pixels
    extent: 512,  // tile extent (radius is calculated relative to it)
    nodeSize: 64, // size of the KD-tree leaf node, affects performance
    log: false,   // whether to log timing info

    // whether to generate numeric ids for input features (in vector tiles)
    generateId: false,

    // a reduce function for calculating custom cluster properties
    reduce: null, // (accumulated, props) => { accumulated.sum += props.sum; }

    // properties to use for individual points when running the reducer
    map: props => props // props => ({sum: props.my_value})
};

const fround = Math.fround || (tmp => ((x) => { tmp[0] = +x; return tmp[0]; }))(new Float32Array(1));

class Supercluster {
    constructor(options) {
        this.options = extend$1(Object.create(defaultOptions), options);
        this.trees = new Array(this.options.maxZoom + 1);
    }

    load(points) {
        const {log, minZoom, maxZoom, nodeSize} = this.options;

        if (log) console.time('total time');

        const timerId = `prepare ${  points.length  } points`;
        if (log) console.time(timerId);

        this.points = points;

        // generate a cluster object for each point and index input points into a KD-tree
        let clusters = [];
        for (let i = 0; i < points.length; i++) {
            if (!points[i].geometry) continue;
            clusters.push(createPointCluster(points[i], i));
        }
        this.trees[maxZoom + 1] = new KDBush(clusters, getX, getY, nodeSize, Float32Array);

        if (log) console.timeEnd(timerId);

        // cluster points on max zoom, then cluster the results on previous zoom, etc.;
        // results in a cluster hierarchy across zoom levels
        for (let z = maxZoom; z >= minZoom; z--) {
            const now = +Date.now();

            // create a new set of clusters for the zoom and index them with a KD-tree
            clusters = this._cluster(clusters, z);
            this.trees[z] = new KDBush(clusters, getX, getY, nodeSize, Float32Array);

            if (log) console.log('z%d: %d clusters in %dms', z, clusters.length, +Date.now() - now);
        }

        if (log) console.timeEnd('total time');

        return this;
    }

    getClusters(bbox, zoom) {
        let minLng = ((bbox[0] + 180) % 360 + 360) % 360 - 180;
        const minLat = Math.max(-90, Math.min(90, bbox[1]));
        let maxLng = bbox[2] === 180 ? 180 : ((bbox[2] + 180) % 360 + 360) % 360 - 180;
        const maxLat = Math.max(-90, Math.min(90, bbox[3]));

        if (bbox[2] - bbox[0] >= 360) {
            minLng = -180;
            maxLng = 180;
        } else if (minLng > maxLng) {
            const easternHem = this.getClusters([minLng, minLat, 180, maxLat], zoom);
            const westernHem = this.getClusters([-180, minLat, maxLng, maxLat], zoom);
            return easternHem.concat(westernHem);
        }

        const tree = this.trees[this._limitZoom(zoom)];
        const ids = tree.range(lngX(minLng), latY(maxLat), lngX(maxLng), latY(minLat));
        const clusters = [];
        for (const id of ids) {
            const c = tree.points[id];
            clusters.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
        }
        return clusters;
    }

    getChildren(clusterId) {
        const originId = this._getOriginId(clusterId);
        const originZoom = this._getOriginZoom(clusterId);
        const errorMsg = 'No cluster with the specified id.';

        const index = this.trees[originZoom];
        if (!index) throw new Error(errorMsg);

        const origin = index.points[originId];
        if (!origin) throw new Error(errorMsg);

        const r = this.options.radius / (this.options.extent * Math.pow(2, originZoom - 1));
        const ids = index.within(origin.x, origin.y, r);
        const children = [];
        for (const id of ids) {
            const c = index.points[id];
            if (c.parentId === clusterId) {
                children.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
            }
        }

        if (children.length === 0) throw new Error(errorMsg);

        return children;
    }

    getLeaves(clusterId, limit, offset) {
        limit = limit || 10;
        offset = offset || 0;

        const leaves = [];
        this._appendLeaves(leaves, clusterId, limit, offset, 0);

        return leaves;
    }

    getTile(z, x, y) {
        const tree = this.trees[this._limitZoom(z)];
        const z2 = Math.pow(2, z);
        const {extent, radius} = this.options;
        const p = radius / extent;
        const top = (y - p) / z2;
        const bottom = (y + 1 + p) / z2;

        const tile = {
            features: []
        };

        this._addTileFeatures(
            tree.range((x - p) / z2, top, (x + 1 + p) / z2, bottom),
            tree.points, x, y, z2, tile);

        if (x === 0) {
            this._addTileFeatures(
                tree.range(1 - p / z2, top, 1, bottom),
                tree.points, z2, y, z2, tile);
        }
        if (x === z2 - 1) {
            this._addTileFeatures(
                tree.range(0, top, p / z2, bottom),
                tree.points, -1, y, z2, tile);
        }

        return tile.features.length ? tile : null;
    }

    getClusterExpansionZoom(clusterId) {
        let expansionZoom = this._getOriginZoom(clusterId) - 1;
        while (expansionZoom <= this.options.maxZoom) {
            const children = this.getChildren(clusterId);
            expansionZoom++;
            if (children.length !== 1) break;
            clusterId = children[0].properties.cluster_id;
        }
        return expansionZoom;
    }

    _appendLeaves(result, clusterId, limit, offset, skipped) {
        const children = this.getChildren(clusterId);

        for (const child of children) {
            const props = child.properties;

            if (props && props.cluster) {
                if (skipped + props.point_count <= offset) {
                    // skip the whole cluster
                    skipped += props.point_count;
                } else {
                    // enter the cluster
                    skipped = this._appendLeaves(result, props.cluster_id, limit, offset, skipped);
                    // exit the cluster
                }
            } else if (skipped < offset) {
                // skip a single point
                skipped++;
            } else {
                // add a single point
                result.push(child);
            }
            if (result.length === limit) break;
        }

        return skipped;
    }

    _addTileFeatures(ids, points, x, y, z2, tile) {
        for (const i of ids) {
            const c = points[i];
            const isCluster = c.numPoints;

            let tags, px, py;
            if (isCluster) {
                tags = getClusterProperties(c);
                px = c.x;
                py = c.y;
            } else {
                const p = this.points[c.index];
                tags = p.properties;
                px = lngX(p.geometry.coordinates[0]);
                py = latY(p.geometry.coordinates[1]);
            }

            const f = {
                type: 1,
                geometry: [[
                    Math.round(this.options.extent * (px * z2 - x)),
                    Math.round(this.options.extent * (py * z2 - y))
                ]],
                tags
            };

            // assign id
            let id;
            if (isCluster) {
                id = c.id;
            } else if (this.options.generateId) {
                // optionally generate id
                id = c.index;
            } else if (this.points[c.index].id) {
                // keep id if already assigned
                id = this.points[c.index].id;
            }

            if (id !== undefined) f.id = id;

            tile.features.push(f);
        }
    }

    _limitZoom(z) {
        return Math.max(this.options.minZoom, Math.min(+z, this.options.maxZoom + 1));
    }

    _cluster(points, zoom) {
        const clusters = [];
        const {radius, extent, reduce, minPoints} = this.options;
        const r = radius / (extent * Math.pow(2, zoom));

        // loop through each point
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            // if we've already visited the point at this zoom level, skip it
            if (p.zoom <= zoom) continue;
            p.zoom = zoom;

            // find all nearby points
            const tree = this.trees[zoom + 1];
            const neighborIds = tree.within(p.x, p.y, r);

            const numPointsOrigin = p.numPoints || 1;
            let numPoints = numPointsOrigin;

            // count the number of points in a potential cluster
            for (const neighborId of neighborIds) {
                const b = tree.points[neighborId];
                // filter out neighbors that are already processed
                if (b.zoom > zoom) numPoints += b.numPoints || 1;
            }

            // if there were neighbors to merge, and there are enough points to form a cluster
            if (numPoints > numPointsOrigin && numPoints >= minPoints) {
                let wx = p.x * numPointsOrigin;
                let wy = p.y * numPointsOrigin;

                let clusterProperties = reduce && numPointsOrigin > 1 ? this._map(p, true) : null;

                // encode both zoom and point index on which the cluster originated -- offset by total length of features
                const id = (i << 5) + (zoom + 1) + this.points.length;

                for (const neighborId of neighborIds) {
                    const b = tree.points[neighborId];

                    if (b.zoom <= zoom) continue;
                    b.zoom = zoom; // save the zoom (so it doesn't get processed twice)

                    const numPoints2 = b.numPoints || 1;
                    wx += b.x * numPoints2; // accumulate coordinates for calculating weighted center
                    wy += b.y * numPoints2;

                    b.parentId = id;

                    if (reduce) {
                        if (!clusterProperties) clusterProperties = this._map(p, true);
                        reduce(clusterProperties, this._map(b));
                    }
                }

                p.parentId = id;
                clusters.push(createCluster(wx / numPoints, wy / numPoints, id, numPoints, clusterProperties));

            } else { // left points as unclustered
                clusters.push(p);

                if (numPoints > 1) {
                    for (const neighborId of neighborIds) {
                        const b = tree.points[neighborId];
                        if (b.zoom <= zoom) continue;
                        b.zoom = zoom;
                        clusters.push(b);
                    }
                }
            }
        }

        return clusters;
    }

    // get index of the point from which the cluster originated
    _getOriginId(clusterId) {
        return (clusterId - this.points.length) >> 5;
    }

    // get zoom of the point from which the cluster originated
    _getOriginZoom(clusterId) {
        return (clusterId - this.points.length) % 32;
    }

    _map(point, clone) {
        if (point.numPoints) {
            return clone ? extend$1({}, point.properties) : point.properties;
        }
        const original = this.points[point.index].properties;
        const result = this.options.map(original);
        return clone && result === original ? extend$1({}, result) : result;
    }
}

function createCluster(x, y, id, numPoints, properties) {
    return {
        x: fround(x), // weighted cluster center; round for consistency with Float32Array index
        y: fround(y),
        zoom: Infinity, // the last zoom the cluster was processed at
        id, // encodes index of the first child of the cluster and its zoom level
        parentId: -1, // parent cluster id
        numPoints,
        properties
    };
}

function createPointCluster(p, id) {
    const [x, y] = p.geometry.coordinates;
    return {
        x: fround(lngX(x)), // projected point coordinates
        y: fround(latY(y)),
        zoom: Infinity, // the last zoom the point was processed at
        index: id, // index of the source feature in the original input array,
        parentId: -1 // parent cluster id
    };
}

function getClusterJSON(cluster) {
    return {
        type: 'Feature',
        id: cluster.id,
        properties: getClusterProperties(cluster),
        geometry: {
            type: 'Point',
            coordinates: [xLng(cluster.x), yLat(cluster.y)]
        }
    };
}

function getClusterProperties(cluster) {
    const count = cluster.numPoints;
    const abbrev =
        count >= 10000 ? `${Math.round(count / 1000)  }k` :
        count >= 1000 ? `${Math.round(count / 100) / 10  }k` : count;
    return extend$1(extend$1({}, cluster.properties), {
        cluster: true,
        cluster_id: cluster.id,
        point_count: count,
        point_count_abbreviated: abbrev
    });
}

// longitude/latitude to spherical mercator in [0..1] range
function lngX(lng) {
    return lng / 360 + 0.5;
}
function latY(lat) {
    const sin = Math.sin(lat * Math.PI / 180);
    const y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return y < 0 ? 0 : y > 1 ? 1 : y;
}

// spherical mercator to longitude/latitude
function xLng(x) {
    return (x - 0.5) * 360;
}
function yLat(y) {
    const y2 = (180 - y * 360) * Math.PI / 180;
    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;
}

function extend$1(dest, src) {
    for (const id in src) dest[id] = src[id];
    return dest;
}

function getX(p) {
    return p.x;
}
function getY(p) {
    return p.y;
}

// calculate simplification data using optimized Douglas-Peucker algorithm

function simplify(coords, first, last, sqTolerance) {
    var maxSqDist = sqTolerance;
    var mid = (last - first) >> 1;
    var minPosToMid = last - first;
    var index;

    var ax = coords[first];
    var ay = coords[first + 1];
    var bx = coords[last];
    var by = coords[last + 1];

    for (var i = first + 3; i < last; i += 3) {
        var d = getSqSegDist(coords[i], coords[i + 1], ax, ay, bx, by);

        if (d > maxSqDist) {
            index = i;
            maxSqDist = d;

        } else if (d === maxSqDist) {
            // a workaround to ensure we choose a pivot close to the middle of the list,
            // reducing recursion depth, for certain degenerate inputs
            // https://github.com/mapbox/geojson-vt/issues/104
            var posToMid = Math.abs(i - mid);
            if (posToMid < minPosToMid) {
                index = i;
                minPosToMid = posToMid;
            }
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 3) simplify(coords, first, index, sqTolerance);
        coords[index + 2] = maxSqDist;
        if (last - index > 3) simplify(coords, index, last, sqTolerance);
    }
}

// square distance from a point to a segment
function getSqSegDist(px, py, x, y, bx, by) {

    var dx = bx - x;
    var dy = by - y;

    if (dx !== 0 || dy !== 0) {

        var t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = bx;
            y = by;

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = px - x;
    dy = py - y;

    return dx * dx + dy * dy;
}

function createFeature(id, type, geom, tags) {
    var feature = {
        id: typeof id === 'undefined' ? null : id,
        type: type,
        geometry: geom,
        tags: tags,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    };
    calcBBox(feature);
    return feature;
}

function calcBBox(feature) {
    var geom = feature.geometry;
    var type = feature.type;

    if (type === 'Point' || type === 'MultiPoint' || type === 'LineString') {
        calcLineBBox(feature, geom);

    } else if (type === 'Polygon' || type === 'MultiLineString') {
        for (var i = 0; i < geom.length; i++) {
            calcLineBBox(feature, geom[i]);
        }

    } else if (type === 'MultiPolygon') {
        for (i = 0; i < geom.length; i++) {
            for (var j = 0; j < geom[i].length; j++) {
                calcLineBBox(feature, geom[i][j]);
            }
        }
    }
}

function calcLineBBox(feature, geom) {
    for (var i = 0; i < geom.length; i += 3) {
        feature.minX = Math.min(feature.minX, geom[i]);
        feature.minY = Math.min(feature.minY, geom[i + 1]);
        feature.maxX = Math.max(feature.maxX, geom[i]);
        feature.maxY = Math.max(feature.maxY, geom[i + 1]);
    }
}

// converts GeoJSON feature into an intermediate projected JSON vector format with simplification data

function convert(data, options) {
    var features = [];
    if (data.type === 'FeatureCollection') {
        for (var i = 0; i < data.features.length; i++) {
            convertFeature(features, data.features[i], options, i);
        }

    } else if (data.type === 'Feature') {
        convertFeature(features, data, options);

    } else {
        // single geometry or a geometry collection
        convertFeature(features, {geometry: data}, options);
    }

    return features;
}

function convertFeature(features, geojson, options, index) {
    if (!geojson.geometry) return;

    var coords = geojson.geometry.coordinates;
    var type = geojson.geometry.type;
    var tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);
    var geometry = [];
    var id = geojson.id;
    if (options.promoteId) {
        id = geojson.properties[options.promoteId];
    } else if (options.generateId) {
        id = index || 0;
    }
    if (type === 'Point') {
        convertPoint(coords, geometry);

    } else if (type === 'MultiPoint') {
        for (var i = 0; i < coords.length; i++) {
            convertPoint(coords[i], geometry);
        }

    } else if (type === 'LineString') {
        convertLine(coords, geometry, tolerance, false);

    } else if (type === 'MultiLineString') {
        if (options.lineMetrics) {
            // explode into linestrings to be able to track metrics
            for (i = 0; i < coords.length; i++) {
                geometry = [];
                convertLine(coords[i], geometry, tolerance, false);
                features.push(createFeature(id, 'LineString', geometry, geojson.properties));
            }
            return;
        } else {
            convertLines(coords, geometry, tolerance, false);
        }

    } else if (type === 'Polygon') {
        convertLines(coords, geometry, tolerance, true);

    } else if (type === 'MultiPolygon') {
        for (i = 0; i < coords.length; i++) {
            var polygon = [];
            convertLines(coords[i], polygon, tolerance, true);
            geometry.push(polygon);
        }
    } else if (type === 'GeometryCollection') {
        for (i = 0; i < geojson.geometry.geometries.length; i++) {
            convertFeature(features, {
                id: id,
                geometry: geojson.geometry.geometries[i],
                properties: geojson.properties
            }, options, index);
        }
        return;
    } else {
        throw new Error('Input data is not a valid GeoJSON object.');
    }

    features.push(createFeature(id, type, geometry, geojson.properties));
}

function convertPoint(coords, out) {
    out.push(projectX(coords[0]));
    out.push(projectY(coords[1]));
    out.push(0);
}

function convertLine(ring, out, tolerance, isPolygon) {
    var x0, y0;
    var size = 0;

    for (var j = 0; j < ring.length; j++) {
        var x = projectX(ring[j][0]);
        var y = projectY(ring[j][1]);

        out.push(x);
        out.push(y);
        out.push(0);

        if (j > 0) {
            if (isPolygon) {
                size += (x0 * y - x * y0) / 2; // area
            } else {
                size += Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2)); // length
            }
        }
        x0 = x;
        y0 = y;
    }

    var last = out.length - 3;
    out[2] = 1;
    simplify(out, 0, last, tolerance);
    out[last + 2] = 1;

    out.size = Math.abs(size);
    out.start = 0;
    out.end = out.size;
}

function convertLines(rings, out, tolerance, isPolygon) {
    for (var i = 0; i < rings.length; i++) {
        var geom = [];
        convertLine(rings[i], geom, tolerance, isPolygon);
        out.push(geom);
    }
}

function projectX(x) {
    return x / 360 + 0.5;
}

function projectY(y) {
    var sin = Math.sin(y * Math.PI / 180);
    var y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
    return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}

/* clip features between two axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 */

function clip(features, scale, k1, k2, axis, minAll, maxAll, options) {

    k1 /= scale;
    k2 /= scale;

    if (minAll >= k1 && maxAll < k2) return features; // trivial accept
    else if (maxAll < k1 || minAll >= k2) return null; // trivial reject

    var clipped = [];

    for (var i = 0; i < features.length; i++) {

        var feature = features[i];
        var geometry = feature.geometry;
        var type = feature.type;

        var min = axis === 0 ? feature.minX : feature.minY;
        var max = axis === 0 ? feature.maxX : feature.maxY;

        if (min >= k1 && max < k2) { // trivial accept
            clipped.push(feature);
            continue;
        } else if (max < k1 || min >= k2) { // trivial reject
            continue;
        }

        var newGeometry = [];

        if (type === 'Point' || type === 'MultiPoint') {
            clipPoints(geometry, newGeometry, k1, k2, axis);

        } else if (type === 'LineString') {
            clipLine(geometry, newGeometry, k1, k2, axis, false, options.lineMetrics);

        } else if (type === 'MultiLineString') {
            clipLines(geometry, newGeometry, k1, k2, axis, false);

        } else if (type === 'Polygon') {
            clipLines(geometry, newGeometry, k1, k2, axis, true);

        } else if (type === 'MultiPolygon') {
            for (var j = 0; j < geometry.length; j++) {
                var polygon = [];
                clipLines(geometry[j], polygon, k1, k2, axis, true);
                if (polygon.length) {
                    newGeometry.push(polygon);
                }
            }
        }

        if (newGeometry.length) {
            if (options.lineMetrics && type === 'LineString') {
                for (j = 0; j < newGeometry.length; j++) {
                    clipped.push(createFeature(feature.id, type, newGeometry[j], feature.tags));
                }
                continue;
            }

            if (type === 'LineString' || type === 'MultiLineString') {
                if (newGeometry.length === 1) {
                    type = 'LineString';
                    newGeometry = newGeometry[0];
                } else {
                    type = 'MultiLineString';
                }
            }
            if (type === 'Point' || type === 'MultiPoint') {
                type = newGeometry.length === 3 ? 'Point' : 'MultiPoint';
            }

            clipped.push(createFeature(feature.id, type, newGeometry, feature.tags));
        }
    }

    return clipped.length ? clipped : null;
}

function clipPoints(geom, newGeom, k1, k2, axis) {
    for (var i = 0; i < geom.length; i += 3) {
        var a = geom[i + axis];

        if (a >= k1 && a <= k2) {
            newGeom.push(geom[i]);
            newGeom.push(geom[i + 1]);
            newGeom.push(geom[i + 2]);
        }
    }
}

function clipLine(geom, newGeom, k1, k2, axis, isPolygon, trackMetrics) {

    var slice = newSlice(geom);
    var intersect = axis === 0 ? intersectX : intersectY;
    var len = geom.start;
    var segLen, t;

    for (var i = 0; i < geom.length - 3; i += 3) {
        var ax = geom[i];
        var ay = geom[i + 1];
        var az = geom[i + 2];
        var bx = geom[i + 3];
        var by = geom[i + 4];
        var a = axis === 0 ? ax : ay;
        var b = axis === 0 ? bx : by;
        var exited = false;

        if (trackMetrics) segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));

        if (a < k1) {
            // ---|-->  | (line enters the clip region from the left)
            if (b > k1) {
                t = intersect(slice, ax, ay, bx, by, k1);
                if (trackMetrics) slice.start = len + segLen * t;
            }
        } else if (a > k2) {
            // |  <--|--- (line enters the clip region from the right)
            if (b < k2) {
                t = intersect(slice, ax, ay, bx, by, k2);
                if (trackMetrics) slice.start = len + segLen * t;
            }
        } else {
            addPoint(slice, ax, ay, az);
        }
        if (b < k1 && a >= k1) {
            // <--|---  | or <--|-----|--- (line exits the clip region on the left)
            t = intersect(slice, ax, ay, bx, by, k1);
            exited = true;
        }
        if (b > k2 && a <= k2) {
            // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
            t = intersect(slice, ax, ay, bx, by, k2);
            exited = true;
        }

        if (!isPolygon && exited) {
            if (trackMetrics) slice.end = len + segLen * t;
            newGeom.push(slice);
            slice = newSlice(geom);
        }

        if (trackMetrics) len += segLen;
    }

    // add the last point
    var last = geom.length - 3;
    ax = geom[last];
    ay = geom[last + 1];
    az = geom[last + 2];
    a = axis === 0 ? ax : ay;
    if (a >= k1 && a <= k2) addPoint(slice, ax, ay, az);

    // close the polygon if its endpoints are not the same after clipping
    last = slice.length - 3;
    if (isPolygon && last >= 3 && (slice[last] !== slice[0] || slice[last + 1] !== slice[1])) {
        addPoint(slice, slice[0], slice[1], slice[2]);
    }

    // add the final slice
    if (slice.length) {
        newGeom.push(slice);
    }
}

function newSlice(line) {
    var slice = [];
    slice.size = line.size;
    slice.start = line.start;
    slice.end = line.end;
    return slice;
}

function clipLines(geom, newGeom, k1, k2, axis, isPolygon) {
    for (var i = 0; i < geom.length; i++) {
        clipLine(geom[i], newGeom, k1, k2, axis, isPolygon, false);
    }
}

function addPoint(out, x, y, z) {
    out.push(x);
    out.push(y);
    out.push(z);
}

function intersectX(out, ax, ay, bx, by, x) {
    var t = (x - ax) / (bx - ax);
    out.push(x);
    out.push(ay + (by - ay) * t);
    out.push(1);
    return t;
}

function intersectY(out, ax, ay, bx, by, y) {
    var t = (y - ay) / (by - ay);
    out.push(ax + (bx - ax) * t);
    out.push(y);
    out.push(1);
    return t;
}

function wrap(features, options) {
    var buffer = options.buffer / options.extent;
    var merged = features;
    var left  = clip(features, 1, -1 - buffer, buffer,     0, -1, 2, options); // left world copy
    var right = clip(features, 1,  1 - buffer, 2 + buffer, 0, -1, 2, options); // right world copy

    if (left || right) {
        merged = clip(features, 1, -buffer, 1 + buffer, 0, -1, 2, options) || []; // center world copy

        if (left) merged = shiftFeatureCoords(left, 1).concat(merged); // merge left into center
        if (right) merged = merged.concat(shiftFeatureCoords(right, -1)); // merge right into center
    }

    return merged;
}

function shiftFeatureCoords(features, offset) {
    var newFeatures = [];

    for (var i = 0; i < features.length; i++) {
        var feature = features[i],
            type = feature.type;

        var newGeometry;

        if (type === 'Point' || type === 'MultiPoint' || type === 'LineString') {
            newGeometry = shiftCoords(feature.geometry, offset);

        } else if (type === 'MultiLineString' || type === 'Polygon') {
            newGeometry = [];
            for (var j = 0; j < feature.geometry.length; j++) {
                newGeometry.push(shiftCoords(feature.geometry[j], offset));
            }
        } else if (type === 'MultiPolygon') {
            newGeometry = [];
            for (j = 0; j < feature.geometry.length; j++) {
                var newPolygon = [];
                for (var k = 0; k < feature.geometry[j].length; k++) {
                    newPolygon.push(shiftCoords(feature.geometry[j][k], offset));
                }
                newGeometry.push(newPolygon);
            }
        }

        newFeatures.push(createFeature(feature.id, type, newGeometry, feature.tags));
    }

    return newFeatures;
}

function shiftCoords(points, offset) {
    var newPoints = [];
    newPoints.size = points.size;

    if (points.start !== undefined) {
        newPoints.start = points.start;
        newPoints.end = points.end;
    }

    for (var i = 0; i < points.length; i += 3) {
        newPoints.push(points[i] + offset, points[i + 1], points[i + 2]);
    }
    return newPoints;
}

// Transforms the coordinates of each feature in the given tile from
// mercator-projected space into (extent x extent) tile space.
function transformTile(tile, extent) {
    if (tile.transformed) return tile;

    var z2 = 1 << tile.z,
        tx = tile.x,
        ty = tile.y,
        i, j, k;

    for (i = 0; i < tile.features.length; i++) {
        var feature = tile.features[i],
            geom = feature.geometry,
            type = feature.type;

        feature.geometry = [];

        if (type === 1) {
            for (j = 0; j < geom.length; j += 2) {
                feature.geometry.push(transformPoint(geom[j], geom[j + 1], extent, z2, tx, ty));
            }
        } else {
            for (j = 0; j < geom.length; j++) {
                var ring = [];
                for (k = 0; k < geom[j].length; k += 2) {
                    ring.push(transformPoint(geom[j][k], geom[j][k + 1], extent, z2, tx, ty));
                }
                feature.geometry.push(ring);
            }
        }
    }

    tile.transformed = true;

    return tile;
}

function transformPoint(x, y, extent, z2, tx, ty) {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))];
}

function createTile(features, z, tx, ty, options) {
    var tolerance = z === options.maxZoom ? 0 : options.tolerance / ((1 << z) * options.extent);
    var tile = {
        features: [],
        numPoints: 0,
        numSimplified: 0,
        numFeatures: 0,
        source: null,
        x: tx,
        y: ty,
        z: z,
        transformed: false,
        minX: 2,
        minY: 1,
        maxX: -1,
        maxY: 0
    };
    for (var i = 0; i < features.length; i++) {
        tile.numFeatures++;
        addFeature(tile, features[i], tolerance, options);

        var minX = features[i].minX;
        var minY = features[i].minY;
        var maxX = features[i].maxX;
        var maxY = features[i].maxY;

        if (minX < tile.minX) tile.minX = minX;
        if (minY < tile.minY) tile.minY = minY;
        if (maxX > tile.maxX) tile.maxX = maxX;
        if (maxY > tile.maxY) tile.maxY = maxY;
    }
    return tile;
}

function addFeature(tile, feature, tolerance, options) {

    var geom = feature.geometry,
        type = feature.type,
        simplified = [];

    if (type === 'Point' || type === 'MultiPoint') {
        for (var i = 0; i < geom.length; i += 3) {
            simplified.push(geom[i]);
            simplified.push(geom[i + 1]);
            tile.numPoints++;
            tile.numSimplified++;
        }

    } else if (type === 'LineString') {
        addLine(simplified, geom, tile, tolerance, false, false);

    } else if (type === 'MultiLineString' || type === 'Polygon') {
        for (i = 0; i < geom.length; i++) {
            addLine(simplified, geom[i], tile, tolerance, type === 'Polygon', i === 0);
        }

    } else if (type === 'MultiPolygon') {

        for (var k = 0; k < geom.length; k++) {
            var polygon = geom[k];
            for (i = 0; i < polygon.length; i++) {
                addLine(simplified, polygon[i], tile, tolerance, true, i === 0);
            }
        }
    }

    if (simplified.length) {
        var tags = feature.tags || null;
        if (type === 'LineString' && options.lineMetrics) {
            tags = {};
            for (var key in feature.tags) tags[key] = feature.tags[key];
            tags['mapbox_clip_start'] = geom.start / geom.size;
            tags['mapbox_clip_end'] = geom.end / geom.size;
        }
        var tileFeature = {
            geometry: simplified,
            type: type === 'Polygon' || type === 'MultiPolygon' ? 3 :
                type === 'LineString' || type === 'MultiLineString' ? 2 : 1,
            tags: tags
        };
        if (feature.id !== null) {
            tileFeature.id = feature.id;
        }
        tile.features.push(tileFeature);
    }
}

function addLine(result, geom, tile, tolerance, isPolygon, isOuter) {
    var sqTolerance = tolerance * tolerance;

    if (tolerance > 0 && (geom.size < (isPolygon ? sqTolerance : tolerance))) {
        tile.numPoints += geom.length / 3;
        return;
    }

    var ring = [];

    for (var i = 0; i < geom.length; i += 3) {
        if (tolerance === 0 || geom[i + 2] > sqTolerance) {
            tile.numSimplified++;
            ring.push(geom[i]);
            ring.push(geom[i + 1]);
        }
        tile.numPoints++;
    }

    if (isPolygon) rewind(ring, isOuter);

    result.push(ring);
}

function rewind(ring, clockwise) {
    var area = 0;
    for (var i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
        area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
    }
    if (area > 0 === clockwise) {
        for (i = 0, len = ring.length; i < len / 2; i += 2) {
            var x = ring[i];
            var y = ring[i + 1];
            ring[i] = ring[len - 2 - i];
            ring[i + 1] = ring[len - 1 - i];
            ring[len - 2 - i] = x;
            ring[len - 1 - i] = y;
        }
    }
}

function geojsonvt(data, options) {
    return new GeoJSONVT(data, options);
}

function GeoJSONVT(data, options) {
    options = this.options = extend(Object.create(this.options), options);

    var debug = options.debug;

    if (debug) console.time('preprocess data');

    if (options.maxZoom < 0 || options.maxZoom > 24) throw new Error('maxZoom should be in the 0-24 range');
    if (options.promoteId && options.generateId) throw new Error('promoteId and generateId cannot be used together.');

    var features = convert(data, options);

    this.tiles = {};
    this.tileCoords = [];

    if (debug) {
        console.timeEnd('preprocess data');
        console.log('index: maxZoom: %d, maxPoints: %d', options.indexMaxZoom, options.indexMaxPoints);
        console.time('generate tiles');
        this.stats = {};
        this.total = 0;
    }

    features = wrap(features, options);

    // start slicing from the top tile down
    if (features.length) this.splitTile(features, 0, 0, 0);

    if (debug) {
        if (features.length) console.log('features: %d, points: %d', this.tiles[0].numFeatures, this.tiles[0].numPoints);
        console.timeEnd('generate tiles');
        console.log('tiles generated:', this.total, JSON.stringify(this.stats));
    }
}

GeoJSONVT.prototype.options = {
    maxZoom: 14,            // max zoom to preserve detail on
    indexMaxZoom: 5,        // max zoom in the tile index
    indexMaxPoints: 100000, // max number of points per tile in the tile index
    tolerance: 3,           // simplification tolerance (higher means simpler)
    extent: 4096,           // tile extent
    buffer: 64,             // tile buffer on each side
    lineMetrics: false,     // whether to calculate line metrics
    promoteId: null,        // name of a feature property to be promoted to feature.id
    generateId: false,      // whether to generate feature ids. Cannot be used with promoteId
    debug: 0                // logging level (0, 1 or 2)
};

GeoJSONVT.prototype.splitTile = function (features, z, x, y, cz, cx, cy) {

    var stack = [features, z, x, y],
        options = this.options,
        debug = options.debug;

    // avoid recursion by using a processing queue
    while (stack.length) {
        y = stack.pop();
        x = stack.pop();
        z = stack.pop();
        features = stack.pop();

        var z2 = 1 << z,
            id = toID(z, x, y),
            tile = this.tiles[id];

        if (!tile) {
            if (debug > 1) console.time('creation');

            tile = this.tiles[id] = createTile(features, z, x, y, options);
            this.tileCoords.push({z: z, x: x, y: y});

            if (debug) {
                if (debug > 1) {
                    console.log('tile z%d-%d-%d (features: %d, points: %d, simplified: %d)',
                        z, x, y, tile.numFeatures, tile.numPoints, tile.numSimplified);
                    console.timeEnd('creation');
                }
                var key = 'z' + z;
                this.stats[key] = (this.stats[key] || 0) + 1;
                this.total++;
            }
        }

        // save reference to original geometry in tile so that we can drill down later if we stop now
        tile.source = features;

        // if it's the first-pass tiling
        if (!cz) {
            // stop tiling if we reached max zoom, or if the tile is too simple
            if (z === options.indexMaxZoom || tile.numPoints <= options.indexMaxPoints) continue;

        // if a drilldown to a specific tile
        } else {
            // stop tiling if we reached base zoom or our target tile zoom
            if (z === options.maxZoom || z === cz) continue;

            // stop tiling if it's not an ancestor of the target tile
            var m = 1 << (cz - z);
            if (x !== Math.floor(cx / m) || y !== Math.floor(cy / m)) continue;
        }

        // if we slice further down, no need to keep source geometry
        tile.source = null;

        if (features.length === 0) continue;

        if (debug > 1) console.time('clipping');

        // values we'll use for clipping
        var k1 = 0.5 * options.buffer / options.extent,
            k2 = 0.5 - k1,
            k3 = 0.5 + k1,
            k4 = 1 + k1,
            tl, bl, tr, br, left, right;

        tl = bl = tr = br = null;

        left  = clip(features, z2, x - k1, x + k3, 0, tile.minX, tile.maxX, options);
        right = clip(features, z2, x + k2, x + k4, 0, tile.minX, tile.maxX, options);
        features = null;

        if (left) {
            tl = clip(left, z2, y - k1, y + k3, 1, tile.minY, tile.maxY, options);
            bl = clip(left, z2, y + k2, y + k4, 1, tile.minY, tile.maxY, options);
            left = null;
        }

        if (right) {
            tr = clip(right, z2, y - k1, y + k3, 1, tile.minY, tile.maxY, options);
            br = clip(right, z2, y + k2, y + k4, 1, tile.minY, tile.maxY, options);
            right = null;
        }

        if (debug > 1) console.timeEnd('clipping');

        stack.push(tl || [], z + 1, x * 2,     y * 2);
        stack.push(bl || [], z + 1, x * 2,     y * 2 + 1);
        stack.push(tr || [], z + 1, x * 2 + 1, y * 2);
        stack.push(br || [], z + 1, x * 2 + 1, y * 2 + 1);
    }
};

GeoJSONVT.prototype.getTile = function (z, x, y) {
    var options = this.options,
        extent = options.extent,
        debug = options.debug;

    if (z < 0 || z > 24) return null;

    var z2 = 1 << z;
    x = ((x % z2) + z2) % z2; // wrap tile x coordinate

    var id = toID(z, x, y);
    if (this.tiles[id]) return transformTile(this.tiles[id], extent);

    if (debug > 1) console.log('drilling down to z%d-%d-%d', z, x, y);

    var z0 = z,
        x0 = x,
        y0 = y,
        parent;

    while (!parent && z0 > 0) {
        z0--;
        x0 = Math.floor(x0 / 2);
        y0 = Math.floor(y0 / 2);
        parent = this.tiles[toID(z0, x0, y0)];
    }

    if (!parent || !parent.source) return null;

    // if we found a parent tile containing the original geometry, we can drill down from it
    if (debug > 1) console.log('found parent tile z%d-%d-%d', z0, x0, y0);

    if (debug > 1) console.time('drilling down');
    this.splitTile(parent.source, z0, x0, y0, z, x, y);
    if (debug > 1) console.timeEnd('drilling down');

    return this.tiles[id] ? transformTile(this.tiles[id], extent) : null;
};

function toID(z, x, y) {
    return (((1 << z) * y + x) * 32) + z;
}

function extend(dest, src) {
    for (var i in src) dest[i] = src[i];
    return dest;
}

function loadGeoJSONTile(params, callback) {
    const canonical = params.tileID.canonical;
    if (!this._geoJSONIndex) {
        return callback(null, null); // we couldn't load the file
    }
    const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
    if (!geoJSONTile) {
        return callback(null, null); // nothing in the given tile
    }
    const geojsonWrapper = new GeoJSONWrapper$2(geoJSONTile.features);
    // Encode the geojson-vt tile into binary vector tile form.  This
    // is a convenience that allows `FeatureIndex` to operate the same way
    // across `VectorTileSource` and `GeoJSONSource` data.
    let pbf = vtpbf(geojsonWrapper);
    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
        pbf = new Uint8Array(pbf);
    }
    callback(null, {
        vectorTile: geojsonWrapper,
        rawData: pbf.buffer
    });
}
/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
 * @private
 */
class GeoJSONWorkerSource extends VectorTileWorkerSource {
    /**
     * @param [loadGeoJSON] Optional method for custom loading/parsing of
     * GeoJSON based on parameters passed from the main-thread Source.
     * See {@link GeoJSONWorkerSource#loadGeoJSON}.
     * @private
     */
    constructor(actor, layerIndex, availableImages, loadGeoJSON) {
        super(actor, layerIndex, availableImages, loadGeoJSONTile);
        if (loadGeoJSON) {
            this.loadGeoJSON = loadGeoJSON;
        }
    }
    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
     * expecting `callback(error, data)` to be called with either an error or a
     * parsed GeoJSON object.
     *
     * When `loadData` requests come in faster than they can be processed,
     * they are coalesced into a single request using the latest data.
     * See {@link GeoJSONWorkerSource#coalesce}
     *
     * @param params
     * @param callback
     * @private
     */
    loadData(params, callback) {
        if (this._pendingCallback) {
            // Tell the foreground the previous call has been abandoned
            this._pendingCallback(null, { abandoned: true });
        }
        this._pendingCallback = callback;
        this._pendingLoadDataParams = params;
        if (this._state &&
            this._state !== 'Idle') {
            this._state = 'NeedsLoadData';
        }
        else {
            this._state = 'Coalescing';
            this._loadData();
        }
    }
    /**
     * Internal implementation: called directly by `loadData`
     * or by `coalesce` using stored parameters.
     */
    _loadData() {
        if (!this._pendingCallback || !this._pendingLoadDataParams) {
            performance.assert(false);
            return;
        }
        const callback = this._pendingCallback;
        const params = this._pendingLoadDataParams;
        delete this._pendingCallback;
        delete this._pendingLoadDataParams;
        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new performance.RequestPerformance(params.request) : false;
        this.loadGeoJSON(params, (err, data) => {
            if (err || !data) {
                return callback(err);
            }
            else if (typeof data !== 'object') {
                return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
            }
            else {
                geojsonRewind(data, true);
                try {
                    if (params.filter) {
                        const compiled = performance.createExpression(params.filter, { type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false });
                        if (compiled.result === 'error')
                            throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
                        const features = data.features.filter(feature => compiled.value.evaluate({ zoom: 0 }, feature));
                        data = { type: 'FeatureCollection', features };
                    }
                    this._geoJSONIndex = params.cluster ?
                        new Supercluster(getSuperclusterOptions(params)).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                }
                catch (err) {
                    return callback(err);
                }
                this.loaded = {};
                const result = {};
                if (perf) {
                    const resourceTimingData = perf.finish();
                    // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                    // late evaluation in the main thread causes TypeError: illegal invocation
                    if (resourceTimingData) {
                        result.resourceTiming = {};
                        result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                    }
                }
                callback(null, result);
            }
        });
    }
    /**
     * While processing `loadData`, we coalesce all further
     * `loadData` messages into a single call to _loadData
     * that will happen once we've finished processing the
     * first message. {@link GeoJSONSource#_updateWorkerData}
     * is responsible for sending us the `coalesce` message
     * at the time it receives a response from `loadData`
     *
     *          State: Idle
     *          ↑          |
     *     'coalesce'   'loadData'
     *          |     (triggers load)
     *          |          ↓
     *        State: Coalescing
     *          ↑          |
     *   (triggers load)   |
     *     'coalesce'   'loadData'
     *          |          ↓
     *        State: NeedsLoadData
     */
    coalesce() {
        if (this._state === 'Coalescing') {
            this._state = 'Idle';
        }
        else if (this._state === 'NeedsLoadData') {
            this._state = 'Coalescing';
            this._loadData();
        }
    }
    /**
    * Implements {@link WorkerSource#reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params
    * @param params.uid The UID for this tile.
    * @private
    */
    reloadTile(params, callback) {
        const loaded = this.loaded, uid = params.uid;
        if (loaded && loaded[uid]) {
            return super.reloadTile(params, callback);
        }
        else {
            return this.loadTile(params, callback);
        }
    }
    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param params
     * @param [params.url] A URL to the remote GeoJSON data.
     * @param [params.data] Literal GeoJSON data. Must be provided if `params.url` is not.
     * @private
     */
    loadGeoJSON(params, callback) {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            performance.getJSON(params.request, callback);
        }
        else if (typeof params.data === 'string') {
            try {
                return callback(null, JSON.parse(params.data));
            }
            catch (e) {
                return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
            }
        }
        else {
            return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
        }
    }
    removeSource(params, callback) {
        if (this._pendingCallback) {
            // Don't leak callbacks
            this._pendingCallback(null, { abandoned: true });
        }
        callback();
    }
    getClusterExpansionZoom(params, callback) {
        try {
            callback(null, this._geoJSONIndex.getClusterExpansionZoom(params.clusterId));
        }
        catch (e) {
            callback(e);
        }
    }
    getClusterChildren(params, callback) {
        try {
            callback(null, this._geoJSONIndex.getChildren(params.clusterId));
        }
        catch (e) {
            callback(e);
        }
    }
    getClusterLeaves(params, callback) {
        try {
            callback(null, this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset));
        }
        catch (e) {
            callback(e);
        }
    }
}
function getSuperclusterOptions({ superclusterOptions, clusterProperties }) {
    if (!clusterProperties || !superclusterOptions)
        return superclusterOptions;
    const mapExpressions = {};
    const reduceExpressions = {};
    const globals = { accumulated: null, zoom: 0 };
    const feature = { properties: null };
    const propertyNames = Object.keys(clusterProperties);
    for (const key of propertyNames) {
        const [operator, mapExpression] = clusterProperties[key];
        const mapExpressionParsed = performance.createExpression(mapExpression);
        const reduceExpressionParsed = performance.createExpression(typeof operator === 'string' ? [operator, ['accumulated'], ['get', key]] : operator);
        performance.assert(mapExpressionParsed.result === 'success');
        performance.assert(reduceExpressionParsed.result === 'success');
        mapExpressions[key] = mapExpressionParsed.value;
        reduceExpressions[key] = reduceExpressionParsed.value;
    }
    superclusterOptions.map = (pointProperties) => {
        feature.properties = pointProperties;
        const properties = {};
        for (const key of propertyNames) {
            properties[key] = mapExpressions[key].evaluate(globals, feature);
        }
        return properties;
    };
    superclusterOptions.reduce = (accumulated, clusterProperties) => {
        feature.properties = clusterProperties;
        for (const key of propertyNames) {
            globals.accumulated = accumulated[key];
            accumulated[key] = reduceExpressions[key].evaluate(globals, feature);
        }
    };
    return superclusterOptions;
}

/**
 * @private
 */
class Worker {
    constructor(self) {
        this.self = self;
        this.actor = new performance.Actor(self, this);
        this.layerIndexes = {};
        this.availableImages = {};
        this.workerSourceTypes = {
            vector: VectorTileWorkerSource,
            geojson: GeoJSONWorkerSource
        };
        // [mapId][sourceType][sourceName] => worker source instance
        this.workerSources = {};
        this.demWorkerSources = {};
        this.self.registerWorkerSource = (name, WorkerSource) => {
            if (this.workerSourceTypes[name]) {
                throw new Error(`Worker source with name "${name}" already registered.`);
            }
            this.workerSourceTypes[name] = WorkerSource;
        };
        // This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
        this.self.registerRTLTextPlugin = (rtlTextPlugin) => {
            if (performance.plugin.isParsed()) {
                throw new Error('RTL text plugin already registered.');
            }
            performance.plugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            performance.plugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
            performance.plugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
        };
    }
    setReferrer(mapID, referrer) {
        this.referrer = referrer;
    }
    setImages(mapId, images, callback) {
        this.availableImages[mapId] = images;
        for (const workerSource in this.workerSources[mapId]) {
            const ws = this.workerSources[mapId][workerSource];
            for (const source in ws) {
                ws[source].availableImages = images;
            }
        }
        callback();
    }
    setLayers(mapId, layers, callback) {
        this.getLayerIndex(mapId).replace(layers);
        callback();
    }
    updateLayers(mapId, params, callback) {
        this.getLayerIndex(mapId).update(params.layers, params.removedIds);
        callback();
    }
    loadTile(mapId, params, callback) {
        performance.assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source).loadTile(params, callback);
    }
    loadDEMTile(mapId, params, callback) {
        this.getDEMWorkerSource(mapId, params.source).loadTile(params, callback);
    }
    reloadTile(mapId, params, callback) {
        performance.assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source).reloadTile(params, callback);
    }
    abortTile(mapId, params, callback) {
        performance.assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source).abortTile(params, callback);
    }
    removeTile(mapId, params, callback) {
        performance.assert(params.type);
        this.getWorkerSource(mapId, params.type, params.source).removeTile(params, callback);
    }
    removeDEMTile(mapId, params) {
        this.getDEMWorkerSource(mapId, params.source).removeTile(params);
    }
    removeSource(mapId, params, callback) {
        performance.assert(params.type);
        performance.assert(params.source);
        if (!this.workerSources[mapId] ||
            !this.workerSources[mapId][params.type] ||
            !this.workerSources[mapId][params.type][params.source]) {
            return;
        }
        const worker = this.workerSources[mapId][params.type][params.source];
        delete this.workerSources[mapId][params.type][params.source];
        if (worker.removeSource !== undefined) {
            worker.removeSource(params, callback);
        }
        else {
            callback();
        }
    }
    /**
     * Load a {@link WorkerSource} script at params.url.  The script is run
     * (using importScripts) with `registerWorkerSource` in scope, which is a
     * function taking `(name, workerSourceObject)`.
     *  @private
     */
    loadWorkerSource(map, params, callback) {
        try {
            this.self.importScripts(params.url);
            callback();
        }
        catch (e) {
            callback(e.toString());
        }
    }
    syncRTLPluginState(map, state, callback) {
        try {
            performance.plugin.setState(state);
            const pluginURL = performance.plugin.getPluginURL();
            if (performance.plugin.isLoaded() &&
                !performance.plugin.isParsed() &&
                pluginURL != null // Not possible when `isLoaded` is true, but keeps flow happy
            ) {
                this.self.importScripts(pluginURL);
                const complete = performance.plugin.isParsed();
                const error = complete ? undefined : new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`);
                callback(error, complete);
            }
        }
        catch (e) {
            callback(e.toString());
        }
    }
    getAvailableImages(mapId) {
        let availableImages = this.availableImages[mapId];
        if (!availableImages) {
            availableImages = [];
        }
        return availableImages;
    }
    getLayerIndex(mapId) {
        let layerIndexes = this.layerIndexes[mapId];
        if (!layerIndexes) {
            layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
        }
        return layerIndexes;
    }
    getWorkerSource(mapId, type, source) {
        if (!this.workerSources[mapId])
            this.workerSources[mapId] = {};
        if (!this.workerSources[mapId][type])
            this.workerSources[mapId][type] = {};
        if (!this.workerSources[mapId][type][source]) {
            // use a wrapped actor so that we can attach a target mapId param
            // to any messages invoked by the WorkerSource
            const actor = {
                send: (type, data, callback) => {
                    this.actor.send(type, data, callback, mapId);
                }
            };
            this.workerSources[mapId][type][source] = new this.workerSourceTypes[type](actor, this.getLayerIndex(mapId), this.getAvailableImages(mapId));
        }
        return this.workerSources[mapId][type][source];
    }
    getDEMWorkerSource(mapId, source) {
        if (!this.demWorkerSources[mapId])
            this.demWorkerSources[mapId] = {};
        if (!this.demWorkerSources[mapId][source]) {
            this.demWorkerSources[mapId][source] = new RasterDEMTileWorkerSource();
        }
        return this.demWorkerSources[mapId][source];
    }
    enforceCacheSizeLimit(mapId, limit) {
        performance.enforceCacheSizeLimit(limit);
    }
}
/* global self, WorkerGlobalScope */
if (typeof WorkerGlobalScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    self instanceof WorkerGlobalScope) {
    self.worker = new Worker(self);
}

return Worker;

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc3R5bGUtc3BlYy9ncm91cF9ieV9sYXlvdXQudHMiLCIuLi8uLi8uLi9zcmMvc3R5bGUvc3R5bGVfbGF5ZXJfaW5kZXgudHMiLCIuLi8uLi8uLi9zcmMvcmVuZGVyL2dseXBoX2F0bGFzLnRzIiwiLi4vLi4vLi4vc3JjL3NvdXJjZS93b3JrZXJfdGlsZS50cyIsIi4uLy4uLy4uL3NyYy9zb3VyY2UvdmVjdG9yX3RpbGVfd29ya2VyX3NvdXJjZS50cyIsIi4uLy4uLy4uL3NyYy9zb3VyY2UvcmFzdGVyX2RlbV90aWxlX3dvcmtlcl9zb3VyY2UudHMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQG1hcGJveC9nZW9qc29uLXJld2luZC9pbmRleC5qcyIsIi4uLy4uLy4uL3NyYy9zb3VyY2UvZ2VvanNvbl93cmFwcGVyLnRzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Z0LXBiZi9saWIvZ2VvanNvbl93cmFwcGVyLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Z0LXBiZi9pbmRleC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9rZGJ1c2gvc3JjL3NvcnQuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMva2RidXNoL3NyYy9yYW5nZS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9rZGJ1c2gvc3JjL3dpdGhpbi5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9rZGJ1c2gvc3JjL2luZGV4LmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3N1cGVyY2x1c3Rlci9pbmRleC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy9zaW1wbGlmeS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy9mZWF0dXJlLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2dlb2pzb24tdnQvc3JjL2NvbnZlcnQuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvZ2VvanNvbi12dC9zcmMvY2xpcC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy93cmFwLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2dlb2pzb24tdnQvc3JjL3RyYW5zZm9ybS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy90aWxlLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2dlb2pzb24tdnQvc3JjL2luZGV4LmpzIiwiLi4vLi4vLi4vc3JjL3NvdXJjZS9nZW9qc29uX3dvcmtlcl9zb3VyY2UudHMiLCIuLi8uLi8uLi9zcmMvc291cmNlL3dvcmtlci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLCJcbm1vZHVsZS5leHBvcnRzID0gcmV3aW5kO1xuXG5mdW5jdGlvbiByZXdpbmQoZ2osIG91dGVyKSB7XG4gICAgdmFyIHR5cGUgPSBnaiAmJiBnai50eXBlLCBpO1xuXG4gICAgaWYgKHR5cGUgPT09ICdGZWF0dXJlQ29sbGVjdGlvbicpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGdqLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSByZXdpbmQoZ2ouZmVhdHVyZXNbaV0sIG91dGVyKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0dlb21ldHJ5Q29sbGVjdGlvbicpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGdqLmdlb21ldHJpZXMubGVuZ3RoOyBpKyspIHJld2luZChnai5nZW9tZXRyaWVzW2ldLCBvdXRlcik7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdGZWF0dXJlJykge1xuICAgICAgICByZXdpbmQoZ2ouZ2VvbWV0cnksIG91dGVyKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1BvbHlnb24nKSB7XG4gICAgICAgIHJld2luZFJpbmdzKGdqLmNvb3JkaW5hdGVzLCBvdXRlcik7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBnai5jb29yZGluYXRlcy5sZW5ndGg7IGkrKykgcmV3aW5kUmluZ3MoZ2ouY29vcmRpbmF0ZXNbaV0sIG91dGVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZ2o7XG59XG5cbmZ1bmN0aW9uIHJld2luZFJpbmdzKHJpbmdzLCBvdXRlcikge1xuICAgIGlmIChyaW5ncy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIHJld2luZFJpbmcocmluZ3NbMF0sIG91dGVyKTtcbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IHJpbmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJld2luZFJpbmcocmluZ3NbaV0sICFvdXRlcik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZXdpbmRSaW5nKHJpbmcsIGRpcikge1xuICAgIHZhciBhcmVhID0gMCwgZXJyID0gMDtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmluZy5sZW5ndGgsIGogPSBsZW4gLSAxOyBpIDwgbGVuOyBqID0gaSsrKSB7XG4gICAgICAgIHZhciBrID0gKHJpbmdbaV1bMF0gLSByaW5nW2pdWzBdKSAqIChyaW5nW2pdWzFdICsgcmluZ1tpXVsxXSk7XG4gICAgICAgIHZhciBtID0gYXJlYSArIGs7XG4gICAgICAgIGVyciArPSBNYXRoLmFicyhhcmVhKSA+PSBNYXRoLmFicyhrKSA/IGFyZWEgLSBtICsgayA6IGsgLSBtICsgYXJlYTtcbiAgICAgICAgYXJlYSA9IG07XG4gICAgfVxuICAgIGlmIChhcmVhICsgZXJyID49IDAgIT09ICEhZGlyKSByaW5nLnJldmVyc2UoKTtcbn1cbiIsbnVsbCwiJ3VzZSBzdHJpY3QnXG5cbnZhciBQb2ludCA9IHJlcXVpcmUoJ0BtYXBib3gvcG9pbnQtZ2VvbWV0cnknKVxudmFyIFZlY3RvclRpbGVGZWF0dXJlID0gcmVxdWlyZSgnQG1hcGJveC92ZWN0b3ItdGlsZScpLlZlY3RvclRpbGVGZWF0dXJlXG5cbm1vZHVsZS5leHBvcnRzID0gR2VvSlNPTldyYXBwZXJcblxuLy8gY29uZm9ybSB0byB2ZWN0b3J0aWxlIGFwaVxuZnVuY3Rpb24gR2VvSlNPTldyYXBwZXIgKGZlYXR1cmVzLCBvcHRpb25zKSB7XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgdGhpcy5mZWF0dXJlcyA9IGZlYXR1cmVzXG4gIHRoaXMubGVuZ3RoID0gZmVhdHVyZXMubGVuZ3RoXG59XG5cbkdlb0pTT05XcmFwcGVyLnByb3RvdHlwZS5mZWF0dXJlID0gZnVuY3Rpb24gKGkpIHtcbiAgcmV0dXJuIG5ldyBGZWF0dXJlV3JhcHBlcih0aGlzLmZlYXR1cmVzW2ldLCB0aGlzLm9wdGlvbnMuZXh0ZW50KVxufVxuXG5mdW5jdGlvbiBGZWF0dXJlV3JhcHBlciAoZmVhdHVyZSwgZXh0ZW50KSB7XG4gIHRoaXMuaWQgPSB0eXBlb2YgZmVhdHVyZS5pZCA9PT0gJ251bWJlcicgPyBmZWF0dXJlLmlkIDogdW5kZWZpbmVkXG4gIHRoaXMudHlwZSA9IGZlYXR1cmUudHlwZVxuICB0aGlzLnJhd0dlb21ldHJ5ID0gZmVhdHVyZS50eXBlID09PSAxID8gW2ZlYXR1cmUuZ2VvbWV0cnldIDogZmVhdHVyZS5nZW9tZXRyeVxuICB0aGlzLnByb3BlcnRpZXMgPSBmZWF0dXJlLnRhZ3NcbiAgdGhpcy5leHRlbnQgPSBleHRlbnQgfHwgNDA5NlxufVxuXG5GZWF0dXJlV3JhcHBlci5wcm90b3R5cGUubG9hZEdlb21ldHJ5ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmluZ3MgPSB0aGlzLnJhd0dlb21ldHJ5XG4gIHRoaXMuZ2VvbWV0cnkgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmluZyA9IHJpbmdzW2ldXG4gICAgdmFyIG5ld1JpbmcgPSBbXVxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgcmluZy5sZW5ndGg7IGorKykge1xuICAgICAgbmV3UmluZy5wdXNoKG5ldyBQb2ludChyaW5nW2pdWzBdLCByaW5nW2pdWzFdKSlcbiAgICB9XG4gICAgdGhpcy5nZW9tZXRyeS5wdXNoKG5ld1JpbmcpXG4gIH1cbiAgcmV0dXJuIHRoaXMuZ2VvbWV0cnlcbn1cblxuRmVhdHVyZVdyYXBwZXIucHJvdG90eXBlLmJib3ggPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5nZW9tZXRyeSkgdGhpcy5sb2FkR2VvbWV0cnkoKVxuXG4gIHZhciByaW5ncyA9IHRoaXMuZ2VvbWV0cnlcbiAgdmFyIHgxID0gSW5maW5pdHlcbiAgdmFyIHgyID0gLUluZmluaXR5XG4gIHZhciB5MSA9IEluZmluaXR5XG4gIHZhciB5MiA9IC1JbmZpbml0eVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmluZyA9IHJpbmdzW2ldXG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHJpbmcubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBjb29yZCA9IHJpbmdbal1cblxuICAgICAgeDEgPSBNYXRoLm1pbih4MSwgY29vcmQueClcbiAgICAgIHgyID0gTWF0aC5tYXgoeDIsIGNvb3JkLngpXG4gICAgICB5MSA9IE1hdGgubWluKHkxLCBjb29yZC55KVxuICAgICAgeTIgPSBNYXRoLm1heCh5MiwgY29vcmQueSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gW3gxLCB5MSwgeDIsIHkyXVxufVxuXG5GZWF0dXJlV3JhcHBlci5wcm90b3R5cGUudG9HZW9KU09OID0gVmVjdG9yVGlsZUZlYXR1cmUucHJvdG90eXBlLnRvR2VvSlNPTlxuIiwidmFyIFBiZiA9IHJlcXVpcmUoJ3BiZicpXG52YXIgR2VvSlNPTldyYXBwZXIgPSByZXF1aXJlKCcuL2xpYi9nZW9qc29uX3dyYXBwZXInKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZyb21WZWN0b3JUaWxlSnNcbm1vZHVsZS5leHBvcnRzLmZyb21WZWN0b3JUaWxlSnMgPSBmcm9tVmVjdG9yVGlsZUpzXG5tb2R1bGUuZXhwb3J0cy5mcm9tR2VvanNvblZ0ID0gZnJvbUdlb2pzb25WdFxubW9kdWxlLmV4cG9ydHMuR2VvSlNPTldyYXBwZXIgPSBHZW9KU09OV3JhcHBlclxuXG4vKipcbiAqIFNlcmlhbGl6ZSBhIHZlY3Rvci10aWxlLWpzLWNyZWF0ZWQgdGlsZSB0byBwYmZcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdGlsZVxuICogQHJldHVybiB7QnVmZmVyfSB1bmNvbXByZXNzZWQsIHBiZi1zZXJpYWxpemVkIHRpbGUgZGF0YVxuICovXG5mdW5jdGlvbiBmcm9tVmVjdG9yVGlsZUpzICh0aWxlKSB7XG4gIHZhciBvdXQgPSBuZXcgUGJmKClcbiAgd3JpdGVUaWxlKHRpbGUsIG91dClcbiAgcmV0dXJuIG91dC5maW5pc2goKVxufVxuXG4vKipcbiAqIFNlcmlhbGl6ZWQgYSBnZW9qc29uLXZ0LWNyZWF0ZWQgdGlsZSB0byBwYmYuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGxheWVycyAtIEFuIG9iamVjdCBtYXBwaW5nIGxheWVyIG5hbWVzIHRvIGdlb2pzb24tdnQtY3JlYXRlZCB2ZWN0b3IgdGlsZSBvYmplY3RzXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIC0gQW4gb2JqZWN0IHNwZWNpZnlpbmcgdGhlIHZlY3Rvci10aWxlIHNwZWNpZmljYXRpb24gdmVyc2lvbiBhbmQgZXh0ZW50IHRoYXQgd2VyZSB1c2VkIHRvIGNyZWF0ZSBgbGF5ZXJzYC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy52ZXJzaW9uPTFdIC0gVmVyc2lvbiBvZiB2ZWN0b3ItdGlsZSBzcGVjIHVzZWRcbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy5leHRlbnQ9NDA5Nl0gLSBFeHRlbnQgb2YgdGhlIHZlY3RvciB0aWxlXG4gKiBAcmV0dXJuIHtCdWZmZXJ9IHVuY29tcHJlc3NlZCwgcGJmLXNlcmlhbGl6ZWQgdGlsZSBkYXRhXG4gKi9cbmZ1bmN0aW9uIGZyb21HZW9qc29uVnQgKGxheWVycywgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICB2YXIgbCA9IHt9XG4gIGZvciAodmFyIGsgaW4gbGF5ZXJzKSB7XG4gICAgbFtrXSA9IG5ldyBHZW9KU09OV3JhcHBlcihsYXllcnNba10uZmVhdHVyZXMsIG9wdGlvbnMpXG4gICAgbFtrXS5uYW1lID0ga1xuICAgIGxba10udmVyc2lvbiA9IG9wdGlvbnMudmVyc2lvblxuICAgIGxba10uZXh0ZW50ID0gb3B0aW9ucy5leHRlbnRcbiAgfVxuICByZXR1cm4gZnJvbVZlY3RvclRpbGVKcyh7IGxheWVyczogbCB9KVxufVxuXG5mdW5jdGlvbiB3cml0ZVRpbGUgKHRpbGUsIHBiZikge1xuICBmb3IgKHZhciBrZXkgaW4gdGlsZS5sYXllcnMpIHtcbiAgICBwYmYud3JpdGVNZXNzYWdlKDMsIHdyaXRlTGF5ZXIsIHRpbGUubGF5ZXJzW2tleV0pXG4gIH1cbn1cblxuZnVuY3Rpb24gd3JpdGVMYXllciAobGF5ZXIsIHBiZikge1xuICBwYmYud3JpdGVWYXJpbnRGaWVsZCgxNSwgbGF5ZXIudmVyc2lvbiB8fCAxKVxuICBwYmYud3JpdGVTdHJpbmdGaWVsZCgxLCBsYXllci5uYW1lIHx8ICcnKVxuICBwYmYud3JpdGVWYXJpbnRGaWVsZCg1LCBsYXllci5leHRlbnQgfHwgNDA5NilcblxuICB2YXIgaVxuICB2YXIgY29udGV4dCA9IHtcbiAgICBrZXlzOiBbXSxcbiAgICB2YWx1ZXM6IFtdLFxuICAgIGtleWNhY2hlOiB7fSxcbiAgICB2YWx1ZWNhY2hlOiB7fVxuICB9XG5cbiAgZm9yIChpID0gMDsgaSA8IGxheWVyLmxlbmd0aDsgaSsrKSB7XG4gICAgY29udGV4dC5mZWF0dXJlID0gbGF5ZXIuZmVhdHVyZShpKVxuICAgIHBiZi53cml0ZU1lc3NhZ2UoMiwgd3JpdGVGZWF0dXJlLCBjb250ZXh0KVxuICB9XG5cbiAgdmFyIGtleXMgPSBjb250ZXh0LmtleXNcbiAgZm9yIChpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICBwYmYud3JpdGVTdHJpbmdGaWVsZCgzLCBrZXlzW2ldKVxuICB9XG5cbiAgdmFyIHZhbHVlcyA9IGNvbnRleHQudmFsdWVzXG4gIGZvciAoaSA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICBwYmYud3JpdGVNZXNzYWdlKDQsIHdyaXRlVmFsdWUsIHZhbHVlc1tpXSlcbiAgfVxufVxuXG5mdW5jdGlvbiB3cml0ZUZlYXR1cmUgKGNvbnRleHQsIHBiZikge1xuICB2YXIgZmVhdHVyZSA9IGNvbnRleHQuZmVhdHVyZVxuXG4gIGlmIChmZWF0dXJlLmlkICE9PSB1bmRlZmluZWQpIHtcbiAgICBwYmYud3JpdGVWYXJpbnRGaWVsZCgxLCBmZWF0dXJlLmlkKVxuICB9XG5cbiAgcGJmLndyaXRlTWVzc2FnZSgyLCB3cml0ZVByb3BlcnRpZXMsIGNvbnRleHQpXG4gIHBiZi53cml0ZVZhcmludEZpZWxkKDMsIGZlYXR1cmUudHlwZSlcbiAgcGJmLndyaXRlTWVzc2FnZSg0LCB3cml0ZUdlb21ldHJ5LCBmZWF0dXJlKVxufVxuXG5mdW5jdGlvbiB3cml0ZVByb3BlcnRpZXMgKGNvbnRleHQsIHBiZikge1xuICB2YXIgZmVhdHVyZSA9IGNvbnRleHQuZmVhdHVyZVxuICB2YXIga2V5cyA9IGNvbnRleHQua2V5c1xuICB2YXIgdmFsdWVzID0gY29udGV4dC52YWx1ZXNcbiAgdmFyIGtleWNhY2hlID0gY29udGV4dC5rZXljYWNoZVxuICB2YXIgdmFsdWVjYWNoZSA9IGNvbnRleHQudmFsdWVjYWNoZVxuXG4gIGZvciAodmFyIGtleSBpbiBmZWF0dXJlLnByb3BlcnRpZXMpIHtcbiAgICB2YXIgdmFsdWUgPSBmZWF0dXJlLnByb3BlcnRpZXNba2V5XVxuXG4gICAgdmFyIGtleUluZGV4ID0ga2V5Y2FjaGVba2V5XVxuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkgY29udGludWUgLy8gZG9uJ3QgZW5jb2RlIG51bGwgdmFsdWUgcHJvcGVydGllc1xuXG4gICAgaWYgKHR5cGVvZiBrZXlJbmRleCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGtleXMucHVzaChrZXkpXG4gICAgICBrZXlJbmRleCA9IGtleXMubGVuZ3RoIC0gMVxuICAgICAga2V5Y2FjaGVba2V5XSA9IGtleUluZGV4XG4gICAgfVxuICAgIHBiZi53cml0ZVZhcmludChrZXlJbmRleClcblxuICAgIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlXG4gICAgaWYgKHR5cGUgIT09ICdzdHJpbmcnICYmIHR5cGUgIT09ICdib29sZWFuJyAmJiB0eXBlICE9PSAnbnVtYmVyJykge1xuICAgICAgdmFsdWUgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSlcbiAgICB9XG4gICAgdmFyIHZhbHVlS2V5ID0gdHlwZSArICc6JyArIHZhbHVlXG4gICAgdmFyIHZhbHVlSW5kZXggPSB2YWx1ZWNhY2hlW3ZhbHVlS2V5XVxuICAgIGlmICh0eXBlb2YgdmFsdWVJbmRleCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHZhbHVlcy5wdXNoKHZhbHVlKVxuICAgICAgdmFsdWVJbmRleCA9IHZhbHVlcy5sZW5ndGggLSAxXG4gICAgICB2YWx1ZWNhY2hlW3ZhbHVlS2V5XSA9IHZhbHVlSW5kZXhcbiAgICB9XG4gICAgcGJmLndyaXRlVmFyaW50KHZhbHVlSW5kZXgpXG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWFuZCAoY21kLCBsZW5ndGgpIHtcbiAgcmV0dXJuIChsZW5ndGggPDwgMykgKyAoY21kICYgMHg3KVxufVxuXG5mdW5jdGlvbiB6aWd6YWcgKG51bSkge1xuICByZXR1cm4gKG51bSA8PCAxKSBeIChudW0gPj4gMzEpXG59XG5cbmZ1bmN0aW9uIHdyaXRlR2VvbWV0cnkgKGZlYXR1cmUsIHBiZikge1xuICB2YXIgZ2VvbWV0cnkgPSBmZWF0dXJlLmxvYWRHZW9tZXRyeSgpXG4gIHZhciB0eXBlID0gZmVhdHVyZS50eXBlXG4gIHZhciB4ID0gMFxuICB2YXIgeSA9IDBcbiAgdmFyIHJpbmdzID0gZ2VvbWV0cnkubGVuZ3RoXG4gIGZvciAodmFyIHIgPSAwOyByIDwgcmluZ3M7IHIrKykge1xuICAgIHZhciByaW5nID0gZ2VvbWV0cnlbcl1cbiAgICB2YXIgY291bnQgPSAxXG4gICAgaWYgKHR5cGUgPT09IDEpIHtcbiAgICAgIGNvdW50ID0gcmluZy5sZW5ndGhcbiAgICB9XG4gICAgcGJmLndyaXRlVmFyaW50KGNvbW1hbmQoMSwgY291bnQpKSAvLyBtb3ZldG9cbiAgICAvLyBkbyBub3Qgd3JpdGUgcG9seWdvbiBjbG9zaW5nIHBhdGggYXMgbGluZXRvXG4gICAgdmFyIGxpbmVDb3VudCA9IHR5cGUgPT09IDMgPyByaW5nLmxlbmd0aCAtIDEgOiByaW5nLmxlbmd0aFxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZUNvdW50OyBpKyspIHtcbiAgICAgIGlmIChpID09PSAxICYmIHR5cGUgIT09IDEpIHtcbiAgICAgICAgcGJmLndyaXRlVmFyaW50KGNvbW1hbmQoMiwgbGluZUNvdW50IC0gMSkpIC8vIGxpbmV0b1xuICAgICAgfVxuICAgICAgdmFyIGR4ID0gcmluZ1tpXS54IC0geFxuICAgICAgdmFyIGR5ID0gcmluZ1tpXS55IC0geVxuICAgICAgcGJmLndyaXRlVmFyaW50KHppZ3phZyhkeCkpXG4gICAgICBwYmYud3JpdGVWYXJpbnQoemlnemFnKGR5KSlcbiAgICAgIHggKz0gZHhcbiAgICAgIHkgKz0gZHlcbiAgICB9XG4gICAgaWYgKHR5cGUgPT09IDMpIHtcbiAgICAgIHBiZi53cml0ZVZhcmludChjb21tYW5kKDcsIDEpKSAvLyBjbG9zZXBhdGhcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JpdGVWYWx1ZSAodmFsdWUsIHBiZikge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZVxuICBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBwYmYud3JpdGVTdHJpbmdGaWVsZCgxLCB2YWx1ZSlcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICBwYmYud3JpdGVCb29sZWFuRmllbGQoNywgdmFsdWUpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodmFsdWUgJSAxICE9PSAwKSB7XG4gICAgICBwYmYud3JpdGVEb3VibGVGaWVsZCgzLCB2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKHZhbHVlIDwgMCkge1xuICAgICAgcGJmLndyaXRlU1ZhcmludEZpZWxkKDYsIHZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBwYmYud3JpdGVWYXJpbnRGaWVsZCg1LCB2YWx1ZSlcbiAgICB9XG4gIH1cbn1cbiIsIlxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEtEKGlkcywgY29vcmRzLCBub2RlU2l6ZSwgbGVmdCwgcmlnaHQsIGRlcHRoKSB7XG4gICAgaWYgKHJpZ2h0IC0gbGVmdCA8PSBub2RlU2l6ZSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbSA9IChsZWZ0ICsgcmlnaHQpID4+IDE7XG5cbiAgICBzZWxlY3QoaWRzLCBjb29yZHMsIG0sIGxlZnQsIHJpZ2h0LCBkZXB0aCAlIDIpO1xuXG4gICAgc29ydEtEKGlkcywgY29vcmRzLCBub2RlU2l6ZSwgbGVmdCwgbSAtIDEsIGRlcHRoICsgMSk7XG4gICAgc29ydEtEKGlkcywgY29vcmRzLCBub2RlU2l6ZSwgbSArIDEsIHJpZ2h0LCBkZXB0aCArIDEpO1xufVxuXG5mdW5jdGlvbiBzZWxlY3QoaWRzLCBjb29yZHMsIGssIGxlZnQsIHJpZ2h0LCBpbmMpIHtcblxuICAgIHdoaWxlIChyaWdodCA+IGxlZnQpIHtcbiAgICAgICAgaWYgKHJpZ2h0IC0gbGVmdCA+IDYwMCkge1xuICAgICAgICAgICAgY29uc3QgbiA9IHJpZ2h0IC0gbGVmdCArIDE7XG4gICAgICAgICAgICBjb25zdCBtID0gayAtIGxlZnQgKyAxO1xuICAgICAgICAgICAgY29uc3QgeiA9IE1hdGgubG9nKG4pO1xuICAgICAgICAgICAgY29uc3QgcyA9IDAuNSAqIE1hdGguZXhwKDIgKiB6IC8gMyk7XG4gICAgICAgICAgICBjb25zdCBzZCA9IDAuNSAqIE1hdGguc3FydCh6ICogcyAqIChuIC0gcykgLyBuKSAqIChtIC0gbiAvIDIgPCAwID8gLTEgOiAxKTtcbiAgICAgICAgICAgIGNvbnN0IG5ld0xlZnQgPSBNYXRoLm1heChsZWZ0LCBNYXRoLmZsb29yKGsgLSBtICogcyAvIG4gKyBzZCkpO1xuICAgICAgICAgICAgY29uc3QgbmV3UmlnaHQgPSBNYXRoLm1pbihyaWdodCwgTWF0aC5mbG9vcihrICsgKG4gLSBtKSAqIHMgLyBuICsgc2QpKTtcbiAgICAgICAgICAgIHNlbGVjdChpZHMsIGNvb3JkcywgaywgbmV3TGVmdCwgbmV3UmlnaHQsIGluYyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ID0gY29vcmRzWzIgKiBrICsgaW5jXTtcbiAgICAgICAgbGV0IGkgPSBsZWZ0O1xuICAgICAgICBsZXQgaiA9IHJpZ2h0O1xuXG4gICAgICAgIHN3YXBJdGVtKGlkcywgY29vcmRzLCBsZWZ0LCBrKTtcbiAgICAgICAgaWYgKGNvb3Jkc1syICogcmlnaHQgKyBpbmNdID4gdCkgc3dhcEl0ZW0oaWRzLCBjb29yZHMsIGxlZnQsIHJpZ2h0KTtcblxuICAgICAgICB3aGlsZSAoaSA8IGopIHtcbiAgICAgICAgICAgIHN3YXBJdGVtKGlkcywgY29vcmRzLCBpLCBqKTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGotLTtcbiAgICAgICAgICAgIHdoaWxlIChjb29yZHNbMiAqIGkgKyBpbmNdIDwgdCkgaSsrO1xuICAgICAgICAgICAgd2hpbGUgKGNvb3Jkc1syICogaiArIGluY10gPiB0KSBqLS07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29vcmRzWzIgKiBsZWZ0ICsgaW5jXSA9PT0gdCkgc3dhcEl0ZW0oaWRzLCBjb29yZHMsIGxlZnQsIGopO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIHN3YXBJdGVtKGlkcywgY29vcmRzLCBqLCByaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaiA8PSBrKSBsZWZ0ID0gaiArIDE7XG4gICAgICAgIGlmIChrIDw9IGopIHJpZ2h0ID0gaiAtIDE7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzd2FwSXRlbShpZHMsIGNvb3JkcywgaSwgaikge1xuICAgIHN3YXAoaWRzLCBpLCBqKTtcbiAgICBzd2FwKGNvb3JkcywgMiAqIGksIDIgKiBqKTtcbiAgICBzd2FwKGNvb3JkcywgMiAqIGkgKyAxLCAyICogaiArIDEpO1xufVxuXG5mdW5jdGlvbiBzd2FwKGFyciwgaSwgaikge1xuICAgIGNvbnN0IHRtcCA9IGFycltpXTtcbiAgICBhcnJbaV0gPSBhcnJbal07XG4gICAgYXJyW2pdID0gdG1wO1xufVxuIiwiXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5nZShpZHMsIGNvb3JkcywgbWluWCwgbWluWSwgbWF4WCwgbWF4WSwgbm9kZVNpemUpIHtcbiAgICBjb25zdCBzdGFjayA9IFswLCBpZHMubGVuZ3RoIC0gMSwgMF07XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgbGV0IHgsIHk7XG5cbiAgICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgY29uc3QgbGVmdCA9IHN0YWNrLnBvcCgpO1xuXG4gICAgICAgIGlmIChyaWdodCAtIGxlZnQgPD0gbm9kZVNpemUpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBsZWZ0OyBpIDw9IHJpZ2h0OyBpKyspIHtcbiAgICAgICAgICAgICAgICB4ID0gY29vcmRzWzIgKiBpXTtcbiAgICAgICAgICAgICAgICB5ID0gY29vcmRzWzIgKiBpICsgMV07XG4gICAgICAgICAgICAgICAgaWYgKHggPj0gbWluWCAmJiB4IDw9IG1heFggJiYgeSA+PSBtaW5ZICYmIHkgPD0gbWF4WSkgcmVzdWx0LnB1c2goaWRzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbSA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblxuICAgICAgICB4ID0gY29vcmRzWzIgKiBtXTtcbiAgICAgICAgeSA9IGNvb3Jkc1syICogbSArIDFdO1xuXG4gICAgICAgIGlmICh4ID49IG1pblggJiYgeCA8PSBtYXhYICYmIHkgPj0gbWluWSAmJiB5IDw9IG1heFkpIHJlc3VsdC5wdXNoKGlkc1ttXSk7XG5cbiAgICAgICAgY29uc3QgbmV4dEF4aXMgPSAoYXhpcyArIDEpICUgMjtcblxuICAgICAgICBpZiAoYXhpcyA9PT0gMCA/IG1pblggPD0geCA6IG1pblkgPD0geSkge1xuICAgICAgICAgICAgc3RhY2sucHVzaChsZWZ0KTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobSAtIDEpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXh0QXhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGF4aXMgPT09IDAgPyBtYXhYID49IHggOiBtYXhZID49IHkpIHtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobSArIDEpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChyaWdodCk7XG4gICAgICAgICAgICBzdGFjay5wdXNoKG5leHRBeGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG4iLCJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHdpdGhpbihpZHMsIGNvb3JkcywgcXgsIHF5LCByLCBub2RlU2l6ZSkge1xuICAgIGNvbnN0IHN0YWNrID0gWzAsIGlkcy5sZW5ndGggLSAxLCAwXTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCByMiA9IHIgKiByO1xuXG4gICAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBheGlzID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBzdGFjay5wb3AoKTtcblxuICAgICAgICBpZiAocmlnaHQgLSBsZWZ0IDw9IG5vZGVTaXplKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gbGVmdDsgaSA8PSByaWdodDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNxRGlzdChjb29yZHNbMiAqIGldLCBjb29yZHNbMiAqIGkgKyAxXSwgcXgsIHF5KSA8PSByMikgcmVzdWx0LnB1c2goaWRzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbSA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblxuICAgICAgICBjb25zdCB4ID0gY29vcmRzWzIgKiBtXTtcbiAgICAgICAgY29uc3QgeSA9IGNvb3Jkc1syICogbSArIDFdO1xuXG4gICAgICAgIGlmIChzcURpc3QoeCwgeSwgcXgsIHF5KSA8PSByMikgcmVzdWx0LnB1c2goaWRzW21dKTtcblxuICAgICAgICBjb25zdCBuZXh0QXhpcyA9IChheGlzICsgMSkgJSAyO1xuXG4gICAgICAgIGlmIChheGlzID09PSAwID8gcXggLSByIDw9IHggOiBxeSAtIHIgPD0geSkge1xuICAgICAgICAgICAgc3RhY2sucHVzaChsZWZ0KTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobSAtIDEpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXh0QXhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGF4aXMgPT09IDAgPyBxeCArIHIgPj0geCA6IHF5ICsgciA+PSB5KSB7XG4gICAgICAgICAgICBzdGFjay5wdXNoKG0gKyAxKTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gocmlnaHQpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXh0QXhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzcURpc3QoYXgsIGF5LCBieCwgYnkpIHtcbiAgICBjb25zdCBkeCA9IGF4IC0gYng7XG4gICAgY29uc3QgZHkgPSBheSAtIGJ5O1xuICAgIHJldHVybiBkeCAqIGR4ICsgZHkgKiBkeTtcbn1cbiIsIlxuaW1wb3J0IHNvcnQgZnJvbSAnLi9zb3J0JztcbmltcG9ydCByYW5nZSBmcm9tICcuL3JhbmdlJztcbmltcG9ydCB3aXRoaW4gZnJvbSAnLi93aXRoaW4nO1xuXG5jb25zdCBkZWZhdWx0R2V0WCA9IHAgPT4gcFswXTtcbmNvbnN0IGRlZmF1bHRHZXRZID0gcCA9PiBwWzFdO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBLREJ1c2gge1xuICAgIGNvbnN0cnVjdG9yKHBvaW50cywgZ2V0WCA9IGRlZmF1bHRHZXRYLCBnZXRZID0gZGVmYXVsdEdldFksIG5vZGVTaXplID0gNjQsIEFycmF5VHlwZSA9IEZsb2F0NjRBcnJheSkge1xuICAgICAgICB0aGlzLm5vZGVTaXplID0gbm9kZVNpemU7XG4gICAgICAgIHRoaXMucG9pbnRzID0gcG9pbnRzO1xuXG4gICAgICAgIGNvbnN0IEluZGV4QXJyYXlUeXBlID0gcG9pbnRzLmxlbmd0aCA8IDY1NTM2ID8gVWludDE2QXJyYXkgOiBVaW50MzJBcnJheTtcblxuICAgICAgICBjb25zdCBpZHMgPSB0aGlzLmlkcyA9IG5ldyBJbmRleEFycmF5VHlwZShwb2ludHMubGVuZ3RoKTtcbiAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5jb29yZHMgPSBuZXcgQXJyYXlUeXBlKHBvaW50cy5sZW5ndGggKiAyKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWRzW2ldID0gaTtcbiAgICAgICAgICAgIGNvb3Jkc1syICogaV0gPSBnZXRYKHBvaW50c1tpXSk7XG4gICAgICAgICAgICBjb29yZHNbMiAqIGkgKyAxXSA9IGdldFkocG9pbnRzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNvcnQoaWRzLCBjb29yZHMsIG5vZGVTaXplLCAwLCBpZHMubGVuZ3RoIC0gMSwgMCk7XG4gICAgfVxuXG4gICAgcmFuZ2UobWluWCwgbWluWSwgbWF4WCwgbWF4WSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UodGhpcy5pZHMsIHRoaXMuY29vcmRzLCBtaW5YLCBtaW5ZLCBtYXhYLCBtYXhZLCB0aGlzLm5vZGVTaXplKTtcbiAgICB9XG5cbiAgICB3aXRoaW4oeCwgeSwgcikge1xuICAgICAgICByZXR1cm4gd2l0aGluKHRoaXMuaWRzLCB0aGlzLmNvb3JkcywgeCwgeSwgciwgdGhpcy5ub2RlU2l6ZSk7XG4gICAgfVxufVxuIiwiXG5pbXBvcnQgS0RCdXNoIGZyb20gJ2tkYnVzaCc7XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICAgIG1pblpvb206IDAsICAgLy8gbWluIHpvb20gdG8gZ2VuZXJhdGUgY2x1c3RlcnMgb25cbiAgICBtYXhab29tOiAxNiwgIC8vIG1heCB6b29tIGxldmVsIHRvIGNsdXN0ZXIgdGhlIHBvaW50cyBvblxuICAgIG1pblBvaW50czogMiwgLy8gbWluaW11bSBwb2ludHMgdG8gZm9ybSBhIGNsdXN0ZXJcbiAgICByYWRpdXM6IDQwLCAgIC8vIGNsdXN0ZXIgcmFkaXVzIGluIHBpeGVsc1xuICAgIGV4dGVudDogNTEyLCAgLy8gdGlsZSBleHRlbnQgKHJhZGl1cyBpcyBjYWxjdWxhdGVkIHJlbGF0aXZlIHRvIGl0KVxuICAgIG5vZGVTaXplOiA2NCwgLy8gc2l6ZSBvZiB0aGUgS0QtdHJlZSBsZWFmIG5vZGUsIGFmZmVjdHMgcGVyZm9ybWFuY2VcbiAgICBsb2c6IGZhbHNlLCAgIC8vIHdoZXRoZXIgdG8gbG9nIHRpbWluZyBpbmZvXG5cbiAgICAvLyB3aGV0aGVyIHRvIGdlbmVyYXRlIG51bWVyaWMgaWRzIGZvciBpbnB1dCBmZWF0dXJlcyAoaW4gdmVjdG9yIHRpbGVzKVxuICAgIGdlbmVyYXRlSWQ6IGZhbHNlLFxuXG4gICAgLy8gYSByZWR1Y2UgZnVuY3Rpb24gZm9yIGNhbGN1bGF0aW5nIGN1c3RvbSBjbHVzdGVyIHByb3BlcnRpZXNcbiAgICByZWR1Y2U6IG51bGwsIC8vIChhY2N1bXVsYXRlZCwgcHJvcHMpID0+IHsgYWNjdW11bGF0ZWQuc3VtICs9IHByb3BzLnN1bTsgfVxuXG4gICAgLy8gcHJvcGVydGllcyB0byB1c2UgZm9yIGluZGl2aWR1YWwgcG9pbnRzIHdoZW4gcnVubmluZyB0aGUgcmVkdWNlclxuICAgIG1hcDogcHJvcHMgPT4gcHJvcHMgLy8gcHJvcHMgPT4gKHtzdW06IHByb3BzLm15X3ZhbHVlfSlcbn07XG5cbmNvbnN0IGZyb3VuZCA9IE1hdGguZnJvdW5kIHx8ICh0bXAgPT4gKCh4KSA9PiB7IHRtcFswXSA9ICt4OyByZXR1cm4gdG1wWzBdOyB9KSkobmV3IEZsb2F0MzJBcnJheSgxKSk7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN1cGVyY2x1c3RlciB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBleHRlbmQoT2JqZWN0LmNyZWF0ZShkZWZhdWx0T3B0aW9ucyksIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLnRyZWVzID0gbmV3IEFycmF5KHRoaXMub3B0aW9ucy5tYXhab29tICsgMSk7XG4gICAgfVxuXG4gICAgbG9hZChwb2ludHMpIHtcbiAgICAgICAgY29uc3Qge2xvZywgbWluWm9vbSwgbWF4Wm9vbSwgbm9kZVNpemV9ID0gdGhpcy5vcHRpb25zO1xuXG4gICAgICAgIGlmIChsb2cpIGNvbnNvbGUudGltZSgndG90YWwgdGltZScpO1xuXG4gICAgICAgIGNvbnN0IHRpbWVySWQgPSBgcHJlcGFyZSAkeyAgcG9pbnRzLmxlbmd0aCAgfSBwb2ludHNgO1xuICAgICAgICBpZiAobG9nKSBjb25zb2xlLnRpbWUodGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5wb2ludHMgPSBwb2ludHM7XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgYSBjbHVzdGVyIG9iamVjdCBmb3IgZWFjaCBwb2ludCBhbmQgaW5kZXggaW5wdXQgcG9pbnRzIGludG8gYSBLRC10cmVlXG4gICAgICAgIGxldCBjbHVzdGVycyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCFwb2ludHNbaV0uZ2VvbWV0cnkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY2x1c3RlcnMucHVzaChjcmVhdGVQb2ludENsdXN0ZXIocG9pbnRzW2ldLCBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50cmVlc1ttYXhab29tICsgMV0gPSBuZXcgS0RCdXNoKGNsdXN0ZXJzLCBnZXRYLCBnZXRZLCBub2RlU2l6ZSwgRmxvYXQzMkFycmF5KTtcblxuICAgICAgICBpZiAobG9nKSBjb25zb2xlLnRpbWVFbmQodGltZXJJZCk7XG5cbiAgICAgICAgLy8gY2x1c3RlciBwb2ludHMgb24gbWF4IHpvb20sIHRoZW4gY2x1c3RlciB0aGUgcmVzdWx0cyBvbiBwcmV2aW91cyB6b29tLCBldGMuO1xuICAgICAgICAvLyByZXN1bHRzIGluIGEgY2x1c3RlciBoaWVyYXJjaHkgYWNyb3NzIHpvb20gbGV2ZWxzXG4gICAgICAgIGZvciAobGV0IHogPSBtYXhab29tOyB6ID49IG1pblpvb207IHotLSkge1xuICAgICAgICAgICAgY29uc3Qgbm93ID0gK0RhdGUubm93KCk7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBzZXQgb2YgY2x1c3RlcnMgZm9yIHRoZSB6b29tIGFuZCBpbmRleCB0aGVtIHdpdGggYSBLRC10cmVlXG4gICAgICAgICAgICBjbHVzdGVycyA9IHRoaXMuX2NsdXN0ZXIoY2x1c3RlcnMsIHopO1xuICAgICAgICAgICAgdGhpcy50cmVlc1t6XSA9IG5ldyBLREJ1c2goY2x1c3RlcnMsIGdldFgsIGdldFksIG5vZGVTaXplLCBGbG9hdDMyQXJyYXkpO1xuXG4gICAgICAgICAgICBpZiAobG9nKSBjb25zb2xlLmxvZygneiVkOiAlZCBjbHVzdGVycyBpbiAlZG1zJywgeiwgY2x1c3RlcnMubGVuZ3RoLCArRGF0ZS5ub3coKSAtIG5vdyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9nKSBjb25zb2xlLnRpbWVFbmQoJ3RvdGFsIHRpbWUnKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBnZXRDbHVzdGVycyhiYm94LCB6b29tKSB7XG4gICAgICAgIGxldCBtaW5MbmcgPSAoKGJib3hbMF0gKyAxODApICUgMzYwICsgMzYwKSAlIDM2MCAtIDE4MDtcbiAgICAgICAgY29uc3QgbWluTGF0ID0gTWF0aC5tYXgoLTkwLCBNYXRoLm1pbig5MCwgYmJveFsxXSkpO1xuICAgICAgICBsZXQgbWF4TG5nID0gYmJveFsyXSA9PT0gMTgwID8gMTgwIDogKChiYm94WzJdICsgMTgwKSAlIDM2MCArIDM2MCkgJSAzNjAgLSAxODA7XG4gICAgICAgIGNvbnN0IG1heExhdCA9IE1hdGgubWF4KC05MCwgTWF0aC5taW4oOTAsIGJib3hbM10pKTtcblxuICAgICAgICBpZiAoYmJveFsyXSAtIGJib3hbMF0gPj0gMzYwKSB7XG4gICAgICAgICAgICBtaW5MbmcgPSAtMTgwO1xuICAgICAgICAgICAgbWF4TG5nID0gMTgwO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbkxuZyA+IG1heExuZykge1xuICAgICAgICAgICAgY29uc3QgZWFzdGVybkhlbSA9IHRoaXMuZ2V0Q2x1c3RlcnMoW21pbkxuZywgbWluTGF0LCAxODAsIG1heExhdF0sIHpvb20pO1xuICAgICAgICAgICAgY29uc3Qgd2VzdGVybkhlbSA9IHRoaXMuZ2V0Q2x1c3RlcnMoWy0xODAsIG1pbkxhdCwgbWF4TG5nLCBtYXhMYXRdLCB6b29tKTtcbiAgICAgICAgICAgIHJldHVybiBlYXN0ZXJuSGVtLmNvbmNhdCh3ZXN0ZXJuSGVtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyZWUgPSB0aGlzLnRyZWVzW3RoaXMuX2xpbWl0Wm9vbSh6b29tKV07XG4gICAgICAgIGNvbnN0IGlkcyA9IHRyZWUucmFuZ2UobG5nWChtaW5MbmcpLCBsYXRZKG1heExhdCksIGxuZ1gobWF4TG5nKSwgbGF0WShtaW5MYXQpKTtcbiAgICAgICAgY29uc3QgY2x1c3RlcnMgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBpZCBvZiBpZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGMgPSB0cmVlLnBvaW50c1tpZF07XG4gICAgICAgICAgICBjbHVzdGVycy5wdXNoKGMubnVtUG9pbnRzID8gZ2V0Q2x1c3RlckpTT04oYykgOiB0aGlzLnBvaW50c1tjLmluZGV4XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNsdXN0ZXJzO1xuICAgIH1cblxuICAgIGdldENoaWxkcmVuKGNsdXN0ZXJJZCkge1xuICAgICAgICBjb25zdCBvcmlnaW5JZCA9IHRoaXMuX2dldE9yaWdpbklkKGNsdXN0ZXJJZCk7XG4gICAgICAgIGNvbnN0IG9yaWdpblpvb20gPSB0aGlzLl9nZXRPcmlnaW5ab29tKGNsdXN0ZXJJZCk7XG4gICAgICAgIGNvbnN0IGVycm9yTXNnID0gJ05vIGNsdXN0ZXIgd2l0aCB0aGUgc3BlY2lmaWVkIGlkLic7XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnRyZWVzW29yaWdpblpvb21dO1xuICAgICAgICBpZiAoIWluZGV4KSB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNc2cpO1xuXG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IGluZGV4LnBvaW50c1tvcmlnaW5JZF07XG4gICAgICAgIGlmICghb3JpZ2luKSB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNc2cpO1xuXG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLm9wdGlvbnMucmFkaXVzIC8gKHRoaXMub3B0aW9ucy5leHRlbnQgKiBNYXRoLnBvdygyLCBvcmlnaW5ab29tIC0gMSkpO1xuICAgICAgICBjb25zdCBpZHMgPSBpbmRleC53aXRoaW4ob3JpZ2luLngsIG9yaWdpbi55LCByKTtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBpZCBvZiBpZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGMgPSBpbmRleC5wb2ludHNbaWRdO1xuICAgICAgICAgICAgaWYgKGMucGFyZW50SWQgPT09IGNsdXN0ZXJJZCkge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goYy5udW1Qb2ludHMgPyBnZXRDbHVzdGVySlNPTihjKSA6IHRoaXMucG9pbnRzW2MuaW5kZXhdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihlcnJvck1zZyk7XG5cbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgIH1cblxuICAgIGdldExlYXZlcyhjbHVzdGVySWQsIGxpbWl0LCBvZmZzZXQpIHtcbiAgICAgICAgbGltaXQgPSBsaW1pdCB8fCAxMDtcbiAgICAgICAgb2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cbiAgICAgICAgY29uc3QgbGVhdmVzID0gW107XG4gICAgICAgIHRoaXMuX2FwcGVuZExlYXZlcyhsZWF2ZXMsIGNsdXN0ZXJJZCwgbGltaXQsIG9mZnNldCwgMCk7XG5cbiAgICAgICAgcmV0dXJuIGxlYXZlcztcbiAgICB9XG5cbiAgICBnZXRUaWxlKHosIHgsIHkpIHtcbiAgICAgICAgY29uc3QgdHJlZSA9IHRoaXMudHJlZXNbdGhpcy5fbGltaXRab29tKHopXTtcbiAgICAgICAgY29uc3QgejIgPSBNYXRoLnBvdygyLCB6KTtcbiAgICAgICAgY29uc3Qge2V4dGVudCwgcmFkaXVzfSA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgY29uc3QgcCA9IHJhZGl1cyAvIGV4dGVudDtcbiAgICAgICAgY29uc3QgdG9wID0gKHkgLSBwKSAvIHoyO1xuICAgICAgICBjb25zdCBib3R0b20gPSAoeSArIDEgKyBwKSAvIHoyO1xuXG4gICAgICAgIGNvbnN0IHRpbGUgPSB7XG4gICAgICAgICAgICBmZWF0dXJlczogW11cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9hZGRUaWxlRmVhdHVyZXMoXG4gICAgICAgICAgICB0cmVlLnJhbmdlKCh4IC0gcCkgLyB6MiwgdG9wLCAoeCArIDEgKyBwKSAvIHoyLCBib3R0b20pLFxuICAgICAgICAgICAgdHJlZS5wb2ludHMsIHgsIHksIHoyLCB0aWxlKTtcblxuICAgICAgICBpZiAoeCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fYWRkVGlsZUZlYXR1cmVzKFxuICAgICAgICAgICAgICAgIHRyZWUucmFuZ2UoMSAtIHAgLyB6MiwgdG9wLCAxLCBib3R0b20pLFxuICAgICAgICAgICAgICAgIHRyZWUucG9pbnRzLCB6MiwgeSwgejIsIHRpbGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh4ID09PSB6MiAtIDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZFRpbGVGZWF0dXJlcyhcbiAgICAgICAgICAgICAgICB0cmVlLnJhbmdlKDAsIHRvcCwgcCAvIHoyLCBib3R0b20pLFxuICAgICAgICAgICAgICAgIHRyZWUucG9pbnRzLCAtMSwgeSwgejIsIHRpbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRpbGUuZmVhdHVyZXMubGVuZ3RoID8gdGlsZSA6IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0Q2x1c3RlckV4cGFuc2lvblpvb20oY2x1c3RlcklkKSB7XG4gICAgICAgIGxldCBleHBhbnNpb25ab29tID0gdGhpcy5fZ2V0T3JpZ2luWm9vbShjbHVzdGVySWQpIC0gMTtcbiAgICAgICAgd2hpbGUgKGV4cGFuc2lvblpvb20gPD0gdGhpcy5vcHRpb25zLm1heFpvb20pIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5nZXRDaGlsZHJlbihjbHVzdGVySWQpO1xuICAgICAgICAgICAgZXhwYW5zaW9uWm9vbSsrO1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCAhPT0gMSkgYnJlYWs7XG4gICAgICAgICAgICBjbHVzdGVySWQgPSBjaGlsZHJlblswXS5wcm9wZXJ0aWVzLmNsdXN0ZXJfaWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4cGFuc2lvblpvb207XG4gICAgfVxuXG4gICAgX2FwcGVuZExlYXZlcyhyZXN1bHQsIGNsdXN0ZXJJZCwgbGltaXQsIG9mZnNldCwgc2tpcHBlZCkge1xuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZ2V0Q2hpbGRyZW4oY2x1c3RlcklkKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wcyA9IGNoaWxkLnByb3BlcnRpZXM7XG5cbiAgICAgICAgICAgIGlmIChwcm9wcyAmJiBwcm9wcy5jbHVzdGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNraXBwZWQgKyBwcm9wcy5wb2ludF9jb3VudCA8PSBvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCB0aGUgd2hvbGUgY2x1c3RlclxuICAgICAgICAgICAgICAgICAgICBza2lwcGVkICs9IHByb3BzLnBvaW50X2NvdW50O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVudGVyIHRoZSBjbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgIHNraXBwZWQgPSB0aGlzLl9hcHBlbmRMZWF2ZXMocmVzdWx0LCBwcm9wcy5jbHVzdGVyX2lkLCBsaW1pdCwgb2Zmc2V0LCBza2lwcGVkKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gZXhpdCB0aGUgY2x1c3RlclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2tpcHBlZCA8IG9mZnNldCkge1xuICAgICAgICAgICAgICAgIC8vIHNraXAgYSBzaW5nbGUgcG9pbnRcbiAgICAgICAgICAgICAgICBza2lwcGVkKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBhIHNpbmdsZSBwb2ludFxuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSBsaW1pdCkgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2tpcHBlZDtcbiAgICB9XG5cbiAgICBfYWRkVGlsZUZlYXR1cmVzKGlkcywgcG9pbnRzLCB4LCB5LCB6MiwgdGlsZSkge1xuICAgICAgICBmb3IgKGNvbnN0IGkgb2YgaWRzKSB7XG4gICAgICAgICAgICBjb25zdCBjID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyID0gYy5udW1Qb2ludHM7XG5cbiAgICAgICAgICAgIGxldCB0YWdzLCBweCwgcHk7XG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyKSB7XG4gICAgICAgICAgICAgICAgdGFncyA9IGdldENsdXN0ZXJQcm9wZXJ0aWVzKGMpO1xuICAgICAgICAgICAgICAgIHB4ID0gYy54O1xuICAgICAgICAgICAgICAgIHB5ID0gYy55O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwID0gdGhpcy5wb2ludHNbYy5pbmRleF07XG4gICAgICAgICAgICAgICAgdGFncyA9IHAucHJvcGVydGllcztcbiAgICAgICAgICAgICAgICBweCA9IGxuZ1gocC5nZW9tZXRyeS5jb29yZGluYXRlc1swXSk7XG4gICAgICAgICAgICAgICAgcHkgPSBsYXRZKHAuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IDEsXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnk6IFtbXG4gICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5vcHRpb25zLmV4dGVudCAqIChweCAqIHoyIC0geCkpLFxuICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMub3B0aW9ucy5leHRlbnQgKiAocHkgKiB6MiAtIHkpKVxuICAgICAgICAgICAgICAgIF1dLFxuICAgICAgICAgICAgICAgIHRhZ3NcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGFzc2lnbiBpZFxuICAgICAgICAgICAgbGV0IGlkO1xuICAgICAgICAgICAgaWYgKGlzQ2x1c3Rlcikge1xuICAgICAgICAgICAgICAgIGlkID0gYy5pZDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmdlbmVyYXRlSWQpIHtcbiAgICAgICAgICAgICAgICAvLyBvcHRpb25hbGx5IGdlbmVyYXRlIGlkXG4gICAgICAgICAgICAgICAgaWQgPSBjLmluZGV4O1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBvaW50c1tjLmluZGV4XS5pZCkge1xuICAgICAgICAgICAgICAgIC8vIGtlZXAgaWQgaWYgYWxyZWFkeSBhc3NpZ25lZFxuICAgICAgICAgICAgICAgIGlkID0gdGhpcy5wb2ludHNbYy5pbmRleF0uaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpZCAhPT0gdW5kZWZpbmVkKSBmLmlkID0gaWQ7XG5cbiAgICAgICAgICAgIHRpbGUuZmVhdHVyZXMucHVzaChmKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9saW1pdFpvb20oeikge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgodGhpcy5vcHRpb25zLm1pblpvb20sIE1hdGgubWluKCt6LCB0aGlzLm9wdGlvbnMubWF4Wm9vbSArIDEpKTtcbiAgICB9XG5cbiAgICBfY2x1c3Rlcihwb2ludHMsIHpvb20pIHtcbiAgICAgICAgY29uc3QgY2x1c3RlcnMgPSBbXTtcbiAgICAgICAgY29uc3Qge3JhZGl1cywgZXh0ZW50LCByZWR1Y2UsIG1pblBvaW50c30gPSB0aGlzLm9wdGlvbnM7XG4gICAgICAgIGNvbnN0IHIgPSByYWRpdXMgLyAoZXh0ZW50ICogTWF0aC5wb3coMiwgem9vbSkpO1xuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBlYWNoIHBvaW50XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgLy8gaWYgd2UndmUgYWxyZWFkeSB2aXNpdGVkIHRoZSBwb2ludCBhdCB0aGlzIHpvb20gbGV2ZWwsIHNraXAgaXRcbiAgICAgICAgICAgIGlmIChwLnpvb20gPD0gem9vbSkgY29udGludWU7XG4gICAgICAgICAgICBwLnpvb20gPSB6b29tO1xuXG4gICAgICAgICAgICAvLyBmaW5kIGFsbCBuZWFyYnkgcG9pbnRzXG4gICAgICAgICAgICBjb25zdCB0cmVlID0gdGhpcy50cmVlc1t6b29tICsgMV07XG4gICAgICAgICAgICBjb25zdCBuZWlnaGJvcklkcyA9IHRyZWUud2l0aGluKHAueCwgcC55LCByKTtcblxuICAgICAgICAgICAgY29uc3QgbnVtUG9pbnRzT3JpZ2luID0gcC5udW1Qb2ludHMgfHwgMTtcbiAgICAgICAgICAgIGxldCBudW1Qb2ludHMgPSBudW1Qb2ludHNPcmlnaW47XG5cbiAgICAgICAgICAgIC8vIGNvdW50IHRoZSBudW1iZXIgb2YgcG9pbnRzIGluIGEgcG90ZW50aWFsIGNsdXN0ZXJcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmVpZ2hib3JJZCBvZiBuZWlnaGJvcklkcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGIgPSB0cmVlLnBvaW50c1tuZWlnaGJvcklkXTtcbiAgICAgICAgICAgICAgICAvLyBmaWx0ZXIgb3V0IG5laWdoYm9ycyB0aGF0IGFyZSBhbHJlYWR5IHByb2Nlc3NlZFxuICAgICAgICAgICAgICAgIGlmIChiLnpvb20gPiB6b29tKSBudW1Qb2ludHMgKz0gYi5udW1Qb2ludHMgfHwgMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlcmUgd2VyZSBuZWlnaGJvcnMgdG8gbWVyZ2UsIGFuZCB0aGVyZSBhcmUgZW5vdWdoIHBvaW50cyB0byBmb3JtIGEgY2x1c3RlclxuICAgICAgICAgICAgaWYgKG51bVBvaW50cyA+IG51bVBvaW50c09yaWdpbiAmJiBudW1Qb2ludHMgPj0gbWluUG9pbnRzKSB7XG4gICAgICAgICAgICAgICAgbGV0IHd4ID0gcC54ICogbnVtUG9pbnRzT3JpZ2luO1xuICAgICAgICAgICAgICAgIGxldCB3eSA9IHAueSAqIG51bVBvaW50c09yaWdpbjtcblxuICAgICAgICAgICAgICAgIGxldCBjbHVzdGVyUHJvcGVydGllcyA9IHJlZHVjZSAmJiBudW1Qb2ludHNPcmlnaW4gPiAxID8gdGhpcy5fbWFwKHAsIHRydWUpIDogbnVsbDtcblxuICAgICAgICAgICAgICAgIC8vIGVuY29kZSBib3RoIHpvb20gYW5kIHBvaW50IGluZGV4IG9uIHdoaWNoIHRoZSBjbHVzdGVyIG9yaWdpbmF0ZWQgLS0gb2Zmc2V0IGJ5IHRvdGFsIGxlbmd0aCBvZiBmZWF0dXJlc1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gKGkgPDwgNSkgKyAoem9vbSArIDEpICsgdGhpcy5wb2ludHMubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBuZWlnaGJvcklkIG9mIG5laWdoYm9ySWRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGIgPSB0cmVlLnBvaW50c1tuZWlnaGJvcklkXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYi56b29tIDw9IHpvb20pIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBiLnpvb20gPSB6b29tOyAvLyBzYXZlIHRoZSB6b29tIChzbyBpdCBkb2Vzbid0IGdldCBwcm9jZXNzZWQgdHdpY2UpXG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtUG9pbnRzMiA9IGIubnVtUG9pbnRzIHx8IDE7XG4gICAgICAgICAgICAgICAgICAgIHd4ICs9IGIueCAqIG51bVBvaW50czI7IC8vIGFjY3VtdWxhdGUgY29vcmRpbmF0ZXMgZm9yIGNhbGN1bGF0aW5nIHdlaWdodGVkIGNlbnRlclxuICAgICAgICAgICAgICAgICAgICB3eSArPSBiLnkgKiBudW1Qb2ludHMyO1xuXG4gICAgICAgICAgICAgICAgICAgIGIucGFyZW50SWQgPSBpZDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocmVkdWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJQcm9wZXJ0aWVzKSBjbHVzdGVyUHJvcGVydGllcyA9IHRoaXMuX21hcChwLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZHVjZShjbHVzdGVyUHJvcGVydGllcywgdGhpcy5fbWFwKGIpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHAucGFyZW50SWQgPSBpZDtcbiAgICAgICAgICAgICAgICBjbHVzdGVycy5wdXNoKGNyZWF0ZUNsdXN0ZXIod3ggLyBudW1Qb2ludHMsIHd5IC8gbnVtUG9pbnRzLCBpZCwgbnVtUG9pbnRzLCBjbHVzdGVyUHJvcGVydGllcykpO1xuXG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBsZWZ0IHBvaW50cyBhcyB1bmNsdXN0ZXJlZFxuICAgICAgICAgICAgICAgIGNsdXN0ZXJzLnB1c2gocCk7XG5cbiAgICAgICAgICAgICAgICBpZiAobnVtUG9pbnRzID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JJZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGIgPSB0cmVlLnBvaW50c1tuZWlnaGJvcklkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiLnpvb20gPD0gem9vbSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBiLnpvb20gPSB6b29tO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnMucHVzaChiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbHVzdGVycztcbiAgICB9XG5cbiAgICAvLyBnZXQgaW5kZXggb2YgdGhlIHBvaW50IGZyb20gd2hpY2ggdGhlIGNsdXN0ZXIgb3JpZ2luYXRlZFxuICAgIF9nZXRPcmlnaW5JZChjbHVzdGVySWQpIHtcbiAgICAgICAgcmV0dXJuIChjbHVzdGVySWQgLSB0aGlzLnBvaW50cy5sZW5ndGgpID4+IDU7XG4gICAgfVxuXG4gICAgLy8gZ2V0IHpvb20gb2YgdGhlIHBvaW50IGZyb20gd2hpY2ggdGhlIGNsdXN0ZXIgb3JpZ2luYXRlZFxuICAgIF9nZXRPcmlnaW5ab29tKGNsdXN0ZXJJZCkge1xuICAgICAgICByZXR1cm4gKGNsdXN0ZXJJZCAtIHRoaXMucG9pbnRzLmxlbmd0aCkgJSAzMjtcbiAgICB9XG5cbiAgICBfbWFwKHBvaW50LCBjbG9uZSkge1xuICAgICAgICBpZiAocG9pbnQubnVtUG9pbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gY2xvbmUgPyBleHRlbmQoe30sIHBvaW50LnByb3BlcnRpZXMpIDogcG9pbnQucHJvcGVydGllcztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvcmlnaW5hbCA9IHRoaXMucG9pbnRzW3BvaW50LmluZGV4XS5wcm9wZXJ0aWVzO1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLm9wdGlvbnMubWFwKG9yaWdpbmFsKTtcbiAgICAgICAgcmV0dXJuIGNsb25lICYmIHJlc3VsdCA9PT0gb3JpZ2luYWwgPyBleHRlbmQoe30sIHJlc3VsdCkgOiByZXN1bHQ7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDbHVzdGVyKHgsIHksIGlkLCBudW1Qb2ludHMsIHByb3BlcnRpZXMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICB4OiBmcm91bmQoeCksIC8vIHdlaWdodGVkIGNsdXN0ZXIgY2VudGVyOyByb3VuZCBmb3IgY29uc2lzdGVuY3kgd2l0aCBGbG9hdDMyQXJyYXkgaW5kZXhcbiAgICAgICAgeTogZnJvdW5kKHkpLFxuICAgICAgICB6b29tOiBJbmZpbml0eSwgLy8gdGhlIGxhc3Qgem9vbSB0aGUgY2x1c3RlciB3YXMgcHJvY2Vzc2VkIGF0XG4gICAgICAgIGlkLCAvLyBlbmNvZGVzIGluZGV4IG9mIHRoZSBmaXJzdCBjaGlsZCBvZiB0aGUgY2x1c3RlciBhbmQgaXRzIHpvb20gbGV2ZWxcbiAgICAgICAgcGFyZW50SWQ6IC0xLCAvLyBwYXJlbnQgY2x1c3RlciBpZFxuICAgICAgICBudW1Qb2ludHMsXG4gICAgICAgIHByb3BlcnRpZXNcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQb2ludENsdXN0ZXIocCwgaWQpIHtcbiAgICBjb25zdCBbeCwgeV0gPSBwLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgIHJldHVybiB7XG4gICAgICAgIHg6IGZyb3VuZChsbmdYKHgpKSwgLy8gcHJvamVjdGVkIHBvaW50IGNvb3JkaW5hdGVzXG4gICAgICAgIHk6IGZyb3VuZChsYXRZKHkpKSxcbiAgICAgICAgem9vbTogSW5maW5pdHksIC8vIHRoZSBsYXN0IHpvb20gdGhlIHBvaW50IHdhcyBwcm9jZXNzZWQgYXRcbiAgICAgICAgaW5kZXg6IGlkLCAvLyBpbmRleCBvZiB0aGUgc291cmNlIGZlYXR1cmUgaW4gdGhlIG9yaWdpbmFsIGlucHV0IGFycmF5LFxuICAgICAgICBwYXJlbnRJZDogLTEgLy8gcGFyZW50IGNsdXN0ZXIgaWRcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBnZXRDbHVzdGVySlNPTihjbHVzdGVyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgICBpZDogY2x1c3Rlci5pZCxcbiAgICAgICAgcHJvcGVydGllczogZ2V0Q2x1c3RlclByb3BlcnRpZXMoY2x1c3RlciksXG4gICAgICAgIGdlb21ldHJ5OiB7XG4gICAgICAgICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgICAgICAgY29vcmRpbmF0ZXM6IFt4TG5nKGNsdXN0ZXIueCksIHlMYXQoY2x1c3Rlci55KV1cbiAgICAgICAgfVxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGdldENsdXN0ZXJQcm9wZXJ0aWVzKGNsdXN0ZXIpIHtcbiAgICBjb25zdCBjb3VudCA9IGNsdXN0ZXIubnVtUG9pbnRzO1xuICAgIGNvbnN0IGFiYnJldiA9XG4gICAgICAgIGNvdW50ID49IDEwMDAwID8gYCR7TWF0aC5yb3VuZChjb3VudCAvIDEwMDApICB9a2AgOlxuICAgICAgICBjb3VudCA+PSAxMDAwID8gYCR7TWF0aC5yb3VuZChjb3VudCAvIDEwMCkgLyAxMCAgfWtgIDogY291bnQ7XG4gICAgcmV0dXJuIGV4dGVuZChleHRlbmQoe30sIGNsdXN0ZXIucHJvcGVydGllcyksIHtcbiAgICAgICAgY2x1c3RlcjogdHJ1ZSxcbiAgICAgICAgY2x1c3Rlcl9pZDogY2x1c3Rlci5pZCxcbiAgICAgICAgcG9pbnRfY291bnQ6IGNvdW50LFxuICAgICAgICBwb2ludF9jb3VudF9hYmJyZXZpYXRlZDogYWJicmV2XG4gICAgfSk7XG59XG5cbi8vIGxvbmdpdHVkZS9sYXRpdHVkZSB0byBzcGhlcmljYWwgbWVyY2F0b3IgaW4gWzAuLjFdIHJhbmdlXG5mdW5jdGlvbiBsbmdYKGxuZykge1xuICAgIHJldHVybiBsbmcgLyAzNjAgKyAwLjU7XG59XG5mdW5jdGlvbiBsYXRZKGxhdCkge1xuICAgIGNvbnN0IHNpbiA9IE1hdGguc2luKGxhdCAqIE1hdGguUEkgLyAxODApO1xuICAgIGNvbnN0IHkgPSAoMC41IC0gMC4yNSAqIE1hdGgubG9nKCgxICsgc2luKSAvICgxIC0gc2luKSkgLyBNYXRoLlBJKTtcbiAgICByZXR1cm4geSA8IDAgPyAwIDogeSA+IDEgPyAxIDogeTtcbn1cblxuLy8gc3BoZXJpY2FsIG1lcmNhdG9yIHRvIGxvbmdpdHVkZS9sYXRpdHVkZVxuZnVuY3Rpb24geExuZyh4KSB7XG4gICAgcmV0dXJuICh4IC0gMC41KSAqIDM2MDtcbn1cbmZ1bmN0aW9uIHlMYXQoeSkge1xuICAgIGNvbnN0IHkyID0gKDE4MCAtIHkgKiAzNjApICogTWF0aC5QSSAvIDE4MDtcbiAgICByZXR1cm4gMzYwICogTWF0aC5hdGFuKE1hdGguZXhwKHkyKSkgLyBNYXRoLlBJIC0gOTA7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChkZXN0LCBzcmMpIHtcbiAgICBmb3IgKGNvbnN0IGlkIGluIHNyYykgZGVzdFtpZF0gPSBzcmNbaWRdO1xuICAgIHJldHVybiBkZXN0O1xufVxuXG5mdW5jdGlvbiBnZXRYKHApIHtcbiAgICByZXR1cm4gcC54O1xufVxuZnVuY3Rpb24gZ2V0WShwKSB7XG4gICAgcmV0dXJuIHAueTtcbn1cbiIsIlxuLy8gY2FsY3VsYXRlIHNpbXBsaWZpY2F0aW9uIGRhdGEgdXNpbmcgb3B0aW1pemVkIERvdWdsYXMtUGV1Y2tlciBhbGdvcml0aG1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc2ltcGxpZnkoY29vcmRzLCBmaXJzdCwgbGFzdCwgc3FUb2xlcmFuY2UpIHtcbiAgICB2YXIgbWF4U3FEaXN0ID0gc3FUb2xlcmFuY2U7XG4gICAgdmFyIG1pZCA9IChsYXN0IC0gZmlyc3QpID4+IDE7XG4gICAgdmFyIG1pblBvc1RvTWlkID0gbGFzdCAtIGZpcnN0O1xuICAgIHZhciBpbmRleDtcblxuICAgIHZhciBheCA9IGNvb3Jkc1tmaXJzdF07XG4gICAgdmFyIGF5ID0gY29vcmRzW2ZpcnN0ICsgMV07XG4gICAgdmFyIGJ4ID0gY29vcmRzW2xhc3RdO1xuICAgIHZhciBieSA9IGNvb3Jkc1tsYXN0ICsgMV07XG5cbiAgICBmb3IgKHZhciBpID0gZmlyc3QgKyAzOyBpIDwgbGFzdDsgaSArPSAzKSB7XG4gICAgICAgIHZhciBkID0gZ2V0U3FTZWdEaXN0KGNvb3Jkc1tpXSwgY29vcmRzW2kgKyAxXSwgYXgsIGF5LCBieCwgYnkpO1xuXG4gICAgICAgIGlmIChkID4gbWF4U3FEaXN0KSB7XG4gICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICBtYXhTcURpc3QgPSBkO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoZCA9PT0gbWF4U3FEaXN0KSB7XG4gICAgICAgICAgICAvLyBhIHdvcmthcm91bmQgdG8gZW5zdXJlIHdlIGNob29zZSBhIHBpdm90IGNsb3NlIHRvIHRoZSBtaWRkbGUgb2YgdGhlIGxpc3QsXG4gICAgICAgICAgICAvLyByZWR1Y2luZyByZWN1cnNpb24gZGVwdGgsIGZvciBjZXJ0YWluIGRlZ2VuZXJhdGUgaW5wdXRzXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWFwYm94L2dlb2pzb24tdnQvaXNzdWVzLzEwNFxuICAgICAgICAgICAgdmFyIHBvc1RvTWlkID0gTWF0aC5hYnMoaSAtIG1pZCk7XG4gICAgICAgICAgICBpZiAocG9zVG9NaWQgPCBtaW5Qb3NUb01pZCkge1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBtaW5Qb3NUb01pZCA9IHBvc1RvTWlkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1heFNxRGlzdCA+IHNxVG9sZXJhbmNlKSB7XG4gICAgICAgIGlmIChpbmRleCAtIGZpcnN0ID4gMykgc2ltcGxpZnkoY29vcmRzLCBmaXJzdCwgaW5kZXgsIHNxVG9sZXJhbmNlKTtcbiAgICAgICAgY29vcmRzW2luZGV4ICsgMl0gPSBtYXhTcURpc3Q7XG4gICAgICAgIGlmIChsYXN0IC0gaW5kZXggPiAzKSBzaW1wbGlmeShjb29yZHMsIGluZGV4LCBsYXN0LCBzcVRvbGVyYW5jZSk7XG4gICAgfVxufVxuXG4vLyBzcXVhcmUgZGlzdGFuY2UgZnJvbSBhIHBvaW50IHRvIGEgc2VnbWVudFxuZnVuY3Rpb24gZ2V0U3FTZWdEaXN0KHB4LCBweSwgeCwgeSwgYngsIGJ5KSB7XG5cbiAgICB2YXIgZHggPSBieCAtIHg7XG4gICAgdmFyIGR5ID0gYnkgLSB5O1xuXG4gICAgaWYgKGR4ICE9PSAwIHx8IGR5ICE9PSAwKSB7XG5cbiAgICAgICAgdmFyIHQgPSAoKHB4IC0geCkgKiBkeCArIChweSAtIHkpICogZHkpIC8gKGR4ICogZHggKyBkeSAqIGR5KTtcblxuICAgICAgICBpZiAodCA+IDEpIHtcbiAgICAgICAgICAgIHggPSBieDtcbiAgICAgICAgICAgIHkgPSBieTtcblxuICAgICAgICB9IGVsc2UgaWYgKHQgPiAwKSB7XG4gICAgICAgICAgICB4ICs9IGR4ICogdDtcbiAgICAgICAgICAgIHkgKz0gZHkgKiB0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZHggPSBweCAtIHg7XG4gICAgZHkgPSBweSAtIHk7XG5cbiAgICByZXR1cm4gZHggKiBkeCArIGR5ICogZHk7XG59XG4iLCJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNyZWF0ZUZlYXR1cmUoaWQsIHR5cGUsIGdlb20sIHRhZ3MpIHtcbiAgICB2YXIgZmVhdHVyZSA9IHtcbiAgICAgICAgaWQ6IHR5cGVvZiBpZCA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogaWQsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGdlb21ldHJ5OiBnZW9tLFxuICAgICAgICB0YWdzOiB0YWdzLFxuICAgICAgICBtaW5YOiBJbmZpbml0eSxcbiAgICAgICAgbWluWTogSW5maW5pdHksXG4gICAgICAgIG1heFg6IC1JbmZpbml0eSxcbiAgICAgICAgbWF4WTogLUluZmluaXR5XG4gICAgfTtcbiAgICBjYWxjQkJveChmZWF0dXJlKTtcbiAgICByZXR1cm4gZmVhdHVyZTtcbn1cblxuZnVuY3Rpb24gY2FsY0JCb3goZmVhdHVyZSkge1xuICAgIHZhciBnZW9tID0gZmVhdHVyZS5nZW9tZXRyeTtcbiAgICB2YXIgdHlwZSA9IGZlYXR1cmUudHlwZTtcblxuICAgIGlmICh0eXBlID09PSAnUG9pbnQnIHx8IHR5cGUgPT09ICdNdWx0aVBvaW50JyB8fCB0eXBlID09PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgY2FsY0xpbmVCQm94KGZlYXR1cmUsIGdlb20pO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnUG9seWdvbicgfHwgdHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBnZW9tLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjYWxjTGluZUJCb3goZmVhdHVyZSwgZ2VvbVtpXSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGdlb20ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZ2VvbVtpXS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNhbGNMaW5lQkJveChmZWF0dXJlLCBnZW9tW2ldW2pdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gY2FsY0xpbmVCQm94KGZlYXR1cmUsIGdlb20pIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20ubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgZmVhdHVyZS5taW5YID0gTWF0aC5taW4oZmVhdHVyZS5taW5YLCBnZW9tW2ldKTtcbiAgICAgICAgZmVhdHVyZS5taW5ZID0gTWF0aC5taW4oZmVhdHVyZS5taW5ZLCBnZW9tW2kgKyAxXSk7XG4gICAgICAgIGZlYXR1cmUubWF4WCA9IE1hdGgubWF4KGZlYXR1cmUubWF4WCwgZ2VvbVtpXSk7XG4gICAgICAgIGZlYXR1cmUubWF4WSA9IE1hdGgubWF4KGZlYXR1cmUubWF4WSwgZ2VvbVtpICsgMV0pO1xuICAgIH1cbn1cbiIsIlxuaW1wb3J0IHNpbXBsaWZ5IGZyb20gJy4vc2ltcGxpZnknO1xuaW1wb3J0IGNyZWF0ZUZlYXR1cmUgZnJvbSAnLi9mZWF0dXJlJztcblxuLy8gY29udmVydHMgR2VvSlNPTiBmZWF0dXJlIGludG8gYW4gaW50ZXJtZWRpYXRlIHByb2plY3RlZCBKU09OIHZlY3RvciBmb3JtYXQgd2l0aCBzaW1wbGlmaWNhdGlvbiBkYXRhXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNvbnZlcnQoZGF0YSwgb3B0aW9ucykge1xuICAgIHZhciBmZWF0dXJlcyA9IFtdO1xuICAgIGlmIChkYXRhLnR5cGUgPT09ICdGZWF0dXJlQ29sbGVjdGlvbicpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb252ZXJ0RmVhdHVyZShmZWF0dXJlcywgZGF0YS5mZWF0dXJlc1tpXSwgb3B0aW9ucywgaSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAoZGF0YS50eXBlID09PSAnRmVhdHVyZScpIHtcbiAgICAgICAgY29udmVydEZlYXR1cmUoZmVhdHVyZXMsIGRhdGEsIG9wdGlvbnMpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc2luZ2xlIGdlb21ldHJ5IG9yIGEgZ2VvbWV0cnkgY29sbGVjdGlvblxuICAgICAgICBjb252ZXJ0RmVhdHVyZShmZWF0dXJlcywge2dlb21ldHJ5OiBkYXRhfSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZlYXR1cmVzO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0RmVhdHVyZShmZWF0dXJlcywgZ2VvanNvbiwgb3B0aW9ucywgaW5kZXgpIHtcbiAgICBpZiAoIWdlb2pzb24uZ2VvbWV0cnkpIHJldHVybjtcblxuICAgIHZhciBjb29yZHMgPSBnZW9qc29uLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgIHZhciB0eXBlID0gZ2VvanNvbi5nZW9tZXRyeS50eXBlO1xuICAgIHZhciB0b2xlcmFuY2UgPSBNYXRoLnBvdyhvcHRpb25zLnRvbGVyYW5jZSAvICgoMSA8PCBvcHRpb25zLm1heFpvb20pICogb3B0aW9ucy5leHRlbnQpLCAyKTtcbiAgICB2YXIgZ2VvbWV0cnkgPSBbXTtcbiAgICB2YXIgaWQgPSBnZW9qc29uLmlkO1xuICAgIGlmIChvcHRpb25zLnByb21vdGVJZCkge1xuICAgICAgICBpZCA9IGdlb2pzb24ucHJvcGVydGllc1tvcHRpb25zLnByb21vdGVJZF07XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmdlbmVyYXRlSWQpIHtcbiAgICAgICAgaWQgPSBpbmRleCB8fCAwO1xuICAgIH1cbiAgICBpZiAodHlwZSA9PT0gJ1BvaW50Jykge1xuICAgICAgICBjb252ZXJ0UG9pbnQoY29vcmRzLCBnZW9tZXRyeSk7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aVBvaW50Jykge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29udmVydFBvaW50KGNvb3Jkc1tpXSwgZ2VvbWV0cnkpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xuICAgICAgICBjb252ZXJ0TGluZShjb29yZHMsIGdlb21ldHJ5LCB0b2xlcmFuY2UsIGZhbHNlKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMubGluZU1ldHJpY3MpIHtcbiAgICAgICAgICAgIC8vIGV4cGxvZGUgaW50byBsaW5lc3RyaW5ncyB0byBiZSBhYmxlIHRvIHRyYWNrIG1ldHJpY3NcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBnZW9tZXRyeSA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnZlcnRMaW5lKGNvb3Jkc1tpXSwgZ2VvbWV0cnksIHRvbGVyYW5jZSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGZlYXR1cmVzLnB1c2goY3JlYXRlRmVhdHVyZShpZCwgJ0xpbmVTdHJpbmcnLCBnZW9tZXRyeSwgZ2VvanNvbi5wcm9wZXJ0aWVzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb252ZXJ0TGluZXMoY29vcmRzLCBnZW9tZXRyeSwgdG9sZXJhbmNlLCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1BvbHlnb24nKSB7XG4gICAgICAgIGNvbnZlcnRMaW5lcyhjb29yZHMsIGdlb21ldHJ5LCB0b2xlcmFuY2UsIHRydWUpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcG9seWdvbiA9IFtdO1xuICAgICAgICAgICAgY29udmVydExpbmVzKGNvb3Jkc1tpXSwgcG9seWdvbiwgdG9sZXJhbmNlLCB0cnVlKTtcbiAgICAgICAgICAgIGdlb21ldHJ5LnB1c2gocG9seWdvbik7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdHZW9tZXRyeUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBnZW9qc29uLmdlb21ldHJ5Lmdlb21ldHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnZlcnRGZWF0dXJlKGZlYXR1cmVzLCB7XG4gICAgICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgICAgIGdlb21ldHJ5OiBnZW9qc29uLmdlb21ldHJ5Lmdlb21ldHJpZXNbaV0sXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogZ2VvanNvbi5wcm9wZXJ0aWVzXG4gICAgICAgICAgICB9LCBvcHRpb25zLCBpbmRleCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW5wdXQgZGF0YSBpcyBub3QgYSB2YWxpZCBHZW9KU09OIG9iamVjdC4nKTtcbiAgICB9XG5cbiAgICBmZWF0dXJlcy5wdXNoKGNyZWF0ZUZlYXR1cmUoaWQsIHR5cGUsIGdlb21ldHJ5LCBnZW9qc29uLnByb3BlcnRpZXMpKTtcbn1cblxuZnVuY3Rpb24gY29udmVydFBvaW50KGNvb3Jkcywgb3V0KSB7XG4gICAgb3V0LnB1c2gocHJvamVjdFgoY29vcmRzWzBdKSk7XG4gICAgb3V0LnB1c2gocHJvamVjdFkoY29vcmRzWzFdKSk7XG4gICAgb3V0LnB1c2goMCk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRMaW5lKHJpbmcsIG91dCwgdG9sZXJhbmNlLCBpc1BvbHlnb24pIHtcbiAgICB2YXIgeDAsIHkwO1xuICAgIHZhciBzaXplID0gMDtcblxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgcmluZy5sZW5ndGg7IGorKykge1xuICAgICAgICB2YXIgeCA9IHByb2plY3RYKHJpbmdbal1bMF0pO1xuICAgICAgICB2YXIgeSA9IHByb2plY3RZKHJpbmdbal1bMV0pO1xuXG4gICAgICAgIG91dC5wdXNoKHgpO1xuICAgICAgICBvdXQucHVzaCh5KTtcbiAgICAgICAgb3V0LnB1c2goMCk7XG5cbiAgICAgICAgaWYgKGogPiAwKSB7XG4gICAgICAgICAgICBpZiAoaXNQb2x5Z29uKSB7XG4gICAgICAgICAgICAgICAgc2l6ZSArPSAoeDAgKiB5IC0geCAqIHkwKSAvIDI7IC8vIGFyZWFcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2l6ZSArPSBNYXRoLnNxcnQoTWF0aC5wb3coeCAtIHgwLCAyKSArIE1hdGgucG93KHkgLSB5MCwgMikpOyAvLyBsZW5ndGhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB4MCA9IHg7XG4gICAgICAgIHkwID0geTtcbiAgICB9XG5cbiAgICB2YXIgbGFzdCA9IG91dC5sZW5ndGggLSAzO1xuICAgIG91dFsyXSA9IDE7XG4gICAgc2ltcGxpZnkob3V0LCAwLCBsYXN0LCB0b2xlcmFuY2UpO1xuICAgIG91dFtsYXN0ICsgMl0gPSAxO1xuXG4gICAgb3V0LnNpemUgPSBNYXRoLmFicyhzaXplKTtcbiAgICBvdXQuc3RhcnQgPSAwO1xuICAgIG91dC5lbmQgPSBvdXQuc2l6ZTtcbn1cblxuZnVuY3Rpb24gY29udmVydExpbmVzKHJpbmdzLCBvdXQsIHRvbGVyYW5jZSwgaXNQb2x5Z29uKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCByaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZ2VvbSA9IFtdO1xuICAgICAgICBjb252ZXJ0TGluZShyaW5nc1tpXSwgZ2VvbSwgdG9sZXJhbmNlLCBpc1BvbHlnb24pO1xuICAgICAgICBvdXQucHVzaChnZW9tKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHByb2plY3RYKHgpIHtcbiAgICByZXR1cm4geCAvIDM2MCArIDAuNTtcbn1cblxuZnVuY3Rpb24gcHJvamVjdFkoeSkge1xuICAgIHZhciBzaW4gPSBNYXRoLnNpbih5ICogTWF0aC5QSSAvIDE4MCk7XG4gICAgdmFyIHkyID0gMC41IC0gMC4yNSAqIE1hdGgubG9nKCgxICsgc2luKSAvICgxIC0gc2luKSkgLyBNYXRoLlBJO1xuICAgIHJldHVybiB5MiA8IDAgPyAwIDogeTIgPiAxID8gMSA6IHkyO1xufVxuIiwiXG5pbXBvcnQgY3JlYXRlRmVhdHVyZSBmcm9tICcuL2ZlYXR1cmUnO1xuXG4vKiBjbGlwIGZlYXR1cmVzIGJldHdlZW4gdHdvIGF4aXMtcGFyYWxsZWwgbGluZXM6XG4gKiAgICAgfCAgICAgICAgfFxuICogIF9fX3xfX18gICAgIHwgICAgIC9cbiAqIC8gICB8ICAgXFxfX19ffF9fX18vXG4gKiAgICAgfCAgICAgICAgfFxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNsaXAoZmVhdHVyZXMsIHNjYWxlLCBrMSwgazIsIGF4aXMsIG1pbkFsbCwgbWF4QWxsLCBvcHRpb25zKSB7XG5cbiAgICBrMSAvPSBzY2FsZTtcbiAgICBrMiAvPSBzY2FsZTtcblxuICAgIGlmIChtaW5BbGwgPj0gazEgJiYgbWF4QWxsIDwgazIpIHJldHVybiBmZWF0dXJlczsgLy8gdHJpdmlhbCBhY2NlcHRcbiAgICBlbHNlIGlmIChtYXhBbGwgPCBrMSB8fCBtaW5BbGwgPj0gazIpIHJldHVybiBudWxsOyAvLyB0cml2aWFsIHJlamVjdFxuXG4gICAgdmFyIGNsaXBwZWQgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICB2YXIgZmVhdHVyZSA9IGZlYXR1cmVzW2ldO1xuICAgICAgICB2YXIgZ2VvbWV0cnkgPSBmZWF0dXJlLmdlb21ldHJ5O1xuICAgICAgICB2YXIgdHlwZSA9IGZlYXR1cmUudHlwZTtcblxuICAgICAgICB2YXIgbWluID0gYXhpcyA9PT0gMCA/IGZlYXR1cmUubWluWCA6IGZlYXR1cmUubWluWTtcbiAgICAgICAgdmFyIG1heCA9IGF4aXMgPT09IDAgPyBmZWF0dXJlLm1heFggOiBmZWF0dXJlLm1heFk7XG5cbiAgICAgICAgaWYgKG1pbiA+PSBrMSAmJiBtYXggPCBrMikgeyAvLyB0cml2aWFsIGFjY2VwdFxuICAgICAgICAgICAgY2xpcHBlZC5wdXNoKGZlYXR1cmUpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gZWxzZSBpZiAobWF4IDwgazEgfHwgbWluID49IGsyKSB7IC8vIHRyaXZpYWwgcmVqZWN0XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBuZXdHZW9tZXRyeSA9IFtdO1xuXG4gICAgICAgIGlmICh0eXBlID09PSAnUG9pbnQnIHx8IHR5cGUgPT09ICdNdWx0aVBvaW50Jykge1xuICAgICAgICAgICAgY2xpcFBvaW50cyhnZW9tZXRyeSwgbmV3R2VvbWV0cnksIGsxLCBrMiwgYXhpcyk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgICAgIGNsaXBMaW5lKGdlb21ldHJ5LCBuZXdHZW9tZXRyeSwgazEsIGsyLCBheGlzLCBmYWxzZSwgb3B0aW9ucy5saW5lTWV0cmljcyk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgY2xpcExpbmVzKGdlb21ldHJ5LCBuZXdHZW9tZXRyeSwgazEsIGsyLCBheGlzLCBmYWxzZSk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnUG9seWdvbicpIHtcbiAgICAgICAgICAgIGNsaXBMaW5lcyhnZW9tZXRyeSwgbmV3R2VvbWV0cnksIGsxLCBrMiwgYXhpcywgdHJ1ZSk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBnZW9tZXRyeS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciBwb2x5Z29uID0gW107XG4gICAgICAgICAgICAgICAgY2xpcExpbmVzKGdlb21ldHJ5W2pdLCBwb2x5Z29uLCBrMSwgazIsIGF4aXMsIHRydWUpO1xuICAgICAgICAgICAgICAgIGlmIChwb2x5Z29uLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBuZXdHZW9tZXRyeS5wdXNoKHBvbHlnb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZXdHZW9tZXRyeS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmxpbmVNZXRyaWNzICYmIHR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBuZXdHZW9tZXRyeS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjbGlwcGVkLnB1c2goY3JlYXRlRmVhdHVyZShmZWF0dXJlLmlkLCB0eXBlLCBuZXdHZW9tZXRyeVtqXSwgZmVhdHVyZS50YWdzKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ0xpbmVTdHJpbmcnIHx8IHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld0dlb21ldHJ5Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICB0eXBlID0gJ0xpbmVTdHJpbmcnO1xuICAgICAgICAgICAgICAgICAgICBuZXdHZW9tZXRyeSA9IG5ld0dlb21ldHJ5WzBdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSAnTXVsdGlMaW5lU3RyaW5nJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ1BvaW50JyB8fCB0eXBlID09PSAnTXVsdGlQb2ludCcpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gbmV3R2VvbWV0cnkubGVuZ3RoID09PSAzID8gJ1BvaW50JyA6ICdNdWx0aVBvaW50JztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2xpcHBlZC5wdXNoKGNyZWF0ZUZlYXR1cmUoZmVhdHVyZS5pZCwgdHlwZSwgbmV3R2VvbWV0cnksIGZlYXR1cmUudGFncykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNsaXBwZWQubGVuZ3RoID8gY2xpcHBlZCA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGNsaXBQb2ludHMoZ2VvbSwgbmV3R2VvbSwgazEsIGsyLCBheGlzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBnZW9tLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIHZhciBhID0gZ2VvbVtpICsgYXhpc107XG5cbiAgICAgICAgaWYgKGEgPj0gazEgJiYgYSA8PSBrMikge1xuICAgICAgICAgICAgbmV3R2VvbS5wdXNoKGdlb21baV0pO1xuICAgICAgICAgICAgbmV3R2VvbS5wdXNoKGdlb21baSArIDFdKTtcbiAgICAgICAgICAgIG5ld0dlb20ucHVzaChnZW9tW2kgKyAyXSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNsaXBMaW5lKGdlb20sIG5ld0dlb20sIGsxLCBrMiwgYXhpcywgaXNQb2x5Z29uLCB0cmFja01ldHJpY3MpIHtcblxuICAgIHZhciBzbGljZSA9IG5ld1NsaWNlKGdlb20pO1xuICAgIHZhciBpbnRlcnNlY3QgPSBheGlzID09PSAwID8gaW50ZXJzZWN0WCA6IGludGVyc2VjdFk7XG4gICAgdmFyIGxlbiA9IGdlb20uc3RhcnQ7XG4gICAgdmFyIHNlZ0xlbiwgdDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ2VvbS5sZW5ndGggLSAzOyBpICs9IDMpIHtcbiAgICAgICAgdmFyIGF4ID0gZ2VvbVtpXTtcbiAgICAgICAgdmFyIGF5ID0gZ2VvbVtpICsgMV07XG4gICAgICAgIHZhciBheiA9IGdlb21baSArIDJdO1xuICAgICAgICB2YXIgYnggPSBnZW9tW2kgKyAzXTtcbiAgICAgICAgdmFyIGJ5ID0gZ2VvbVtpICsgNF07XG4gICAgICAgIHZhciBhID0gYXhpcyA9PT0gMCA/IGF4IDogYXk7XG4gICAgICAgIHZhciBiID0gYXhpcyA9PT0gMCA/IGJ4IDogYnk7XG4gICAgICAgIHZhciBleGl0ZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodHJhY2tNZXRyaWNzKSBzZWdMZW4gPSBNYXRoLnNxcnQoTWF0aC5wb3coYXggLSBieCwgMikgKyBNYXRoLnBvdyhheSAtIGJ5LCAyKSk7XG5cbiAgICAgICAgaWYgKGEgPCBrMSkge1xuICAgICAgICAgICAgLy8gLS0tfC0tPiAgfCAobGluZSBlbnRlcnMgdGhlIGNsaXAgcmVnaW9uIGZyb20gdGhlIGxlZnQpXG4gICAgICAgICAgICBpZiAoYiA+IGsxKSB7XG4gICAgICAgICAgICAgICAgdCA9IGludGVyc2VjdChzbGljZSwgYXgsIGF5LCBieCwgYnksIGsxKTtcbiAgICAgICAgICAgICAgICBpZiAodHJhY2tNZXRyaWNzKSBzbGljZS5zdGFydCA9IGxlbiArIHNlZ0xlbiAqIHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYSA+IGsyKSB7XG4gICAgICAgICAgICAvLyB8ICA8LS18LS0tIChsaW5lIGVudGVycyB0aGUgY2xpcCByZWdpb24gZnJvbSB0aGUgcmlnaHQpXG4gICAgICAgICAgICBpZiAoYiA8IGsyKSB7XG4gICAgICAgICAgICAgICAgdCA9IGludGVyc2VjdChzbGljZSwgYXgsIGF5LCBieCwgYnksIGsyKTtcbiAgICAgICAgICAgICAgICBpZiAodHJhY2tNZXRyaWNzKSBzbGljZS5zdGFydCA9IGxlbiArIHNlZ0xlbiAqIHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhZGRQb2ludChzbGljZSwgYXgsIGF5LCBheik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGIgPCBrMSAmJiBhID49IGsxKSB7XG4gICAgICAgICAgICAvLyA8LS18LS0tICB8IG9yIDwtLXwtLS0tLXwtLS0gKGxpbmUgZXhpdHMgdGhlIGNsaXAgcmVnaW9uIG9uIHRoZSBsZWZ0KVxuICAgICAgICAgICAgdCA9IGludGVyc2VjdChzbGljZSwgYXgsIGF5LCBieCwgYnksIGsxKTtcbiAgICAgICAgICAgIGV4aXRlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGIgPiBrMiAmJiBhIDw9IGsyKSB7XG4gICAgICAgICAgICAvLyB8ICAtLS18LS0+IG9yIC0tLXwtLS0tLXwtLT4gKGxpbmUgZXhpdHMgdGhlIGNsaXAgcmVnaW9uIG9uIHRoZSByaWdodClcbiAgICAgICAgICAgIHQgPSBpbnRlcnNlY3Qoc2xpY2UsIGF4LCBheSwgYngsIGJ5LCBrMik7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc1BvbHlnb24gJiYgZXhpdGVkKSB7XG4gICAgICAgICAgICBpZiAodHJhY2tNZXRyaWNzKSBzbGljZS5lbmQgPSBsZW4gKyBzZWdMZW4gKiB0O1xuICAgICAgICAgICAgbmV3R2VvbS5wdXNoKHNsaWNlKTtcbiAgICAgICAgICAgIHNsaWNlID0gbmV3U2xpY2UoZ2VvbSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHJhY2tNZXRyaWNzKSBsZW4gKz0gc2VnTGVuO1xuICAgIH1cblxuICAgIC8vIGFkZCB0aGUgbGFzdCBwb2ludFxuICAgIHZhciBsYXN0ID0gZ2VvbS5sZW5ndGggLSAzO1xuICAgIGF4ID0gZ2VvbVtsYXN0XTtcbiAgICBheSA9IGdlb21bbGFzdCArIDFdO1xuICAgIGF6ID0gZ2VvbVtsYXN0ICsgMl07XG4gICAgYSA9IGF4aXMgPT09IDAgPyBheCA6IGF5O1xuICAgIGlmIChhID49IGsxICYmIGEgPD0gazIpIGFkZFBvaW50KHNsaWNlLCBheCwgYXksIGF6KTtcblxuICAgIC8vIGNsb3NlIHRoZSBwb2x5Z29uIGlmIGl0cyBlbmRwb2ludHMgYXJlIG5vdCB0aGUgc2FtZSBhZnRlciBjbGlwcGluZ1xuICAgIGxhc3QgPSBzbGljZS5sZW5ndGggLSAzO1xuICAgIGlmIChpc1BvbHlnb24gJiYgbGFzdCA+PSAzICYmIChzbGljZVtsYXN0XSAhPT0gc2xpY2VbMF0gfHwgc2xpY2VbbGFzdCArIDFdICE9PSBzbGljZVsxXSkpIHtcbiAgICAgICAgYWRkUG9pbnQoc2xpY2UsIHNsaWNlWzBdLCBzbGljZVsxXSwgc2xpY2VbMl0pO1xuICAgIH1cblxuICAgIC8vIGFkZCB0aGUgZmluYWwgc2xpY2VcbiAgICBpZiAoc2xpY2UubGVuZ3RoKSB7XG4gICAgICAgIG5ld0dlb20ucHVzaChzbGljZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBuZXdTbGljZShsaW5lKSB7XG4gICAgdmFyIHNsaWNlID0gW107XG4gICAgc2xpY2Uuc2l6ZSA9IGxpbmUuc2l6ZTtcbiAgICBzbGljZS5zdGFydCA9IGxpbmUuc3RhcnQ7XG4gICAgc2xpY2UuZW5kID0gbGluZS5lbmQ7XG4gICAgcmV0dXJuIHNsaWNlO1xufVxuXG5mdW5jdGlvbiBjbGlwTGluZXMoZ2VvbSwgbmV3R2VvbSwgazEsIGsyLCBheGlzLCBpc1BvbHlnb24pIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY2xpcExpbmUoZ2VvbVtpXSwgbmV3R2VvbSwgazEsIGsyLCBheGlzLCBpc1BvbHlnb24sIGZhbHNlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFkZFBvaW50KG91dCwgeCwgeSwgeikge1xuICAgIG91dC5wdXNoKHgpO1xuICAgIG91dC5wdXNoKHkpO1xuICAgIG91dC5wdXNoKHopO1xufVxuXG5mdW5jdGlvbiBpbnRlcnNlY3RYKG91dCwgYXgsIGF5LCBieCwgYnksIHgpIHtcbiAgICB2YXIgdCA9ICh4IC0gYXgpIC8gKGJ4IC0gYXgpO1xuICAgIG91dC5wdXNoKHgpO1xuICAgIG91dC5wdXNoKGF5ICsgKGJ5IC0gYXkpICogdCk7XG4gICAgb3V0LnB1c2goMSk7XG4gICAgcmV0dXJuIHQ7XG59XG5cbmZ1bmN0aW9uIGludGVyc2VjdFkob3V0LCBheCwgYXksIGJ4LCBieSwgeSkge1xuICAgIHZhciB0ID0gKHkgLSBheSkgLyAoYnkgLSBheSk7XG4gICAgb3V0LnB1c2goYXggKyAoYnggLSBheCkgKiB0KTtcbiAgICBvdXQucHVzaCh5KTtcbiAgICBvdXQucHVzaCgxKTtcbiAgICByZXR1cm4gdDtcbn1cbiIsIlxuaW1wb3J0IGNsaXAgZnJvbSAnLi9jbGlwJztcbmltcG9ydCBjcmVhdGVGZWF0dXJlIGZyb20gJy4vZmVhdHVyZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHdyYXAoZmVhdHVyZXMsIG9wdGlvbnMpIHtcbiAgICB2YXIgYnVmZmVyID0gb3B0aW9ucy5idWZmZXIgLyBvcHRpb25zLmV4dGVudDtcbiAgICB2YXIgbWVyZ2VkID0gZmVhdHVyZXM7XG4gICAgdmFyIGxlZnQgID0gY2xpcChmZWF0dXJlcywgMSwgLTEgLSBidWZmZXIsIGJ1ZmZlciwgICAgIDAsIC0xLCAyLCBvcHRpb25zKTsgLy8gbGVmdCB3b3JsZCBjb3B5XG4gICAgdmFyIHJpZ2h0ID0gY2xpcChmZWF0dXJlcywgMSwgIDEgLSBidWZmZXIsIDIgKyBidWZmZXIsIDAsIC0xLCAyLCBvcHRpb25zKTsgLy8gcmlnaHQgd29ybGQgY29weVxuXG4gICAgaWYgKGxlZnQgfHwgcmlnaHQpIHtcbiAgICAgICAgbWVyZ2VkID0gY2xpcChmZWF0dXJlcywgMSwgLWJ1ZmZlciwgMSArIGJ1ZmZlciwgMCwgLTEsIDIsIG9wdGlvbnMpIHx8IFtdOyAvLyBjZW50ZXIgd29ybGQgY29weVxuXG4gICAgICAgIGlmIChsZWZ0KSBtZXJnZWQgPSBzaGlmdEZlYXR1cmVDb29yZHMobGVmdCwgMSkuY29uY2F0KG1lcmdlZCk7IC8vIG1lcmdlIGxlZnQgaW50byBjZW50ZXJcbiAgICAgICAgaWYgKHJpZ2h0KSBtZXJnZWQgPSBtZXJnZWQuY29uY2F0KHNoaWZ0RmVhdHVyZUNvb3JkcyhyaWdodCwgLTEpKTsgLy8gbWVyZ2UgcmlnaHQgaW50byBjZW50ZXJcbiAgICB9XG5cbiAgICByZXR1cm4gbWVyZ2VkO1xufVxuXG5mdW5jdGlvbiBzaGlmdEZlYXR1cmVDb29yZHMoZmVhdHVyZXMsIG9mZnNldCkge1xuICAgIHZhciBuZXdGZWF0dXJlcyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZmVhdHVyZSA9IGZlYXR1cmVzW2ldLFxuICAgICAgICAgICAgdHlwZSA9IGZlYXR1cmUudHlwZTtcblxuICAgICAgICB2YXIgbmV3R2VvbWV0cnk7XG5cbiAgICAgICAgaWYgKHR5cGUgPT09ICdQb2ludCcgfHwgdHlwZSA9PT0gJ011bHRpUG9pbnQnIHx8IHR5cGUgPT09ICdMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgbmV3R2VvbWV0cnkgPSBzaGlmdENvb3JkcyhmZWF0dXJlLmdlb21ldHJ5LCBvZmZzZXQpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycgfHwgdHlwZSA9PT0gJ1BvbHlnb24nKSB7XG4gICAgICAgICAgICBuZXdHZW9tZXRyeSA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBmZWF0dXJlLmdlb21ldHJ5Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgbmV3R2VvbWV0cnkucHVzaChzaGlmdENvb3JkcyhmZWF0dXJlLmdlb21ldHJ5W2pdLCBvZmZzZXQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICAgICAgbmV3R2VvbWV0cnkgPSBbXTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBmZWF0dXJlLmdlb21ldHJ5Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5ld1BvbHlnb24gPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrID0gMDsgayA8IGZlYXR1cmUuZ2VvbWV0cnlbal0ubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3UG9seWdvbi5wdXNoKHNoaWZ0Q29vcmRzKGZlYXR1cmUuZ2VvbWV0cnlbal1ba10sIG9mZnNldCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBuZXdHZW9tZXRyeS5wdXNoKG5ld1BvbHlnb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbmV3RmVhdHVyZXMucHVzaChjcmVhdGVGZWF0dXJlKGZlYXR1cmUuaWQsIHR5cGUsIG5ld0dlb21ldHJ5LCBmZWF0dXJlLnRhZ3MpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3RmVhdHVyZXM7XG59XG5cbmZ1bmN0aW9uIHNoaWZ0Q29vcmRzKHBvaW50cywgb2Zmc2V0KSB7XG4gICAgdmFyIG5ld1BvaW50cyA9IFtdO1xuICAgIG5ld1BvaW50cy5zaXplID0gcG9pbnRzLnNpemU7XG5cbiAgICBpZiAocG9pbnRzLnN0YXJ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbmV3UG9pbnRzLnN0YXJ0ID0gcG9pbnRzLnN0YXJ0O1xuICAgICAgICBuZXdQb2ludHMuZW5kID0gcG9pbnRzLmVuZDtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICBuZXdQb2ludHMucHVzaChwb2ludHNbaV0gKyBvZmZzZXQsIHBvaW50c1tpICsgMV0sIHBvaW50c1tpICsgMl0pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UG9pbnRzO1xufVxuIiwiXG4vLyBUcmFuc2Zvcm1zIHRoZSBjb29yZGluYXRlcyBvZiBlYWNoIGZlYXR1cmUgaW4gdGhlIGdpdmVuIHRpbGUgZnJvbVxuLy8gbWVyY2F0b3ItcHJvamVjdGVkIHNwYWNlIGludG8gKGV4dGVudCB4IGV4dGVudCkgdGlsZSBzcGFjZS5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHRyYW5zZm9ybVRpbGUodGlsZSwgZXh0ZW50KSB7XG4gICAgaWYgKHRpbGUudHJhbnNmb3JtZWQpIHJldHVybiB0aWxlO1xuXG4gICAgdmFyIHoyID0gMSA8PCB0aWxlLnosXG4gICAgICAgIHR4ID0gdGlsZS54LFxuICAgICAgICB0eSA9IHRpbGUueSxcbiAgICAgICAgaSwgaiwgaztcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0aWxlLmZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBmZWF0dXJlID0gdGlsZS5mZWF0dXJlc1tpXSxcbiAgICAgICAgICAgIGdlb20gPSBmZWF0dXJlLmdlb21ldHJ5LFxuICAgICAgICAgICAgdHlwZSA9IGZlYXR1cmUudHlwZTtcblxuICAgICAgICBmZWF0dXJlLmdlb21ldHJ5ID0gW107XG5cbiAgICAgICAgaWYgKHR5cGUgPT09IDEpIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBnZW9tLmxlbmd0aDsgaiArPSAyKSB7XG4gICAgICAgICAgICAgICAgZmVhdHVyZS5nZW9tZXRyeS5wdXNoKHRyYW5zZm9ybVBvaW50KGdlb21bal0sIGdlb21baiArIDFdLCBleHRlbnQsIHoyLCB0eCwgdHkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBnZW9tLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJpbmcgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwgZ2VvbVtqXS5sZW5ndGg7IGsgKz0gMikge1xuICAgICAgICAgICAgICAgICAgICByaW5nLnB1c2godHJhbnNmb3JtUG9pbnQoZ2VvbVtqXVtrXSwgZ2VvbVtqXVtrICsgMV0sIGV4dGVudCwgejIsIHR4LCB0eSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmZWF0dXJlLmdlb21ldHJ5LnB1c2gocmluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aWxlLnRyYW5zZm9ybWVkID0gdHJ1ZTtcblxuICAgIHJldHVybiB0aWxlO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Qb2ludCh4LCB5LCBleHRlbnQsIHoyLCB0eCwgdHkpIHtcbiAgICByZXR1cm4gW1xuICAgICAgICBNYXRoLnJvdW5kKGV4dGVudCAqICh4ICogejIgLSB0eCkpLFxuICAgICAgICBNYXRoLnJvdW5kKGV4dGVudCAqICh5ICogejIgLSB0eSkpXTtcbn1cbiIsIlxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY3JlYXRlVGlsZShmZWF0dXJlcywgeiwgdHgsIHR5LCBvcHRpb25zKSB7XG4gICAgdmFyIHRvbGVyYW5jZSA9IHogPT09IG9wdGlvbnMubWF4Wm9vbSA/IDAgOiBvcHRpb25zLnRvbGVyYW5jZSAvICgoMSA8PCB6KSAqIG9wdGlvbnMuZXh0ZW50KTtcbiAgICB2YXIgdGlsZSA9IHtcbiAgICAgICAgZmVhdHVyZXM6IFtdLFxuICAgICAgICBudW1Qb2ludHM6IDAsXG4gICAgICAgIG51bVNpbXBsaWZpZWQ6IDAsXG4gICAgICAgIG51bUZlYXR1cmVzOiAwLFxuICAgICAgICBzb3VyY2U6IG51bGwsXG4gICAgICAgIHg6IHR4LFxuICAgICAgICB5OiB0eSxcbiAgICAgICAgejogeixcbiAgICAgICAgdHJhbnNmb3JtZWQ6IGZhbHNlLFxuICAgICAgICBtaW5YOiAyLFxuICAgICAgICBtaW5ZOiAxLFxuICAgICAgICBtYXhYOiAtMSxcbiAgICAgICAgbWF4WTogMFxuICAgIH07XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aWxlLm51bUZlYXR1cmVzKys7XG4gICAgICAgIGFkZEZlYXR1cmUodGlsZSwgZmVhdHVyZXNbaV0sIHRvbGVyYW5jZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIG1pblggPSBmZWF0dXJlc1tpXS5taW5YO1xuICAgICAgICB2YXIgbWluWSA9IGZlYXR1cmVzW2ldLm1pblk7XG4gICAgICAgIHZhciBtYXhYID0gZmVhdHVyZXNbaV0ubWF4WDtcbiAgICAgICAgdmFyIG1heFkgPSBmZWF0dXJlc1tpXS5tYXhZO1xuXG4gICAgICAgIGlmIChtaW5YIDwgdGlsZS5taW5YKSB0aWxlLm1pblggPSBtaW5YO1xuICAgICAgICBpZiAobWluWSA8IHRpbGUubWluWSkgdGlsZS5taW5ZID0gbWluWTtcbiAgICAgICAgaWYgKG1heFggPiB0aWxlLm1heFgpIHRpbGUubWF4WCA9IG1heFg7XG4gICAgICAgIGlmIChtYXhZID4gdGlsZS5tYXhZKSB0aWxlLm1heFkgPSBtYXhZO1xuICAgIH1cbiAgICByZXR1cm4gdGlsZTtcbn1cblxuZnVuY3Rpb24gYWRkRmVhdHVyZSh0aWxlLCBmZWF0dXJlLCB0b2xlcmFuY2UsIG9wdGlvbnMpIHtcblxuICAgIHZhciBnZW9tID0gZmVhdHVyZS5nZW9tZXRyeSxcbiAgICAgICAgdHlwZSA9IGZlYXR1cmUudHlwZSxcbiAgICAgICAgc2ltcGxpZmllZCA9IFtdO1xuXG4gICAgaWYgKHR5cGUgPT09ICdQb2ludCcgfHwgdHlwZSA9PT0gJ011bHRpUG9pbnQnKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ2VvbS5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICAgICAgc2ltcGxpZmllZC5wdXNoKGdlb21baV0pO1xuICAgICAgICAgICAgc2ltcGxpZmllZC5wdXNoKGdlb21baSArIDFdKTtcbiAgICAgICAgICAgIHRpbGUubnVtUG9pbnRzKys7XG4gICAgICAgICAgICB0aWxlLm51bVNpbXBsaWZpZWQrKztcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgYWRkTGluZShzaW1wbGlmaWVkLCBnZW9tLCB0aWxlLCB0b2xlcmFuY2UsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnIHx8IHR5cGUgPT09ICdQb2x5Z29uJykge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZ2VvbS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWRkTGluZShzaW1wbGlmaWVkLCBnZW9tW2ldLCB0aWxlLCB0b2xlcmFuY2UsIHR5cGUgPT09ICdQb2x5Z29uJywgaSA9PT0gMCk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpUG9seWdvbicpIHtcblxuICAgICAgICBmb3IgKHZhciBrID0gMDsgayA8IGdlb20ubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgIHZhciBwb2x5Z29uID0gZ2VvbVtrXTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwb2x5Z29uLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYWRkTGluZShzaW1wbGlmaWVkLCBwb2x5Z29uW2ldLCB0aWxlLCB0b2xlcmFuY2UsIHRydWUsIGkgPT09IDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNpbXBsaWZpZWQubGVuZ3RoKSB7XG4gICAgICAgIHZhciB0YWdzID0gZmVhdHVyZS50YWdzIHx8IG51bGw7XG4gICAgICAgIGlmICh0eXBlID09PSAnTGluZVN0cmluZycgJiYgb3B0aW9ucy5saW5lTWV0cmljcykge1xuICAgICAgICAgICAgdGFncyA9IHt9O1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGZlYXR1cmUudGFncykgdGFnc1trZXldID0gZmVhdHVyZS50YWdzW2tleV07XG4gICAgICAgICAgICB0YWdzWydtYXBib3hfY2xpcF9zdGFydCddID0gZ2VvbS5zdGFydCAvIGdlb20uc2l6ZTtcbiAgICAgICAgICAgIHRhZ3NbJ21hcGJveF9jbGlwX2VuZCddID0gZ2VvbS5lbmQgLyBnZW9tLnNpemU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHRpbGVGZWF0dXJlID0ge1xuICAgICAgICAgICAgZ2VvbWV0cnk6IHNpbXBsaWZpZWQsXG4gICAgICAgICAgICB0eXBlOiB0eXBlID09PSAnUG9seWdvbicgfHwgdHlwZSA9PT0gJ011bHRpUG9seWdvbicgPyAzIDpcbiAgICAgICAgICAgICAgICB0eXBlID09PSAnTGluZVN0cmluZycgfHwgdHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycgPyAyIDogMSxcbiAgICAgICAgICAgIHRhZ3M6IHRhZ3NcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGZlYXR1cmUuaWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRpbGVGZWF0dXJlLmlkID0gZmVhdHVyZS5pZDtcbiAgICAgICAgfVxuICAgICAgICB0aWxlLmZlYXR1cmVzLnB1c2godGlsZUZlYXR1cmUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gYWRkTGluZShyZXN1bHQsIGdlb20sIHRpbGUsIHRvbGVyYW5jZSwgaXNQb2x5Z29uLCBpc091dGVyKSB7XG4gICAgdmFyIHNxVG9sZXJhbmNlID0gdG9sZXJhbmNlICogdG9sZXJhbmNlO1xuXG4gICAgaWYgKHRvbGVyYW5jZSA+IDAgJiYgKGdlb20uc2l6ZSA8IChpc1BvbHlnb24gPyBzcVRvbGVyYW5jZSA6IHRvbGVyYW5jZSkpKSB7XG4gICAgICAgIHRpbGUubnVtUG9pbnRzICs9IGdlb20ubGVuZ3RoIC8gMztcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciByaW5nID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20ubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgaWYgKHRvbGVyYW5jZSA9PT0gMCB8fCBnZW9tW2kgKyAyXSA+IHNxVG9sZXJhbmNlKSB7XG4gICAgICAgICAgICB0aWxlLm51bVNpbXBsaWZpZWQrKztcbiAgICAgICAgICAgIHJpbmcucHVzaChnZW9tW2ldKTtcbiAgICAgICAgICAgIHJpbmcucHVzaChnZW9tW2kgKyAxXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGlsZS5udW1Qb2ludHMrKztcbiAgICB9XG5cbiAgICBpZiAoaXNQb2x5Z29uKSByZXdpbmQocmluZywgaXNPdXRlcik7XG5cbiAgICByZXN1bHQucHVzaChyaW5nKTtcbn1cblxuZnVuY3Rpb24gcmV3aW5kKHJpbmcsIGNsb2Nrd2lzZSkge1xuICAgIHZhciBhcmVhID0gMDtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmluZy5sZW5ndGgsIGogPSBsZW4gLSAyOyBpIDwgbGVuOyBqID0gaSwgaSArPSAyKSB7XG4gICAgICAgIGFyZWEgKz0gKHJpbmdbaV0gLSByaW5nW2pdKSAqIChyaW5nW2kgKyAxXSArIHJpbmdbaiArIDFdKTtcbiAgICB9XG4gICAgaWYgKGFyZWEgPiAwID09PSBjbG9ja3dpc2UpIHtcbiAgICAgICAgZm9yIChpID0gMCwgbGVuID0gcmluZy5sZW5ndGg7IGkgPCBsZW4gLyAyOyBpICs9IDIpIHtcbiAgICAgICAgICAgIHZhciB4ID0gcmluZ1tpXTtcbiAgICAgICAgICAgIHZhciB5ID0gcmluZ1tpICsgMV07XG4gICAgICAgICAgICByaW5nW2ldID0gcmluZ1tsZW4gLSAyIC0gaV07XG4gICAgICAgICAgICByaW5nW2kgKyAxXSA9IHJpbmdbbGVuIC0gMSAtIGldO1xuICAgICAgICAgICAgcmluZ1tsZW4gLSAyIC0gaV0gPSB4O1xuICAgICAgICAgICAgcmluZ1tsZW4gLSAxIC0gaV0gPSB5O1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiXG5pbXBvcnQgY29udmVydCBmcm9tICcuL2NvbnZlcnQnOyAgICAgLy8gR2VvSlNPTiBjb252ZXJzaW9uIGFuZCBwcmVwcm9jZXNzaW5nXG5pbXBvcnQgY2xpcCBmcm9tICcuL2NsaXAnOyAgICAgICAgICAgLy8gc3RyaXBlIGNsaXBwaW5nIGFsZ29yaXRobVxuaW1wb3J0IHdyYXAgZnJvbSAnLi93cmFwJzsgICAgICAgICAgIC8vIGRhdGUgbGluZSBwcm9jZXNzaW5nXG5pbXBvcnQgdHJhbnNmb3JtIGZyb20gJy4vdHJhbnNmb3JtJzsgLy8gY29vcmRpbmF0ZSB0cmFuc2Zvcm1hdGlvblxuaW1wb3J0IGNyZWF0ZVRpbGUgZnJvbSAnLi90aWxlJzsgICAgIC8vIGZpbmFsIHNpbXBsaWZpZWQgdGlsZSBnZW5lcmF0aW9uXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdlb2pzb252dChkYXRhLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBHZW9KU09OVlQoZGF0YSwgb3B0aW9ucyk7XG59XG5cbmZ1bmN0aW9uIEdlb0pTT05WVChkYXRhLCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IHRoaXMub3B0aW9ucyA9IGV4dGVuZChPYmplY3QuY3JlYXRlKHRoaXMub3B0aW9ucyksIG9wdGlvbnMpO1xuXG4gICAgdmFyIGRlYnVnID0gb3B0aW9ucy5kZWJ1ZztcblxuICAgIGlmIChkZWJ1ZykgY29uc29sZS50aW1lKCdwcmVwcm9jZXNzIGRhdGEnKTtcblxuICAgIGlmIChvcHRpb25zLm1heFpvb20gPCAwIHx8IG9wdGlvbnMubWF4Wm9vbSA+IDI0KSB0aHJvdyBuZXcgRXJyb3IoJ21heFpvb20gc2hvdWxkIGJlIGluIHRoZSAwLTI0IHJhbmdlJyk7XG4gICAgaWYgKG9wdGlvbnMucHJvbW90ZUlkICYmIG9wdGlvbnMuZ2VuZXJhdGVJZCkgdGhyb3cgbmV3IEVycm9yKCdwcm9tb3RlSWQgYW5kIGdlbmVyYXRlSWQgY2Fubm90IGJlIHVzZWQgdG9nZXRoZXIuJyk7XG5cbiAgICB2YXIgZmVhdHVyZXMgPSBjb252ZXJ0KGRhdGEsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy50aWxlcyA9IHt9O1xuICAgIHRoaXMudGlsZUNvb3JkcyA9IFtdO1xuXG4gICAgaWYgKGRlYnVnKSB7XG4gICAgICAgIGNvbnNvbGUudGltZUVuZCgncHJlcHJvY2VzcyBkYXRhJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdpbmRleDogbWF4Wm9vbTogJWQsIG1heFBvaW50czogJWQnLCBvcHRpb25zLmluZGV4TWF4Wm9vbSwgb3B0aW9ucy5pbmRleE1heFBvaW50cyk7XG4gICAgICAgIGNvbnNvbGUudGltZSgnZ2VuZXJhdGUgdGlsZXMnKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IHt9O1xuICAgICAgICB0aGlzLnRvdGFsID0gMDtcbiAgICB9XG5cbiAgICBmZWF0dXJlcyA9IHdyYXAoZmVhdHVyZXMsIG9wdGlvbnMpO1xuXG4gICAgLy8gc3RhcnQgc2xpY2luZyBmcm9tIHRoZSB0b3AgdGlsZSBkb3duXG4gICAgaWYgKGZlYXR1cmVzLmxlbmd0aCkgdGhpcy5zcGxpdFRpbGUoZmVhdHVyZXMsIDAsIDAsIDApO1xuXG4gICAgaWYgKGRlYnVnKSB7XG4gICAgICAgIGlmIChmZWF0dXJlcy5sZW5ndGgpIGNvbnNvbGUubG9nKCdmZWF0dXJlczogJWQsIHBvaW50czogJWQnLCB0aGlzLnRpbGVzWzBdLm51bUZlYXR1cmVzLCB0aGlzLnRpbGVzWzBdLm51bVBvaW50cyk7XG4gICAgICAgIGNvbnNvbGUudGltZUVuZCgnZ2VuZXJhdGUgdGlsZXMnKTtcbiAgICAgICAgY29uc29sZS5sb2coJ3RpbGVzIGdlbmVyYXRlZDonLCB0aGlzLnRvdGFsLCBKU09OLnN0cmluZ2lmeSh0aGlzLnN0YXRzKSk7XG4gICAgfVxufVxuXG5HZW9KU09OVlQucHJvdG90eXBlLm9wdGlvbnMgPSB7XG4gICAgbWF4Wm9vbTogMTQsICAgICAgICAgICAgLy8gbWF4IHpvb20gdG8gcHJlc2VydmUgZGV0YWlsIG9uXG4gICAgaW5kZXhNYXhab29tOiA1LCAgICAgICAgLy8gbWF4IHpvb20gaW4gdGhlIHRpbGUgaW5kZXhcbiAgICBpbmRleE1heFBvaW50czogMTAwMDAwLCAvLyBtYXggbnVtYmVyIG9mIHBvaW50cyBwZXIgdGlsZSBpbiB0aGUgdGlsZSBpbmRleFxuICAgIHRvbGVyYW5jZTogMywgICAgICAgICAgIC8vIHNpbXBsaWZpY2F0aW9uIHRvbGVyYW5jZSAoaGlnaGVyIG1lYW5zIHNpbXBsZXIpXG4gICAgZXh0ZW50OiA0MDk2LCAgICAgICAgICAgLy8gdGlsZSBleHRlbnRcbiAgICBidWZmZXI6IDY0LCAgICAgICAgICAgICAvLyB0aWxlIGJ1ZmZlciBvbiBlYWNoIHNpZGVcbiAgICBsaW5lTWV0cmljczogZmFsc2UsICAgICAvLyB3aGV0aGVyIHRvIGNhbGN1bGF0ZSBsaW5lIG1ldHJpY3NcbiAgICBwcm9tb3RlSWQ6IG51bGwsICAgICAgICAvLyBuYW1lIG9mIGEgZmVhdHVyZSBwcm9wZXJ0eSB0byBiZSBwcm9tb3RlZCB0byBmZWF0dXJlLmlkXG4gICAgZ2VuZXJhdGVJZDogZmFsc2UsICAgICAgLy8gd2hldGhlciB0byBnZW5lcmF0ZSBmZWF0dXJlIGlkcy4gQ2Fubm90IGJlIHVzZWQgd2l0aCBwcm9tb3RlSWRcbiAgICBkZWJ1ZzogMCAgICAgICAgICAgICAgICAvLyBsb2dnaW5nIGxldmVsICgwLCAxIG9yIDIpXG59O1xuXG5HZW9KU09OVlQucHJvdG90eXBlLnNwbGl0VGlsZSA9IGZ1bmN0aW9uIChmZWF0dXJlcywgeiwgeCwgeSwgY3osIGN4LCBjeSkge1xuXG4gICAgdmFyIHN0YWNrID0gW2ZlYXR1cmVzLCB6LCB4LCB5XSxcbiAgICAgICAgb3B0aW9ucyA9IHRoaXMub3B0aW9ucyxcbiAgICAgICAgZGVidWcgPSBvcHRpb25zLmRlYnVnO1xuXG4gICAgLy8gYXZvaWQgcmVjdXJzaW9uIGJ5IHVzaW5nIGEgcHJvY2Vzc2luZyBxdWV1ZVxuICAgIHdoaWxlIChzdGFjay5sZW5ndGgpIHtcbiAgICAgICAgeSA9IHN0YWNrLnBvcCgpO1xuICAgICAgICB4ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIHogPSBzdGFjay5wb3AoKTtcbiAgICAgICAgZmVhdHVyZXMgPSBzdGFjay5wb3AoKTtcblxuICAgICAgICB2YXIgejIgPSAxIDw8IHosXG4gICAgICAgICAgICBpZCA9IHRvSUQoeiwgeCwgeSksXG4gICAgICAgICAgICB0aWxlID0gdGhpcy50aWxlc1tpZF07XG5cbiAgICAgICAgaWYgKCF0aWxlKSB7XG4gICAgICAgICAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLnRpbWUoJ2NyZWF0aW9uJyk7XG5cbiAgICAgICAgICAgIHRpbGUgPSB0aGlzLnRpbGVzW2lkXSA9IGNyZWF0ZVRpbGUoZmVhdHVyZXMsIHosIHgsIHksIG9wdGlvbnMpO1xuICAgICAgICAgICAgdGhpcy50aWxlQ29vcmRzLnB1c2goe3o6IHosIHg6IHgsIHk6IHl9KTtcblxuICAgICAgICAgICAgaWYgKGRlYnVnKSB7XG4gICAgICAgICAgICAgICAgaWYgKGRlYnVnID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlsZSB6JWQtJWQtJWQgKGZlYXR1cmVzOiAlZCwgcG9pbnRzOiAlZCwgc2ltcGxpZmllZDogJWQpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHosIHgsIHksIHRpbGUubnVtRmVhdHVyZXMsIHRpbGUubnVtUG9pbnRzLCB0aWxlLm51bVNpbXBsaWZpZWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLnRpbWVFbmQoJ2NyZWF0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBrZXkgPSAneicgKyB6O1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHNba2V5XSA9ICh0aGlzLnN0YXRzW2tleV0gfHwgMCkgKyAxO1xuICAgICAgICAgICAgICAgIHRoaXMudG90YWwrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIGdlb21ldHJ5IGluIHRpbGUgc28gdGhhdCB3ZSBjYW4gZHJpbGwgZG93biBsYXRlciBpZiB3ZSBzdG9wIG5vd1xuICAgICAgICB0aWxlLnNvdXJjZSA9IGZlYXR1cmVzO1xuXG4gICAgICAgIC8vIGlmIGl0J3MgdGhlIGZpcnN0LXBhc3MgdGlsaW5nXG4gICAgICAgIGlmICghY3opIHtcbiAgICAgICAgICAgIC8vIHN0b3AgdGlsaW5nIGlmIHdlIHJlYWNoZWQgbWF4IHpvb20sIG9yIGlmIHRoZSB0aWxlIGlzIHRvbyBzaW1wbGVcbiAgICAgICAgICAgIGlmICh6ID09PSBvcHRpb25zLmluZGV4TWF4Wm9vbSB8fCB0aWxlLm51bVBvaW50cyA8PSBvcHRpb25zLmluZGV4TWF4UG9pbnRzKSBjb250aW51ZTtcblxuICAgICAgICAvLyBpZiBhIGRyaWxsZG93biB0byBhIHNwZWNpZmljIHRpbGVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHN0b3AgdGlsaW5nIGlmIHdlIHJlYWNoZWQgYmFzZSB6b29tIG9yIG91ciB0YXJnZXQgdGlsZSB6b29tXG4gICAgICAgICAgICBpZiAoeiA9PT0gb3B0aW9ucy5tYXhab29tIHx8IHogPT09IGN6KSBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gc3RvcCB0aWxpbmcgaWYgaXQncyBub3QgYW4gYW5jZXN0b3Igb2YgdGhlIHRhcmdldCB0aWxlXG4gICAgICAgICAgICB2YXIgbSA9IDEgPDwgKGN6IC0geik7XG4gICAgICAgICAgICBpZiAoeCAhPT0gTWF0aC5mbG9vcihjeCAvIG0pIHx8IHkgIT09IE1hdGguZmxvb3IoY3kgLyBtKSkgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSBzbGljZSBmdXJ0aGVyIGRvd24sIG5vIG5lZWQgdG8ga2VlcCBzb3VyY2UgZ2VvbWV0cnlcbiAgICAgICAgdGlsZS5zb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIGlmIChmZWF0dXJlcy5sZW5ndGggPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICAgIGlmIChkZWJ1ZyA+IDEpIGNvbnNvbGUudGltZSgnY2xpcHBpbmcnKTtcblxuICAgICAgICAvLyB2YWx1ZXMgd2UnbGwgdXNlIGZvciBjbGlwcGluZ1xuICAgICAgICB2YXIgazEgPSAwLjUgKiBvcHRpb25zLmJ1ZmZlciAvIG9wdGlvbnMuZXh0ZW50LFxuICAgICAgICAgICAgazIgPSAwLjUgLSBrMSxcbiAgICAgICAgICAgIGszID0gMC41ICsgazEsXG4gICAgICAgICAgICBrNCA9IDEgKyBrMSxcbiAgICAgICAgICAgIHRsLCBibCwgdHIsIGJyLCBsZWZ0LCByaWdodDtcblxuICAgICAgICB0bCA9IGJsID0gdHIgPSBiciA9IG51bGw7XG5cbiAgICAgICAgbGVmdCAgPSBjbGlwKGZlYXR1cmVzLCB6MiwgeCAtIGsxLCB4ICsgazMsIDAsIHRpbGUubWluWCwgdGlsZS5tYXhYLCBvcHRpb25zKTtcbiAgICAgICAgcmlnaHQgPSBjbGlwKGZlYXR1cmVzLCB6MiwgeCArIGsyLCB4ICsgazQsIDAsIHRpbGUubWluWCwgdGlsZS5tYXhYLCBvcHRpb25zKTtcbiAgICAgICAgZmVhdHVyZXMgPSBudWxsO1xuXG4gICAgICAgIGlmIChsZWZ0KSB7XG4gICAgICAgICAgICB0bCA9IGNsaXAobGVmdCwgejIsIHkgLSBrMSwgeSArIGszLCAxLCB0aWxlLm1pblksIHRpbGUubWF4WSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBibCA9IGNsaXAobGVmdCwgejIsIHkgKyBrMiwgeSArIGs0LCAxLCB0aWxlLm1pblksIHRpbGUubWF4WSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBsZWZ0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyaWdodCkge1xuICAgICAgICAgICAgdHIgPSBjbGlwKHJpZ2h0LCB6MiwgeSAtIGsxLCB5ICsgazMsIDEsIHRpbGUubWluWSwgdGlsZS5tYXhZLCBvcHRpb25zKTtcbiAgICAgICAgICAgIGJyID0gY2xpcChyaWdodCwgejIsIHkgKyBrMiwgeSArIGs0LCAxLCB0aWxlLm1pblksIHRpbGUubWF4WSwgb3B0aW9ucyk7XG4gICAgICAgICAgICByaWdodCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLnRpbWVFbmQoJ2NsaXBwaW5nJyk7XG5cbiAgICAgICAgc3RhY2sucHVzaCh0bCB8fCBbXSwgeiArIDEsIHggKiAyLCAgICAgeSAqIDIpO1xuICAgICAgICBzdGFjay5wdXNoKGJsIHx8IFtdLCB6ICsgMSwgeCAqIDIsICAgICB5ICogMiArIDEpO1xuICAgICAgICBzdGFjay5wdXNoKHRyIHx8IFtdLCB6ICsgMSwgeCAqIDIgKyAxLCB5ICogMik7XG4gICAgICAgIHN0YWNrLnB1c2goYnIgfHwgW10sIHogKyAxLCB4ICogMiArIDEsIHkgKiAyICsgMSk7XG4gICAgfVxufTtcblxuR2VvSlNPTlZULnByb3RvdHlwZS5nZXRUaWxlID0gZnVuY3Rpb24gKHosIHgsIHkpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHRoaXMub3B0aW9ucyxcbiAgICAgICAgZXh0ZW50ID0gb3B0aW9ucy5leHRlbnQsXG4gICAgICAgIGRlYnVnID0gb3B0aW9ucy5kZWJ1ZztcblxuICAgIGlmICh6IDwgMCB8fCB6ID4gMjQpIHJldHVybiBudWxsO1xuXG4gICAgdmFyIHoyID0gMSA8PCB6O1xuICAgIHggPSAoKHggJSB6MikgKyB6MikgJSB6MjsgLy8gd3JhcCB0aWxlIHggY29vcmRpbmF0ZVxuXG4gICAgdmFyIGlkID0gdG9JRCh6LCB4LCB5KTtcbiAgICBpZiAodGhpcy50aWxlc1tpZF0pIHJldHVybiB0cmFuc2Zvcm0odGhpcy50aWxlc1tpZF0sIGV4dGVudCk7XG5cbiAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLmxvZygnZHJpbGxpbmcgZG93biB0byB6JWQtJWQtJWQnLCB6LCB4LCB5KTtcblxuICAgIHZhciB6MCA9IHosXG4gICAgICAgIHgwID0geCxcbiAgICAgICAgeTAgPSB5LFxuICAgICAgICBwYXJlbnQ7XG5cbiAgICB3aGlsZSAoIXBhcmVudCAmJiB6MCA+IDApIHtcbiAgICAgICAgejAtLTtcbiAgICAgICAgeDAgPSBNYXRoLmZsb29yKHgwIC8gMik7XG4gICAgICAgIHkwID0gTWF0aC5mbG9vcih5MCAvIDIpO1xuICAgICAgICBwYXJlbnQgPSB0aGlzLnRpbGVzW3RvSUQoejAsIHgwLCB5MCldO1xuICAgIH1cblxuICAgIGlmICghcGFyZW50IHx8ICFwYXJlbnQuc291cmNlKSByZXR1cm4gbnVsbDtcblxuICAgIC8vIGlmIHdlIGZvdW5kIGEgcGFyZW50IHRpbGUgY29udGFpbmluZyB0aGUgb3JpZ2luYWwgZ2VvbWV0cnksIHdlIGNhbiBkcmlsbCBkb3duIGZyb20gaXRcbiAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLmxvZygnZm91bmQgcGFyZW50IHRpbGUgeiVkLSVkLSVkJywgejAsIHgwLCB5MCk7XG5cbiAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLnRpbWUoJ2RyaWxsaW5nIGRvd24nKTtcbiAgICB0aGlzLnNwbGl0VGlsZShwYXJlbnQuc291cmNlLCB6MCwgeDAsIHkwLCB6LCB4LCB5KTtcbiAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLnRpbWVFbmQoJ2RyaWxsaW5nIGRvd24nKTtcblxuICAgIHJldHVybiB0aGlzLnRpbGVzW2lkXSA/IHRyYW5zZm9ybSh0aGlzLnRpbGVzW2lkXSwgZXh0ZW50KSA6IG51bGw7XG59O1xuXG5mdW5jdGlvbiB0b0lEKHosIHgsIHkpIHtcbiAgICByZXR1cm4gKCgoMSA8PCB6KSAqIHkgKyB4KSAqIDMyKSArIHo7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChkZXN0LCBzcmMpIHtcbiAgICBmb3IgKHZhciBpIGluIHNyYykgZGVzdFtpXSA9IHNyY1tpXTtcbiAgICByZXR1cm4gZGVzdDtcbn1cbiIsbnVsbCxudWxsXSwibmFtZXMiOlsicmVmUHJvcGVydGllcyIsImNyZWF0ZVN0eWxlTGF5ZXIiLCJmZWF0dXJlRmlsdGVyIiwicG90cGFjayIsIkFscGhhSW1hZ2UiLCJyZWdpc3RlciIsIk92ZXJzY2FsZWRUaWxlSUQiLCJDb2xsaXNpb25Cb3hBcnJheSIsIkRpY3Rpb25hcnlDb2RlciIsIkZlYXR1cmVJbmRleCIsIndhcm5PbmNlIiwiYXNzZXJ0IiwibWFwT2JqZWN0IiwiSW1hZ2VBdGxhcyIsIlN5bWJvbEJ1Y2tldCIsInBlcmZvcm1TeW1ib2xMYXlvdXQiLCJMaW5lQnVja2V0IiwiRmlsbEJ1Y2tldCIsIkZpbGxFeHRydXNpb25CdWNrZXQiLCJFdmFsdWF0aW9uUGFyYW1ldGVycyIsImdldEFycmF5QnVmZmVyIiwidnQiLCJQcm90b2J1ZiIsIlJlcXVlc3RQZXJmb3JtYW5jZSIsImV4dGVuZCIsImlzSW1hZ2VCaXRtYXAiLCJERU1EYXRhIiwiUkdCQUltYWdlIiwicmV3aW5kIiwibXZ0IiwiRmVhdHVyZVdyYXBwZXIiLCJFWFRFTlQiLCJQb2ludCIsIkdlb0pTT05XcmFwcGVyIiwicmVxdWlyZSQkMCIsInJlcXVpcmUkJDEiLCJ2dFBiZk1vZHVsZSIsInZ0UGJmIiwic29ydCIsInRyYW5zZm9ybSIsImNyZWF0ZUV4cHJlc3Npb24iLCJnZXRKU09OIiwiQWN0b3IiLCJnbG9iYWxSVExUZXh0UGx1Z2luIiwiZW5mb3JjZUNhY2hlU2l6ZUxpbWl0Il0sIm1hcHBpbmdzIjoiOztBQUdBLFNBQVMsU0FBUyxDQUFDLEdBQUcsRUFBQTtBQUNsQixJQUFBLE1BQU0sSUFBSSxHQUFHLE9BQU8sR0FBRyxDQUFDO0FBQ3hCLElBQUEsSUFBSSxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxLQUFLLFFBQVEsSUFBSSxHQUFHLEtBQUssU0FBUyxJQUFJLEdBQUcsS0FBSyxJQUFJO0FBQ2pHLFFBQUEsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBRS9CLElBQUEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ3BCLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNkLFFBQUEsS0FBSyxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFDbkIsWUFBQSxHQUFHLElBQUksQ0FBRyxFQUFBLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0FBQy9CLFNBQUE7UUFDRCxPQUFPLENBQUEsRUFBRyxHQUFHLENBQUEsQ0FBQSxDQUFHLENBQUM7QUFDcEIsS0FBQTtJQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFckMsSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2QsSUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNsQyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQSxDQUFBLENBQUcsQ0FBQztBQUNuRSxLQUFBO0lBQ0QsT0FBTyxDQUFBLEVBQUcsR0FBRyxDQUFBLENBQUEsQ0FBRyxDQUFDO0FBQ3JCLENBQUM7QUFFRCxTQUFTLE1BQU0sQ0FBQyxLQUFLLEVBQUE7SUFDakIsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ2IsSUFBQSxLQUFLLE1BQU0sQ0FBQyxJQUFJQSx5QkFBYSxFQUFFO1FBQzNCLEdBQUcsSUFBSSxDQUFJLENBQUEsRUFBQSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUEsQ0FBRSxDQUFDO0FBQ3BDLEtBQUE7QUFDRCxJQUFBLE9BQU8sR0FBRyxDQUFDO0FBQ2YsQ0FBQztBQUlEOzs7Ozs7Ozs7Ozs7OztBQWNHO0FBQ0gsU0FBUyxhQUFhLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBQTtJQUNyQyxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFbEIsSUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUVwQyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFeEUsUUFBQSxJQUFJLFVBQVU7WUFDVixVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUVqQyxRQUFBLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0QixJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ1IsWUFBQSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUMxQixTQUFBO1FBQ0QsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6QixLQUFBO0lBRUQsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBRWxCLElBQUEsS0FBSyxNQUFNLENBQUMsSUFBSSxNQUFNLEVBQUU7UUFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxQixLQUFBO0FBRUQsSUFBQSxPQUFPLE1BQU0sQ0FBQztBQUNsQjs7QUM5REEsTUFBTSxlQUFlLENBQUE7QUFXakIsSUFBQSxXQUFBLENBQVksWUFBK0MsRUFBQTtBQUN2RCxRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO0FBQ25CLFFBQUEsSUFBSSxZQUFZLEVBQUU7QUFDZCxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDOUIsU0FBQTtLQUNKO0FBRUQsSUFBQSxPQUFPLENBQUMsWUFBdUMsRUFBQTtBQUMzQyxRQUFBLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO0FBQ3hCLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDbEIsUUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQztLQUNqQztJQUVELE1BQU0sQ0FBQyxZQUF1QyxFQUFFLFVBQXlCLEVBQUE7QUFDckUsUUFBQSxLQUFLLE1BQU0sV0FBVyxJQUFJLFlBQVksRUFBRTtZQUNwQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUM7QUFFakQsWUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsR0FBR0MsNEJBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDM0UsS0FBSyxDQUFDLGNBQWMsR0FBR0Msd0JBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkQsWUFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM1QyxTQUFBO0FBQ0QsUUFBQSxLQUFLLE1BQU0sRUFBRSxJQUFJLFVBQVUsRUFBRTtBQUN6QixZQUFBLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN6QixZQUFBLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM5QixZQUFBLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUMzQixTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO0FBRTNCLFFBQUEsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUUvRSxRQUFBLEtBQUssTUFBTSxZQUFZLElBQUksTUFBTSxFQUFFO1lBQy9CLE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUUvRSxZQUFBLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4QixZQUFBLElBQUksS0FBSyxDQUFDLFVBQVUsS0FBSyxNQUFNLEVBQUU7Z0JBQzdCLFNBQVM7QUFDWixhQUFBO0FBRUQsWUFBQSxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztZQUNwQyxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDZCxXQUFXLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUN0RCxhQUFBO0FBRUQsWUFBQSxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLG1CQUFtQixDQUFDO0FBQy9ELFlBQUEsSUFBSSxtQkFBbUIsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBQ3RCLGdCQUFBLG1CQUFtQixHQUFHLFdBQVcsQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDekQsYUFBQTtBQUVELFlBQUEsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3BDLFNBQUE7S0FDSjtBQUNKOztBQ3hFRCxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFvQkosTUFBTyxVQUFVLENBQUE7QUFJM0IsSUFBQSxXQUFBLENBQVksTUFJWCxFQUFBO1FBQ0csTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUVoQixRQUFBLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO0FBQ3hCLFlBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzdCLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFN0MsWUFBQSxLQUFLLE1BQU0sRUFBRSxJQUFJLE1BQU0sRUFBRTtBQUNyQixnQkFBQSxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QixnQkFBQSxJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUFFLFNBQVM7QUFFeEUsZ0JBQUEsTUFBTSxHQUFHLEdBQUc7QUFDUixvQkFBQSxDQUFDLEVBQUUsQ0FBQztBQUNKLG9CQUFBLENBQUMsRUFBRSxDQUFDO29CQUNKLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLEdBQUcsT0FBTztvQkFDakMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxPQUFPO2lCQUNyQyxDQUFDO0FBQ0YsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNmLGdCQUFBLGNBQWMsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUMsQ0FBQztBQUMxRCxhQUFBO0FBQ0osU0FBQTtRQUVELE1BQU0sRUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFDLEdBQUdDLG1CQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0IsUUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJQyxzQkFBVSxDQUFDLEVBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBRTlELFFBQUEsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUU7QUFDeEIsWUFBQSxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFN0IsWUFBQSxLQUFLLE1BQU0sRUFBRSxJQUFJLE1BQU0sRUFBRTtBQUNyQixnQkFBQSxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QixnQkFBQSxJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUFFLFNBQVM7Z0JBQ3hFLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDdEMsZ0JBQUFBLHNCQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzFHLGFBQUE7QUFDSixTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztBQUNuQixRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO0tBQzlCO0FBQ0osQ0FBQTtBQUVEQyxvQkFBUSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUM7O0FDL0NsQyxNQUFNLFVBQVUsQ0FBQTtBQXFCWixJQUFBLFdBQUEsQ0FBWSxNQUE0QixFQUFBO0FBQ3BDLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJQyw0QkFBZ0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25LLFFBQUEsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ3RCLFFBQUEsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ3hCLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQ3BDLFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDO0FBQ2hDLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQzVCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQztBQUNqRCxRQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUM7UUFDcEQsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUM7UUFDNUQsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUM7QUFDdEQsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7S0FDckM7SUFFRCxLQUFLLENBQUMsSUFBZ0IsRUFBRSxVQUEyQixFQUFFLGVBQThCLEVBQUUsS0FBWSxFQUFFLFFBQTRCLEVBQUE7QUFDM0gsUUFBQSxTQUFTO0FBRVQsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztBQUN4QixRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBRWpCLFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUlDLDZCQUFpQixFQUFFLENBQUM7QUFDakQsUUFBQSxNQUFNLGdCQUFnQixHQUFHLElBQUlDLDJCQUFlLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUU5RSxRQUFBLE1BQU0sWUFBWSxHQUFHLElBQUlDLHdCQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbkUsUUFBQSxZQUFZLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUVqQyxNQUFNLE9BQU8sR0FBMEIsRUFBRSxDQUFDO0FBRTFDLFFBQUEsTUFBTSxPQUFPLEdBQUc7WUFDWixZQUFZO0FBQ1osWUFBQSxnQkFBZ0IsRUFBRSxFQUFFO0FBQ3BCLFlBQUEsbUJBQW1CLEVBQUUsRUFBRTtBQUN2QixZQUFBLGlCQUFpQixFQUFFLEVBQUU7WUFDckIsZUFBZTtTQUNsQixDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvRCxRQUFBLEtBQUssTUFBTSxhQUFhLElBQUksYUFBYSxFQUFFO1lBQ3ZDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDL0MsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDZCxTQUFTO0FBQ1osYUFBQTtBQUVELFlBQUEsSUFBSSxXQUFXLENBQUMsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUMzQixnQkFBQUMsb0JBQVEsQ0FBQyxDQUF1QixvQkFBQSxFQUFBLElBQUksQ0FBQyxNQUFNLENBQUEsU0FBQSxFQUFZLGFBQWEsQ0FBSSxFQUFBLENBQUE7QUFDcEUsb0JBQUEsZ0ZBQWdGLENBQUMsQ0FBQztBQUN6RixhQUFBO1lBRUQsTUFBTSxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDaEUsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDO0FBQ3BCLFlBQUEsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ3JELE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzNDLE1BQU0sRUFBRSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0FBQ3RELGdCQUFBLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBQyxDQUFDLENBQUM7QUFDekQsYUFBQTtBQUVELFlBQUEsS0FBSyxNQUFNLE1BQU0sSUFBSSxhQUFhLENBQUMsYUFBYSxDQUFDLEVBQUU7QUFDL0MsZ0JBQUEsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUV4QkMsa0JBQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNyQyxnQkFBQSxJQUFJLEtBQUssQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7b0JBQUUsU0FBUztnQkFDckUsSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLE9BQU87b0JBQUUsU0FBUztBQUMxRCxnQkFBQSxJQUFJLEtBQUssQ0FBQyxVQUFVLEtBQUssTUFBTTtvQkFBRSxTQUFTO2dCQUUxQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztBQUV0RCxnQkFBQSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7QUFDbEQsb0JBQUEsS0FBSyxFQUFFLFlBQVksQ0FBQyxjQUFjLENBQUMsTUFBTTtBQUN6QyxvQkFBQSxNQUFNLEVBQUUsTUFBTTtvQkFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7b0JBQ2YsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO29CQUMzQixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7b0JBQzdCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7b0JBQ3pDLGdCQUFnQjtvQkFDaEIsUUFBUSxFQUFFLElBQUksQ0FBQyxNQUFNO0FBQ3hCLGlCQUFBLENBQUMsQ0FBQztBQUVILGdCQUFBLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzFELGdCQUFBLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0QsYUFBQTtBQUNKLFNBQUE7QUFFRCxRQUFBLElBQUksS0FBWSxDQUFDO0FBQ2pCLFFBQUEsSUFBSSxRQUlILENBQUM7QUFDRixRQUFBLElBQUksT0FBa0MsQ0FBQztBQUN2QyxRQUFBLElBQUksVUFBcUMsQ0FBQztRQUUxQyxNQUFNLE1BQU0sR0FBR0MscUJBQVMsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNqRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFO1lBQzVCLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxLQUFJO2dCQUM3RCxJQUFJLENBQUMsS0FBSyxFQUFFO29CQUNSLEtBQUssR0FBRyxHQUFHLENBQUM7b0JBQ1osUUFBUSxHQUFHLE1BQU0sQ0FBQztBQUNsQixvQkFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNCLGlCQUFBO0FBQ0wsYUFBQyxDQUFDLENBQUM7QUFDTixTQUFBO0FBQU0sYUFBQTtZQUNILFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDakIsU0FBQTtRQUVELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDcEQsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0FBQ2QsWUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxLQUFJO2dCQUN0RyxJQUFJLENBQUMsS0FBSyxFQUFFO29CQUNSLEtBQUssR0FBRyxHQUFHLENBQUM7b0JBQ1osT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixvQkFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNCLGlCQUFBO0FBQ0wsYUFBQyxDQUFDLENBQUM7QUFDTixTQUFBO0FBQU0sYUFBQTtZQUNILE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDaEIsU0FBQTtRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDMUQsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO0FBQ2pCLFlBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUk7Z0JBQ25ILElBQUksQ0FBQyxLQUFLLEVBQUU7b0JBQ1IsS0FBSyxHQUFHLEdBQUcsQ0FBQztvQkFDWixVQUFVLEdBQUcsTUFBTSxDQUFDO0FBQ3BCLG9CQUFBLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDM0IsaUJBQUE7QUFDTCxhQUFDLENBQUMsQ0FBQztBQUNOLFNBQUE7QUFBTSxhQUFBO1lBQ0gsVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUNuQixTQUFBO0FBRUQsUUFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRXhCLFFBQUEsU0FBUyxZQUFZLEdBQUE7QUFDakIsWUFBQSxJQUFJLEtBQUssRUFBRTtBQUNQLGdCQUFBLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzFCLGFBQUE7QUFBTSxpQkFBQSxJQUFJLFFBQVEsSUFBSSxPQUFPLElBQUksVUFBVSxFQUFFO0FBQzFDLGdCQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLFVBQVUsR0FBRyxJQUFJQyxzQkFBVSxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztBQUV2RCxnQkFBQSxLQUFLLE1BQU0sR0FBRyxJQUFJLE9BQU8sRUFBRTtBQUN2QixvQkFBQSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzVCLElBQUksTUFBTSxZQUFZQyx3QkFBWSxFQUFFO3dCQUNoQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7d0JBQzdEQywrQkFBbUIsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbEoscUJBQUE7eUJBQU0sSUFBSSxNQUFNLENBQUMsVUFBVTt5QkFDdkIsTUFBTSxZQUFZQyxzQkFBVTtBQUM1Qiw0QkFBQSxNQUFNLFlBQVlDLHNCQUFVOzRCQUM1QixNQUFNLFlBQVlDLCtCQUFtQixDQUFDLEVBQUU7d0JBQ3pDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztBQUM3RCx3QkFBQSxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUNuRixxQkFBQTtBQUNKLGlCQUFBO0FBRUQsZ0JBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7Z0JBQ3JCLFFBQVEsQ0FBQyxJQUFJLEVBQUU7QUFDWCxvQkFBQSxPQUFPLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUN6RCxZQUFZO29CQUNaLGlCQUFpQixFQUFFLElBQUksQ0FBQyxpQkFBaUI7b0JBQ3pDLGVBQWUsRUFBRSxVQUFVLENBQUMsS0FBSztvQkFDakMsVUFBVTs7b0JBRVYsUUFBUSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxRQUFRLEdBQUcsSUFBSTtvQkFDbkQsT0FBTyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLEdBQUcsSUFBSTtBQUNqRCxvQkFBQSxjQUFjLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLFVBQVUsQ0FBQyxTQUFTLEdBQUcsSUFBSTtBQUN4RSxpQkFBQSxDQUFDLENBQUM7QUFDTixhQUFBO1NBQ0o7S0FDSjtBQUNKLENBQUE7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE1BQWlDLEVBQUUsSUFBWSxFQUFFLGVBQThCLEVBQUE7O0FBRXRHLElBQUEsTUFBTSxVQUFVLEdBQUcsSUFBSUMsZ0NBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEQsSUFBQSxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtBQUN4QixRQUFBLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBQ2xELEtBQUE7QUFDTDs7QUM3TEE7O0FBRUc7QUFDSCxTQUFTLGNBQWMsQ0FBQyxNQUE0QixFQUFFLFFBQWdDLEVBQUE7QUFDbEYsSUFBQSxNQUFNLE9BQU8sR0FBR0MsMEJBQWMsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBa0IsRUFBRSxJQUF5QixFQUFFLFlBQTRCLEVBQUUsT0FBdUIsS0FBSTtBQUNwSixRQUFBLElBQUksR0FBRyxFQUFFO1lBQ0wsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pCLFNBQUE7QUFBTSxhQUFBLElBQUksSUFBSSxFQUFFO1lBQ2IsUUFBUSxDQUFDLElBQUksRUFBRTtnQkFDWCxVQUFVLEVBQUUsSUFBSUMsc0JBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSUMsZUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pELGdCQUFBLE9BQU8sRUFBRSxJQUFJO2dCQUNiLFlBQVk7Z0JBQ1osT0FBTztBQUNWLGFBQUEsQ0FBQyxDQUFDO0FBQ04sU0FBQTtBQUNMLEtBQUMsQ0FBQyxDQUFDO0FBQ0gsSUFBQSxPQUFPLE1BQUs7UUFDUixPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDakIsUUFBQSxRQUFRLEVBQUUsQ0FBQztBQUNmLEtBQUMsQ0FBQztBQUNOLENBQUM7QUFFRDs7Ozs7Ozs7QUFRRztBQUNILE1BQU0sc0JBQXNCLENBQUE7QUFReEI7Ozs7OztBQU1HO0FBQ0gsSUFBQSxXQUFBLENBQVksS0FBWSxFQUFFLFVBQTJCLEVBQUUsZUFBOEIsRUFBRSxjQUFzQyxFQUFBO0FBQ3pILFFBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7QUFDbkIsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztBQUM3QixRQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO0FBQ3ZDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLElBQUksY0FBYyxDQUFDO0FBQ3ZELFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7QUFDbEIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztLQUNwQjtBQUVEOzs7OztBQUtHO0lBQ0gsUUFBUSxDQUFDLE1BQTRCLEVBQUUsUUFBNEIsRUFBQTtBQUMvRCxRQUFBLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7UUFFdkIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO0FBQ2IsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUV0QixRQUFBLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxxQkFBcUI7WUFDMUUsSUFBSUMsOEJBQWtCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEtBQUssQ0FBQztBQUVuRCxRQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDOUQsUUFBQSxVQUFVLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxFQUFFLFFBQVEsS0FBSTtBQUM3RCxZQUFBLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUV6QixZQUFBLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0FBQ2xCLGdCQUFBLFVBQVUsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQzNCLGdCQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDO0FBQzlCLGdCQUFBLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLGFBQUE7QUFFRCxZQUFBLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7WUFDckMsTUFBTSxZQUFZLEdBQUcsRUFBdUMsQ0FBQztZQUM3RCxJQUFJLFFBQVEsQ0FBQyxPQUFPO0FBQUUsZ0JBQUEsWUFBWSxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQzlELElBQUksUUFBUSxDQUFDLFlBQVk7QUFBRSxnQkFBQSxZQUFZLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUM7WUFFN0UsTUFBTSxjQUFjLEdBQUcsRUFBMkIsQ0FBQztBQUNuRCxZQUFBLElBQUksSUFBSSxFQUFFO0FBQ04sZ0JBQUEsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7OztBQUd6QyxnQkFBQSxJQUFJLGtCQUFrQjtBQUNsQixvQkFBQSxjQUFjLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7QUFDdEYsYUFBQTtBQUVELFlBQUEsVUFBVSxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQzVDLFVBQVUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEtBQUk7Z0JBQ3JHLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTTtBQUFFLG9CQUFBLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDOztnQkFHekMsUUFBUSxDQUFDLElBQUksRUFBRUMsa0JBQU0sQ0FBQyxFQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0FBQ3RHLGFBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUNoQyxZQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDO0FBQ2xDLFNBQUMsQ0FBb0IsQ0FBQztLQUN6QjtBQUVEOzs7QUFHRztJQUNILFVBQVUsQ0FBQyxNQUE0QixFQUFFLFFBQTRCLEVBQUE7QUFDakUsUUFBQSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxFQUN0QixHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFDaEIsUUFBUSxHQUFHLElBQUksQ0FBQztBQUNwQixRQUFBLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixZQUFBLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMvQixZQUFBLFVBQVUsQ0FBQyxrQkFBa0IsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUM7QUFFMUQsWUFBQSxNQUFNLElBQUksR0FBRyxDQUFDLEdBQVcsRUFBRSxJQUFVLEtBQUk7QUFDckMsZ0JBQUEsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLGNBQWMsQ0FBQztBQUNqRCxnQkFBQSxJQUFJLGNBQWMsRUFBRTtvQkFDaEIsT0FBTyxVQUFVLENBQUMsY0FBYyxDQUFDO29CQUNqQyxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFDdEgsaUJBQUE7QUFDRCxnQkFBQSxRQUFRLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3hCLGFBQUMsQ0FBQztBQUVGLFlBQUEsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtBQUNqQyxnQkFBQSxVQUFVLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztBQUNwQyxhQUFBO0FBQU0saUJBQUEsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRTs7Z0JBRXJDLElBQUksVUFBVSxDQUFDLFVBQVUsRUFBRTtvQkFDdkIsVUFBVSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3BHLGlCQUFBO0FBQU0scUJBQUE7QUFDSCxvQkFBQSxJQUFJLEVBQUUsQ0FBQztBQUNWLGlCQUFBO0FBQ0osYUFBQTtBQUNKLFNBQUE7S0FDSjtBQUVEOzs7Ozs7QUFNRztJQUNILFNBQVMsQ0FBQyxNQUFzQixFQUFFLFFBQTRCLEVBQUE7UUFDMUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFDeEIsR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFDckIsUUFBQSxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRTtBQUMvQyxZQUFBLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUNyQixZQUFBLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLFNBQUE7QUFDRCxRQUFBLFFBQVEsRUFBRSxDQUFDO0tBQ2Q7QUFFRDs7Ozs7O0FBTUc7SUFDSCxVQUFVLENBQUMsTUFBc0IsRUFBRSxRQUE0QixFQUFBO1FBQzNELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQ3RCLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ3JCLFFBQUEsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3ZCLFlBQUEsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEIsU0FBQTtBQUNELFFBQUEsUUFBUSxFQUFFLENBQUM7S0FDZDtBQUNKOztBQ3ZNRCxNQUFNLHlCQUF5QixDQUFBO0FBTTNCLElBQUEsV0FBQSxHQUFBO0FBQ0ksUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztLQUNwQjtJQUVELFFBQVEsQ0FBQyxNQUErQixFQUFFLFFBQStCLEVBQUE7UUFDckUsTUFBTSxFQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFDLEdBQUcsTUFBTSxDQUFDOztBQUU3QyxRQUFBLE1BQU0sV0FBVyxHQUFHQyx5QkFBYSxDQUFDLFlBQVksQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLEdBQUcsWUFBeUIsQ0FBQztRQUM5RyxNQUFNLEdBQUcsR0FBRyxJQUFJQyxtQkFBTyxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUNoQyxRQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQ3ZCLFFBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztLQUN2QjtBQUVELElBQUEsWUFBWSxDQUFDLFNBQXNCLEVBQUE7O1FBRS9CLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixFQUFFOztBQUV2RCxZQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxlQUFlLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUUsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3ZFLFNBQUE7UUFFRCxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFFL0MsUUFBQSxJQUFJLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDOztRQUUxRixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDNUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckcsT0FBTyxJQUFJQyxxQkFBUyxDQUFDLEVBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDdEY7QUFFRCxJQUFBLFVBQVUsQ0FBQyxNQUFzQixFQUFBO1FBQzdCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQ3RCLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ3JCLFFBQUEsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3ZCLFlBQUEsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEIsU0FBQTtLQUNKO0FBQ0o7O0lDdkRELGFBQWMsR0FBR0MsUUFBTSxDQUFDO0FBQ3hCO0FBQ0EsU0FBU0EsUUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUU7QUFDM0IsSUFBSSxJQUFJLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7QUFDaEM7QUFDQSxJQUFJLElBQUksSUFBSSxLQUFLLG1CQUFtQixFQUFFO0FBQ3RDLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRUEsUUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDL0U7QUFDQSxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssb0JBQW9CLEVBQUU7QUFDOUMsUUFBUSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFQSxRQUFNLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNuRjtBQUNBLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7QUFDbkMsUUFBUUEsUUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDbkM7QUFDQSxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO0FBQ25DLFFBQVEsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDM0M7QUFDQSxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssY0FBYyxFQUFFO0FBQ3hDLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMxRixLQUFLO0FBQ0w7QUFDQSxJQUFJLE9BQU8sRUFBRSxDQUFDO0FBQ2QsQ0FBQztBQUNEO0FBQ0EsU0FBUyxXQUFXLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRTtBQUNuQyxJQUFJLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsT0FBTztBQUNuQztBQUNBLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNoQyxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzNDLFFBQVEsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLEtBQUs7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQy9CLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDMUIsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtBQUN0RSxRQUFRLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEUsUUFBUSxJQUFJLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFH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QUM7QUFDMUQsSUFBSSxNQUFNLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzNELENBQUM7QUFDRDtBQUNBLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQ2xEO0FBQ0EsSUFBSSxPQUFPLEtBQUssR0FBRyxJQUFJLEVBQUU7QUFDekIsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLEdBQUcsR0FBRyxFQUFFO0FBQ2hDLFlBQVksTUFBTSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7QUFDdkMsWUFBWSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNuQyxZQUFZLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEMsWUFBWSxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2hELFlBQVksTUFBTSxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3ZGLFlBQVksTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzRSxZQUFZLE1BQU0sUUFBUSxH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LElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2pEO0FBQ0EsUUFBUSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLFFBQVEsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDcEM7QUFDQSxRQUFRLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVEO0FBQ0EsUUFBUSxNQUFNLFFBQVEsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hDO0FBQ0EsUUFBUSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDcEQsWUFBWSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdCLFlBQVksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDOUIsWUFBWSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLFNBQVM7QUFDVCxRQUFRLElBQUksSUFBSSxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUNwRCxZQUFZLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzlCLFlBQVksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM5QixZQUFZLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENB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QUFPLEVBQUUsSUFBSTtBQUNyQixRQUFRLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtBQUM5QixRQUFRLFdBQVcsRUFBRSxLQUFLO0FBQzFCLFFBQVEsdUJBQXVCLEVBQUUsTUFBTTtBQUN2QyxLQUFLLENBQUMsQ0FBQztBQUNQLENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQ25CLElBQUksT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUMzQixDQUFDO0FBQ0QsU0FBUyxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQ25CLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUM5QyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEdBQUcsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZFLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUNEO0FBQ0E7QUFDQSxTQUFTLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDakIsSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFDM0IsQ0FBQztBQUNELFNBQVMsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNqQixJQUFJLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUM7QUFDL0MsSUFBSSxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMs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SSxDQUFDLENBQUM7QUFDOUIsSUFBSSxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNsQixJQUFJLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztBQUN2QixDQUFDO0FBQ0Q7QUFDQSxTQUFTLFlBQVksQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUU7QUFDeEQsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUMzQyxRQUFRLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUN0QixRQUFRLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUMxRCxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkIsS0FBSztBQUNMLENBQUM7QUFDRDtBQUNBLFNBQVMsUUFBUSxDQUFDLENBQUMsRUFBRTtBQUNyQixJQUFJLE9BQU8sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDekIsQ0FBQztBQUNEO0FBQ0EsU0FBUyxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3JCLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUMxQyxJQUFJLElBQUksRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztBQUNwRSxJQUFJLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ3hD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QztBQUM1QixJQUFJLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzlGLFFBQVEsUUFBUSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RELEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7QUFDdEIsUUFBUSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVCLEtBQUs7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLFFBQVEsQ0FBQyxJQUFJLEVBQUU7QUFDeEIsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDbkIsSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDM0IsSUFBSSxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDN0IsSUFBSSxLQUFLLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDekIsSUFBSSxPQUFPLEtBQUssQ0FBQztBQUNqQixDQUFDO0FBQ0Q7QUFDQSxTQUFTLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtBQUMzRCxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzFDLFFBQVEsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ25FLEtBQUs7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDaEMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEIsQ0FBQztBQUNEO0FBQ0EsU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDNUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNqQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEIsSUFBSSxPQUFPLENBQUMsQ0FBQztBQUNiLENBQUM7QUFDRDtBQUNBLFNBQVMsVUFBVSxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQzVDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUNqQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNqQyxJQUFJLEdB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QUFFLENBQUM7QUFDM0IsUUFBUSxVQUFVLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDMUQ7QUFDQSxRQUFRLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDcEMsUUFBUSxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3BDLFFBQVEsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNwQyxRQUFRLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDcEM7QUFDQSxRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDL0MsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQy9DLFFBQVEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUMvQyxRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDL0MsS0FBSztBQUNMLElBQUksT0FBTyxJQUFJLENBQUM7QUFDaEIsQ0FBQztBQUNEO0FBQ0EsU0FBUyxVQUFVLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO0FBQ3ZEO0FBQ0EsSUFBSSxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsUUFBUTtBQUMvQixRQUFRLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSTtBQUMzQixRQUFRLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDeEI7QUFDQSxJQUFJLElBQUksSUFBSSxL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LElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQyxTQUFTO0FBQ1QsUUFBUSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDekIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLFNBQVMsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3pDO0FBQ0EsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3RCLENBQUM7QUFDRDtBQUNBLFNBQVMsTUFBTSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7QUFDakMsSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7QUFDakIsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUM1RSxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEUsS0FBSztBQUNMLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLFNBQVMsRUFBRTtBQUNoQyxRQUFRLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzVELFlBQVksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVCLFlBQVksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FB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QU8sQ0FBQyxNQUFNO0FBQ3RELFlBQVksRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQ3pCLFlBQVksRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQ3pCLFlBQVksRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFO0FBQ3ZCLFlBQVksRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7QUFDeEM7QUFDQSxRQUFRLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFDakM7QUFDQSxRQUFRLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNyRixRQUFRLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNyRixRQUFRLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDeEI7QUFDQSxRQUFRLElBQUksSUFBSSxFQUFFO0FBQ2xCLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2xGLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2xGLFlBQVksSUFBSSxHQUFHLElBQUksQ0FBQztBQUN4QixTQUFTO0FBQ1Q7QUFDQSxRQUFRLElBQUksS0FBSyxFQUFFO0FBQ25CLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ25GLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ25GLFlBQVksS0FBSyxHQUFHLElBQUksQ0FBQztBQUN6QixTQUFTO0FBQ1Q7QUFDQSxRQUFRLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ25EO0FBQ0EsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN0RCxRQUFRLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMxRCxRQUFRLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN0RCxRQUFRLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDMUQsS0FBSztBQUNMLENBQUMsQ0FBQztBQUNGO0FBQ0EsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUNqRCxJQUFJLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPO0FBQzlCLFFBQVEsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNO0FBQy9CLFFBQVEsS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7QUFDOUI7QUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ3JDO0FBQ0EsSUFBSSxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BCLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDN0I7QUFDQSxJQUFJLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzNCLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU9lLGFBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pFO0FBQ0EsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3RFO0FBQ0EsSUFBSSxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2QsUUFBUSxFQUFFLEdBQUcsQ0FBQztBQUNkLFFBQVEsRUFBRSxHQUFHLENBQUM7QUFDZCxRQUFRLE1BQU0sQ0FBQztBQUNmO0FBQ0EsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUU7QUFDOUIsUUFBUSxFQUFFLEVBQUUsQ0FBQztBQUNiLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLFFBQVEsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM5QyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQy9DO0FBQ0E7QUFDQSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDMUU7QUFDQSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ2pELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkQsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUNwRDtBQUNBLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHQSxhQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDckUsQ0FBQyxDQUFDO0FBQ0Y7QUFDQSxTQUFTLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUN2QixJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUNEO0FBQ0EsU0FBUyxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUMzQixJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEMsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQjs7QUMxSkEsU0FBUyxlQUFlLENBQUMsTUFBNEIsRUFBRSxRQUFnQyxFQUFBO0FBQ25GLElBQUEsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFFMUMsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtRQUNyQixPQUFPLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDL0IsS0FBQTtJQUVELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEYsSUFBSSxDQUFDLFdBQVcsRUFBRTtRQUNkLE9BQU8sUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMvQixLQUFBO0lBRUQsTUFBTSxjQUFjLEdBQUcsSUFBSU4sZ0JBQWMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7Ozs7QUFLaEUsSUFBQSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDaEMsSUFBQSxJQUFJLEdBQUcsQ0FBQyxVQUFVLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxVQUFVLEtBQUssR0FBRyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUU7O0FBRWxFLFFBQUEsR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLEtBQUE7SUFFRCxRQUFRLENBQUMsSUFBSSxFQUFFO0FBQ1gsUUFBQSxVQUFVLEVBQUUsY0FBYztRQUMxQixPQUFPLEVBQUUsR0FBRyxDQUFDLE1BQU07QUFDdEIsS0FBQSxDQUFDLENBQUM7QUFDUCxDQUFDO0FBTUQ7Ozs7Ozs7OztBQVNHO0FBQ0gsTUFBTSxtQkFBb0IsU0FBUSxzQkFBc0IsQ0FBQTtBQVNwRDs7Ozs7QUFLRztBQUNILElBQUEsV0FBQSxDQUFZLEtBQVksRUFBRSxVQUEyQixFQUFFLGVBQThCLEVBQUUsV0FBZ0MsRUFBQTtRQUNuSCxLQUFLLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsZUFBZSxDQUFDLENBQUM7QUFDM0QsUUFBQSxJQUFJLFdBQVcsRUFBRTtBQUNiLFlBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7QUFDbEMsU0FBQTtLQUNKO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkc7SUFDSCxRQUFRLENBQUMsTUFBNkIsRUFBRSxRQUd0QyxFQUFBO1FBQ0UsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7O1lBRXZCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsRUFBQyxTQUFTLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztBQUNsRCxTQUFBO0FBQ0QsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsUUFBUSxDQUFDO0FBQ2pDLFFBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLE1BQU0sQ0FBQztRQUVyQyxJQUFJLElBQUksQ0FBQyxNQUFNO0FBQ1gsWUFBQSxJQUFJLENBQUMsTUFBTSxLQUFLLE1BQU0sRUFBRTtBQUN4QixZQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsZUFBZSxDQUFDO0FBQ2pDLFNBQUE7QUFBTSxhQUFBO0FBQ0gsWUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztZQUMzQixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDcEIsU0FBQTtLQUNKO0FBRUQ7OztBQUdHO0lBQ0gsU0FBUyxHQUFBO1FBQ0wsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRTtZQUN4RHRCLGtCQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDZCxPQUFPO0FBQ1YsU0FBQTtBQUNELFFBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDO0FBQ3ZDLFFBQUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDO1FBQzNDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDO1FBQzdCLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDO0FBRW5DLFFBQUEsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLHFCQUFxQjtZQUMxRSxJQUFJWSw4QkFBa0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBRW5ELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBa0IsRUFBRSxJQUFpQixLQUFJO0FBQy9ELFlBQUEsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDZCxnQkFBQSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QixhQUFBO0FBQU0saUJBQUEsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDakMsZ0JBQUEsT0FBTyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQSxxQkFBQSxFQUF3QixNQUFNLENBQUMsTUFBTSxDQUFBLGdDQUFBLENBQWtDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZHLGFBQUE7QUFBTSxpQkFBQTtBQUNILGdCQUFBSyxhQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUVuQixJQUFJO29CQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTt3QkFDZixNQUFNLFFBQVEsR0FBR1ksNEJBQWdCLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQVEsQ0FBQyxDQUFDO0FBQ2xKLHdCQUFBLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxPQUFPO0FBQzNCLDRCQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUEsRUFBRyxHQUFHLENBQUMsR0FBRyxDQUFBLEVBQUEsRUFBSyxHQUFHLENBQUMsT0FBTyxDQUFBLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUV4RixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBQyxJQUFJLEVBQUUsQ0FBQyxFQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQzt3QkFDOUYsSUFBSSxHQUFHLEVBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBQyxDQUFDO0FBQ2hELHFCQUFBO0FBRUQsb0JBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsT0FBTztBQUMvQix3QkFBQSxJQUFJLFlBQVksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO0FBQ3BFLHdCQUFBLFNBQVMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDaEQsaUJBQUE7QUFBQyxnQkFBQSxPQUFPLEdBQUcsRUFBRTtBQUNWLG9CQUFBLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLGlCQUFBO0FBRUQsZ0JBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7Z0JBRWpCLE1BQU0sTUFBTSxHQUFHLEVBQTZCLENBQUM7QUFDN0MsZ0JBQUEsSUFBSSxJQUFJLEVBQUU7QUFDTixvQkFBQSxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQzs7O0FBR3pDLG9CQUFBLElBQUksa0JBQWtCLEVBQUU7QUFDcEIsd0JBQUEsTUFBTSxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7QUFDM0Isd0JBQUEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztBQUN6RixxQkFBQTtBQUNKLGlCQUFBO0FBQ0QsZ0JBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUMxQixhQUFBO0FBQ0wsU0FBQyxDQUFDLENBQUM7S0FDTjtBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJHO0lBQ0gsUUFBUSxHQUFBO0FBQ0osUUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssWUFBWSxFQUFFO0FBQzlCLFlBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7QUFDeEIsU0FBQTtBQUFNLGFBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLGVBQWUsRUFBRTtBQUN4QyxZQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO1lBQzNCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUNwQixTQUFBO0tBQ0o7QUFFRDs7Ozs7Ozs7O0FBU0U7SUFDRixVQUFVLENBQUMsTUFBNEIsRUFBRSxRQUE0QixFQUFBO1FBQ2pFLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQ3RCLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBRXJCLFFBQUEsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ3ZCLE9BQU8sS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0MsU0FBQTtBQUFNLGFBQUE7WUFDSCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzFDLFNBQUE7S0FDSjtBQUVEOzs7Ozs7Ozs7OztBQVdHO0lBQ0gsV0FBVyxDQUFDLE1BQTZCLEVBQUUsUUFBK0IsRUFBQTs7Ozs7UUFLdEUsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO0FBQ2hCLFlBQUFDLG1CQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNyQyxTQUFBO0FBQU0sYUFBQSxJQUFJLE9BQU8sTUFBTSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDeEMsSUFBSTtBQUNBLGdCQUFBLE9BQU8sUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2xELGFBQUE7QUFBQyxZQUFBLE9BQU8sQ0FBQyxFQUFFO0FBQ1IsZ0JBQUEsT0FBTyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQSxxQkFBQSxFQUF3QixNQUFNLENBQUMsTUFBTSxDQUFBLGdDQUFBLENBQWtDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZHLGFBQUE7QUFDSixTQUFBO0FBQU0sYUFBQTtBQUNILFlBQUEsT0FBTyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQSxxQkFBQSxFQUF3QixNQUFNLENBQUMsTUFBTSxDQUFBLGdDQUFBLENBQWtDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZHLFNBQUE7S0FDSjtJQUVELFlBQVksQ0FBQyxNQUVaLEVBQUUsUUFBNEIsRUFBQTtRQUMzQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTs7WUFFdkIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxFQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO0FBQ2xELFNBQUE7QUFDRCxRQUFBLFFBQVEsRUFBRSxDQUFDO0tBQ2Q7SUFFRCx1QkFBdUIsQ0FBQyxNQUV2QixFQUFFLFFBQTBCLEVBQUE7UUFDekIsSUFBSTtBQUNBLFlBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0FBQ2hGLFNBQUE7QUFBQyxRQUFBLE9BQU8sQ0FBQyxFQUFFO1lBQ1IsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2YsU0FBQTtLQUNKO0lBRUQsa0JBQWtCLENBQUMsTUFFbEIsRUFBRSxRQUEwQyxFQUFBO1FBQ3pDLElBQUk7QUFDQSxZQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDcEUsU0FBQTtBQUFDLFFBQUEsT0FBTyxDQUFDLEVBQUU7WUFDUixRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDZixTQUFBO0tBQ0o7SUFFRCxnQkFBZ0IsQ0FBQyxNQUloQixFQUFFLFFBQTBDLEVBQUE7UUFDekMsSUFBSTtZQUNBLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQy9GLFNBQUE7QUFBQyxRQUFBLE9BQU8sQ0FBQyxFQUFFO1lBQ1IsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2YsU0FBQTtLQUNKO0FBQ0osQ0FBQTtBQUVELFNBQVMsc0JBQXNCLENBQUMsRUFBQyxtQkFBbUIsRUFBRSxpQkFBaUIsRUFBd0QsRUFBQTtBQUMzSCxJQUFBLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLG1CQUFtQjtBQUFFLFFBQUEsT0FBTyxtQkFBbUIsQ0FBQztJQUUzRSxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDMUIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7SUFDN0IsTUFBTSxPQUFPLEdBQUcsRUFBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUMsQ0FBQztBQUM3QyxJQUFBLE1BQU0sT0FBTyxHQUFHLEVBQUMsVUFBVSxFQUFFLElBQUksRUFBQyxDQUFDO0lBQ25DLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUVyRCxJQUFBLEtBQUssTUFBTSxHQUFHLElBQUksYUFBYSxFQUFFO1FBQzdCLE1BQU0sQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7QUFFekQsUUFBQSxNQUFNLG1CQUFtQixHQUFHRCw0QkFBZ0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUM1RCxRQUFBLE1BQU0sc0JBQXNCLEdBQUdBLDRCQUFnQixDQUMzQyxPQUFPLFFBQVEsS0FBSyxRQUFRLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBRXpGLFFBQUE3QixrQkFBTSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsQ0FBQztBQUNqRCxRQUFBQSxrQkFBTSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUMsQ0FBQztBQUVwRCxRQUFBLGNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUM7QUFDaEQsUUFBQSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxzQkFBc0IsQ0FBQyxLQUFLLENBQUM7QUFDekQsS0FBQTtBQUVELElBQUEsbUJBQW1CLENBQUMsR0FBRyxHQUFHLENBQUMsZUFBZSxLQUFJO0FBQzFDLFFBQUEsT0FBTyxDQUFDLFVBQVUsR0FBRyxlQUFlLENBQUM7UUFDckMsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQ3RCLFFBQUEsS0FBSyxNQUFNLEdBQUcsSUFBSSxhQUFhLEVBQUU7QUFDN0IsWUFBQSxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDcEUsU0FBQTtBQUNELFFBQUEsT0FBTyxVQUFVLENBQUM7QUFDdEIsS0FBQyxDQUFDO0lBQ0YsbUJBQW1CLENBQUMsTUFBTSxHQUFHLENBQUMsV0FBVyxFQUFFLGlCQUFpQixLQUFJO0FBQzVELFFBQUEsT0FBTyxDQUFDLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQztBQUN2QyxRQUFBLEtBQUssTUFBTSxHQUFHLElBQUksYUFBYSxFQUFFO0FBQzdCLFlBQUEsT0FBTyxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkMsWUFBQSxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN4RSxTQUFBO0FBQ0wsS0FBQyxDQUFDO0FBRUYsSUFBQSxPQUFPLG1CQUFtQixDQUFDO0FBQy9COztBQ3pWQTs7QUFFRztBQUNXLE1BQU8sTUFBTSxDQUFBO0FBd0J2QixJQUFBLFdBQUEsQ0FBWSxJQUFnQyxFQUFBO0FBQ3hDLFFBQUEsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJK0IsaUJBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFFbkMsUUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztBQUN2QixRQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsRUFBRSxDQUFDO1FBRTFCLElBQUksQ0FBQyxpQkFBaUIsR0FBRztBQUNyQixZQUFBLE1BQU0sRUFBRSxzQkFBc0I7QUFDOUIsWUFBQSxPQUFPLEVBQUUsbUJBQW1CO1NBQy9CLENBQUM7O0FBR0YsUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN4QixRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7UUFFM0IsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLElBQVksRUFBRSxZQUUvQyxLQUFJO0FBQ0QsWUFBQSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUM5QixnQkFBQSxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixJQUFJLENBQUEscUJBQUEsQ0FBdUIsQ0FBQyxDQUFDO0FBQzVFLGFBQUE7QUFDRCxZQUFBLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUM7QUFDaEQsU0FBQyxDQUFDOztRQUdGLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxhQUlsQyxLQUFJO0FBQ0QsWUFBQSxJQUFJQyxrQkFBbUIsQ0FBQyxRQUFRLEVBQUUsRUFBRTtBQUNoQyxnQkFBQSxNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7QUFDMUQsYUFBQTtBQUNELFlBQUFBLGtCQUFtQixDQUFDLG9CQUFvQixDQUFDLEdBQUcsYUFBYSxDQUFDLGtCQUFrQixDQUFDO0FBQzdFLFlBQUFBLGtCQUFtQixDQUFDLDBCQUEwQixDQUFDLEdBQUcsYUFBYSxDQUFDLHdCQUF3QixDQUFDO0FBQ3pGLFlBQUFBLGtCQUFtQixDQUFDLGdDQUFnQyxDQUFDLEdBQUcsYUFBYSxDQUFDLDhCQUE4QixDQUFDO0FBQ3pHLFNBQUMsQ0FBQztLQUNMO0lBRUQsV0FBVyxDQUFDLEtBQWEsRUFBRSxRQUFnQixFQUFBO0FBQ3ZDLFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7S0FDNUI7QUFFRCxJQUFBLFNBQVMsQ0FBQyxLQUFhLEVBQUUsTUFBcUIsRUFBRSxRQUE0QixFQUFBO0FBQ3hFLFFBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxNQUFNLENBQUM7UUFDckMsS0FBSyxNQUFNLFlBQVksSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ2xELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDbkQsWUFBQSxLQUFLLE1BQU0sTUFBTSxJQUFJLEVBQUUsRUFBRTtBQUNyQixnQkFBQSxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQztBQUN2QyxhQUFBO0FBQ0osU0FBQTtBQUNELFFBQUEsUUFBUSxFQUFFLENBQUM7S0FDZDtBQUVELElBQUEsU0FBUyxDQUFDLEtBQWEsRUFBRSxNQUFpQyxFQUFFLFFBQTRCLEVBQUE7UUFDcEYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDMUMsUUFBQSxRQUFRLEVBQUUsQ0FBQztLQUNkO0FBRUQsSUFBQSxZQUFZLENBQUMsS0FBYSxFQUFFLE1BRzNCLEVBQUUsUUFBNEIsRUFBQTtBQUMzQixRQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ25FLFFBQUEsUUFBUSxFQUFFLENBQUM7S0FDZDtBQUVELElBQUEsUUFBUSxDQUFDLEtBQWEsRUFBRSxNQUV2QixFQUFFLFFBQTRCLEVBQUE7QUFDM0IsUUFBQWhDLGtCQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7S0FDdEY7QUFFRCxJQUFBLFdBQVcsQ0FBQyxLQUFhLEVBQUUsTUFBK0IsRUFBRSxRQUErQixFQUFBO0FBQ3ZGLFFBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUM1RTtBQUVELElBQUEsVUFBVSxDQUFDLEtBQWEsRUFBRSxNQUV6QixFQUFFLFFBQTRCLEVBQUE7QUFDM0IsUUFBQUEsa0JBQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUN4RjtBQUVELElBQUEsU0FBUyxDQUFDLEtBQWEsRUFBRSxNQUV4QixFQUFFLFFBQTRCLEVBQUE7QUFDM0IsUUFBQUEsa0JBQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUN2RjtBQUVELElBQUEsVUFBVSxDQUFDLEtBQWEsRUFBRSxNQUV6QixFQUFFLFFBQTRCLEVBQUE7QUFDM0IsUUFBQUEsa0JBQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztLQUN4RjtJQUVELGFBQWEsQ0FBQyxLQUFhLEVBQUUsTUFBc0IsRUFBQTtBQUMvQyxRQUFBLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNwRTtBQUVELElBQUEsWUFBWSxDQUFDLEtBQWEsRUFBRSxNQUkzQixFQUFFLFFBQTRCLEVBQUE7QUFDM0IsUUFBQUEsa0JBQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEIsUUFBQUEsa0JBQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFdEIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7WUFDMUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDdkMsWUFBQSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN4RCxPQUFPO0FBQ1YsU0FBQTtBQUVELFFBQUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3JFLFFBQUEsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFN0QsUUFBQSxJQUFJLE1BQU0sQ0FBQyxZQUFZLEtBQUssU0FBUyxFQUFFO0FBQ25DLFlBQUEsTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDekMsU0FBQTtBQUFNLGFBQUE7QUFDSCxZQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ2QsU0FBQTtLQUNKO0FBRUQ7Ozs7O0FBS0c7QUFDSCxJQUFBLGdCQUFnQixDQUFDLEdBQVcsRUFBRSxNQUU3QixFQUFFLFFBQXdCLEVBQUE7UUFDdkIsSUFBSTtZQUNBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwQyxZQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ2QsU0FBQTtBQUFDLFFBQUEsT0FBTyxDQUFDLEVBQUU7QUFDUixZQUFBLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUMxQixTQUFBO0tBQ0o7QUFFRCxJQUFBLGtCQUFrQixDQUFDLEdBQVcsRUFBRSxLQUFrQixFQUFFLFFBQTJCLEVBQUE7UUFDM0UsSUFBSTtBQUNBLFlBQUFnQyxrQkFBbUIsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDcEMsWUFBQSxNQUFNLFNBQVMsR0FBR0Esa0JBQW1CLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDckQsSUFDSUEsa0JBQW1CLENBQUMsUUFBUSxFQUFFO2dCQUM5QixDQUFDQSxrQkFBbUIsQ0FBQyxRQUFRLEVBQUU7Z0JBQy9CLFNBQVMsSUFBSSxJQUFJO0FBQ25CLGNBQUE7QUFDRSxnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNuQyxnQkFBQSxNQUFNLFFBQVEsR0FBR0Esa0JBQW1CLENBQUMsUUFBUSxFQUFFLENBQUM7QUFDaEQsZ0JBQUEsTUFBTSxLQUFLLEdBQUcsUUFBUSxHQUFHLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxpREFBaUQsU0FBUyxDQUFBLENBQUUsQ0FBQyxDQUFDO0FBQzdHLGdCQUFBLFFBQVEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0IsYUFBQTtBQUNKLFNBQUE7QUFBQyxRQUFBLE9BQU8sQ0FBQyxFQUFFO0FBQ1IsWUFBQSxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7QUFDMUIsU0FBQTtLQUNKO0FBRUQsSUFBQSxrQkFBa0IsQ0FBQyxLQUFhLEVBQUE7UUFDNUIsSUFBSSxlQUFlLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUVsRCxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQ2xCLGVBQWUsR0FBRyxFQUFFLENBQUM7QUFDeEIsU0FBQTtBQUVELFFBQUEsT0FBTyxlQUFlLENBQUM7S0FDMUI7QUFFRCxJQUFBLGFBQWEsQ0FBQyxLQUFhLEVBQUE7UUFDdkIsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ2YsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztBQUNuRSxTQUFBO0FBQ0QsUUFBQSxPQUFPLFlBQVksQ0FBQztLQUN2QjtBQUVELElBQUEsZUFBZSxDQUFDLEtBQWEsRUFBRSxJQUFZLEVBQUUsTUFBYyxFQUFBO0FBQ3ZELFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO0FBQzFCLFlBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRXpDLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUU7OztBQUcxQyxZQUFBLE1BQU0sS0FBSyxHQUFHO2dCQUNWLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxLQUFJO0FBQzNCLG9CQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO2lCQUNoRDthQUNKLENBQUM7QUFDRixZQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFTLENBQUUsS0FBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDbEssU0FBQTtBQUVELFFBQUEsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQ2xEO0lBRUQsa0JBQWtCLENBQUMsS0FBYSxFQUFFLE1BQWMsRUFBQTtBQUM1QyxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDO0FBQzdCLFlBQUEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUV0QyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ3ZDLFlBQUEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUkseUJBQXlCLEVBQUUsQ0FBQztBQUMxRSxTQUFBO1FBRUQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDL0M7SUFFRCxxQkFBcUIsQ0FBQyxLQUFhLEVBQUUsS0FBYSxFQUFBO1FBQzlDQyxpQ0FBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNoQztBQUNKLENBQUE7QUFFRDtBQUNBLElBQUksT0FBTyxpQkFBaUIsS0FBSyxXQUFXO0lBQ3hDLE9BQU8sSUFBSSxLQUFLLFdBQVc7SUFDM0IsSUFBSSxZQUFZLGlCQUFpQixFQUFFO0lBQ2xDLElBQVksQ0FBQyxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBVyxDQUFDLENBQUM7QUFDbEQ7Ozs7Ozs7OyJ9
