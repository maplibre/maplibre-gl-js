define(['./shared'], function (performance) { 'use strict';

function stringify(obj) {
    var type = typeof obj;
    if (type === 'number' || type === 'boolean' || type === 'string' || obj === undefined || obj === null)
        { return JSON.stringify(obj); }

    if (Array.isArray(obj)) {
        var str$1 = '[';
        for (var i$1 = 0, list = obj; i$1 < list.length; i$1 += 1) {
            var val = list[i$1];

            str$1 += (stringify(val)) + ",";
        }
        return (str$1 + "]");
    }

    var keys = Object.keys(obj).sort();

    var str = '{';
    for (var i = 0; i < keys.length; i++) {
        str += (JSON.stringify(keys[i])) + ":" + (stringify(obj[keys[i]])) + ",";
    }
    return (str + "}");
}

function getKey(layer) {
    var key = '';
    for (var i = 0, list = performance.refProperties; i < list.length; i += 1) {
        var k = list[i];

        key += "/" + (stringify(layer[k]));
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
    var groups = {};

    for (var i = 0; i < layers.length; i++) {

        var k = (cachedKeys && cachedKeys[layers[i].id]) || getKey(layers[i]);
        // update the cache if there is one
        if (cachedKeys)
            { cachedKeys[layers[i].id] = k; }

        var group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }

    var result = [];

    for (var k$1 in groups) {
        result.push(groups[k$1]);
    }

    return result;
}


var StyleLayerIndex = function StyleLayerIndex(layerConfigs                        ) {
    this.keyCache = {};
    if (layerConfigs) {
        this.replace(layerConfigs);
    }
};

StyleLayerIndex.prototype.replace = function replace (layerConfigs                       ) {
    this._layerConfigs = {};
    this._layers = {};
    this.update(layerConfigs, []);
};

StyleLayerIndex.prototype.update = function update (layerConfigs                       , removedIds           ) {
        var this$1 = this;

    for (var i = 0, list = layerConfigs; i < list.length; i += 1) {
        var layerConfig = list[i];

            this._layerConfigs[layerConfig.id] = layerConfig;

        var layer = this._layers[layerConfig.id] = performance.createStyleLayer(layerConfig);
        layer._featureFilter = performance.featureFilter(layer.filter);
        if (this.keyCache[layerConfig.id])
            { delete this.keyCache[layerConfig.id]; }
    }
    for (var i$1 = 0, list$1 = removedIds; i$1 < list$1.length; i$1 += 1) {
        var id = list$1[i$1];

            delete this.keyCache[id];
        delete this._layerConfigs[id];
        delete this._layers[id];
    }

    this.familiesBySource = {};

    var groups = groupByLayout(performance.values(this._layerConfigs), this.keyCache);

    for (var i$2 = 0, list$2 = groups; i$2 < list$2.length; i$2 += 1) {
        var layerConfigs$1 = list$2[i$2];

            var layers = layerConfigs$1.map(function (layerConfig) { return this$1._layers[layerConfig.id]; });

        var layer$1 = layers[0];
        if (layer$1.visibility === 'none') {
            continue;
        }

        var sourceId = layer$1.source || '';
        var sourceGroup = this.familiesBySource[sourceId];
        if (!sourceGroup) {
            sourceGroup = this.familiesBySource[sourceId] = {};
        }

        var sourceLayerId = layer$1.sourceLayer || '_geojsonTileLayer';
        var sourceLayerFamilies = sourceGroup[sourceLayerId];
        if (!sourceLayerFamilies) {
            sourceLayerFamilies = sourceGroup[sourceLayerId] = [];
        }

        sourceLayerFamilies.push(layers);
    }
};

var padding = 1;

var GlyphAtlas = function GlyphAtlas(stacks                                           ) {
      var positions = {};
      var bins = [];

      for (var stack in stacks) {
          var glyphs = stacks[stack];
          var stackPositions = positions[stack] = {};

          for (var id in glyphs) {
              var src = glyphs[+id];
              if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) { continue; }

              var bin = {
                  x: 0,
                  y: 0,
                  w: src.bitmap.width + 2 * padding,
                  h: src.bitmap.height + 2 * padding
              };
              bins.push(bin);
              stackPositions[id] = {rect: bin, metrics: src.metrics};
          }
      }

      var ref = performance.potpack(bins);
      var w = ref.w;
      var h = ref.h;
      var image = new performance.AlphaImage({width: w || 1, height: h || 1});

      for (var stack$1 in stacks) {
          var glyphs$1 = stacks[stack$1];

          for (var id$1 in glyphs$1) {
              var src$1 = glyphs$1[+id$1];
              if (!src$1 || src$1.bitmap.width === 0 || src$1.bitmap.height === 0) { continue; }
              var bin$1 = positions[stack$1][id$1].rect;
              performance.AlphaImage.copy(src$1.bitmap, image, {x: 0, y: 0}, {x: bin$1.x + padding, y: bin$1.y + padding}, src$1.bitmap);
          }
      }

      this.image = image;
      this.positions = positions;
  };

performance.register('GlyphAtlas', GlyphAtlas);

var WorkerTile = function WorkerTile(params                  ) {
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
};

WorkerTile.prototype.parse = function parse (data        , layerIndex             , availableImages           , actor   , callback                ) {
        var this$1 = this;

    this.status = 'parsing';
    this.data = data;

    this.collisionBoxArray = new performance.CollisionBoxArray();
    var sourceLayerCoder = new performance.DictionaryCoder(Object.keys(data.layers).sort());

    var featureIndex = new performance.FeatureIndex(this.tileID, this.promoteId);
    featureIndex.bucketLayerIDs = [];

    var buckets                    = {};

    var options = {
        featureIndex: featureIndex,
        iconDependencies: {},
        patternDependencies: {},
        glyphDependencies: {},
        availableImages: availableImages
    };

    var layerFamilies = layerIndex.familiesBySource[this.source];
    for (var sourceLayerId in layerFamilies) {
        var sourceLayer = data.layers[sourceLayerId];
        if (!sourceLayer) {
            continue;
        }

        if (sourceLayer.version === 1) {
            performance.warnOnce("Vector tile source \"" + (this.source) + "\" layer \"" + sourceLayerId + "\" " +
                "does not use vector tile spec v2 and therefore may have some rendering errors.");
        }

        var sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
        var features = [];
        for (var index = 0; index < sourceLayer.length; index++) {
            var feature = sourceLayer.feature(index);
            var id = featureIndex.getId(feature, sourceLayerId);
            features.push({feature: feature, id: id, index: index, sourceLayerIndex: sourceLayerIndex});
        }

        for (var i = 0, list = layerFamilies[sourceLayerId]; i < list.length; i += 1) {
            var family = list[i];

                var layer = family[0];

            performance.assert(layer.source === this.source);
            if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) { continue; }
            if (layer.maxzoom && this.zoom >= layer.maxzoom) { continue; }
            if (layer.visibility === 'none') { continue; }

            recalculateLayers(family, this.zoom, availableImages);

            var bucket = buckets[layer.id] = layer.createBucket({
                index: featureIndex.bucketLayerIDs.length,
                layers: family,
                zoom: this.zoom,
                pixelRatio: this.pixelRatio,
                overscaling: this.overscaling,
                collisionBoxArray: this.collisionBoxArray,
                sourceLayerIndex: sourceLayerIndex,
                sourceID: this.source
            });

            bucket.populate(features, options, this.tileID.canonical);
            featureIndex.bucketLayerIDs.push(family.map(function (l) { return l.id; }));
        }
    }

    var error    ;
    var glyphMap                                        ;
    var iconMap                        ;
    var patternMap                        ;

    var stacks = performance.mapObject(options.glyphDependencies, function (glyphs) { return Object.keys(glyphs).map(Number); });
    if (Object.keys(stacks).length) {
        actor.send('getGlyphs', {uid: this.uid, stacks: stacks}, function (err, result) {
            if (!error) {
                error = err;
                glyphMap = result;
                maybePrepare.call(this$1);
            }
        });
    } else {
        glyphMap = {};
    }

    var icons = Object.keys(options.iconDependencies);
    if (icons.length) {
        actor.send('getImages', {icons: icons, source: this.source, tileID: this.tileID, type: 'icons'}, function (err, result) {
            if (!error) {
                error = err;
                iconMap = result;
                maybePrepare.call(this$1);
            }
        });
    } else {
        iconMap = {};
    }

    var patterns = Object.keys(options.patternDependencies);
    if (patterns.length) {
        actor.send('getImages', {icons: patterns, source: this.source, tileID: this.tileID, type: 'patterns'}, function (err, result) {
            if (!error) {
                error = err;
                patternMap = result;
                maybePrepare.call(this$1);
            }
        });
    } else {
        patternMap = {};
    }

    maybePrepare.call(this);

    function maybePrepare() {
        if (error) {
            return callback(error);
        } else if (glyphMap && iconMap && patternMap) {
            var glyphAtlas = new GlyphAtlas(glyphMap);
            var imageAtlas = new performance.ImageAtlas(iconMap, patternMap);

            for (var key in buckets) {
                var bucket = buckets[key];
                if (bucket instanceof performance.SymbolBucket) {
                    recalculateLayers(bucket.layers, this.zoom, availableImages);
                    performance.performSymbolLayout(bucket, glyphMap, glyphAtlas.positions, iconMap, imageAtlas.iconPositions, this.showCollisionBoxes, this.tileID.canonical);
                } else if (bucket.hasPattern &&
                    (bucket instanceof performance.LineBucket ||
                     bucket instanceof performance.FillBucket ||
                     bucket instanceof performance.FillExtrusionBucket)) {
                    recalculateLayers(bucket.layers, this.zoom, availableImages);
                    bucket.addFeatures(options, this.tileID.canonical, imageAtlas.patternPositions);
                }
            }

            this.status = 'done';
            callback(null, {
                buckets: performance.values(buckets).filter(function (b) { return !b.isEmpty(); }),
                featureIndex: featureIndex,
                collisionBoxArray: this.collisionBoxArray,
                glyphAtlasImage: glyphAtlas.image,
                imageAtlas: imageAtlas,
                // Only used for benchmarking:
                glyphMap: this.returnDependencies ? glyphMap : null,
                iconMap: this.returnDependencies ? iconMap : null,
                glyphPositions: this.returnDependencies ? glyphAtlas.positions : null
            });
        }
    }
};

function recalculateLayers(layers                            , zoom        , availableImages               ) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    var parameters = new performance.EvaluationParameters(zoom);
    for (var i = 0, list = layers; i < list.length; i += 1) {
        var layer = list[i];

        layer.recalculate(parameters, availableImages);
    }
}


/**
 * @callback LoadVectorDataCallback
 * @param error
 * @param vectorTile
 * @private
 */

/**
 * @private
 */
function loadVectorTile(params                      , callback                        ) {
    var request = performance.getArrayBuffer(params.request, function (err        , data              , cacheControl         , expires         ) {
        if (err) {
            callback(err);
        } else if (data) {
            callback(null, {
                vectorTile: new performance.vectorTile.VectorTile(new performance.pbf(data)),
                rawData: data,
                cacheControl: cacheControl,
                expires: expires
            });
        }
    });
    return function () {
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
var VectorTileWorkerSource = function VectorTileWorkerSource(actor     , layerIndex               , availableImages             , loadVectorData               ) {
      this.actor = actor;
      this.layerIndex = layerIndex;
      this.availableImages = availableImages;
      this.loadVectorData = loadVectorData || loadVectorTile;
      this.loading = {};
      this.loaded = {};
  };

  /**
   * Implements {@link WorkerSource#loadTile}. Delegates to
   * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
   * a `params.url` property) for fetching and producing a VectorTile object.
   * @private
   */
  VectorTileWorkerSource.prototype.loadTile = function loadTile (params                    , callback                  ) {
        var this$1 = this;

      var uid = params.uid;

      if (!this.loading)
          { this.loading = {}; }

      var perf = (params && params.request && params.request.collectResourceTiming) ?
          new performance.RequestPerformance(params.request) : false;

      var workerTile = this.loading[uid] = new WorkerTile(params);
      workerTile.abort = this.loadVectorData(params, function (err, response) {
          delete this$1.loading[uid];

          if (err || !response) {
              workerTile.status = 'done';
              this$1.loaded[uid] = workerTile;
              return callback(err);
          }

          var rawTileData = response.rawData;
          var cacheControl = {};
          if (response.expires) { cacheControl.expires = response.expires; }
          if (response.cacheControl) { cacheControl.cacheControl = response.cacheControl; }

          var resourceTiming = {};
          if (perf) {
              var resourceTimingData = perf.finish();
              // it's necessary to eval the result of getEntriesByName() here via parse/stringify
              // late evaluation in the main thread causes TypeError: illegal invocation
              if (resourceTimingData)
                  { resourceTiming.resourceTiming = JSON.parse(JSON.stringify(resourceTimingData)); }
          }

          workerTile.vectorTile = response.vectorTile;
          workerTile.parse(response.vectorTile, this$1.layerIndex, this$1.availableImages, this$1.actor, function (err, result) {
              if (err || !result) { return callback(err); }

              // Transferring a copy of rawTileData because the worker needs to retain its copy.
              callback(null, performance.extend({rawTileData: rawTileData.slice(0)}, result, cacheControl, resourceTiming));
          });

          this$1.loaded = this$1.loaded || {};
          this$1.loaded[uid] = workerTile;
      });
  };

  /**
   * Implements {@link WorkerSource#reloadTile}.
   * @private
   */
  VectorTileWorkerSource.prototype.reloadTile = function reloadTile (params                    , callback                  ) {
        var this$1 = this;

      var loaded = this.loaded,
          uid = params.uid,
          vtSource = this;
      if (loaded && loaded[uid]) {
          var workerTile = loaded[uid];
          workerTile.showCollisionBoxes = params.showCollisionBoxes;

          var done = function (err, data) {
              var reloadCallback = workerTile.reloadCallback;
              if (reloadCallback) {
                  delete workerTile.reloadCallback;
                  workerTile.parse(workerTile.vectorTile, vtSource.layerIndex, this$1.availableImages, vtSource.actor, reloadCallback);
              }
              callback(err, data);
          };

          if (workerTile.status === 'parsing') {
              workerTile.reloadCallback = done;
          } else if (workerTile.status === 'done') {
              // if there was no vector tile data on the initial load, don't try and re-parse tile
              if (workerTile.vectorTile) {
                  workerTile.parse(workerTile.vectorTile, this.layerIndex, this.availableImages, this.actor, done);
              } else {
                  done();
              }
          }
      }
  };

  /**
   * Implements {@link WorkerSource#abortTile}.
   *
   * @param params
   * @param params.uid The UID for this tile.
   * @private
   */
  VectorTileWorkerSource.prototype.abortTile = function abortTile (params              , callback                  ) {
      var loading = this.loading,
          uid = params.uid;
      if (loading && loading[uid] && loading[uid].abort) {
          loading[uid].abort();
          delete loading[uid];
      }
      callback();
  };

  /**
   * Implements {@link WorkerSource#removeTile}.
   *
   * @param params
   * @param params.uid The UID for this tile.
   * @private
   */
  VectorTileWorkerSource.prototype.removeTile = function removeTile (params              , callback                  ) {
      var loaded = this.loaded,
          uid = params.uid;
      if (loaded && loaded[uid]) {
          delete loaded[uid];
      }
      callback();
  };


var ImageBitmap = performance.window.ImageBitmap;

var RasterDEMTileWorkerSource = function RasterDEMTileWorkerSource() {
    this.loaded = {};
};

RasterDEMTileWorkerSource.prototype.loadTile = function loadTile (params                     , callback                   ) {
    var uid = params.uid;
        var encoding = params.encoding;
        var rawImageData = params.rawImageData;
    // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
    var imagePixels = (ImageBitmap && rawImageData instanceof ImageBitmap) ? this.getImageData(rawImageData) : rawImageData;
    var dem = new performance.DEMData(uid, imagePixels, encoding);
    this.loaded = this.loaded || {};
    this.loaded[uid] = dem;
    callback(null, dem);
};

RasterDEMTileWorkerSource.prototype.getImageData = function getImageData (imgBitmap         )        {
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
    var imgData = this.offscreenCanvasContext.getImageData(-1, -1, imgBitmap.width + 2, imgBitmap.height + 2);
    this.offscreenCanvasContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    return new performance.RGBAImage({width: imgData.width, height: imgData.height}, imgData.data);
};

RasterDEMTileWorkerSource.prototype.removeTile = function removeTile (params            ) {
    var loaded = this.loaded,
        uid = params.uid;
    if (loaded && loaded[uid]) {
        delete loaded[uid];
    }
};

var geojsonRewind = rewind;

function rewind(gj, outer) {
    var type = gj && gj.type, i;

    if (type === 'FeatureCollection') {
        for (i = 0; i < gj.features.length; i++) { rewind(gj.features[i], outer); }

    } else if (type === 'GeometryCollection') {
        for (i = 0; i < gj.geometries.length; i++) { rewind(gj.geometries[i], outer); }

    } else if (type === 'Feature') {
        rewind(gj.geometry, outer);

    } else if (type === 'Polygon') {
        rewindRings(gj.coordinates, outer);

    } else if (type === 'MultiPolygon') {
        for (i = 0; i < gj.coordinates.length; i++) { rewindRings(gj.coordinates[i], outer); }
    }

    return gj;
}

function rewindRings(rings, outer) {
    if (rings.length === 0) { return; }

    rewindRing(rings[0], outer);
    for (var i = 1; i < rings.length; i++) {
        rewindRing(rings[i], !outer);
    }
}

function rewindRing(ring, dir) {
    var area = 0;
    for (var i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
        area += (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
    }
    if (area >= 0 !== !!dir) { ring.reverse(); }
}


var toGeoJSON = performance.vectorTile.VectorTileFeature.prototype.toGeoJSON;

// The feature type used by geojson-vt and supercluster. Should be extracted to
// global type and used in module definitions for those two modules.

var FeatureWrapper = function FeatureWrapper(feature     ) {
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
};

FeatureWrapper.prototype.loadGeometry = function loadGeometry () {
    if (this._feature.type === 1) {
        var geometry = [];
        for (var i = 0, list = this._feature.geometry; i < list.length; i += 1) {
            var point = list[i];

                geometry.push([new performance.Point$1(point[0], point[1])]);
        }
        return geometry;
    } else {
        var geometry$1 = [];
        for (var i$2 = 0, list$2 = this._feature.geometry; i$2 < list$2.length; i$2 += 1) {
            var ring = list$2[i$2];

                var newRing = [];
            for (var i$1 = 0, list$1 = ring; i$1 < list$1.length; i$1 += 1) {
                var point$1 = list$1[i$1];

                    newRing.push(new performance.Point$1(point$1[0], point$1[1]));
            }
            geometry$1.push(newRing);
        }
        return geometry$1;
    }
};

FeatureWrapper.prototype.toGeoJSON = function toGeoJSON$1 (x    , y    , z    ) {
    return toGeoJSON.call(this, x, y, z);
};

var GeoJSONWrapper = function GeoJSONWrapper(features            ) {
    this.layers = {'_geojsonTileLayer': this};
    this.name = '_geojsonTileLayer';
    this.extent = performance.EXTENT;
    this.length = features.length;
    this._features = features;
};

GeoJSONWrapper.prototype.feature = function feature (i    )                {
    return new FeatureWrapper(this._features[i]);
};

'use strict';


var VectorTileFeature = performance.vectorTile.VectorTileFeature;

var geojson_wrapper = GeoJSONWrapper$1;

// conform to vectortile api
function GeoJSONWrapper$1 (features, options) {
  this.options = options || {};
  this.features = features;
  this.length = features.length;
}

GeoJSONWrapper$1.prototype.feature = function (i) {
  return new FeatureWrapper$1(this.features[i], this.options.extent)
};

function FeatureWrapper$1 (feature, extent) {
  this.id = typeof feature.id === 'number' ? feature.id : undefined;
  this.type = feature.type;
  this.rawGeometry = feature.type === 1 ? [feature.geometry] : feature.geometry;
  this.properties = feature.tags;
  this.extent = extent || 4096;
}

FeatureWrapper$1.prototype.loadGeometry = function () {
  var rings = this.rawGeometry;
  this.geometry = [];

  for (var i = 0; i < rings.length; i++) {
    var ring = rings[i];
    var newRing = [];
    for (var j = 0; j < ring.length; j++) {
      newRing.push(new performance.Point$1(ring[j][0], ring[j][1]));
    }
    this.geometry.push(newRing);
  }
  return this.geometry
};

FeatureWrapper$1.prototype.bbox = function () {
  if (!this.geometry) { this.loadGeometry(); }

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

FeatureWrapper$1.prototype.toGeoJSON = VectorTileFeature.prototype.toGeoJSON;

var vtPbf = fromVectorTileJs;
var fromVectorTileJs_1 = fromVectorTileJs;
var fromGeojsonVt_1 = fromGeojsonVt;
var GeoJSONWrapper_1 = geojson_wrapper;

/**
 * Serialize a vector-tile-js-created tile to pbf
 *
 * @param {Object} tile
 * @return {Buffer} uncompressed, pbf-serialized tile data
 */
function fromVectorTileJs (tile) {
  var out = new performance.pbf();
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
    l[k] = new geojson_wrapper(layers[k].features, options);
    l[k].name = k;
    l[k].version = options.version;
    l[k].extent = options.extent;
  }
  return fromVectorTileJs({layers: l})
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
    var keyIndex = keycache[key];
    if (typeof keyIndex === 'undefined') {
      keys.push(key);
      keyIndex = keys.length - 1;
      keycache[key] = keyIndex;
    }
    pbf.writeVarint(keyIndex);

    var value = feature.properties[key];
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
vtPbf.fromVectorTileJs = fromVectorTileJs_1;
vtPbf.fromGeojsonVt = fromGeojsonVt_1;
vtPbf.GeoJSONWrapper = GeoJSONWrapper_1;

function sortKD(ids, coords, nodeSize, left, right, depth) {
    if (right - left <= nodeSize) { return; }

    var m = (left + right) >> 1;

    select(ids, coords, m, left, right, depth % 2);

    sortKD(ids, coords, nodeSize, left, m - 1, depth + 1);
    sortKD(ids, coords, nodeSize, m + 1, right, depth + 1);
}

function select(ids, coords, k, left, right, inc) {

    while (right > left) {
        if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            select(ids, coords, k, newLeft, newRight, inc);
        }

        var t = coords[2 * k + inc];
        var i = left;
        var j = right;

        swapItem(ids, coords, left, k);
        if (coords[2 * right + inc] > t) { swapItem(ids, coords, left, right); }

        while (i < j) {
            swapItem(ids, coords, i, j);
            i++;
            j--;
            while (coords[2 * i + inc] < t) { i++; }
            while (coords[2 * j + inc] > t) { j--; }
        }

        if (coords[2 * left + inc] === t) { swapItem(ids, coords, left, j); }
        else {
            j++;
            swapItem(ids, coords, j, right);
        }

        if (j <= k) { left = j + 1; }
        if (k <= j) { right = j - 1; }
    }
}

function swapItem(ids, coords, i, j) {
    swap(ids, i, j);
    swap(coords, 2 * i, 2 * j);
    swap(coords, 2 * i + 1, 2 * j + 1);
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

function range(ids, coords, minX, minY, maxX, maxY, nodeSize) {
    var stack = [0, ids.length - 1, 0];
    var result = [];
    var x, y;

    while (stack.length) {
        var axis = stack.pop();
        var right = stack.pop();
        var left = stack.pop();

        if (right - left <= nodeSize) {
            for (var i = left; i <= right; i++) {
                x = coords[2 * i];
                y = coords[2 * i + 1];
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) { result.push(ids[i]); }
            }
            continue;
        }

        var m = Math.floor((left + right) / 2);

        x = coords[2 * m];
        y = coords[2 * m + 1];

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) { result.push(ids[m]); }

        var nextAxis = (axis + 1) % 2;

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
    var stack = [0, ids.length - 1, 0];
    var result = [];
    var r2 = r * r;

    while (stack.length) {
        var axis = stack.pop();
        var right = stack.pop();
        var left = stack.pop();

        if (right - left <= nodeSize) {
            for (var i = left; i <= right; i++) {
                if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2) { result.push(ids[i]); }
            }
            continue;
        }

        var m = Math.floor((left + right) / 2);

        var x = coords[2 * m];
        var y = coords[2 * m + 1];

        if (sqDist(x, y, qx, qy) <= r2) { result.push(ids[m]); }

        var nextAxis = (axis + 1) % 2;

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
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
}

var defaultGetX = function (p) { return p[0]; };
var defaultGetY = function (p) { return p[1]; };

var KDBush = function KDBush(points, getX, getY, nodeSize, ArrayType) {
    if ( getX === void 0 ) getX = defaultGetX;
    if ( getY === void 0 ) getY = defaultGetY;
    if ( nodeSize === void 0 ) nodeSize = 64;
    if ( ArrayType === void 0 ) ArrayType = Float64Array;

    this.nodeSize = nodeSize;
    this.points = points;

    var IndexArrayType = points.length < 65536 ? Uint16Array : Uint32Array;

    var ids = this.ids = new IndexArrayType(points.length);
    var coords = this.coords = new ArrayType(points.length * 2);

    for (var i = 0; i < points.length; i++) {
        ids[i] = i;
        coords[2 * i] = getX(points[i]);
        coords[2 * i + 1] = getY(points[i]);
    }

    sortKD(ids, coords, nodeSize, 0, ids.length - 1, 0);
};

KDBush.prototype.range = function range$1 (minX, minY, maxX, maxY) {
    return range(this.ids, this.coords, minX, minY, maxX, maxY, this.nodeSize);
};

KDBush.prototype.within = function within$1 (x, y, r) {
    return within(this.ids, this.coords, x, y, r, this.nodeSize);
};

var defaultOptions = {
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
    map: function (props) { return props; } // props => ({sum: props.my_value})
};

var Supercluster = function Supercluster(options) {
    this.options = extend(Object.create(defaultOptions), options);
    this.trees = new Array(this.options.maxZoom + 1);
};

Supercluster.prototype.load = function load (points) {
    var ref = this.options;
        var log = ref.log;
        var minZoom = ref.minZoom;
        var maxZoom = ref.maxZoom;
        var nodeSize = ref.nodeSize;

    if (log) { console.time('total time'); }

    var timerId = "prepare " + (points.length) + " points";
    if (log) { console.time(timerId); }

    this.points = points;

    // generate a cluster object for each point and index input points into a KD-tree
    var clusters = [];
    for (var i = 0; i < points.length; i++) {
        if (!points[i].geometry) { continue; }
        clusters.push(createPointCluster(points[i], i));
    }
    this.trees[maxZoom + 1] = new KDBush(clusters, getX, getY, nodeSize, Float32Array);

    if (log) { console.timeEnd(timerId); }

    // cluster points on max zoom, then cluster the results on previous zoom, etc.;
    // results in a cluster hierarchy across zoom levels
    for (var z = maxZoom; z >= minZoom; z--) {
        var now = +Date.now();

        // create a new set of clusters for the zoom and index them with a KD-tree
        clusters = this._cluster(clusters, z);
        this.trees[z] = new KDBush(clusters, getX, getY, nodeSize, Float32Array);

        if (log) { console.log('z%d: %d clusters in %dms', z, clusters.length, +Date.now() - now); }
    }

    if (log) { console.timeEnd('total time'); }

    return this;
};

Supercluster.prototype.getClusters = function getClusters (bbox, zoom) {
    var minLng = ((bbox[0] + 180) % 360 + 360) % 360 - 180;
    var minLat = Math.max(-90, Math.min(90, bbox[1]));
    var maxLng = bbox[2] === 180 ? 180 : ((bbox[2] + 180) % 360 + 360) % 360 - 180;
    var maxLat = Math.max(-90, Math.min(90, bbox[3]));

    if (bbox[2] - bbox[0] >= 360) {
        minLng = -180;
        maxLng = 180;
    } else if (minLng > maxLng) {
        var easternHem = this.getClusters([minLng, minLat, 180, maxLat], zoom);
        var westernHem = this.getClusters([-180, minLat, maxLng, maxLat], zoom);
        return easternHem.concat(westernHem);
    }

    var tree = this.trees[this._limitZoom(zoom)];
    var ids = tree.range(lngX(minLng), latY(maxLat), lngX(maxLng), latY(minLat));
    var clusters = [];
    for (var i = 0, list = ids; i < list.length; i += 1) {
        var id = list[i];

            var c = tree.points[id];
        clusters.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
    }
    return clusters;
};

Supercluster.prototype.getChildren = function getChildren (clusterId) {
    var originId = this._getOriginId(clusterId);
    var originZoom = this._getOriginZoom(clusterId);
    var errorMsg = 'No cluster with the specified id.';

    var index = this.trees[originZoom];
    if (!index) { throw new Error(errorMsg); }

    var origin = index.points[originId];
    if (!origin) { throw new Error(errorMsg); }

    var r = this.options.radius / (this.options.extent * Math.pow(2, originZoom - 1));
    var ids = index.within(origin.x, origin.y, r);
    var children = [];
    for (var i = 0, list = ids; i < list.length; i += 1) {
        var id = list[i];

            var c = index.points[id];
        if (c.parentId === clusterId) {
            children.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
        }
    }

    if (children.length === 0) { throw new Error(errorMsg); }

    return children;
};

Supercluster.prototype.getLeaves = function getLeaves (clusterId, limit, offset) {
    limit = limit || 10;
    offset = offset || 0;

    var leaves = [];
    this._appendLeaves(leaves, clusterId, limit, offset, 0);

    return leaves;
};

Supercluster.prototype.getTile = function getTile (z, x, y) {
    var tree = this.trees[this._limitZoom(z)];
    var z2 = Math.pow(2, z);
    var ref = this.options;
        var extent = ref.extent;
        var radius = ref.radius;
    var p = radius / extent;
    var top = (y - p) / z2;
    var bottom = (y + 1 + p) / z2;

    var tile = {
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
};

Supercluster.prototype.getClusterExpansionZoom = function getClusterExpansionZoom (clusterId) {
    var expansionZoom = this._getOriginZoom(clusterId) - 1;
    while (expansionZoom <= this.options.maxZoom) {
        var children = this.getChildren(clusterId);
        expansionZoom++;
        if (children.length !== 1) { break; }
        clusterId = children[0].properties.cluster_id;
    }
    return expansionZoom;
};

Supercluster.prototype._appendLeaves = function _appendLeaves (result, clusterId, limit, offset, skipped) {
    var children = this.getChildren(clusterId);

    for (var i = 0, list = children; i < list.length; i += 1) {
        var child = list[i];

            var props = child.properties;

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
        if (result.length === limit) { break; }
    }

    return skipped;
};

Supercluster.prototype._addTileFeatures = function _addTileFeatures (ids, points, x, y, z2, tile) {
    for (var i$1 = 0, list = ids; i$1 < list.length; i$1 += 1) {
        var i = list[i$1];

            var c = points[i];
        var isCluster = c.numPoints;
        var f = {
            type: 1,
            geometry: [[
                Math.round(this.options.extent * (c.x * z2 - x)),
                Math.round(this.options.extent * (c.y * z2 - y))
            ]],
            tags: isCluster ? getClusterProperties(c) : this.points[c.index].properties
        };

        // assign id
        var id = (void 0);
        if (isCluster) {
            id = c.id;
        } else if (this.options.generateId) {
            // optionally generate id
            id = c.index;
        } else if (this.points[c.index].id) {
            // keep id if already assigned
            id = this.points[c.index].id;
        }

        if (id !== undefined) { f.id = id; }

        tile.features.push(f);
    }
};

Supercluster.prototype._limitZoom = function _limitZoom (z) {
    return Math.max(this.options.minZoom, Math.min(+z, this.options.maxZoom + 1));
};

Supercluster.prototype._cluster = function _cluster (points, zoom) {
    var clusters = [];
    var ref = this.options;
        var radius = ref.radius;
        var extent = ref.extent;
        var reduce = ref.reduce;
        var minPoints = ref.minPoints;
    var r = radius / (extent * Math.pow(2, zoom));

    // loop through each point
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        // if we've already visited the point at this zoom level, skip it
        if (p.zoom <= zoom) { continue; }
        p.zoom = zoom;

        // find all nearby points
        var tree = this.trees[zoom + 1];
        var neighborIds = tree.within(p.x, p.y, r);

        var numPointsOrigin = p.numPoints || 1;
        var numPoints = numPointsOrigin;

        // count the number of points in a potential cluster
        for (var i$1 = 0, list = neighborIds; i$1 < list.length; i$1 += 1) {
            var neighborId = list[i$1];

                var b = tree.points[neighborId];
            // filter out neighbors that are already processed
            if (b.zoom > zoom) { numPoints += b.numPoints || 1; }
        }

        if (numPoints >= minPoints) { // enough points to form a cluster
            var wx = p.x * numPointsOrigin;
            var wy = p.y * numPointsOrigin;

            var clusterProperties = reduce && numPointsOrigin > 1 ? this._map(p, true) : null;

            // encode both zoom and point index on which the cluster originated -- offset by total length of features
            var id = (i << 5) + (zoom + 1) + this.points.length;

            for (var i$2 = 0, list$1 = neighborIds; i$2 < list$1.length; i$2 += 1) {
                var neighborId$1 = list$1[i$2];

                    var b$1 = tree.points[neighborId$1];

                if (b$1.zoom <= zoom) { continue; }
                b$1.zoom = zoom; // save the zoom (so it doesn't get processed twice)

                var numPoints2 = b$1.numPoints || 1;
                wx += b$1.x * numPoints2; // accumulate coordinates for calculating weighted center
                wy += b$1.y * numPoints2;

                b$1.parentId = id;

                if (reduce) {
                    if (!clusterProperties) { clusterProperties = this._map(p, true); }
                    reduce(clusterProperties, this._map(b$1));
                }
            }

            p.parentId = id;
            clusters.push(createCluster(wx / numPoints, wy / numPoints, id, numPoints, clusterProperties));

        } else { // left points as unclustered
            clusters.push(p);

            if (numPoints > 1) {
                for (var i$3 = 0, list$2 = neighborIds; i$3 < list$2.length; i$3 += 1) {
                    var neighborId$2 = list$2[i$3];

                        var b$2 = tree.points[neighborId$2];
                    if (b$2.zoom <= zoom) { continue; }
                    b$2.zoom = zoom;
                    clusters.push(b$2);
                }
            }
        }
    }

    return clusters;
};

// get index of the point from which the cluster originated
Supercluster.prototype._getOriginId = function _getOriginId (clusterId) {
    return (clusterId - this.points.length) >> 5;
};

// get zoom of the point from which the cluster originated
Supercluster.prototype._getOriginZoom = function _getOriginZoom (clusterId) {
    return (clusterId - this.points.length) % 32;
};

Supercluster.prototype._map = function _map (point, clone) {
    if (point.numPoints) {
        return clone ? extend({}, point.properties) : point.properties;
    }
    var original = this.points[point.index].properties;
    var result = this.options.map(original);
    return clone && result === original ? extend({}, result) : result;
};

function createCluster(x, y, id, numPoints, properties) {
    return {
        x: x, // weighted cluster center
        y: y,
        zoom: Infinity, // the last zoom the cluster was processed at
        id: id, // encodes index of the first child of the cluster and its zoom level
        parentId: -1, // parent cluster id
        numPoints: numPoints,
        properties: properties
    };
}

function createPointCluster(p, id) {
    var ref = p.geometry.coordinates;
    var x = ref[0];
    var y = ref[1];
    return {
        x: lngX(x), // projected point coordinates
        y: latY(y),
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
    var count = cluster.numPoints;
    var abbrev =
        count >= 10000 ? ((Math.round(count / 1000)) + "k") :
        count >= 1000 ? ((Math.round(count / 100) / 10) + "k") : count;
    return extend(extend({}, cluster.properties), {
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
    var sin = Math.sin(lat * Math.PI / 180);
    var y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return y < 0 ? 0 : y > 1 ? 1 : y;
}

// spherical mercator to longitude/latitude
function xLng(x) {
    return (x - 0.5) * 360;
}
function yLat(y) {
    var y2 = (180 - y * 360) * Math.PI / 180;
    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;
}

function extend(dest, src) {
    for (var id in src) { dest[id] = src[id]; }
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
        if (index - first > 3) { simplify(coords, first, index, sqTolerance); }
        coords[index + 2] = maxSqDist;
        if (last - index > 3) { simplify(coords, index, last, sqTolerance); }
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
    if (!geojson.geometry) { return; }

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

    if (minAll >= k1 && maxAll < k2) { return features; } // trivial accept
    else if (maxAll < k1 || minAll >= k2) { return null; } // trivial reject

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

        if (trackMetrics) { segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2)); }

        if (a < k1) {
            // ---|-->  | (line enters the clip region from the left)
            if (b > k1) {
                t = intersect(slice, ax, ay, bx, by, k1);
                if (trackMetrics) { slice.start = len + segLen * t; }
            }
        } else if (a > k2) {
            // |  <--|--- (line enters the clip region from the right)
            if (b < k2) {
                t = intersect(slice, ax, ay, bx, by, k2);
                if (trackMetrics) { slice.start = len + segLen * t; }
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
            if (trackMetrics) { slice.end = len + segLen * t; }
            newGeom.push(slice);
            slice = newSlice(geom);
        }

        if (trackMetrics) { len += segLen; }
    }

    // add the last point
    var last = geom.length - 3;
    ax = geom[last];
    ay = geom[last + 1];
    az = geom[last + 2];
    a = axis === 0 ? ax : ay;
    if (a >= k1 && a <= k2) { addPoint(slice, ax, ay, az); }

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

        if (left) { merged = shiftFeatureCoords(left, 1).concat(merged); } // merge left into center
        if (right) { merged = merged.concat(shiftFeatureCoords(right, -1)); } // merge right into center
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
    if (tile.transformed) { return tile; }

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

        if (minX < tile.minX) { tile.minX = minX; }
        if (minY < tile.minY) { tile.minY = minY; }
        if (maxX > tile.maxX) { tile.maxX = maxX; }
        if (maxY > tile.maxY) { tile.maxY = maxY; }
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
            for (var key in feature.tags) { tags[key] = feature.tags[key]; }
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

    if (isPolygon) { rewind$1(ring, isOuter); }

    result.push(ring);
}

function rewind$1(ring, clockwise) {
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
    options = this.options = extend$1(Object.create(this.options), options);

    var debug = options.debug;

    if (debug) { console.time('preprocess data'); }

    if (options.maxZoom < 0 || options.maxZoom > 24) { throw new Error('maxZoom should be in the 0-24 range'); }
    if (options.promoteId && options.generateId) { throw new Error('promoteId and generateId cannot be used together.'); }

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
    if (features.length) { this.splitTile(features, 0, 0, 0); }

    if (debug) {
        if (features.length) { console.log('features: %d, points: %d', this.tiles[0].numFeatures, this.tiles[0].numPoints); }
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
            if (debug > 1) { console.time('creation'); }

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
            if (z === options.indexMaxZoom || tile.numPoints <= options.indexMaxPoints) { continue; }

        // if a drilldown to a specific tile
        } else {
            // stop tiling if we reached base zoom or our target tile zoom
            if (z === options.maxZoom || z === cz) { continue; }

            // stop tiling if it's not an ancestor of the target tile
            var m = 1 << (cz - z);
            if (x !== Math.floor(cx / m) || y !== Math.floor(cy / m)) { continue; }
        }

        // if we slice further down, no need to keep source geometry
        tile.source = null;

        if (features.length === 0) { continue; }

        if (debug > 1) { console.time('clipping'); }

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

        if (debug > 1) { console.timeEnd('clipping'); }

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

    if (z < 0 || z > 24) { return null; }

    var z2 = 1 << z;
    x = ((x % z2) + z2) % z2; // wrap tile x coordinate

    var id = toID(z, x, y);
    if (this.tiles[id]) { return transformTile(this.tiles[id], extent); }

    if (debug > 1) { console.log('drilling down to z%d-%d-%d', z, x, y); }

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

    if (!parent || !parent.source) { return null; }

    // if we found a parent tile containing the original geometry, we can drill down from it
    if (debug > 1) { console.log('found parent tile z%d-%d-%d', z0, x0, y0); }

    if (debug > 1) { console.time('drilling down'); }
    this.splitTile(parent.source, z0, x0, y0, z, x, y);
    if (debug > 1) { console.timeEnd('drilling down'); }

    return this.tiles[id] ? transformTile(this.tiles[id], extent) : null;
};

function toID(z, x, y) {
    return (((1 << z) * y + x) * 32) + z;
}

function extend$1(dest, src) {
    for (var i in src) { dest[i] = src[i]; }
    return dest;
}


function loadGeoJSONTile(params                      , callback                        ) {
    var canonical = params.tileID.canonical;

    if (!this._geoJSONIndex) {
        return callback(null, null);  // we couldn't load the file
    }

    var geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
    if (!geoJSONTile) {
        return callback(null, null); // nothing in the given tile
    }

    var geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

    // Encode the geojson-vt tile into binary vector tile form.  This
    // is a convenience that allows `FeatureIndex` to operate the same way
    // across `VectorTileSource` and `GeoJSONSource` data.
    var pbf = vtPbf(geojsonWrapper);
    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
        pbf = new Uint8Array(pbf);
    }

    callback(null, {
        vectorTile: geojsonWrapper,
        rawData: pbf.buffer
    });
}

                        // 'loadData' received while coalescing, trigger one more 'loadData' on receiving 'coalesced'

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
var GeoJSONWorkerSource = /*@__PURE__*/(function (VectorTileWorkerSource) {
  function GeoJSONWorkerSource(actor       , layerIndex                 , availableImages               , loadGeoJSON              ) {
        VectorTileWorkerSource.call(this, actor, layerIndex, availableImages, loadGeoJSONTile);
        if (loadGeoJSON) {
            this.loadGeoJSON = loadGeoJSON;
        }
    }

  if ( VectorTileWorkerSource ) GeoJSONWorkerSource.__proto__ = VectorTileWorkerSource;
  GeoJSONWorkerSource.prototype = Object.create( VectorTileWorkerSource && VectorTileWorkerSource.prototype );
  GeoJSONWorkerSource.prototype.constructor = GeoJSONWorkerSource;

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
    GeoJSONWorkerSource.prototype.loadData = function loadData (params                       , callback

                              ) {
        if (this._pendingCallback) {
            // Tell the foreground the previous call has been abandoned
            this._pendingCallback(null, {abandoned: true});
        }
        this._pendingCallback = callback;
        this._pendingLoadDataParams = params;

        if (this._state &&
            this._state !== 'Idle') {
            this._state = 'NeedsLoadData';
        } else {
            this._state = 'Coalescing';
            this._loadData();
        }
    };

    /**
     * Internal implementation: called directly by `loadData`
     * or by `coalesce` using stored parameters.
     */
    GeoJSONWorkerSource.prototype._loadData = function _loadData () {
        var this$1 = this;

        if (!this._pendingCallback || !this._pendingLoadDataParams) {
            performance.assert(false);
            return;
        }
        var callback = this._pendingCallback;
        var params = this._pendingLoadDataParams;
        delete this._pendingCallback;
        delete this._pendingLoadDataParams;

        var perf = (params && params.request && params.request.collectResourceTiming) ?
            new performance.RequestPerformance(params.request) : false;

        this.loadGeoJSON(params, function (err        , data         ) {
            if (err || !data) {
                return callback(err);
            } else if (typeof data !== 'object') {
                return callback(new Error(("Input data given to '" + (params.source) + "' is not a valid GeoJSON object.")));
            } else {
                geojsonRewind(data, true);

                try {
                    if (params.filter) {
                        var compiled = performance.createExpression(params.filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false});
                        if (compiled.result === 'error')
                            { throw new Error(compiled.value.map(function (err) { return ((err.key) + ": " + (err.message)); }).join(', ')); }

                        var features = data.features.filter(function (feature) { return compiled.value.evaluate({zoom: 0}, feature); });
                        data = {type: 'FeatureCollection', features: features};
                    }

                    this$1._geoJSONIndex = params.cluster ?
                        new Supercluster(getSuperclusterOptions(params)).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                } catch (err) {
                    return callback(err);
                }

                this$1.loaded = {};

                var result = {};
                if (perf) {
                    var resourceTimingData = perf.finish();
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
    };

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
    GeoJSONWorkerSource.prototype.coalesce = function coalesce () {
        if (this._state === 'Coalescing') {
            this._state = 'Idle';
        } else if (this._state === 'NeedsLoadData') {
            this._state = 'Coalescing';
            this._loadData();
        }
    };

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
    GeoJSONWorkerSource.prototype.reloadTile = function reloadTile (params                      , callback                    ) {
        var loaded = this.loaded,
            uid = params.uid;

        if (loaded && loaded[uid]) {
            return VectorTileWorkerSource.prototype.reloadTile.call(this, params, callback);
        } else {
            return this.loadTile(params, callback);
        }
    };

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
    GeoJSONWorkerSource.prototype.loadGeoJSON = function loadGeoJSON (params                       , callback                          ) {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            performance.getJSON(params.request, callback);
        } else if (typeof params.data === 'string') {
            try {
                return callback(null, JSON.parse(params.data));
            } catch (e) {
                return callback(new Error(("Input data given to '" + (params.source) + "' is not a valid GeoJSON object.")));
            }
        } else {
            return callback(new Error(("Input data given to '" + (params.source) + "' is not a valid GeoJSON object.")));
        }
    };

    GeoJSONWorkerSource.prototype.removeSource = function removeSource (params                  , callback                 ) {
        if (this._pendingCallback) {
            // Don't leak callbacks
            this._pendingCallback(null, {abandoned: true});
        }
        callback();
    };

    GeoJSONWorkerSource.prototype.getClusterExpansionZoom = function getClusterExpansionZoom (params                     , callback                  ) {
        try {
            callback(null, this._geoJSONIndex.getClusterExpansionZoom(params.clusterId));
        } catch (e) {
            callback(e);
        }
    };

    GeoJSONWorkerSource.prototype.getClusterChildren = function getClusterChildren (params                     , callback                                 ) {
        try {
            callback(null, this._geoJSONIndex.getChildren(params.clusterId));
        } catch (e) {
            callback(e);
        }
    };

    GeoJSONWorkerSource.prototype.getClusterLeaves = function getClusterLeaves (params                                                    , callback                                 ) {
        try {
            callback(null, this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset));
        } catch (e) {
            callback(e);
        }
    };

  return GeoJSONWorkerSource;
}(VectorTileWorkerSource));

function getSuperclusterOptions(ref) {
    var superclusterOptions = ref.superclusterOptions;
    var clusterProperties = ref.clusterProperties;

    if (!clusterProperties || !superclusterOptions) { return superclusterOptions; }

    var mapExpressions = {};
    var reduceExpressions = {};
    var globals = {accumulated: null, zoom: 0};
    var feature = {properties: null};
    var propertyNames = Object.keys(clusterProperties);

    for (var i = 0, list = propertyNames; i < list.length; i += 1) {
        var key = list[i];

      var ref$1 = clusterProperties[key];
        var operator = ref$1[0];
        var mapExpression = ref$1[1];

        var mapExpressionParsed = performance.createExpression(mapExpression);
        var reduceExpressionParsed = performance.createExpression(
            typeof operator === 'string' ? [operator, ['accumulated'], ['get', key]] : operator);

        performance.assert(mapExpressionParsed.result === 'success');
        performance.assert(reduceExpressionParsed.result === 'success');

        mapExpressions[key] = mapExpressionParsed.value;
        reduceExpressions[key] = reduceExpressionParsed.value;
    }

    superclusterOptions.map = function (pointProperties) {
        feature.properties = pointProperties;
        var properties = {};
        for (var i = 0, list = propertyNames; i < list.length; i += 1) {
            var key = list[i];

          properties[key] = mapExpressions[key].evaluate(globals, feature);
        }
        return properties;
    };
    superclusterOptions.reduce = function (accumulated, clusterProperties) {
        feature.properties = clusterProperties;
        for (var i = 0, list = propertyNames; i < list.length; i += 1) {
            var key = list[i];

          globals.accumulated = accumulated[key];
            accumulated[key] = reduceExpressions[key].evaluate(globals, feature);
        }
    };

    return superclusterOptions;
}


/**
 * @private
 */
var Worker = function Worker(self                        ) {
    var this$1 = this;

    debugger;

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

    this.self.registerWorkerSource = function (name    , WorkerSource                 ) {
        if (this$1.workerSourceTypes[name]) {
            throw new Error(("Worker source with name \"" + name + "\" already registered."));
        }
        this$1.workerSourceTypes[name] = WorkerSource;
    };

    // This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
    this.self.registerRTLTextPlugin = function (rtlTextPlugin                                                                                                           ) {
        if (performance.plugin.isParsed()) {
            throw new Error('RTL text plugin already registered.');
        }
        performance.plugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
        performance.plugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
        performance.plugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
    };
};

Worker.prototype.setReferrer = function setReferrer (mapID    , referrer    ) {
    this.referrer = referrer;
};

Worker.prototype.setImages = function setImages (mapId    , images           , callback                ) {
    this.availableImages[mapId] = images;
    for (var workerSource in this.workerSources[mapId]) {
        var ws = this.workerSources[mapId][workerSource];
        for (var source in ws) {
            ws[source].availableImages = images;
        }
    }
    callback();
};

Worker.prototype.setLayers = function setLayers (mapId    , layers                       , callback                ) {
    this.getLayerIndex(mapId).replace(layers);
    callback();
};

Worker.prototype.updateLayers = function updateLayers (mapId    , params                                                            , callback                ) {
    this.getLayerIndex(mapId).update(params.layers, params.removedIds);
    callback();
};

Worker.prototype.loadTile = function loadTile (mapId    , params                                   , callback                ) {
    debugger;

    performance.assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).loadTile(params, callback);
};

Worker.prototype.loadDEMTile = function loadDEMTile (mapId    , params                     , callback                   ) {
    this.getDEMWorkerSource(mapId, params.source).loadTile(params, callback);
};

Worker.prototype.reloadTile = function reloadTile (mapId    , params                                   , callback                ) {
    performance.assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).reloadTile(params, callback);
};

Worker.prototype.abortTile = function abortTile (mapId    , params                             , callback                ) {
    performance.assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).abortTile(params, callback);
};

Worker.prototype.removeTile = function removeTile (mapId    , params                             , callback                ) {
    performance.assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).removeTile(params, callback);
};

Worker.prototype.removeDEMTile = function removeDEMTile (mapId    , params            ) {
    this.getDEMWorkerSource(mapId, params.source).removeTile(params);
};

Worker.prototype.removeSource = function removeSource (mapId    , params                               , callback                ) {
    performance.assert(params.type);
    performance.assert(params.source);

    if (!this.workerSources[mapId] ||
        !this.workerSources[mapId][params.type] ||
        !this.workerSources[mapId][params.type][params.source]) {
        return;
    }

    var worker = this.workerSources[mapId][params.type][params.source];
    delete this.workerSources[mapId][params.type][params.source];

    if (worker.removeSource !== undefined) {
        worker.removeSource(params, callback);
    } else {
        callback();
    }
};

/**
 * Load a {@link WorkerSource} script at params.url.  The script is run
 * (using importScripts) with `registerWorkerSource` in scope, which is a
 * function taking `(name, workerSourceObject)`.
 *  @private
 */
Worker.prototype.loadWorkerSource = function loadWorkerSource (map    , params             , callback            ) {
    try {
        this.self.importScripts(params.url);
        callback();
    } catch (e) {
        callback(e.toString());
    }
};

Worker.prototype.syncRTLPluginState = function syncRTLPluginState (map    , state         , callback               ) {
    try {
        performance.plugin.setState(state);
        var pluginURL = performance.plugin.getPluginURL();
        if (
            performance.plugin.isLoaded() &&
            !performance.plugin.isParsed() &&
            pluginURL != null // Not possible when `isLoaded` is true, but keeps flow happy
        ) {
            this.self.importScripts(pluginURL);
            var complete = performance.plugin.isParsed();
            var error = complete ? undefined : new Error(("RTL Text Plugin failed to import scripts from " + pluginURL));
            callback(error, complete);
        }
    } catch (e) {
        callback(e.toString());
    }
};

Worker.prototype.getAvailableImages = function getAvailableImages (mapId    ) {
    var availableImages = this.availableImages[mapId];

    if (!availableImages) {
        availableImages = [];
    }

    return availableImages;
};

Worker.prototype.getLayerIndex = function getLayerIndex (mapId    ) {
    var layerIndexes = this.layerIndexes[mapId];
    if (!layerIndexes) {
        layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
    }
    return layerIndexes;
};

Worker.prototype.getWorkerSource = function getWorkerSource (mapId    , type    , source    ) {
        var this$1 = this;

    if (!this.workerSources[mapId])
        { this.workerSources[mapId] = {}; }
    if (!this.workerSources[mapId][type])
        { this.workerSources[mapId][type] = {}; }

    if (!this.workerSources[mapId][type][source]) {
        // use a wrapped actor so that we can attach a target mapId param
        // to any messages invoked by the WorkerSource
        var actor = {
            send: function (type, data, callback) {
                this$1.actor.send(type, data, callback, mapId);
            }
        };
        this.workerSources[mapId][type][source] = new (this.workerSourceTypes[type] )((actor ), this.getLayerIndex(mapId), this.getAvailableImages(mapId));
    }

    return this.workerSources[mapId][type][source];
};

Worker.prototype.getDEMWorkerSource = function getDEMWorkerSource (mapId    , source    ) {
    if (!this.demWorkerSources[mapId])
        { this.demWorkerSources[mapId] = {}; }

    if (!this.demWorkerSources[mapId][source]) {
        this.demWorkerSources[mapId][source] = new RasterDEMTileWorkerSource();
    }

    return this.demWorkerSources[mapId][source];
};

Worker.prototype.enforceCacheSizeLimit = function enforceCacheSizeLimit$1 (mapId    , limit    ) {
    performance.enforceCacheSizeLimit(limit);
};

/* global self, WorkerGlobalScope */
if (typeof WorkerGlobalScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    self instanceof WorkerGlobalScope) {
    self.worker = new Worker(self);
}

return Worker;

});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2VyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc3R5bGUtc3BlYy9ncm91cF9ieV9sYXlvdXQuanMiLCIuLi8uLi8uLi9zcmMvc3R5bGUvc3R5bGVfbGF5ZXJfaW5kZXguanMiLCIuLi8uLi8uLi9zcmMvcmVuZGVyL2dseXBoX2F0bGFzLmpzIiwiLi4vLi4vLi4vc3JjL3NvdXJjZS93b3JrZXJfdGlsZS5qcyIsIi4uLy4uLy4uL3NyYy9zb3VyY2UvdmVjdG9yX3RpbGVfd29ya2VyX3NvdXJjZS5qcyIsIi4uLy4uLy4uL3NyYy9zb3VyY2UvcmFzdGVyX2RlbV90aWxlX3dvcmtlcl9zb3VyY2UuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQG1hcGJveC9nZW9qc29uLXJld2luZC9pbmRleC5qcyIsIi4uLy4uLy4uL3NyYy9zb3VyY2UvZ2VvanNvbl93cmFwcGVyLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Z0LXBiZi9saWIvZ2VvanNvbl93cmFwcGVyLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3Z0LXBiZi9pbmRleC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9rZGJ1c2gvc3JjL3NvcnQuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMva2RidXNoL3NyYy9yYW5nZS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9rZGJ1c2gvc3JjL3dpdGhpbi5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9rZGJ1c2gvc3JjL2luZGV4LmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3N1cGVyY2x1c3Rlci9pbmRleC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy9zaW1wbGlmeS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy9mZWF0dXJlLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2dlb2pzb24tdnQvc3JjL2NvbnZlcnQuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvZ2VvanNvbi12dC9zcmMvY2xpcC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy93cmFwLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2dlb2pzb24tdnQvc3JjL3RyYW5zZm9ybS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9nZW9qc29uLXZ0L3NyYy90aWxlLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL2dlb2pzb24tdnQvc3JjL2luZGV4LmpzIiwiLi4vLi4vLi4vc3JjL3NvdXJjZS9nZW9qc29uX3dvcmtlcl9zb3VyY2UuanMiLCIuLi8uLi8uLi9zcmMvc291cmNlL3dvcmtlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcbmltcG9ydCByZWZQcm9wZXJ0aWVzIGZyb20gJy4vdXRpbC9yZWZfcHJvcGVydGllcyc7XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeShvYmopIHtcbiAgICBjb25zdCB0eXBlID0gdHlwZW9mIG9iajtcbiAgICBpZiAodHlwZSA9PT0gJ251bWJlcicgfHwgdHlwZSA9PT0gJ2Jvb2xlYW4nIHx8IHR5cGUgPT09ICdzdHJpbmcnIHx8IG9iaiA9PT0gdW5kZWZpbmVkIHx8IG9iaiA9PT0gbnVsbClcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaik7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICAgIGxldCBzdHIgPSAnWyc7XG4gICAgICAgIGZvciAoY29uc3QgdmFsIG9mIG9iaikge1xuICAgICAgICAgICAgc3RyICs9IGAke3N0cmluZ2lmeSh2YWwpfSxgO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBgJHtzdHJ9XWA7XG4gICAgfVxuXG4gICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iaikuc29ydCgpO1xuXG4gICAgbGV0IHN0ciA9ICd7JztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc3RyICs9IGAke0pTT04uc3RyaW5naWZ5KGtleXNbaV0pfToke3N0cmluZ2lmeShvYmpba2V5c1tpXV0pfSxgO1xuICAgIH1cbiAgICByZXR1cm4gYCR7c3RyfX1gO1xufVxuXG5mdW5jdGlvbiBnZXRLZXkobGF5ZXIpIHtcbiAgICBsZXQga2V5ID0gJyc7XG4gICAgZm9yIChjb25zdCBrIG9mIHJlZlByb3BlcnRpZXMpIHtcbiAgICAgICAga2V5ICs9IGAvJHtzdHJpbmdpZnkobGF5ZXJba10pfWA7XG4gICAgfVxuICAgIHJldHVybiBrZXk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGdyb3VwQnlMYXlvdXQ7XG5cbi8qKlxuICogR2l2ZW4gYW4gYXJyYXkgb2YgbGF5ZXJzLCByZXR1cm4gYW4gYXJyYXkgb2YgYXJyYXlzIG9mIGxheWVycyB3aGVyZSBhbGxcbiAqIGxheWVycyBpbiBlYWNoIGdyb3VwIGhhdmUgaWRlbnRpY2FsIGxheW91dC1hZmZlY3RpbmcgcHJvcGVydGllcy4gVGhlc2VcbiAqIGFyZSB0aGUgcHJvcGVydGllcyB0aGF0IHdlcmUgZm9ybWVybHkgdXNlZCBieSBleHBsaWNpdCBgcmVmYCBtZWNoYW5pc21cbiAqIGZvciBsYXllcnM6ICd0eXBlJywgJ3NvdXJjZScsICdzb3VyY2UtbGF5ZXInLCAnbWluem9vbScsICdtYXh6b29tJyxcbiAqICdmaWx0ZXInLCBhbmQgJ2xheW91dCcuXG4gKlxuICogVGhlIGlucHV0IGlzIG5vdCBtb2RpZmllZC4gVGhlIG91dHB1dCBsYXllcnMgYXJlIHJlZmVyZW5jZXMgdG8gdGhlXG4gKiBpbnB1dCBsYXllcnMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7QXJyYXk8TGF5ZXI+fSBsYXllcnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbY2FjaGVkS2V5c10gLSBhbiBvYmplY3QgdG8ga2VlcCBhbHJlYWR5IGNhbGN1bGF0ZWQga2V5cy5cbiAqIEByZXR1cm5zIHtBcnJheTxBcnJheTxMYXllcj4+fVxuICovXG5mdW5jdGlvbiBncm91cEJ5TGF5b3V0KGxheWVycywgY2FjaGVkS2V5cykge1xuICAgIGNvbnN0IGdyb3VwcyA9IHt9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICBjb25zdCBrID0gKGNhY2hlZEtleXMgJiYgY2FjaGVkS2V5c1tsYXllcnNbaV0uaWRdKSB8fCBnZXRLZXkobGF5ZXJzW2ldKTtcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBjYWNoZSBpZiB0aGVyZSBpcyBvbmVcbiAgICAgICAgaWYgKGNhY2hlZEtleXMpXG4gICAgICAgICAgICBjYWNoZWRLZXlzW2xheWVyc1tpXS5pZF0gPSBrO1xuXG4gICAgICAgIGxldCBncm91cCA9IGdyb3Vwc1trXTtcbiAgICAgICAgaWYgKCFncm91cCkge1xuICAgICAgICAgICAgZ3JvdXAgPSBncm91cHNba10gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBncm91cC5wdXNoKGxheWVyc1tpXSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGsgaW4gZ3JvdXBzKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGdyb3Vwc1trXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIi8vIEBmbG93XG5cbmltcG9ydCBTdHlsZUxheWVyIGZyb20gJy4vc3R5bGVfbGF5ZXInO1xuaW1wb3J0IGNyZWF0ZVN0eWxlTGF5ZXIgZnJvbSAnLi9jcmVhdGVfc3R5bGVfbGF5ZXInO1xuXG5pbXBvcnQge3ZhbHVlc30gZnJvbSAnLi4vdXRpbC91dGlsJztcbmltcG9ydCBmZWF0dXJlRmlsdGVyIGZyb20gJy4uL3N0eWxlLXNwZWMvZmVhdHVyZV9maWx0ZXInO1xuaW1wb3J0IGdyb3VwQnlMYXlvdXQgZnJvbSAnLi4vc3R5bGUtc3BlYy9ncm91cF9ieV9sYXlvdXQnO1xuXG5pbXBvcnQgdHlwZSB7VHlwZWRTdHlsZUxheWVyfSBmcm9tICcuL3N0eWxlX2xheWVyL3R5cGVkX3N0eWxlX2xheWVyJztcbmltcG9ydCB0eXBlIHtMYXllclNwZWNpZmljYXRpb259IGZyb20gJy4uL3N0eWxlLXNwZWMvdHlwZXMnO1xuXG5leHBvcnQgdHlwZSBMYXllckNvbmZpZ3MgPSB7W186IHN0cmluZ106IExheWVyU3BlY2lmaWNhdGlvbiB9O1xuZXhwb3J0IHR5cGUgRmFtaWx5PExheWVyOiBUeXBlZFN0eWxlTGF5ZXI+ID0gQXJyYXk8TGF5ZXI+O1xuXG5jbGFzcyBTdHlsZUxheWVySW5kZXgge1xuICAgIGZhbWlsaWVzQnlTb3VyY2U6IHsgW3NvdXJjZTogc3RyaW5nXTogeyBbc291cmNlTGF5ZXI6IHN0cmluZ106IEFycmF5PEZhbWlseTwqPj4gfSB9O1xuICAgIGtleUNhY2hlOiB7IFtzb3VyY2U6IHN0cmluZ106IHN0cmluZyB9O1xuXG4gICAgX2xheWVyQ29uZmlnczogTGF5ZXJDb25maWdzO1xuICAgIF9sYXllcnM6IHtbXzogc3RyaW5nXTogU3R5bGVMYXllciB9O1xuXG4gICAgY29uc3RydWN0b3IobGF5ZXJDb25maWdzOiA/QXJyYXk8TGF5ZXJTcGVjaWZpY2F0aW9uPikge1xuICAgICAgICB0aGlzLmtleUNhY2hlID0ge307XG4gICAgICAgIGlmIChsYXllckNvbmZpZ3MpIHtcbiAgICAgICAgICAgIHRoaXMucmVwbGFjZShsYXllckNvbmZpZ3MpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVwbGFjZShsYXllckNvbmZpZ3M6IEFycmF5PExheWVyU3BlY2lmaWNhdGlvbj4pIHtcbiAgICAgICAgdGhpcy5fbGF5ZXJDb25maWdzID0ge307XG4gICAgICAgIHRoaXMuX2xheWVycyA9IHt9O1xuICAgICAgICB0aGlzLnVwZGF0ZShsYXllckNvbmZpZ3MsIFtdKTtcbiAgICB9XG5cbiAgICB1cGRhdGUobGF5ZXJDb25maWdzOiBBcnJheTxMYXllclNwZWNpZmljYXRpb24+LCByZW1vdmVkSWRzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgICAgIGZvciAoY29uc3QgbGF5ZXJDb25maWcgb2YgbGF5ZXJDb25maWdzKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXllckNvbmZpZ3NbbGF5ZXJDb25maWcuaWRdID0gbGF5ZXJDb25maWc7XG5cbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5fbGF5ZXJzW2xheWVyQ29uZmlnLmlkXSA9IGNyZWF0ZVN0eWxlTGF5ZXIobGF5ZXJDb25maWcpO1xuICAgICAgICAgICAgbGF5ZXIuX2ZlYXR1cmVGaWx0ZXIgPSBmZWF0dXJlRmlsdGVyKGxheWVyLmZpbHRlcik7XG4gICAgICAgICAgICBpZiAodGhpcy5rZXlDYWNoZVtsYXllckNvbmZpZy5pZF0pXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMua2V5Q2FjaGVbbGF5ZXJDb25maWcuaWRdO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgaWQgb2YgcmVtb3ZlZElkcykge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMua2V5Q2FjaGVbaWRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xheWVyQ29uZmlnc1tpZF07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGF5ZXJzW2lkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmFtaWxpZXNCeVNvdXJjZSA9IHt9O1xuXG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IGdyb3VwQnlMYXlvdXQodmFsdWVzKHRoaXMuX2xheWVyQ29uZmlncyksIHRoaXMua2V5Q2FjaGUpO1xuXG4gICAgICAgIGZvciAoY29uc3QgbGF5ZXJDb25maWdzIG9mIGdyb3Vwcykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gbGF5ZXJDb25maWdzLm1hcCgobGF5ZXJDb25maWcpID0+IHRoaXMuX2xheWVyc1tsYXllckNvbmZpZy5pZF0pO1xuXG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyc1swXTtcbiAgICAgICAgICAgIGlmIChsYXllci52aXNpYmlsaXR5ID09PSAnbm9uZScpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc291cmNlSWQgPSBsYXllci5zb3VyY2UgfHwgJyc7XG4gICAgICAgICAgICBsZXQgc291cmNlR3JvdXAgPSB0aGlzLmZhbWlsaWVzQnlTb3VyY2Vbc291cmNlSWRdO1xuICAgICAgICAgICAgaWYgKCFzb3VyY2VHcm91cCkge1xuICAgICAgICAgICAgICAgIHNvdXJjZUdyb3VwID0gdGhpcy5mYW1pbGllc0J5U291cmNlW3NvdXJjZUlkXSA9IHt9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzb3VyY2VMYXllcklkID0gbGF5ZXIuc291cmNlTGF5ZXIgfHwgJ19nZW9qc29uVGlsZUxheWVyJztcbiAgICAgICAgICAgIGxldCBzb3VyY2VMYXllckZhbWlsaWVzID0gc291cmNlR3JvdXBbc291cmNlTGF5ZXJJZF07XG4gICAgICAgICAgICBpZiAoIXNvdXJjZUxheWVyRmFtaWxpZXMpIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VMYXllckZhbWlsaWVzID0gc291cmNlR3JvdXBbc291cmNlTGF5ZXJJZF0gPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc291cmNlTGF5ZXJGYW1pbGllcy5wdXNoKGxheWVycyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0eWxlTGF5ZXJJbmRleDtcbiIsIi8vIEBmbG93XG5cbmltcG9ydCB7QWxwaGFJbWFnZX0gZnJvbSAnLi4vdXRpbC9pbWFnZSc7XG5pbXBvcnQge3JlZ2lzdGVyfSBmcm9tICcuLi91dGlsL3dlYl93b3JrZXJfdHJhbnNmZXInO1xuaW1wb3J0IHBvdHBhY2sgZnJvbSAncG90cGFjayc7XG5cbmltcG9ydCB0eXBlIHtHbHlwaE1ldHJpY3MsIFN0eWxlR2x5cGh9IGZyb20gJy4uL3N0eWxlL3N0eWxlX2dseXBoJztcblxuY29uc3QgcGFkZGluZyA9IDE7XG5cbmV4cG9ydCB0eXBlIFJlY3QgPSB7XG4gICAgeDogbnVtYmVyLFxuICAgIHk6IG51bWJlcixcbiAgICB3OiBudW1iZXIsXG4gICAgaDogbnVtYmVyXG59O1xuXG5leHBvcnQgdHlwZSBHbHlwaFBvc2l0aW9uID0ge1xuICAgIHJlY3Q6IFJlY3QsXG4gICAgbWV0cmljczogR2x5cGhNZXRyaWNzXG59O1xuXG5leHBvcnQgdHlwZSBHbHlwaFBvc2l0aW9ucyA9IHtbXzogc3RyaW5nXToge1tfOiBudW1iZXJdOiBHbHlwaFBvc2l0aW9uIH0gfVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBHbHlwaEF0bGFzIHtcbiAgICBpbWFnZTogQWxwaGFJbWFnZTtcbiAgICBwb3NpdGlvbnM6IEdseXBoUG9zaXRpb25zO1xuXG4gICAgY29uc3RydWN0b3Ioc3RhY2tzOiB7W186IHN0cmluZ106IHtbXzogbnVtYmVyXTogP1N0eWxlR2x5cGggfSB9KSB7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9ucyA9IHt9O1xuICAgICAgICBjb25zdCBiaW5zID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBzdGFjayBpbiBzdGFja3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGdseXBocyA9IHN0YWNrc1tzdGFja107XG4gICAgICAgICAgICBjb25zdCBzdGFja1Bvc2l0aW9ucyA9IHBvc2l0aW9uc1tzdGFja10gPSB7fTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBnbHlwaHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcmMgPSBnbHlwaHNbK2lkXTtcbiAgICAgICAgICAgICAgICBpZiAoIXNyYyB8fCBzcmMuYml0bWFwLndpZHRoID09PSAwIHx8IHNyYy5iaXRtYXAuaGVpZ2h0ID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJpbiA9IHtcbiAgICAgICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICAgICAgeTogMCxcbiAgICAgICAgICAgICAgICAgICAgdzogc3JjLmJpdG1hcC53aWR0aCArIDIgKiBwYWRkaW5nLFxuICAgICAgICAgICAgICAgICAgICBoOiBzcmMuYml0bWFwLmhlaWdodCArIDIgKiBwYWRkaW5nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBiaW5zLnB1c2goYmluKTtcbiAgICAgICAgICAgICAgICBzdGFja1Bvc2l0aW9uc1tpZF0gPSB7cmVjdDogYmluLCBtZXRyaWNzOiBzcmMubWV0cmljc307XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB7dywgaH0gPSBwb3RwYWNrKGJpbnMpO1xuICAgICAgICBjb25zdCBpbWFnZSA9IG5ldyBBbHBoYUltYWdlKHt3aWR0aDogdyB8fCAxLCBoZWlnaHQ6IGggfHwgMX0pO1xuXG4gICAgICAgIGZvciAoY29uc3Qgc3RhY2sgaW4gc3RhY2tzKSB7XG4gICAgICAgICAgICBjb25zdCBnbHlwaHMgPSBzdGFja3Nbc3RhY2tdO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGdseXBocykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNyYyA9IGdseXBoc1sraWRdO1xuICAgICAgICAgICAgICAgIGlmICghc3JjIHx8IHNyYy5iaXRtYXAud2lkdGggPT09IDAgfHwgc3JjLmJpdG1hcC5oZWlnaHQgPT09IDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJpbiA9IHBvc2l0aW9uc1tzdGFja11baWRdLnJlY3Q7XG4gICAgICAgICAgICAgICAgQWxwaGFJbWFnZS5jb3B5KHNyYy5iaXRtYXAsIGltYWdlLCB7eDogMCwgeTogMH0sIHt4OiBiaW4ueCArIHBhZGRpbmcsIHk6IGJpbi55ICsgcGFkZGluZ30sIHNyYy5iaXRtYXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbWFnZSA9IGltYWdlO1xuICAgICAgICB0aGlzLnBvc2l0aW9ucyA9IHBvc2l0aW9ucztcbiAgICB9XG59XG5cbnJlZ2lzdGVyKCdHbHlwaEF0bGFzJywgR2x5cGhBdGxhcyk7XG4iLCIvLyBAZmxvd1xuXG5pbXBvcnQgRmVhdHVyZUluZGV4IGZyb20gJy4uL2RhdGEvZmVhdHVyZV9pbmRleCc7XG5cbmltcG9ydCB7cGVyZm9ybVN5bWJvbExheW91dH0gZnJvbSAnLi4vc3ltYm9sL3N5bWJvbF9sYXlvdXQnO1xuaW1wb3J0IHtDb2xsaXNpb25Cb3hBcnJheX0gZnJvbSAnLi4vZGF0YS9hcnJheV90eXBlcyc7XG5pbXBvcnQgRGljdGlvbmFyeUNvZGVyIGZyb20gJy4uL3V0aWwvZGljdGlvbmFyeV9jb2Rlcic7XG5pbXBvcnQgU3ltYm9sQnVja2V0IGZyb20gJy4uL2RhdGEvYnVja2V0L3N5bWJvbF9idWNrZXQnO1xuaW1wb3J0IExpbmVCdWNrZXQgZnJvbSAnLi4vZGF0YS9idWNrZXQvbGluZV9idWNrZXQnO1xuaW1wb3J0IEZpbGxCdWNrZXQgZnJvbSAnLi4vZGF0YS9idWNrZXQvZmlsbF9idWNrZXQnO1xuaW1wb3J0IEZpbGxFeHRydXNpb25CdWNrZXQgZnJvbSAnLi4vZGF0YS9idWNrZXQvZmlsbF9leHRydXNpb25fYnVja2V0JztcbmltcG9ydCB7d2Fybk9uY2UsIG1hcE9iamVjdCwgdmFsdWVzfSBmcm9tICcuLi91dGlsL3V0aWwnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IEltYWdlQXRsYXMgZnJvbSAnLi4vcmVuZGVyL2ltYWdlX2F0bGFzJztcbmltcG9ydCBHbHlwaEF0bGFzIGZyb20gJy4uL3JlbmRlci9nbHlwaF9hdGxhcyc7XG5pbXBvcnQgRXZhbHVhdGlvblBhcmFtZXRlcnMgZnJvbSAnLi4vc3R5bGUvZXZhbHVhdGlvbl9wYXJhbWV0ZXJzJztcbmltcG9ydCB7T3ZlcnNjYWxlZFRpbGVJRH0gZnJvbSAnLi90aWxlX2lkJztcblxuaW1wb3J0IHR5cGUge0J1Y2tldH0gZnJvbSAnLi4vZGF0YS9idWNrZXQnO1xuaW1wb3J0IHR5cGUgQWN0b3IgZnJvbSAnLi4vdXRpbC9hY3Rvcic7XG5pbXBvcnQgdHlwZSBTdHlsZUxheWVyIGZyb20gJy4uL3N0eWxlL3N0eWxlX2xheWVyJztcbmltcG9ydCB0eXBlIFN0eWxlTGF5ZXJJbmRleCBmcm9tICcuLi9zdHlsZS9zdHlsZV9sYXllcl9pbmRleCc7XG5pbXBvcnQgdHlwZSB7U3R5bGVJbWFnZX0gZnJvbSAnLi4vc3R5bGUvc3R5bGVfaW1hZ2UnO1xuaW1wb3J0IHR5cGUge1N0eWxlR2x5cGh9IGZyb20gJy4uL3N0eWxlL3N0eWxlX2dseXBoJztcbmltcG9ydCB0eXBlIHtcbiAgICBXb3JrZXJUaWxlUGFyYW1ldGVycyxcbiAgICBXb3JrZXJUaWxlQ2FsbGJhY2ssXG59IGZyb20gJy4uL3NvdXJjZS93b3JrZXJfc291cmNlJztcbmltcG9ydCB0eXBlIHtQcm9tb3RlSWRTcGVjaWZpY2F0aW9ufSBmcm9tICcuLi9zdHlsZS1zcGVjL3R5cGVzJztcblxuY2xhc3MgV29ya2VyVGlsZSB7XG4gICAgdGlsZUlEOiBPdmVyc2NhbGVkVGlsZUlEO1xuICAgIHVpZDogc3RyaW5nO1xuICAgIHpvb206IG51bWJlcjtcbiAgICBwaXhlbFJhdGlvOiBudW1iZXI7XG4gICAgdGlsZVNpemU6IG51bWJlcjtcbiAgICBzb3VyY2U6IHN0cmluZztcbiAgICBwcm9tb3RlSWQ6ID9Qcm9tb3RlSWRTcGVjaWZpY2F0aW9uO1xuICAgIG92ZXJzY2FsaW5nOiBudW1iZXI7XG4gICAgc2hvd0NvbGxpc2lvbkJveGVzOiBib29sZWFuO1xuICAgIGNvbGxlY3RSZXNvdXJjZVRpbWluZzogYm9vbGVhbjtcbiAgICByZXR1cm5EZXBlbmRlbmNpZXM6IGJvb2xlYW47XG5cbiAgICBzdGF0dXM6ICdwYXJzaW5nJyB8ICdkb25lJztcbiAgICBkYXRhOiBWZWN0b3JUaWxlO1xuICAgIGNvbGxpc2lvbkJveEFycmF5OiBDb2xsaXNpb25Cb3hBcnJheTtcblxuICAgIGFib3J0OiA/KCkgPT4gdm9pZDtcbiAgICByZWxvYWRDYWxsYmFjazogV29ya2VyVGlsZUNhbGxiYWNrO1xuICAgIHZlY3RvclRpbGU6IFZlY3RvclRpbGU7XG5cbiAgICBjb25zdHJ1Y3RvcihwYXJhbXM6IFdvcmtlclRpbGVQYXJhbWV0ZXJzKSB7XG4gICAgICAgIHRoaXMudGlsZUlEID0gbmV3IE92ZXJzY2FsZWRUaWxlSUQocGFyYW1zLnRpbGVJRC5vdmVyc2NhbGVkWiwgcGFyYW1zLnRpbGVJRC53cmFwLCBwYXJhbXMudGlsZUlELmNhbm9uaWNhbC56LCBwYXJhbXMudGlsZUlELmNhbm9uaWNhbC54LCBwYXJhbXMudGlsZUlELmNhbm9uaWNhbC55KTtcbiAgICAgICAgdGhpcy51aWQgPSBwYXJhbXMudWlkO1xuICAgICAgICB0aGlzLnpvb20gPSBwYXJhbXMuem9vbTtcbiAgICAgICAgdGhpcy5waXhlbFJhdGlvID0gcGFyYW1zLnBpeGVsUmF0aW87XG4gICAgICAgIHRoaXMudGlsZVNpemUgPSBwYXJhbXMudGlsZVNpemU7XG4gICAgICAgIHRoaXMuc291cmNlID0gcGFyYW1zLnNvdXJjZTtcbiAgICAgICAgdGhpcy5vdmVyc2NhbGluZyA9IHRoaXMudGlsZUlELm92ZXJzY2FsZUZhY3RvcigpO1xuICAgICAgICB0aGlzLnNob3dDb2xsaXNpb25Cb3hlcyA9IHBhcmFtcy5zaG93Q29sbGlzaW9uQm94ZXM7XG4gICAgICAgIHRoaXMuY29sbGVjdFJlc291cmNlVGltaW5nID0gISFwYXJhbXMuY29sbGVjdFJlc291cmNlVGltaW5nO1xuICAgICAgICB0aGlzLnJldHVybkRlcGVuZGVuY2llcyA9ICEhcGFyYW1zLnJldHVybkRlcGVuZGVuY2llcztcbiAgICAgICAgdGhpcy5wcm9tb3RlSWQgPSBwYXJhbXMucHJvbW90ZUlkO1xuICAgIH1cblxuICAgIHBhcnNlKGRhdGE6IFZlY3RvclRpbGUsIGxheWVySW5kZXg6IFN0eWxlTGF5ZXJJbmRleCwgYXZhaWxhYmxlSW1hZ2VzOiBBcnJheTxzdHJpbmc+LCBhY3RvcjogQWN0b3IsIGNhbGxiYWNrOiBXb3JrZXJUaWxlQ2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5zdGF0dXMgPSAncGFyc2luZyc7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG5cbiAgICAgICAgdGhpcy5jb2xsaXNpb25Cb3hBcnJheSA9IG5ldyBDb2xsaXNpb25Cb3hBcnJheSgpO1xuICAgICAgICBjb25zdCBzb3VyY2VMYXllckNvZGVyID0gbmV3IERpY3Rpb25hcnlDb2RlcihPYmplY3Qua2V5cyhkYXRhLmxheWVycykuc29ydCgpKTtcblxuICAgICAgICBjb25zdCBmZWF0dXJlSW5kZXggPSBuZXcgRmVhdHVyZUluZGV4KHRoaXMudGlsZUlELCB0aGlzLnByb21vdGVJZCk7XG4gICAgICAgIGZlYXR1cmVJbmRleC5idWNrZXRMYXllcklEcyA9IFtdO1xuXG4gICAgICAgIGNvbnN0IGJ1Y2tldHM6IHtbXzogc3RyaW5nXTogQnVja2V0fSA9IHt9O1xuXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBmZWF0dXJlSW5kZXgsXG4gICAgICAgICAgICBpY29uRGVwZW5kZW5jaWVzOiB7fSxcbiAgICAgICAgICAgIHBhdHRlcm5EZXBlbmRlbmNpZXM6IHt9LFxuICAgICAgICAgICAgZ2x5cGhEZXBlbmRlbmNpZXM6IHt9LFxuICAgICAgICAgICAgYXZhaWxhYmxlSW1hZ2VzXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgbGF5ZXJGYW1pbGllcyA9IGxheWVySW5kZXguZmFtaWxpZXNCeVNvdXJjZVt0aGlzLnNvdXJjZV07XG4gICAgICAgIGZvciAoY29uc3Qgc291cmNlTGF5ZXJJZCBpbiBsYXllckZhbWlsaWVzKSB7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2VMYXllciA9IGRhdGEubGF5ZXJzW3NvdXJjZUxheWVySWRdO1xuICAgICAgICAgICAgaWYgKCFzb3VyY2VMYXllcikge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc291cmNlTGF5ZXIudmVyc2lvbiA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHdhcm5PbmNlKGBWZWN0b3IgdGlsZSBzb3VyY2UgXCIke3RoaXMuc291cmNlfVwiIGxheWVyIFwiJHtzb3VyY2VMYXllcklkfVwiIGAgK1xuICAgICAgICAgICAgICAgICAgICBgZG9lcyBub3QgdXNlIHZlY3RvciB0aWxlIHNwZWMgdjIgYW5kIHRoZXJlZm9yZSBtYXkgaGF2ZSBzb21lIHJlbmRlcmluZyBlcnJvcnMuYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZUxheWVySW5kZXggPSBzb3VyY2VMYXllckNvZGVyLmVuY29kZShzb3VyY2VMYXllcklkKTtcbiAgICAgICAgICAgIGNvbnN0IGZlYXR1cmVzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgc291cmNlTGF5ZXIubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmVhdHVyZSA9IHNvdXJjZUxheWVyLmZlYXR1cmUoaW5kZXgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gZmVhdHVyZUluZGV4LmdldElkKGZlYXR1cmUsIHNvdXJjZUxheWVySWQpO1xuICAgICAgICAgICAgICAgIGZlYXR1cmVzLnB1c2goe2ZlYXR1cmUsIGlkLCBpbmRleCwgc291cmNlTGF5ZXJJbmRleH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZhbWlseSBvZiBsYXllckZhbWlsaWVzW3NvdXJjZUxheWVySWRdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBmYW1pbHlbMF07XG5cbiAgICAgICAgICAgICAgICBhc3NlcnQobGF5ZXIuc291cmNlID09PSB0aGlzLnNvdXJjZSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLm1pbnpvb20gJiYgdGhpcy56b29tIDwgTWF0aC5mbG9vcihsYXllci5taW56b29tKSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLm1heHpvb20gJiYgdGhpcy56b29tID49IGxheWVyLm1heHpvb20pIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGlmIChsYXllci52aXNpYmlsaXR5ID09PSAnbm9uZScpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMYXllcnMoZmFtaWx5LCB0aGlzLnpvb20sIGF2YWlsYWJsZUltYWdlcyk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBidWNrZXQgPSBidWNrZXRzW2xheWVyLmlkXSA9IGxheWVyLmNyZWF0ZUJ1Y2tldCh7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBmZWF0dXJlSW5kZXguYnVja2V0TGF5ZXJJRHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBsYXllcnM6IGZhbWlseSxcbiAgICAgICAgICAgICAgICAgICAgem9vbTogdGhpcy56b29tLFxuICAgICAgICAgICAgICAgICAgICBwaXhlbFJhdGlvOiB0aGlzLnBpeGVsUmF0aW8sXG4gICAgICAgICAgICAgICAgICAgIG92ZXJzY2FsaW5nOiB0aGlzLm92ZXJzY2FsaW5nLFxuICAgICAgICAgICAgICAgICAgICBjb2xsaXNpb25Cb3hBcnJheTogdGhpcy5jb2xsaXNpb25Cb3hBcnJheSxcbiAgICAgICAgICAgICAgICAgICAgc291cmNlTGF5ZXJJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgc291cmNlSUQ6IHRoaXMuc291cmNlXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBidWNrZXQucG9wdWxhdGUoZmVhdHVyZXMsIG9wdGlvbnMsIHRoaXMudGlsZUlELmNhbm9uaWNhbCk7XG4gICAgICAgICAgICAgICAgZmVhdHVyZUluZGV4LmJ1Y2tldExheWVySURzLnB1c2goZmFtaWx5Lm1hcCgobCkgPT4gbC5pZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGVycm9yOiA/RXJyb3I7XG4gICAgICAgIGxldCBnbHlwaE1hcDogP3tbXzogc3RyaW5nXToge1tfOiBudW1iZXJdOiA/U3R5bGVHbHlwaH19O1xuICAgICAgICBsZXQgaWNvbk1hcDogP3tbXzogc3RyaW5nXTogU3R5bGVJbWFnZX07XG4gICAgICAgIGxldCBwYXR0ZXJuTWFwOiA/e1tfOiBzdHJpbmddOiBTdHlsZUltYWdlfTtcblxuICAgICAgICBjb25zdCBzdGFja3MgPSBtYXBPYmplY3Qob3B0aW9ucy5nbHlwaERlcGVuZGVuY2llcywgKGdseXBocykgPT4gT2JqZWN0LmtleXMoZ2x5cGhzKS5tYXAoTnVtYmVyKSk7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhzdGFja3MpLmxlbmd0aCkge1xuICAgICAgICAgICAgYWN0b3Iuc2VuZCgnZ2V0R2x5cGhzJywge3VpZDogdGhpcy51aWQsIHN0YWNrc30sIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgIGdseXBoTWFwID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICBtYXliZVByZXBhcmUuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGdseXBoTWFwID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpY29ucyA9IE9iamVjdC5rZXlzKG9wdGlvbnMuaWNvbkRlcGVuZGVuY2llcyk7XG4gICAgICAgIGlmIChpY29ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFjdG9yLnNlbmQoJ2dldEltYWdlcycsIHtpY29ucywgc291cmNlOiB0aGlzLnNvdXJjZSwgdGlsZUlEOiB0aGlzLnRpbGVJRCwgdHlwZTogJ2ljb25zJ30sIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgICAgICAgICAgICAgIGljb25NYXAgPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgIG1heWJlUHJlcGFyZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWNvbk1hcCA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF0dGVybnMgPSBPYmplY3Qua2V5cyhvcHRpb25zLnBhdHRlcm5EZXBlbmRlbmNpZXMpO1xuICAgICAgICBpZiAocGF0dGVybnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBhY3Rvci5zZW5kKCdnZXRJbWFnZXMnLCB7aWNvbnM6IHBhdHRlcm5zLCBzb3VyY2U6IHRoaXMuc291cmNlLCB0aWxlSUQ6IHRoaXMudGlsZUlELCB0eXBlOiAncGF0dGVybnMnfSwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBlcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybk1hcCA9IHJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgbWF5YmVQcmVwYXJlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYXR0ZXJuTWFwID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBtYXliZVByZXBhcmUuY2FsbCh0aGlzKTtcblxuICAgICAgICBmdW5jdGlvbiBtYXliZVByZXBhcmUoKSB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyb3IpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChnbHlwaE1hcCAmJiBpY29uTWFwICYmIHBhdHRlcm5NYXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBnbHlwaEF0bGFzID0gbmV3IEdseXBoQXRsYXMoZ2x5cGhNYXApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGltYWdlQXRsYXMgPSBuZXcgSW1hZ2VBdGxhcyhpY29uTWFwLCBwYXR0ZXJuTWFwKTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGJ1Y2tldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVja2V0ID0gYnVja2V0c1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYnVja2V0IGluc3RhbmNlb2YgU3ltYm9sQnVja2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWNhbGN1bGF0ZUxheWVycyhidWNrZXQubGF5ZXJzLCB0aGlzLnpvb20sIGF2YWlsYWJsZUltYWdlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZXJmb3JtU3ltYm9sTGF5b3V0KGJ1Y2tldCwgZ2x5cGhNYXAsIGdseXBoQXRsYXMucG9zaXRpb25zLCBpY29uTWFwLCBpbWFnZUF0bGFzLmljb25Qb3NpdGlvbnMsIHRoaXMuc2hvd0NvbGxpc2lvbkJveGVzLCB0aGlzLnRpbGVJRC5jYW5vbmljYWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGJ1Y2tldC5oYXNQYXR0ZXJuICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAoYnVja2V0IGluc3RhbmNlb2YgTGluZUJ1Y2tldCB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgIGJ1Y2tldCBpbnN0YW5jZW9mIEZpbGxCdWNrZXQgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICBidWNrZXQgaW5zdGFuY2VvZiBGaWxsRXh0cnVzaW9uQnVja2V0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVjYWxjdWxhdGVMYXllcnMoYnVja2V0LmxheWVycywgdGhpcy56b29tLCBhdmFpbGFibGVJbWFnZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVja2V0LmFkZEZlYXR1cmVzKG9wdGlvbnMsIHRoaXMudGlsZUlELmNhbm9uaWNhbCwgaW1hZ2VBdGxhcy5wYXR0ZXJuUG9zaXRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gJ2RvbmUnO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgICAgICAgICAgYnVja2V0czogdmFsdWVzKGJ1Y2tldHMpLmZpbHRlcihiID0+ICFiLmlzRW1wdHkoKSksXG4gICAgICAgICAgICAgICAgICAgIGZlYXR1cmVJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgY29sbGlzaW9uQm94QXJyYXk6IHRoaXMuY29sbGlzaW9uQm94QXJyYXksXG4gICAgICAgICAgICAgICAgICAgIGdseXBoQXRsYXNJbWFnZTogZ2x5cGhBdGxhcy5pbWFnZSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2VBdGxhcyxcbiAgICAgICAgICAgICAgICAgICAgLy8gT25seSB1c2VkIGZvciBiZW5jaG1hcmtpbmc6XG4gICAgICAgICAgICAgICAgICAgIGdseXBoTWFwOiB0aGlzLnJldHVybkRlcGVuZGVuY2llcyA/IGdseXBoTWFwIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgaWNvbk1hcDogdGhpcy5yZXR1cm5EZXBlbmRlbmNpZXMgPyBpY29uTWFwIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZ2x5cGhQb3NpdGlvbnM6IHRoaXMucmV0dXJuRGVwZW5kZW5jaWVzID8gZ2x5cGhBdGxhcy5wb3NpdGlvbnMgOiBudWxsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY2FsY3VsYXRlTGF5ZXJzKGxheWVyczogJFJlYWRPbmx5QXJyYXk8U3R5bGVMYXllcj4sIHpvb206IG51bWJlciwgYXZhaWxhYmxlSW1hZ2VzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgLy8gTGF5ZXJzIGFyZSBzaGFyZWQgYW5kIG1heSBoYXZlIGJlZW4gdXNlZCBieSBhIFdvcmtlclRpbGUgd2l0aCBhIGRpZmZlcmVudCB6b29tLlxuICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBuZXcgRXZhbHVhdGlvblBhcmFtZXRlcnMoem9vbSk7XG4gICAgZm9yIChjb25zdCBsYXllciBvZiBsYXllcnMpIHtcbiAgICAgICAgbGF5ZXIucmVjYWxjdWxhdGUocGFyYW1ldGVycywgYXZhaWxhYmxlSW1hZ2VzKTtcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFdvcmtlclRpbGU7XG4iLCIvLyBAZmxvd1xuXG5pbXBvcnQge2dldEFycmF5QnVmZmVyfSBmcm9tICcuLi91dGlsL2FqYXgnO1xuXG5pbXBvcnQgdnQgZnJvbSAnQG1hcGJveC92ZWN0b3ItdGlsZSc7XG5pbXBvcnQgUHJvdG9idWYgZnJvbSAncGJmJztcbmltcG9ydCBXb3JrZXJUaWxlIGZyb20gJy4vd29ya2VyX3RpbGUnO1xuaW1wb3J0IHtleHRlbmR9IGZyb20gJy4uL3V0aWwvdXRpbCc7XG5pbXBvcnQge1JlcXVlc3RQZXJmb3JtYW5jZX0gZnJvbSAnLi4vdXRpbC9wZXJmb3JtYW5jZSc7XG5cbmltcG9ydCB0eXBlIHtcbiAgICBXb3JrZXJTb3VyY2UsXG4gICAgV29ya2VyVGlsZVBhcmFtZXRlcnMsXG4gICAgV29ya2VyVGlsZUNhbGxiYWNrLFxuICAgIFRpbGVQYXJhbWV0ZXJzXG59IGZyb20gJy4uL3NvdXJjZS93b3JrZXJfc291cmNlJztcblxuaW1wb3J0IHR5cGUgQWN0b3IgZnJvbSAnLi4vdXRpbC9hY3Rvcic7XG5pbXBvcnQgdHlwZSBTdHlsZUxheWVySW5kZXggZnJvbSAnLi4vc3R5bGUvc3R5bGVfbGF5ZXJfaW5kZXgnO1xuaW1wb3J0IHR5cGUge0NhbGxiYWNrfSBmcm9tICcuLi90eXBlcy9jYWxsYmFjayc7XG5cbmV4cG9ydCB0eXBlIExvYWRWZWN0b3JUaWxlUmVzdWx0ID0ge1xuICAgIHZlY3RvclRpbGU6IFZlY3RvclRpbGU7XG4gICAgcmF3RGF0YTogQXJyYXlCdWZmZXI7XG4gICAgZXhwaXJlcz86IGFueTtcbiAgICBjYWNoZUNvbnRyb2w/OiBhbnk7XG4gICAgcmVzb3VyY2VUaW1pbmc/OiBBcnJheTxQZXJmb3JtYW5jZVJlc291cmNlVGltaW5nPjtcbn07XG5cbi8qKlxuICogQGNhbGxiYWNrIExvYWRWZWN0b3JEYXRhQ2FsbGJhY2tcbiAqIEBwYXJhbSBlcnJvclxuICogQHBhcmFtIHZlY3RvclRpbGVcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCB0eXBlIExvYWRWZWN0b3JEYXRhQ2FsbGJhY2sgPSBDYWxsYmFjazw/TG9hZFZlY3RvclRpbGVSZXN1bHQ+O1xuXG5leHBvcnQgdHlwZSBBYm9ydFZlY3RvckRhdGEgPSAoKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgTG9hZFZlY3RvckRhdGEgPSAocGFyYW1zOiBXb3JrZXJUaWxlUGFyYW1ldGVycywgY2FsbGJhY2s6IExvYWRWZWN0b3JEYXRhQ2FsbGJhY2spID0+ID9BYm9ydFZlY3RvckRhdGE7XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gbG9hZFZlY3RvclRpbGUocGFyYW1zOiBXb3JrZXJUaWxlUGFyYW1ldGVycywgY2FsbGJhY2s6IExvYWRWZWN0b3JEYXRhQ2FsbGJhY2spIHtcbiAgICBjb25zdCByZXF1ZXN0ID0gZ2V0QXJyYXlCdWZmZXIocGFyYW1zLnJlcXVlc3QsIChlcnI6ID9FcnJvciwgZGF0YTogP0FycmF5QnVmZmVyLCBjYWNoZUNvbnRyb2w6ID9zdHJpbmcsIGV4cGlyZXM6ID9zdHJpbmcpID0+IHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSBlbHNlIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgICAgICAgICAgdmVjdG9yVGlsZTogbmV3IHZ0LlZlY3RvclRpbGUobmV3IFByb3RvYnVmKGRhdGEpKSxcbiAgICAgICAgICAgICAgICByYXdEYXRhOiBkYXRhLFxuICAgICAgICAgICAgICAgIGNhY2hlQ29udHJvbCxcbiAgICAgICAgICAgICAgICBleHBpcmVzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgIHJlcXVlc3QuY2FuY2VsKCk7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBUaGUge0BsaW5rIFdvcmtlclNvdXJjZX0gaW1wbGVtZW50YXRpb24gdGhhdCBzdXBwb3J0cyB7QGxpbmsgVmVjdG9yVGlsZVNvdXJjZX0uXG4gKiBUaGlzIGNsYXNzIGlzIGRlc2lnbmVkIHRvIGJlIGVhc2lseSByZXVzZWQgdG8gc3VwcG9ydCBjdXN0b20gc291cmNlIHR5cGVzXG4gKiBmb3IgZGF0YSBmb3JtYXRzIHRoYXQgY2FuIGJlIHBhcnNlZC9jb252ZXJ0ZWQgaW50byBhbiBpbi1tZW1vcnkgVmVjdG9yVGlsZVxuICogcmVwcmVzZW50YXRpb24uICBUbyBkbyBzbywgY3JlYXRlIGl0IHdpdGhcbiAqIGBuZXcgVmVjdG9yVGlsZVdvcmtlclNvdXJjZShhY3Rvciwgc3R5bGVMYXllcnMsIGN1c3RvbUxvYWRWZWN0b3JEYXRhRnVuY3Rpb24pYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5jbGFzcyBWZWN0b3JUaWxlV29ya2VyU291cmNlIGltcGxlbWVudHMgV29ya2VyU291cmNlIHtcbiAgICBhY3RvcjogQWN0b3I7XG4gICAgbGF5ZXJJbmRleDogU3R5bGVMYXllckluZGV4O1xuICAgIGF2YWlsYWJsZUltYWdlczogQXJyYXk8c3RyaW5nPjtcbiAgICBsb2FkVmVjdG9yRGF0YTogTG9hZFZlY3RvckRhdGE7XG4gICAgbG9hZGluZzoge1tfOiBzdHJpbmddOiBXb3JrZXJUaWxlIH07XG4gICAgbG9hZGVkOiB7W186IHN0cmluZ106IFdvcmtlclRpbGUgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBbbG9hZFZlY3RvckRhdGFdIE9wdGlvbmFsIG1ldGhvZCBmb3IgY3VzdG9tIGxvYWRpbmcgb2YgYSBWZWN0b3JUaWxlXG4gICAgICogb2JqZWN0IGJhc2VkIG9uIHBhcmFtZXRlcnMgcGFzc2VkIGZyb20gdGhlIG1haW4tdGhyZWFkIFNvdXJjZS4gU2VlXG4gICAgICoge0BsaW5rIFZlY3RvclRpbGVXb3JrZXJTb3VyY2UjbG9hZFRpbGV9LiBUaGUgZGVmYXVsdCBpbXBsZW1lbnRhdGlvbiBzaW1wbHlcbiAgICAgKiBsb2FkcyB0aGUgcGJmIGF0IGBwYXJhbXMudXJsYC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFjdG9yOiBBY3RvciwgbGF5ZXJJbmRleDogU3R5bGVMYXllckluZGV4LCBhdmFpbGFibGVJbWFnZXM6IEFycmF5PHN0cmluZz4sIGxvYWRWZWN0b3JEYXRhOiA/TG9hZFZlY3RvckRhdGEpIHtcbiAgICAgICAgdGhpcy5hY3RvciA9IGFjdG9yO1xuICAgICAgICB0aGlzLmxheWVySW5kZXggPSBsYXllckluZGV4O1xuICAgICAgICB0aGlzLmF2YWlsYWJsZUltYWdlcyA9IGF2YWlsYWJsZUltYWdlcztcbiAgICAgICAgdGhpcy5sb2FkVmVjdG9yRGF0YSA9IGxvYWRWZWN0b3JEYXRhIHx8IGxvYWRWZWN0b3JUaWxlO1xuICAgICAgICB0aGlzLmxvYWRpbmcgPSB7fTtcbiAgICAgICAgdGhpcy5sb2FkZWQgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbXBsZW1lbnRzIHtAbGluayBXb3JrZXJTb3VyY2UjbG9hZFRpbGV9LiBEZWxlZ2F0ZXMgdG9cbiAgICAgKiB7QGxpbmsgVmVjdG9yVGlsZVdvcmtlclNvdXJjZSNsb2FkVmVjdG9yRGF0YX0gKHdoaWNoIGJ5IGRlZmF1bHQgZXhwZWN0c1xuICAgICAqIGEgYHBhcmFtcy51cmxgIHByb3BlcnR5KSBmb3IgZmV0Y2hpbmcgYW5kIHByb2R1Y2luZyBhIFZlY3RvclRpbGUgb2JqZWN0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9hZFRpbGUocGFyYW1zOiBXb3JrZXJUaWxlUGFyYW1ldGVycywgY2FsbGJhY2s6IFdvcmtlclRpbGVDYWxsYmFjaykge1xuICAgICAgICBjb25zdCB1aWQgPSBwYXJhbXMudWlkO1xuXG4gICAgICAgIGlmICghdGhpcy5sb2FkaW5nKVxuICAgICAgICAgICAgdGhpcy5sb2FkaW5nID0ge307XG5cbiAgICAgICAgY29uc3QgcGVyZiA9IChwYXJhbXMgJiYgcGFyYW1zLnJlcXVlc3QgJiYgcGFyYW1zLnJlcXVlc3QuY29sbGVjdFJlc291cmNlVGltaW5nKSA/XG4gICAgICAgICAgICBuZXcgUmVxdWVzdFBlcmZvcm1hbmNlKHBhcmFtcy5yZXF1ZXN0KSA6IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IHdvcmtlclRpbGUgPSB0aGlzLmxvYWRpbmdbdWlkXSA9IG5ldyBXb3JrZXJUaWxlKHBhcmFtcyk7XG4gICAgICAgIHdvcmtlclRpbGUuYWJvcnQgPSB0aGlzLmxvYWRWZWN0b3JEYXRhKHBhcmFtcywgKGVyciwgcmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmxvYWRpbmdbdWlkXTtcblxuICAgICAgICAgICAgaWYgKGVyciB8fCAhcmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICB3b3JrZXJUaWxlLnN0YXR1cyA9ICdkb25lJztcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlZFt1aWRdID0gd29ya2VyVGlsZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcmF3VGlsZURhdGEgPSByZXNwb25zZS5yYXdEYXRhO1xuICAgICAgICAgICAgY29uc3QgY2FjaGVDb250cm9sID0ge307XG4gICAgICAgICAgICBpZiAocmVzcG9uc2UuZXhwaXJlcykgY2FjaGVDb250cm9sLmV4cGlyZXMgPSByZXNwb25zZS5leHBpcmVzO1xuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmNhY2hlQ29udHJvbCkgY2FjaGVDb250cm9sLmNhY2hlQ29udHJvbCA9IHJlc3BvbnNlLmNhY2hlQ29udHJvbDtcblxuICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VUaW1pbmcgPSB7fTtcbiAgICAgICAgICAgIGlmIChwZXJmKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb3VyY2VUaW1pbmdEYXRhID0gcGVyZi5maW5pc2goKTtcbiAgICAgICAgICAgICAgICAvLyBpdCdzIG5lY2Vzc2FyeSB0byBldmFsIHRoZSByZXN1bHQgb2YgZ2V0RW50cmllc0J5TmFtZSgpIGhlcmUgdmlhIHBhcnNlL3N0cmluZ2lmeVxuICAgICAgICAgICAgICAgIC8vIGxhdGUgZXZhbHVhdGlvbiBpbiB0aGUgbWFpbiB0aHJlYWQgY2F1c2VzIFR5cGVFcnJvcjogaWxsZWdhbCBpbnZvY2F0aW9uXG4gICAgICAgICAgICAgICAgaWYgKHJlc291cmNlVGltaW5nRGF0YSlcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VUaW1pbmcucmVzb3VyY2VUaW1pbmcgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHJlc291cmNlVGltaW5nRGF0YSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3b3JrZXJUaWxlLnZlY3RvclRpbGUgPSByZXNwb25zZS52ZWN0b3JUaWxlO1xuICAgICAgICAgICAgd29ya2VyVGlsZS5wYXJzZShyZXNwb25zZS52ZWN0b3JUaWxlLCB0aGlzLmxheWVySW5kZXgsIHRoaXMuYXZhaWxhYmxlSW1hZ2VzLCB0aGlzLmFjdG9yLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyIHx8ICFyZXN1bHQpIHJldHVybiBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICAgICAgLy8gVHJhbnNmZXJyaW5nIGEgY29weSBvZiByYXdUaWxlRGF0YSBiZWNhdXNlIHRoZSB3b3JrZXIgbmVlZHMgdG8gcmV0YWluIGl0cyBjb3B5LlxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGV4dGVuZCh7cmF3VGlsZURhdGE6IHJhd1RpbGVEYXRhLnNsaWNlKDApfSwgcmVzdWx0LCBjYWNoZUNvbnRyb2wsIHJlc291cmNlVGltaW5nKSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5sb2FkZWQgPSB0aGlzLmxvYWRlZCB8fCB7fTtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkW3VpZF0gPSB3b3JrZXJUaWxlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbXBsZW1lbnRzIHtAbGluayBXb3JrZXJTb3VyY2UjcmVsb2FkVGlsZX0uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZWxvYWRUaWxlKHBhcmFtczogV29ya2VyVGlsZVBhcmFtZXRlcnMsIGNhbGxiYWNrOiBXb3JrZXJUaWxlQ2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbG9hZGVkID0gdGhpcy5sb2FkZWQsXG4gICAgICAgICAgICB1aWQgPSBwYXJhbXMudWlkLFxuICAgICAgICAgICAgdnRTb3VyY2UgPSB0aGlzO1xuICAgICAgICBpZiAobG9hZGVkICYmIGxvYWRlZFt1aWRdKSB7XG4gICAgICAgICAgICBjb25zdCB3b3JrZXJUaWxlID0gbG9hZGVkW3VpZF07XG4gICAgICAgICAgICB3b3JrZXJUaWxlLnNob3dDb2xsaXNpb25Cb3hlcyA9IHBhcmFtcy5zaG93Q29sbGlzaW9uQm94ZXM7XG5cbiAgICAgICAgICAgIGNvbnN0IGRvbmUgPSAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVsb2FkQ2FsbGJhY2sgPSB3b3JrZXJUaWxlLnJlbG9hZENhbGxiYWNrO1xuICAgICAgICAgICAgICAgIGlmIChyZWxvYWRDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgd29ya2VyVGlsZS5yZWxvYWRDYWxsYmFjaztcbiAgICAgICAgICAgICAgICAgICAgd29ya2VyVGlsZS5wYXJzZSh3b3JrZXJUaWxlLnZlY3RvclRpbGUsIHZ0U291cmNlLmxheWVySW5kZXgsIHRoaXMuYXZhaWxhYmxlSW1hZ2VzLCB2dFNvdXJjZS5hY3RvciwgcmVsb2FkQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIsIGRhdGEpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHdvcmtlclRpbGUuc3RhdHVzID09PSAncGFyc2luZycpIHtcbiAgICAgICAgICAgICAgICB3b3JrZXJUaWxlLnJlbG9hZENhbGxiYWNrID0gZG9uZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod29ya2VyVGlsZS5zdGF0dXMgPT09ICdkb25lJykge1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoZXJlIHdhcyBubyB2ZWN0b3IgdGlsZSBkYXRhIG9uIHRoZSBpbml0aWFsIGxvYWQsIGRvbid0IHRyeSBhbmQgcmUtcGFyc2UgdGlsZVxuICAgICAgICAgICAgICAgIGlmICh3b3JrZXJUaWxlLnZlY3RvclRpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgd29ya2VyVGlsZS5wYXJzZSh3b3JrZXJUaWxlLnZlY3RvclRpbGUsIHRoaXMubGF5ZXJJbmRleCwgdGhpcy5hdmFpbGFibGVJbWFnZXMsIHRoaXMuYWN0b3IsIGRvbmUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbXBsZW1lbnRzIHtAbGluayBXb3JrZXJTb3VyY2UjYWJvcnRUaWxlfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXJhbXNcbiAgICAgKiBAcGFyYW0gcGFyYW1zLnVpZCBUaGUgVUlEIGZvciB0aGlzIHRpbGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBhYm9ydFRpbGUocGFyYW1zOiBUaWxlUGFyYW1ldGVycywgY2FsbGJhY2s6IFdvcmtlclRpbGVDYWxsYmFjaykge1xuICAgICAgICBjb25zdCBsb2FkaW5nID0gdGhpcy5sb2FkaW5nLFxuICAgICAgICAgICAgdWlkID0gcGFyYW1zLnVpZDtcbiAgICAgICAgaWYgKGxvYWRpbmcgJiYgbG9hZGluZ1t1aWRdICYmIGxvYWRpbmdbdWlkXS5hYm9ydCkge1xuICAgICAgICAgICAgbG9hZGluZ1t1aWRdLmFib3J0KCk7XG4gICAgICAgICAgICBkZWxldGUgbG9hZGluZ1t1aWRdO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW1wbGVtZW50cyB7QGxpbmsgV29ya2VyU291cmNlI3JlbW92ZVRpbGV9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHBhcmFtc1xuICAgICAqIEBwYXJhbSBwYXJhbXMudWlkIFRoZSBVSUQgZm9yIHRoaXMgdGlsZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlbW92ZVRpbGUocGFyYW1zOiBUaWxlUGFyYW1ldGVycywgY2FsbGJhY2s6IFdvcmtlclRpbGVDYWxsYmFjaykge1xuICAgICAgICBjb25zdCBsb2FkZWQgPSB0aGlzLmxvYWRlZCxcbiAgICAgICAgICAgIHVpZCA9IHBhcmFtcy51aWQ7XG4gICAgICAgIGlmIChsb2FkZWQgJiYgbG9hZGVkW3VpZF0pIHtcbiAgICAgICAgICAgIGRlbGV0ZSBsb2FkZWRbdWlkXTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVmVjdG9yVGlsZVdvcmtlclNvdXJjZTtcbiIsIi8vIEBmbG93XG5cbmltcG9ydCBERU1EYXRhIGZyb20gJy4uL2RhdGEvZGVtX2RhdGEnO1xuaW1wb3J0IHtSR0JBSW1hZ2V9IGZyb20gJy4uL3V0aWwvaW1hZ2UnO1xuaW1wb3J0IHdpbmRvdyBmcm9tICcuLi91dGlsL3dpbmRvdyc7XG5cbmltcG9ydCB0eXBlIEFjdG9yIGZyb20gJy4uL3V0aWwvYWN0b3InO1xuaW1wb3J0IHR5cGUge1xuICAgIFdvcmtlckRFTVRpbGVQYXJhbWV0ZXJzLFxuICAgIFdvcmtlckRFTVRpbGVDYWxsYmFjayxcbiAgICBUaWxlUGFyYW1ldGVyc1xufSBmcm9tICcuL3dvcmtlcl9zb3VyY2UnO1xuY29uc3Qge0ltYWdlQml0bWFwfSA9IHdpbmRvdztcblxuY2xhc3MgUmFzdGVyREVNVGlsZVdvcmtlclNvdXJjZSB7XG4gICAgYWN0b3I6IEFjdG9yO1xuICAgIGxvYWRlZDoge1tfOiBzdHJpbmddOiBERU1EYXRhfTtcbiAgICBvZmZzY3JlZW5DYW52YXM6IE9mZnNjcmVlbkNhbnZhcztcbiAgICBvZmZzY3JlZW5DYW52YXNDb250ZXh0OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5sb2FkZWQgPSB7fTtcbiAgICB9XG5cbiAgICBsb2FkVGlsZShwYXJhbXM6IFdvcmtlckRFTVRpbGVQYXJhbWV0ZXJzLCBjYWxsYmFjazogV29ya2VyREVNVGlsZUNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IHt1aWQsIGVuY29kaW5nLCByYXdJbWFnZURhdGF9ID0gcGFyYW1zO1xuICAgICAgICAvLyBNYWluIHRocmVhZCB3aWxsIHRyYW5zZmVyIEltYWdlQml0bWFwIGlmIG9mZnNjcmVlbiBkZWNvZGUgd2l0aCBPZmZzY3JlZW5DYW52YXMgaXMgc3VwcG9ydGVkLCBlbHNlIGl0IHdpbGwgdHJhbnNmZXIgYW4gYWxyZWFkeSBkZWNvZGVkIGltYWdlLlxuICAgICAgICBjb25zdCBpbWFnZVBpeGVscyA9IChJbWFnZUJpdG1hcCAmJiByYXdJbWFnZURhdGEgaW5zdGFuY2VvZiBJbWFnZUJpdG1hcCkgPyB0aGlzLmdldEltYWdlRGF0YShyYXdJbWFnZURhdGEpIDogcmF3SW1hZ2VEYXRhO1xuICAgICAgICBjb25zdCBkZW0gPSBuZXcgREVNRGF0YSh1aWQsIGltYWdlUGl4ZWxzLCBlbmNvZGluZyk7XG4gICAgICAgIHRoaXMubG9hZGVkID0gdGhpcy5sb2FkZWQgfHwge307XG4gICAgICAgIHRoaXMubG9hZGVkW3VpZF0gPSBkZW07XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRlbSk7XG4gICAgfVxuXG4gICAgZ2V0SW1hZ2VEYXRhKGltZ0JpdG1hcDogSW1hZ2VCaXRtYXApOiBSR0JBSW1hZ2Uge1xuICAgICAgICAvLyBMYXppbHkgaW5pdGlhbGl6ZSBPZmZzY3JlZW5DYW52YXNcbiAgICAgICAgaWYgKCF0aGlzLm9mZnNjcmVlbkNhbnZhcyB8fCAhdGhpcy5vZmZzY3JlZW5DYW52YXNDb250ZXh0KSB7XG4gICAgICAgICAgICAvLyBEZW0gdGlsZXMgYXJlIHR5cGljYWxseSAyNTZ4MjU2XG4gICAgICAgICAgICB0aGlzLm9mZnNjcmVlbkNhbnZhcyA9IG5ldyBPZmZzY3JlZW5DYW52YXMoaW1nQml0bWFwLndpZHRoLCBpbWdCaXRtYXAuaGVpZ2h0KTtcbiAgICAgICAgICAgIHRoaXMub2Zmc2NyZWVuQ2FudmFzQ29udGV4dCA9IHRoaXMub2Zmc2NyZWVuQ2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9mZnNjcmVlbkNhbnZhcy53aWR0aCA9IGltZ0JpdG1hcC53aWR0aDtcbiAgICAgICAgdGhpcy5vZmZzY3JlZW5DYW52YXMuaGVpZ2h0ID0gaW1nQml0bWFwLmhlaWdodDtcblxuICAgICAgICB0aGlzLm9mZnNjcmVlbkNhbnZhc0NvbnRleHQuZHJhd0ltYWdlKGltZ0JpdG1hcCwgMCwgMCwgaW1nQml0bWFwLndpZHRoLCBpbWdCaXRtYXAuaGVpZ2h0KTtcbiAgICAgICAgLy8gSW5zZXJ0IGFuIGFkZGl0aW9uYWwgMXB4IHBhZGRpbmcgYXJvdW5kIHRoZSBpbWFnZSB0byBhbGxvdyBiYWNrZmlsbGluZyBmb3IgbmVpZ2hib3JpbmcgZGF0YS5cbiAgICAgICAgY29uc3QgaW1nRGF0YSA9IHRoaXMub2Zmc2NyZWVuQ2FudmFzQ29udGV4dC5nZXRJbWFnZURhdGEoLTEsIC0xLCBpbWdCaXRtYXAud2lkdGggKyAyLCBpbWdCaXRtYXAuaGVpZ2h0ICsgMik7XG4gICAgICAgIHRoaXMub2Zmc2NyZWVuQ2FudmFzQ29udGV4dC5jbGVhclJlY3QoMCwgMCwgdGhpcy5vZmZzY3JlZW5DYW52YXMud2lkdGgsIHRoaXMub2Zmc2NyZWVuQ2FudmFzLmhlaWdodCk7XG4gICAgICAgIHJldHVybiBuZXcgUkdCQUltYWdlKHt3aWR0aDogaW1nRGF0YS53aWR0aCwgaGVpZ2h0OiBpbWdEYXRhLmhlaWdodH0sIGltZ0RhdGEuZGF0YSk7XG4gICAgfVxuXG4gICAgcmVtb3ZlVGlsZShwYXJhbXM6IFRpbGVQYXJhbWV0ZXJzKSB7XG4gICAgICAgIGNvbnN0IGxvYWRlZCA9IHRoaXMubG9hZGVkLFxuICAgICAgICAgICAgdWlkID0gcGFyYW1zLnVpZDtcbiAgICAgICAgaWYgKGxvYWRlZCAmJiBsb2FkZWRbdWlkXSkge1xuICAgICAgICAgICAgZGVsZXRlIGxvYWRlZFt1aWRdO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBSYXN0ZXJERU1UaWxlV29ya2VyU291cmNlO1xuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IHJld2luZDtcblxuZnVuY3Rpb24gcmV3aW5kKGdqLCBvdXRlcikge1xuICAgIHZhciB0eXBlID0gZ2ogJiYgZ2oudHlwZSwgaTtcblxuICAgIGlmICh0eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBnai5mZWF0dXJlcy5sZW5ndGg7IGkrKykgcmV3aW5kKGdqLmZlYXR1cmVzW2ldLCBvdXRlcik7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdHZW9tZXRyeUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBnai5nZW9tZXRyaWVzLmxlbmd0aDsgaSsrKSByZXdpbmQoZ2ouZ2VvbWV0cmllc1tpXSwgb3V0ZXIpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnRmVhdHVyZScpIHtcbiAgICAgICAgcmV3aW5kKGdqLmdlb21ldHJ5LCBvdXRlcik7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdQb2x5Z29uJykge1xuICAgICAgICByZXdpbmRSaW5ncyhnai5jb29yZGluYXRlcywgb3V0ZXIpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZ2ouY29vcmRpbmF0ZXMubGVuZ3RoOyBpKyspIHJld2luZFJpbmdzKGdqLmNvb3JkaW5hdGVzW2ldLCBvdXRlcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGdqO1xufVxuXG5mdW5jdGlvbiByZXdpbmRSaW5ncyhyaW5ncywgb3V0ZXIpIHtcbiAgICBpZiAocmluZ3MubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICByZXdpbmRSaW5nKHJpbmdzWzBdLCBvdXRlcik7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCByaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXdpbmRSaW5nKHJpbmdzW2ldLCAhb3V0ZXIpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmV3aW5kUmluZyhyaW5nLCBkaXIpIHtcbiAgICB2YXIgYXJlYSA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJpbmcubGVuZ3RoLCBqID0gbGVuIC0gMTsgaSA8IGxlbjsgaiA9IGkrKykge1xuICAgICAgICBhcmVhICs9IChyaW5nW2ldWzBdIC0gcmluZ1tqXVswXSkgKiAocmluZ1tqXVsxXSArIHJpbmdbaV1bMV0pO1xuICAgIH1cbiAgICBpZiAoYXJlYSA+PSAwICE9PSAhIWRpcikgcmluZy5yZXZlcnNlKCk7XG59XG4iLCIvLyBAZmxvd1xuXG5pbXBvcnQgUG9pbnQgZnJvbSAnQG1hcGJveC9wb2ludC1nZW9tZXRyeSc7XG5cbmltcG9ydCBtdnQgZnJvbSAnQG1hcGJveC92ZWN0b3ItdGlsZSc7XG5jb25zdCB0b0dlb0pTT04gPSBtdnQuVmVjdG9yVGlsZUZlYXR1cmUucHJvdG90eXBlLnRvR2VvSlNPTjtcbmltcG9ydCBFWFRFTlQgZnJvbSAnLi4vZGF0YS9leHRlbnQnO1xuXG4vLyBUaGUgZmVhdHVyZSB0eXBlIHVzZWQgYnkgZ2VvanNvbi12dCBhbmQgc3VwZXJjbHVzdGVyLiBTaG91bGQgYmUgZXh0cmFjdGVkIHRvXG4vLyBnbG9iYWwgdHlwZSBhbmQgdXNlZCBpbiBtb2R1bGUgZGVmaW5pdGlvbnMgZm9yIHRob3NlIHR3byBtb2R1bGVzLlxudHlwZSBGZWF0dXJlID0ge1xuICAgIHR5cGU6IDEsXG4gICAgaWQ6IG1peGVkLFxuICAgIHRhZ3M6IHtbXzogc3RyaW5nXTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbn0sXG4gICAgZ2VvbWV0cnk6IEFycmF5PFtudW1iZXIsIG51bWJlcl0+LFxufSB8IHtcbiAgICB0eXBlOiAyIHwgMyxcbiAgICBpZDogbWl4ZWQsXG4gICAgdGFnczoge1tfOiBzdHJpbmddOiBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFufSxcbiAgICBnZW9tZXRyeTogQXJyYXk8QXJyYXk8W251bWJlciwgbnVtYmVyXT4+LFxufVxuXG5jbGFzcyBGZWF0dXJlV3JhcHBlciBpbXBsZW1lbnRzIFZlY3RvclRpbGVGZWF0dXJlIHtcbiAgICBfZmVhdHVyZTogRmVhdHVyZTtcblxuICAgIGV4dGVudDogbnVtYmVyO1xuICAgIHR5cGU6IDEgfCAyIHwgMztcbiAgICBpZDogbnVtYmVyO1xuICAgIHByb3BlcnRpZXM6IHtbXzogc3RyaW5nXTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbn07XG5cbiAgICBjb25zdHJ1Y3RvcihmZWF0dXJlOiBGZWF0dXJlKSB7XG4gICAgICAgIHRoaXMuX2ZlYXR1cmUgPSBmZWF0dXJlO1xuXG4gICAgICAgIHRoaXMuZXh0ZW50ID0gRVhURU5UO1xuICAgICAgICB0aGlzLnR5cGUgPSBmZWF0dXJlLnR5cGU7XG4gICAgICAgIHRoaXMucHJvcGVydGllcyA9IGZlYXR1cmUudGFncztcblxuICAgICAgICAvLyBJZiB0aGUgZmVhdHVyZSBoYXMgYSB0b3AtbGV2ZWwgYGlkYCBwcm9wZXJ0eSwgY29weSBpdCBvdmVyLCBidXQgb25seVxuICAgICAgICAvLyBpZiBpdCBjYW4gYmUgY29lcmNlZCB0byBhbiBpbnRlZ2VyLCBiZWNhdXNlIHRoaXMgd3JhcHBlciBpcyB1c2VkIGZvclxuICAgICAgICAvLyBzZXJpYWxpemluZyBnZW9qc29uIGZlYXR1cmUgZGF0YSBpbnRvIHZlY3RvciB0aWxlIFBCRiBkYXRhLCBhbmQgdGhlXG4gICAgICAgIC8vIHZlY3RvciB0aWxlIHNwZWMgb25seSBzdXBwb3J0cyBpbnRlZ2VyIHZhbHVlcyBmb3IgZmVhdHVyZSBpZHMgLS1cbiAgICAgICAgLy8gYWxsb3dpbmcgbm9uLWludGVnZXIgdmFsdWVzIGhlcmUgcmVzdWx0cyBpbiBhIG5vbi1jb21wbGlhbnQgUEJGXG4gICAgICAgIC8vIHRoYXQgY2F1c2VzIGFuIGV4Y2VwdGlvbiB3aGVuIGl0IGlzIHBhcnNlZCB3aXRoIHZlY3Rvci10aWxlLWpzXG4gICAgICAgIGlmICgnaWQnIGluIGZlYXR1cmUgJiYgIWlzTmFOKGZlYXR1cmUuaWQpKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gcGFyc2VJbnQoZmVhdHVyZS5pZCwgMTApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbG9hZEdlb21ldHJ5KCkge1xuICAgICAgICBpZiAodGhpcy5fZmVhdHVyZS50eXBlID09PSAxKSB7XG4gICAgICAgICAgICBjb25zdCBnZW9tZXRyeSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBwb2ludCBvZiB0aGlzLl9mZWF0dXJlLmdlb21ldHJ5KSB7XG4gICAgICAgICAgICAgICAgZ2VvbWV0cnkucHVzaChbbmV3IFBvaW50KHBvaW50WzBdLCBwb2ludFsxXSldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBnZW9tZXRyeTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGdlb21ldHJ5ID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJpbmcgb2YgdGhpcy5fZmVhdHVyZS5nZW9tZXRyeSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1JpbmcgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3UmluZy5wdXNoKG5ldyBQb2ludChwb2ludFswXSwgcG9pbnRbMV0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZ2VvbWV0cnkucHVzaChuZXdSaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBnZW9tZXRyeTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRvR2VvSlNPTih4OiBudW1iZXIsIHk6IG51bWJlciwgejogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0b0dlb0pTT04uY2FsbCh0aGlzLCB4LCB5LCB6KTtcbiAgICB9XG59XG5cbmNsYXNzIEdlb0pTT05XcmFwcGVyIGltcGxlbWVudHMgVmVjdG9yVGlsZSwgVmVjdG9yVGlsZUxheWVyIHtcbiAgICBsYXllcnM6IHtbXzogc3RyaW5nXTogVmVjdG9yVGlsZUxheWVyfTtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgZXh0ZW50OiBudW1iZXI7XG4gICAgbGVuZ3RoOiBudW1iZXI7XG4gICAgX2ZlYXR1cmVzOiBBcnJheTxGZWF0dXJlPjtcblxuICAgIGNvbnN0cnVjdG9yKGZlYXR1cmVzOiBBcnJheTxGZWF0dXJlPikge1xuICAgICAgICB0aGlzLmxheWVycyA9IHsnX2dlb2pzb25UaWxlTGF5ZXInOiB0aGlzfTtcbiAgICAgICAgdGhpcy5uYW1lID0gJ19nZW9qc29uVGlsZUxheWVyJztcbiAgICAgICAgdGhpcy5leHRlbnQgPSBFWFRFTlQ7XG4gICAgICAgIHRoaXMubGVuZ3RoID0gZmVhdHVyZXMubGVuZ3RoO1xuICAgICAgICB0aGlzLl9mZWF0dXJlcyA9IGZlYXR1cmVzO1xuICAgIH1cblxuICAgIGZlYXR1cmUoaTogbnVtYmVyKTogVmVjdG9yVGlsZUZlYXR1cmUge1xuICAgICAgICByZXR1cm4gbmV3IEZlYXR1cmVXcmFwcGVyKHRoaXMuX2ZlYXR1cmVzW2ldKTtcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEdlb0pTT05XcmFwcGVyO1xuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBQb2ludCA9IHJlcXVpcmUoJ0BtYXBib3gvcG9pbnQtZ2VvbWV0cnknKVxudmFyIFZlY3RvclRpbGVGZWF0dXJlID0gcmVxdWlyZSgnQG1hcGJveC92ZWN0b3ItdGlsZScpLlZlY3RvclRpbGVGZWF0dXJlXG5cbm1vZHVsZS5leHBvcnRzID0gR2VvSlNPTldyYXBwZXJcblxuLy8gY29uZm9ybSB0byB2ZWN0b3J0aWxlIGFwaVxuZnVuY3Rpb24gR2VvSlNPTldyYXBwZXIgKGZlYXR1cmVzLCBvcHRpb25zKSB7XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgdGhpcy5mZWF0dXJlcyA9IGZlYXR1cmVzXG4gIHRoaXMubGVuZ3RoID0gZmVhdHVyZXMubGVuZ3RoXG59XG5cbkdlb0pTT05XcmFwcGVyLnByb3RvdHlwZS5mZWF0dXJlID0gZnVuY3Rpb24gKGkpIHtcbiAgcmV0dXJuIG5ldyBGZWF0dXJlV3JhcHBlcih0aGlzLmZlYXR1cmVzW2ldLCB0aGlzLm9wdGlvbnMuZXh0ZW50KVxufVxuXG5mdW5jdGlvbiBGZWF0dXJlV3JhcHBlciAoZmVhdHVyZSwgZXh0ZW50KSB7XG4gIHRoaXMuaWQgPSB0eXBlb2YgZmVhdHVyZS5pZCA9PT0gJ251bWJlcicgPyBmZWF0dXJlLmlkIDogdW5kZWZpbmVkXG4gIHRoaXMudHlwZSA9IGZlYXR1cmUudHlwZVxuICB0aGlzLnJhd0dlb21ldHJ5ID0gZmVhdHVyZS50eXBlID09PSAxID8gW2ZlYXR1cmUuZ2VvbWV0cnldIDogZmVhdHVyZS5nZW9tZXRyeVxuICB0aGlzLnByb3BlcnRpZXMgPSBmZWF0dXJlLnRhZ3NcbiAgdGhpcy5leHRlbnQgPSBleHRlbnQgfHwgNDA5NlxufVxuXG5GZWF0dXJlV3JhcHBlci5wcm90b3R5cGUubG9hZEdlb21ldHJ5ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmluZ3MgPSB0aGlzLnJhd0dlb21ldHJ5XG4gIHRoaXMuZ2VvbWV0cnkgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmluZyA9IHJpbmdzW2ldXG4gICAgdmFyIG5ld1JpbmcgPSBbXVxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgcmluZy5sZW5ndGg7IGorKykge1xuICAgICAgbmV3UmluZy5wdXNoKG5ldyBQb2ludChyaW5nW2pdWzBdLCByaW5nW2pdWzFdKSlcbiAgICB9XG4gICAgdGhpcy5nZW9tZXRyeS5wdXNoKG5ld1JpbmcpXG4gIH1cbiAgcmV0dXJuIHRoaXMuZ2VvbWV0cnlcbn1cblxuRmVhdHVyZVdyYXBwZXIucHJvdG90eXBlLmJib3ggPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5nZW9tZXRyeSkgdGhpcy5sb2FkR2VvbWV0cnkoKVxuXG4gIHZhciByaW5ncyA9IHRoaXMuZ2VvbWV0cnlcbiAgdmFyIHgxID0gSW5maW5pdHlcbiAgdmFyIHgyID0gLUluZmluaXR5XG4gIHZhciB5MSA9IEluZmluaXR5XG4gIHZhciB5MiA9IC1JbmZpbml0eVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcmluZyA9IHJpbmdzW2ldXG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHJpbmcubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBjb29yZCA9IHJpbmdbal1cblxuICAgICAgeDEgPSBNYXRoLm1pbih4MSwgY29vcmQueClcbiAgICAgIHgyID0gTWF0aC5tYXgoeDIsIGNvb3JkLngpXG4gICAgICB5MSA9IE1hdGgubWluKHkxLCBjb29yZC55KVxuICAgICAgeTIgPSBNYXRoLm1heCh5MiwgY29vcmQueSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gW3gxLCB5MSwgeDIsIHkyXVxufVxuXG5GZWF0dXJlV3JhcHBlci5wcm90b3R5cGUudG9HZW9KU09OID0gVmVjdG9yVGlsZUZlYXR1cmUucHJvdG90eXBlLnRvR2VvSlNPTlxuIiwidmFyIFBiZiA9IHJlcXVpcmUoJ3BiZicpXG52YXIgR2VvSlNPTldyYXBwZXIgPSByZXF1aXJlKCcuL2xpYi9nZW9qc29uX3dyYXBwZXInKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZyb21WZWN0b3JUaWxlSnNcbm1vZHVsZS5leHBvcnRzLmZyb21WZWN0b3JUaWxlSnMgPSBmcm9tVmVjdG9yVGlsZUpzXG5tb2R1bGUuZXhwb3J0cy5mcm9tR2VvanNvblZ0ID0gZnJvbUdlb2pzb25WdFxubW9kdWxlLmV4cG9ydHMuR2VvSlNPTldyYXBwZXIgPSBHZW9KU09OV3JhcHBlclxuXG4vKipcbiAqIFNlcmlhbGl6ZSBhIHZlY3Rvci10aWxlLWpzLWNyZWF0ZWQgdGlsZSB0byBwYmZcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdGlsZVxuICogQHJldHVybiB7QnVmZmVyfSB1bmNvbXByZXNzZWQsIHBiZi1zZXJpYWxpemVkIHRpbGUgZGF0YVxuICovXG5mdW5jdGlvbiBmcm9tVmVjdG9yVGlsZUpzICh0aWxlKSB7XG4gIHZhciBvdXQgPSBuZXcgUGJmKClcbiAgd3JpdGVUaWxlKHRpbGUsIG91dClcbiAgcmV0dXJuIG91dC5maW5pc2goKVxufVxuXG4vKipcbiAqIFNlcmlhbGl6ZWQgYSBnZW9qc29uLXZ0LWNyZWF0ZWQgdGlsZSB0byBwYmYuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGxheWVycyAtIEFuIG9iamVjdCBtYXBwaW5nIGxheWVyIG5hbWVzIHRvIGdlb2pzb24tdnQtY3JlYXRlZCB2ZWN0b3IgdGlsZSBvYmplY3RzXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIC0gQW4gb2JqZWN0IHNwZWNpZnlpbmcgdGhlIHZlY3Rvci10aWxlIHNwZWNpZmljYXRpb24gdmVyc2lvbiBhbmQgZXh0ZW50IHRoYXQgd2VyZSB1c2VkIHRvIGNyZWF0ZSBgbGF5ZXJzYC5cbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy52ZXJzaW9uPTFdIC0gVmVyc2lvbiBvZiB2ZWN0b3ItdGlsZSBzcGVjIHVzZWRcbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3B0aW9ucy5leHRlbnQ9NDA5Nl0gLSBFeHRlbnQgb2YgdGhlIHZlY3RvciB0aWxlXG4gKiBAcmV0dXJuIHtCdWZmZXJ9IHVuY29tcHJlc3NlZCwgcGJmLXNlcmlhbGl6ZWQgdGlsZSBkYXRhXG4gKi9cbmZ1bmN0aW9uIGZyb21HZW9qc29uVnQgKGxheWVycywgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICB2YXIgbCA9IHt9XG4gIGZvciAodmFyIGsgaW4gbGF5ZXJzKSB7XG4gICAgbFtrXSA9IG5ldyBHZW9KU09OV3JhcHBlcihsYXllcnNba10uZmVhdHVyZXMsIG9wdGlvbnMpXG4gICAgbFtrXS5uYW1lID0ga1xuICAgIGxba10udmVyc2lvbiA9IG9wdGlvbnMudmVyc2lvblxuICAgIGxba10uZXh0ZW50ID0gb3B0aW9ucy5leHRlbnRcbiAgfVxuICByZXR1cm4gZnJvbVZlY3RvclRpbGVKcyh7bGF5ZXJzOiBsfSlcbn1cblxuZnVuY3Rpb24gd3JpdGVUaWxlICh0aWxlLCBwYmYpIHtcbiAgZm9yICh2YXIga2V5IGluIHRpbGUubGF5ZXJzKSB7XG4gICAgcGJmLndyaXRlTWVzc2FnZSgzLCB3cml0ZUxheWVyLCB0aWxlLmxheWVyc1trZXldKVxuICB9XG59XG5cbmZ1bmN0aW9uIHdyaXRlTGF5ZXIgKGxheWVyLCBwYmYpIHtcbiAgcGJmLndyaXRlVmFyaW50RmllbGQoMTUsIGxheWVyLnZlcnNpb24gfHwgMSlcbiAgcGJmLndyaXRlU3RyaW5nRmllbGQoMSwgbGF5ZXIubmFtZSB8fCAnJylcbiAgcGJmLndyaXRlVmFyaW50RmllbGQoNSwgbGF5ZXIuZXh0ZW50IHx8IDQwOTYpXG5cbiAgdmFyIGlcbiAgdmFyIGNvbnRleHQgPSB7XG4gICAga2V5czogW10sXG4gICAgdmFsdWVzOiBbXSxcbiAgICBrZXljYWNoZToge30sXG4gICAgdmFsdWVjYWNoZToge31cbiAgfVxuXG4gIGZvciAoaSA9IDA7IGkgPCBsYXllci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnRleHQuZmVhdHVyZSA9IGxheWVyLmZlYXR1cmUoaSlcbiAgICBwYmYud3JpdGVNZXNzYWdlKDIsIHdyaXRlRmVhdHVyZSwgY29udGV4dClcbiAgfVxuXG4gIHZhciBrZXlzID0gY29udGV4dC5rZXlzXG4gIGZvciAoaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgcGJmLndyaXRlU3RyaW5nRmllbGQoMywga2V5c1tpXSlcbiAgfVxuXG4gIHZhciB2YWx1ZXMgPSBjb250ZXh0LnZhbHVlc1xuICBmb3IgKGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgcGJmLndyaXRlTWVzc2FnZSg0LCB3cml0ZVZhbHVlLCB2YWx1ZXNbaV0pXG4gIH1cbn1cblxuZnVuY3Rpb24gd3JpdGVGZWF0dXJlIChjb250ZXh0LCBwYmYpIHtcbiAgdmFyIGZlYXR1cmUgPSBjb250ZXh0LmZlYXR1cmVcblxuICBpZiAoZmVhdHVyZS5pZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcGJmLndyaXRlVmFyaW50RmllbGQoMSwgZmVhdHVyZS5pZClcbiAgfVxuXG4gIHBiZi53cml0ZU1lc3NhZ2UoMiwgd3JpdGVQcm9wZXJ0aWVzLCBjb250ZXh0KVxuICBwYmYud3JpdGVWYXJpbnRGaWVsZCgzLCBmZWF0dXJlLnR5cGUpXG4gIHBiZi53cml0ZU1lc3NhZ2UoNCwgd3JpdGVHZW9tZXRyeSwgZmVhdHVyZSlcbn1cblxuZnVuY3Rpb24gd3JpdGVQcm9wZXJ0aWVzIChjb250ZXh0LCBwYmYpIHtcbiAgdmFyIGZlYXR1cmUgPSBjb250ZXh0LmZlYXR1cmVcbiAgdmFyIGtleXMgPSBjb250ZXh0LmtleXNcbiAgdmFyIHZhbHVlcyA9IGNvbnRleHQudmFsdWVzXG4gIHZhciBrZXljYWNoZSA9IGNvbnRleHQua2V5Y2FjaGVcbiAgdmFyIHZhbHVlY2FjaGUgPSBjb250ZXh0LnZhbHVlY2FjaGVcblxuICBmb3IgKHZhciBrZXkgaW4gZmVhdHVyZS5wcm9wZXJ0aWVzKSB7XG4gICAgdmFyIGtleUluZGV4ID0ga2V5Y2FjaGVba2V5XVxuICAgIGlmICh0eXBlb2Yga2V5SW5kZXggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBrZXlzLnB1c2goa2V5KVxuICAgICAga2V5SW5kZXggPSBrZXlzLmxlbmd0aCAtIDFcbiAgICAgIGtleWNhY2hlW2tleV0gPSBrZXlJbmRleFxuICAgIH1cbiAgICBwYmYud3JpdGVWYXJpbnQoa2V5SW5kZXgpXG5cbiAgICB2YXIgdmFsdWUgPSBmZWF0dXJlLnByb3BlcnRpZXNba2V5XVxuICAgIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlXG4gICAgaWYgKHR5cGUgIT09ICdzdHJpbmcnICYmIHR5cGUgIT09ICdib29sZWFuJyAmJiB0eXBlICE9PSAnbnVtYmVyJykge1xuICAgICAgdmFsdWUgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSlcbiAgICB9XG4gICAgdmFyIHZhbHVlS2V5ID0gdHlwZSArICc6JyArIHZhbHVlXG4gICAgdmFyIHZhbHVlSW5kZXggPSB2YWx1ZWNhY2hlW3ZhbHVlS2V5XVxuICAgIGlmICh0eXBlb2YgdmFsdWVJbmRleCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHZhbHVlcy5wdXNoKHZhbHVlKVxuICAgICAgdmFsdWVJbmRleCA9IHZhbHVlcy5sZW5ndGggLSAxXG4gICAgICB2YWx1ZWNhY2hlW3ZhbHVlS2V5XSA9IHZhbHVlSW5kZXhcbiAgICB9XG4gICAgcGJmLndyaXRlVmFyaW50KHZhbHVlSW5kZXgpXG4gIH1cbn1cblxuZnVuY3Rpb24gY29tbWFuZCAoY21kLCBsZW5ndGgpIHtcbiAgcmV0dXJuIChsZW5ndGggPDwgMykgKyAoY21kICYgMHg3KVxufVxuXG5mdW5jdGlvbiB6aWd6YWcgKG51bSkge1xuICByZXR1cm4gKG51bSA8PCAxKSBeIChudW0gPj4gMzEpXG59XG5cbmZ1bmN0aW9uIHdyaXRlR2VvbWV0cnkgKGZlYXR1cmUsIHBiZikge1xuICB2YXIgZ2VvbWV0cnkgPSBmZWF0dXJlLmxvYWRHZW9tZXRyeSgpXG4gIHZhciB0eXBlID0gZmVhdHVyZS50eXBlXG4gIHZhciB4ID0gMFxuICB2YXIgeSA9IDBcbiAgdmFyIHJpbmdzID0gZ2VvbWV0cnkubGVuZ3RoXG4gIGZvciAodmFyIHIgPSAwOyByIDwgcmluZ3M7IHIrKykge1xuICAgIHZhciByaW5nID0gZ2VvbWV0cnlbcl1cbiAgICB2YXIgY291bnQgPSAxXG4gICAgaWYgKHR5cGUgPT09IDEpIHtcbiAgICAgIGNvdW50ID0gcmluZy5sZW5ndGhcbiAgICB9XG4gICAgcGJmLndyaXRlVmFyaW50KGNvbW1hbmQoMSwgY291bnQpKSAvLyBtb3ZldG9cbiAgICAvLyBkbyBub3Qgd3JpdGUgcG9seWdvbiBjbG9zaW5nIHBhdGggYXMgbGluZXRvXG4gICAgdmFyIGxpbmVDb3VudCA9IHR5cGUgPT09IDMgPyByaW5nLmxlbmd0aCAtIDEgOiByaW5nLmxlbmd0aFxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZUNvdW50OyBpKyspIHtcbiAgICAgIGlmIChpID09PSAxICYmIHR5cGUgIT09IDEpIHtcbiAgICAgICAgcGJmLndyaXRlVmFyaW50KGNvbW1hbmQoMiwgbGluZUNvdW50IC0gMSkpIC8vIGxpbmV0b1xuICAgICAgfVxuICAgICAgdmFyIGR4ID0gcmluZ1tpXS54IC0geFxuICAgICAgdmFyIGR5ID0gcmluZ1tpXS55IC0geVxuICAgICAgcGJmLndyaXRlVmFyaW50KHppZ3phZyhkeCkpXG4gICAgICBwYmYud3JpdGVWYXJpbnQoemlnemFnKGR5KSlcbiAgICAgIHggKz0gZHhcbiAgICAgIHkgKz0gZHlcbiAgICB9XG4gICAgaWYgKHR5cGUgPT09IDMpIHtcbiAgICAgIHBiZi53cml0ZVZhcmludChjb21tYW5kKDcsIDEpKSAvLyBjbG9zZXBhdGhcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JpdGVWYWx1ZSAodmFsdWUsIHBiZikge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZVxuICBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICBwYmYud3JpdGVTdHJpbmdGaWVsZCgxLCB2YWx1ZSlcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICBwYmYud3JpdGVCb29sZWFuRmllbGQoNywgdmFsdWUpXG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodmFsdWUgJSAxICE9PSAwKSB7XG4gICAgICBwYmYud3JpdGVEb3VibGVGaWVsZCgzLCB2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKHZhbHVlIDwgMCkge1xuICAgICAgcGJmLndyaXRlU1ZhcmludEZpZWxkKDYsIHZhbHVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBwYmYud3JpdGVWYXJpbnRGaWVsZCg1LCB2YWx1ZSlcbiAgICB9XG4gIH1cbn1cbiIsIlxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc29ydEtEKGlkcywgY29vcmRzLCBub2RlU2l6ZSwgbGVmdCwgcmlnaHQsIGRlcHRoKSB7XG4gICAgaWYgKHJpZ2h0IC0gbGVmdCA8PSBub2RlU2l6ZSkgcmV0dXJuO1xuXG4gICAgY29uc3QgbSA9IChsZWZ0ICsgcmlnaHQpID4+IDE7XG5cbiAgICBzZWxlY3QoaWRzLCBjb29yZHMsIG0sIGxlZnQsIHJpZ2h0LCBkZXB0aCAlIDIpO1xuXG4gICAgc29ydEtEKGlkcywgY29vcmRzLCBub2RlU2l6ZSwgbGVmdCwgbSAtIDEsIGRlcHRoICsgMSk7XG4gICAgc29ydEtEKGlkcywgY29vcmRzLCBub2RlU2l6ZSwgbSArIDEsIHJpZ2h0LCBkZXB0aCArIDEpO1xufVxuXG5mdW5jdGlvbiBzZWxlY3QoaWRzLCBjb29yZHMsIGssIGxlZnQsIHJpZ2h0LCBpbmMpIHtcblxuICAgIHdoaWxlIChyaWdodCA+IGxlZnQpIHtcbiAgICAgICAgaWYgKHJpZ2h0IC0gbGVmdCA+IDYwMCkge1xuICAgICAgICAgICAgY29uc3QgbiA9IHJpZ2h0IC0gbGVmdCArIDE7XG4gICAgICAgICAgICBjb25zdCBtID0gayAtIGxlZnQgKyAxO1xuICAgICAgICAgICAgY29uc3QgeiA9IE1hdGgubG9nKG4pO1xuICAgICAgICAgICAgY29uc3QgcyA9IDAuNSAqIE1hdGguZXhwKDIgKiB6IC8gMyk7XG4gICAgICAgICAgICBjb25zdCBzZCA9IDAuNSAqIE1hdGguc3FydCh6ICogcyAqIChuIC0gcykgLyBuKSAqIChtIC0gbiAvIDIgPCAwID8gLTEgOiAxKTtcbiAgICAgICAgICAgIGNvbnN0IG5ld0xlZnQgPSBNYXRoLm1heChsZWZ0LCBNYXRoLmZsb29yKGsgLSBtICogcyAvIG4gKyBzZCkpO1xuICAgICAgICAgICAgY29uc3QgbmV3UmlnaHQgPSBNYXRoLm1pbihyaWdodCwgTWF0aC5mbG9vcihrICsgKG4gLSBtKSAqIHMgLyBuICsgc2QpKTtcbiAgICAgICAgICAgIHNlbGVjdChpZHMsIGNvb3JkcywgaywgbmV3TGVmdCwgbmV3UmlnaHQsIGluYyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ID0gY29vcmRzWzIgKiBrICsgaW5jXTtcbiAgICAgICAgbGV0IGkgPSBsZWZ0O1xuICAgICAgICBsZXQgaiA9IHJpZ2h0O1xuXG4gICAgICAgIHN3YXBJdGVtKGlkcywgY29vcmRzLCBsZWZ0LCBrKTtcbiAgICAgICAgaWYgKGNvb3Jkc1syICogcmlnaHQgKyBpbmNdID4gdCkgc3dhcEl0ZW0oaWRzLCBjb29yZHMsIGxlZnQsIHJpZ2h0KTtcblxuICAgICAgICB3aGlsZSAoaSA8IGopIHtcbiAgICAgICAgICAgIHN3YXBJdGVtKGlkcywgY29vcmRzLCBpLCBqKTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGotLTtcbiAgICAgICAgICAgIHdoaWxlIChjb29yZHNbMiAqIGkgKyBpbmNdIDwgdCkgaSsrO1xuICAgICAgICAgICAgd2hpbGUgKGNvb3Jkc1syICogaiArIGluY10gPiB0KSBqLS07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29vcmRzWzIgKiBsZWZ0ICsgaW5jXSA9PT0gdCkgc3dhcEl0ZW0oaWRzLCBjb29yZHMsIGxlZnQsIGopO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIHN3YXBJdGVtKGlkcywgY29vcmRzLCBqLCByaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaiA8PSBrKSBsZWZ0ID0gaiArIDE7XG4gICAgICAgIGlmIChrIDw9IGopIHJpZ2h0ID0gaiAtIDE7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzd2FwSXRlbShpZHMsIGNvb3JkcywgaSwgaikge1xuICAgIHN3YXAoaWRzLCBpLCBqKTtcbiAgICBzd2FwKGNvb3JkcywgMiAqIGksIDIgKiBqKTtcbiAgICBzd2FwKGNvb3JkcywgMiAqIGkgKyAxLCAyICogaiArIDEpO1xufVxuXG5mdW5jdGlvbiBzd2FwKGFyciwgaSwgaikge1xuICAgIGNvbnN0IHRtcCA9IGFycltpXTtcbiAgICBhcnJbaV0gPSBhcnJbal07XG4gICAgYXJyW2pdID0gdG1wO1xufVxuIiwiXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByYW5nZShpZHMsIGNvb3JkcywgbWluWCwgbWluWSwgbWF4WCwgbWF4WSwgbm9kZVNpemUpIHtcbiAgICBjb25zdCBzdGFjayA9IFswLCBpZHMubGVuZ3RoIC0gMSwgMF07XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgbGV0IHgsIHk7XG5cbiAgICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgY29uc3QgbGVmdCA9IHN0YWNrLnBvcCgpO1xuXG4gICAgICAgIGlmIChyaWdodCAtIGxlZnQgPD0gbm9kZVNpemUpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBsZWZ0OyBpIDw9IHJpZ2h0OyBpKyspIHtcbiAgICAgICAgICAgICAgICB4ID0gY29vcmRzWzIgKiBpXTtcbiAgICAgICAgICAgICAgICB5ID0gY29vcmRzWzIgKiBpICsgMV07XG4gICAgICAgICAgICAgICAgaWYgKHggPj0gbWluWCAmJiB4IDw9IG1heFggJiYgeSA+PSBtaW5ZICYmIHkgPD0gbWF4WSkgcmVzdWx0LnB1c2goaWRzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbSA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblxuICAgICAgICB4ID0gY29vcmRzWzIgKiBtXTtcbiAgICAgICAgeSA9IGNvb3Jkc1syICogbSArIDFdO1xuXG4gICAgICAgIGlmICh4ID49IG1pblggJiYgeCA8PSBtYXhYICYmIHkgPj0gbWluWSAmJiB5IDw9IG1heFkpIHJlc3VsdC5wdXNoKGlkc1ttXSk7XG5cbiAgICAgICAgY29uc3QgbmV4dEF4aXMgPSAoYXhpcyArIDEpICUgMjtcblxuICAgICAgICBpZiAoYXhpcyA9PT0gMCA/IG1pblggPD0geCA6IG1pblkgPD0geSkge1xuICAgICAgICAgICAgc3RhY2sucHVzaChsZWZ0KTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobSAtIDEpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXh0QXhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGF4aXMgPT09IDAgPyBtYXhYID49IHggOiBtYXhZID49IHkpIHtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobSArIDEpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChyaWdodCk7XG4gICAgICAgICAgICBzdGFjay5wdXNoKG5leHRBeGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG4iLCJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHdpdGhpbihpZHMsIGNvb3JkcywgcXgsIHF5LCByLCBub2RlU2l6ZSkge1xuICAgIGNvbnN0IHN0YWNrID0gWzAsIGlkcy5sZW5ndGggLSAxLCAwXTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCByMiA9IHIgKiByO1xuXG4gICAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBheGlzID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBzdGFjay5wb3AoKTtcblxuICAgICAgICBpZiAocmlnaHQgLSBsZWZ0IDw9IG5vZGVTaXplKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gbGVmdDsgaSA8PSByaWdodDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNxRGlzdChjb29yZHNbMiAqIGldLCBjb29yZHNbMiAqIGkgKyAxXSwgcXgsIHF5KSA8PSByMikgcmVzdWx0LnB1c2goaWRzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbSA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblxuICAgICAgICBjb25zdCB4ID0gY29vcmRzWzIgKiBtXTtcbiAgICAgICAgY29uc3QgeSA9IGNvb3Jkc1syICogbSArIDFdO1xuXG4gICAgICAgIGlmIChzcURpc3QoeCwgeSwgcXgsIHF5KSA8PSByMikgcmVzdWx0LnB1c2goaWRzW21dKTtcblxuICAgICAgICBjb25zdCBuZXh0QXhpcyA9IChheGlzICsgMSkgJSAyO1xuXG4gICAgICAgIGlmIChheGlzID09PSAwID8gcXggLSByIDw9IHggOiBxeSAtIHIgPD0geSkge1xuICAgICAgICAgICAgc3RhY2sucHVzaChsZWZ0KTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobSAtIDEpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXh0QXhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGF4aXMgPT09IDAgPyBxeCArIHIgPj0geCA6IHF5ICsgciA+PSB5KSB7XG4gICAgICAgICAgICBzdGFjay5wdXNoKG0gKyAxKTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gocmlnaHQpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXh0QXhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzcURpc3QoYXgsIGF5LCBieCwgYnkpIHtcbiAgICBjb25zdCBkeCA9IGF4IC0gYng7XG4gICAgY29uc3QgZHkgPSBheSAtIGJ5O1xuICAgIHJldHVybiBkeCAqIGR4ICsgZHkgKiBkeTtcbn1cbiIsIlxuaW1wb3J0IHNvcnQgZnJvbSAnLi9zb3J0JztcbmltcG9ydCByYW5nZSBmcm9tICcuL3JhbmdlJztcbmltcG9ydCB3aXRoaW4gZnJvbSAnLi93aXRoaW4nO1xuXG5jb25zdCBkZWZhdWx0R2V0WCA9IHAgPT4gcFswXTtcbmNvbnN0IGRlZmF1bHRHZXRZID0gcCA9PiBwWzFdO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBLREJ1c2gge1xuICAgIGNvbnN0cnVjdG9yKHBvaW50cywgZ2V0WCA9IGRlZmF1bHRHZXRYLCBnZXRZID0gZGVmYXVsdEdldFksIG5vZGVTaXplID0gNjQsIEFycmF5VHlwZSA9IEZsb2F0NjRBcnJheSkge1xuICAgICAgICB0aGlzLm5vZGVTaXplID0gbm9kZVNpemU7XG4gICAgICAgIHRoaXMucG9pbnRzID0gcG9pbnRzO1xuXG4gICAgICAgIGNvbnN0IEluZGV4QXJyYXlUeXBlID0gcG9pbnRzLmxlbmd0aCA8IDY1NTM2ID8gVWludDE2QXJyYXkgOiBVaW50MzJBcnJheTtcblxuICAgICAgICBjb25zdCBpZHMgPSB0aGlzLmlkcyA9IG5ldyBJbmRleEFycmF5VHlwZShwb2ludHMubGVuZ3RoKTtcbiAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5jb29yZHMgPSBuZXcgQXJyYXlUeXBlKHBvaW50cy5sZW5ndGggKiAyKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWRzW2ldID0gaTtcbiAgICAgICAgICAgIGNvb3Jkc1syICogaV0gPSBnZXRYKHBvaW50c1tpXSk7XG4gICAgICAgICAgICBjb29yZHNbMiAqIGkgKyAxXSA9IGdldFkocG9pbnRzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNvcnQoaWRzLCBjb29yZHMsIG5vZGVTaXplLCAwLCBpZHMubGVuZ3RoIC0gMSwgMCk7XG4gICAgfVxuXG4gICAgcmFuZ2UobWluWCwgbWluWSwgbWF4WCwgbWF4WSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UodGhpcy5pZHMsIHRoaXMuY29vcmRzLCBtaW5YLCBtaW5ZLCBtYXhYLCBtYXhZLCB0aGlzLm5vZGVTaXplKTtcbiAgICB9XG5cbiAgICB3aXRoaW4oeCwgeSwgcikge1xuICAgICAgICByZXR1cm4gd2l0aGluKHRoaXMuaWRzLCB0aGlzLmNvb3JkcywgeCwgeSwgciwgdGhpcy5ub2RlU2l6ZSk7XG4gICAgfVxufVxuIiwiXG5pbXBvcnQgS0RCdXNoIGZyb20gJ2tkYnVzaCc7XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICAgIG1pblpvb206IDAsICAgLy8gbWluIHpvb20gdG8gZ2VuZXJhdGUgY2x1c3RlcnMgb25cbiAgICBtYXhab29tOiAxNiwgIC8vIG1heCB6b29tIGxldmVsIHRvIGNsdXN0ZXIgdGhlIHBvaW50cyBvblxuICAgIG1pblBvaW50czogMiwgLy8gbWluaW11bSBwb2ludHMgdG8gZm9ybSBhIGNsdXN0ZXJcbiAgICByYWRpdXM6IDQwLCAgIC8vIGNsdXN0ZXIgcmFkaXVzIGluIHBpeGVsc1xuICAgIGV4dGVudDogNTEyLCAgLy8gdGlsZSBleHRlbnQgKHJhZGl1cyBpcyBjYWxjdWxhdGVkIHJlbGF0aXZlIHRvIGl0KVxuICAgIG5vZGVTaXplOiA2NCwgLy8gc2l6ZSBvZiB0aGUgS0QtdHJlZSBsZWFmIG5vZGUsIGFmZmVjdHMgcGVyZm9ybWFuY2VcbiAgICBsb2c6IGZhbHNlLCAgIC8vIHdoZXRoZXIgdG8gbG9nIHRpbWluZyBpbmZvXG5cbiAgICAvLyB3aGV0aGVyIHRvIGdlbmVyYXRlIG51bWVyaWMgaWRzIGZvciBpbnB1dCBmZWF0dXJlcyAoaW4gdmVjdG9yIHRpbGVzKVxuICAgIGdlbmVyYXRlSWQ6IGZhbHNlLFxuXG4gICAgLy8gYSByZWR1Y2UgZnVuY3Rpb24gZm9yIGNhbGN1bGF0aW5nIGN1c3RvbSBjbHVzdGVyIHByb3BlcnRpZXNcbiAgICByZWR1Y2U6IG51bGwsIC8vIChhY2N1bXVsYXRlZCwgcHJvcHMpID0+IHsgYWNjdW11bGF0ZWQuc3VtICs9IHByb3BzLnN1bTsgfVxuXG4gICAgLy8gcHJvcGVydGllcyB0byB1c2UgZm9yIGluZGl2aWR1YWwgcG9pbnRzIHdoZW4gcnVubmluZyB0aGUgcmVkdWNlclxuICAgIG1hcDogcHJvcHMgPT4gcHJvcHMgLy8gcHJvcHMgPT4gKHtzdW06IHByb3BzLm15X3ZhbHVlfSlcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN1cGVyY2x1c3RlciB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBleHRlbmQoT2JqZWN0LmNyZWF0ZShkZWZhdWx0T3B0aW9ucyksIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLnRyZWVzID0gbmV3IEFycmF5KHRoaXMub3B0aW9ucy5tYXhab29tICsgMSk7XG4gICAgfVxuXG4gICAgbG9hZChwb2ludHMpIHtcbiAgICAgICAgY29uc3Qge2xvZywgbWluWm9vbSwgbWF4Wm9vbSwgbm9kZVNpemV9ID0gdGhpcy5vcHRpb25zO1xuXG4gICAgICAgIGlmIChsb2cpIGNvbnNvbGUudGltZSgndG90YWwgdGltZScpO1xuXG4gICAgICAgIGNvbnN0IHRpbWVySWQgPSBgcHJlcGFyZSAkeyAgcG9pbnRzLmxlbmd0aCAgfSBwb2ludHNgO1xuICAgICAgICBpZiAobG9nKSBjb25zb2xlLnRpbWUodGltZXJJZCk7XG5cbiAgICAgICAgdGhpcy5wb2ludHMgPSBwb2ludHM7XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgYSBjbHVzdGVyIG9iamVjdCBmb3IgZWFjaCBwb2ludCBhbmQgaW5kZXggaW5wdXQgcG9pbnRzIGludG8gYSBLRC10cmVlXG4gICAgICAgIGxldCBjbHVzdGVycyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCFwb2ludHNbaV0uZ2VvbWV0cnkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY2x1c3RlcnMucHVzaChjcmVhdGVQb2ludENsdXN0ZXIocG9pbnRzW2ldLCBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50cmVlc1ttYXhab29tICsgMV0gPSBuZXcgS0RCdXNoKGNsdXN0ZXJzLCBnZXRYLCBnZXRZLCBub2RlU2l6ZSwgRmxvYXQzMkFycmF5KTtcblxuICAgICAgICBpZiAobG9nKSBjb25zb2xlLnRpbWVFbmQodGltZXJJZCk7XG5cbiAgICAgICAgLy8gY2x1c3RlciBwb2ludHMgb24gbWF4IHpvb20sIHRoZW4gY2x1c3RlciB0aGUgcmVzdWx0cyBvbiBwcmV2aW91cyB6b29tLCBldGMuO1xuICAgICAgICAvLyByZXN1bHRzIGluIGEgY2x1c3RlciBoaWVyYXJjaHkgYWNyb3NzIHpvb20gbGV2ZWxzXG4gICAgICAgIGZvciAobGV0IHogPSBtYXhab29tOyB6ID49IG1pblpvb207IHotLSkge1xuICAgICAgICAgICAgY29uc3Qgbm93ID0gK0RhdGUubm93KCk7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBzZXQgb2YgY2x1c3RlcnMgZm9yIHRoZSB6b29tIGFuZCBpbmRleCB0aGVtIHdpdGggYSBLRC10cmVlXG4gICAgICAgICAgICBjbHVzdGVycyA9IHRoaXMuX2NsdXN0ZXIoY2x1c3RlcnMsIHopO1xuICAgICAgICAgICAgdGhpcy50cmVlc1t6XSA9IG5ldyBLREJ1c2goY2x1c3RlcnMsIGdldFgsIGdldFksIG5vZGVTaXplLCBGbG9hdDMyQXJyYXkpO1xuXG4gICAgICAgICAgICBpZiAobG9nKSBjb25zb2xlLmxvZygneiVkOiAlZCBjbHVzdGVycyBpbiAlZG1zJywgeiwgY2x1c3RlcnMubGVuZ3RoLCArRGF0ZS5ub3coKSAtIG5vdyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobG9nKSBjb25zb2xlLnRpbWVFbmQoJ3RvdGFsIHRpbWUnKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBnZXRDbHVzdGVycyhiYm94LCB6b29tKSB7XG4gICAgICAgIGxldCBtaW5MbmcgPSAoKGJib3hbMF0gKyAxODApICUgMzYwICsgMzYwKSAlIDM2MCAtIDE4MDtcbiAgICAgICAgY29uc3QgbWluTGF0ID0gTWF0aC5tYXgoLTkwLCBNYXRoLm1pbig5MCwgYmJveFsxXSkpO1xuICAgICAgICBsZXQgbWF4TG5nID0gYmJveFsyXSA9PT0gMTgwID8gMTgwIDogKChiYm94WzJdICsgMTgwKSAlIDM2MCArIDM2MCkgJSAzNjAgLSAxODA7XG4gICAgICAgIGNvbnN0IG1heExhdCA9IE1hdGgubWF4KC05MCwgTWF0aC5taW4oOTAsIGJib3hbM10pKTtcblxuICAgICAgICBpZiAoYmJveFsyXSAtIGJib3hbMF0gPj0gMzYwKSB7XG4gICAgICAgICAgICBtaW5MbmcgPSAtMTgwO1xuICAgICAgICAgICAgbWF4TG5nID0gMTgwO1xuICAgICAgICB9IGVsc2UgaWYgKG1pbkxuZyA+IG1heExuZykge1xuICAgICAgICAgICAgY29uc3QgZWFzdGVybkhlbSA9IHRoaXMuZ2V0Q2x1c3RlcnMoW21pbkxuZywgbWluTGF0LCAxODAsIG1heExhdF0sIHpvb20pO1xuICAgICAgICAgICAgY29uc3Qgd2VzdGVybkhlbSA9IHRoaXMuZ2V0Q2x1c3RlcnMoWy0xODAsIG1pbkxhdCwgbWF4TG5nLCBtYXhMYXRdLCB6b29tKTtcbiAgICAgICAgICAgIHJldHVybiBlYXN0ZXJuSGVtLmNvbmNhdCh3ZXN0ZXJuSGVtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyZWUgPSB0aGlzLnRyZWVzW3RoaXMuX2xpbWl0Wm9vbSh6b29tKV07XG4gICAgICAgIGNvbnN0IGlkcyA9IHRyZWUucmFuZ2UobG5nWChtaW5MbmcpLCBsYXRZKG1heExhdCksIGxuZ1gobWF4TG5nKSwgbGF0WShtaW5MYXQpKTtcbiAgICAgICAgY29uc3QgY2x1c3RlcnMgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBpZCBvZiBpZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGMgPSB0cmVlLnBvaW50c1tpZF07XG4gICAgICAgICAgICBjbHVzdGVycy5wdXNoKGMubnVtUG9pbnRzID8gZ2V0Q2x1c3RlckpTT04oYykgOiB0aGlzLnBvaW50c1tjLmluZGV4XSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNsdXN0ZXJzO1xuICAgIH1cblxuICAgIGdldENoaWxkcmVuKGNsdXN0ZXJJZCkge1xuICAgICAgICBjb25zdCBvcmlnaW5JZCA9IHRoaXMuX2dldE9yaWdpbklkKGNsdXN0ZXJJZCk7XG4gICAgICAgIGNvbnN0IG9yaWdpblpvb20gPSB0aGlzLl9nZXRPcmlnaW5ab29tKGNsdXN0ZXJJZCk7XG4gICAgICAgIGNvbnN0IGVycm9yTXNnID0gJ05vIGNsdXN0ZXIgd2l0aCB0aGUgc3BlY2lmaWVkIGlkLic7XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnRyZWVzW29yaWdpblpvb21dO1xuICAgICAgICBpZiAoIWluZGV4KSB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNc2cpO1xuXG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IGluZGV4LnBvaW50c1tvcmlnaW5JZF07XG4gICAgICAgIGlmICghb3JpZ2luKSB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNc2cpO1xuXG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLm9wdGlvbnMucmFkaXVzIC8gKHRoaXMub3B0aW9ucy5leHRlbnQgKiBNYXRoLnBvdygyLCBvcmlnaW5ab29tIC0gMSkpO1xuICAgICAgICBjb25zdCBpZHMgPSBpbmRleC53aXRoaW4ob3JpZ2luLngsIG9yaWdpbi55LCByKTtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBpZCBvZiBpZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGMgPSBpbmRleC5wb2ludHNbaWRdO1xuICAgICAgICAgICAgaWYgKGMucGFyZW50SWQgPT09IGNsdXN0ZXJJZCkge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goYy5udW1Qb2ludHMgPyBnZXRDbHVzdGVySlNPTihjKSA6IHRoaXMucG9pbnRzW2MuaW5kZXhdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihlcnJvck1zZyk7XG5cbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgIH1cblxuICAgIGdldExlYXZlcyhjbHVzdGVySWQsIGxpbWl0LCBvZmZzZXQpIHtcbiAgICAgICAgbGltaXQgPSBsaW1pdCB8fCAxMDtcbiAgICAgICAgb2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cbiAgICAgICAgY29uc3QgbGVhdmVzID0gW107XG4gICAgICAgIHRoaXMuX2FwcGVuZExlYXZlcyhsZWF2ZXMsIGNsdXN0ZXJJZCwgbGltaXQsIG9mZnNldCwgMCk7XG5cbiAgICAgICAgcmV0dXJuIGxlYXZlcztcbiAgICB9XG5cbiAgICBnZXRUaWxlKHosIHgsIHkpIHtcbiAgICAgICAgY29uc3QgdHJlZSA9IHRoaXMudHJlZXNbdGhpcy5fbGltaXRab29tKHopXTtcbiAgICAgICAgY29uc3QgejIgPSBNYXRoLnBvdygyLCB6KTtcbiAgICAgICAgY29uc3Qge2V4dGVudCwgcmFkaXVzfSA9IHRoaXMub3B0aW9ucztcbiAgICAgICAgY29uc3QgcCA9IHJhZGl1cyAvIGV4dGVudDtcbiAgICAgICAgY29uc3QgdG9wID0gKHkgLSBwKSAvIHoyO1xuICAgICAgICBjb25zdCBib3R0b20gPSAoeSArIDEgKyBwKSAvIHoyO1xuXG4gICAgICAgIGNvbnN0IHRpbGUgPSB7XG4gICAgICAgICAgICBmZWF0dXJlczogW11cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9hZGRUaWxlRmVhdHVyZXMoXG4gICAgICAgICAgICB0cmVlLnJhbmdlKCh4IC0gcCkgLyB6MiwgdG9wLCAoeCArIDEgKyBwKSAvIHoyLCBib3R0b20pLFxuICAgICAgICAgICAgdHJlZS5wb2ludHMsIHgsIHksIHoyLCB0aWxlKTtcblxuICAgICAgICBpZiAoeCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fYWRkVGlsZUZlYXR1cmVzKFxuICAgICAgICAgICAgICAgIHRyZWUucmFuZ2UoMSAtIHAgLyB6MiwgdG9wLCAxLCBib3R0b20pLFxuICAgICAgICAgICAgICAgIHRyZWUucG9pbnRzLCB6MiwgeSwgejIsIHRpbGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh4ID09PSB6MiAtIDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZFRpbGVGZWF0dXJlcyhcbiAgICAgICAgICAgICAgICB0cmVlLnJhbmdlKDAsIHRvcCwgcCAvIHoyLCBib3R0b20pLFxuICAgICAgICAgICAgICAgIHRyZWUucG9pbnRzLCAtMSwgeSwgejIsIHRpbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRpbGUuZmVhdHVyZXMubGVuZ3RoID8gdGlsZSA6IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0Q2x1c3RlckV4cGFuc2lvblpvb20oY2x1c3RlcklkKSB7XG4gICAgICAgIGxldCBleHBhbnNpb25ab29tID0gdGhpcy5fZ2V0T3JpZ2luWm9vbShjbHVzdGVySWQpIC0gMTtcbiAgICAgICAgd2hpbGUgKGV4cGFuc2lvblpvb20gPD0gdGhpcy5vcHRpb25zLm1heFpvb20pIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5nZXRDaGlsZHJlbihjbHVzdGVySWQpO1xuICAgICAgICAgICAgZXhwYW5zaW9uWm9vbSsrO1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCAhPT0gMSkgYnJlYWs7XG4gICAgICAgICAgICBjbHVzdGVySWQgPSBjaGlsZHJlblswXS5wcm9wZXJ0aWVzLmNsdXN0ZXJfaWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGV4cGFuc2lvblpvb207XG4gICAgfVxuXG4gICAgX2FwcGVuZExlYXZlcyhyZXN1bHQsIGNsdXN0ZXJJZCwgbGltaXQsIG9mZnNldCwgc2tpcHBlZCkge1xuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZ2V0Q2hpbGRyZW4oY2x1c3RlcklkKTtcblxuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wcyA9IGNoaWxkLnByb3BlcnRpZXM7XG5cbiAgICAgICAgICAgIGlmIChwcm9wcyAmJiBwcm9wcy5jbHVzdGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNraXBwZWQgKyBwcm9wcy5wb2ludF9jb3VudCA8PSBvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCB0aGUgd2hvbGUgY2x1c3RlclxuICAgICAgICAgICAgICAgICAgICBza2lwcGVkICs9IHByb3BzLnBvaW50X2NvdW50O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVudGVyIHRoZSBjbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgIHNraXBwZWQgPSB0aGlzLl9hcHBlbmRMZWF2ZXMocmVzdWx0LCBwcm9wcy5jbHVzdGVyX2lkLCBsaW1pdCwgb2Zmc2V0LCBza2lwcGVkKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gZXhpdCB0aGUgY2x1c3RlclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2tpcHBlZCA8IG9mZnNldCkge1xuICAgICAgICAgICAgICAgIC8vIHNraXAgYSBzaW5nbGUgcG9pbnRcbiAgICAgICAgICAgICAgICBza2lwcGVkKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBhIHNpbmdsZSBwb2ludFxuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSBsaW1pdCkgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2tpcHBlZDtcbiAgICB9XG5cbiAgICBfYWRkVGlsZUZlYXR1cmVzKGlkcywgcG9pbnRzLCB4LCB5LCB6MiwgdGlsZSkge1xuICAgICAgICBmb3IgKGNvbnN0IGkgb2YgaWRzKSB7XG4gICAgICAgICAgICBjb25zdCBjID0gcG9pbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgaXNDbHVzdGVyID0gYy5udW1Qb2ludHM7XG4gICAgICAgICAgICBjb25zdCBmID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IDEsXG4gICAgICAgICAgICAgICAgZ2VvbWV0cnk6IFtbXG4gICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5vcHRpb25zLmV4dGVudCAqIChjLnggKiB6MiAtIHgpKSxcbiAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLm9wdGlvbnMuZXh0ZW50ICogKGMueSAqIHoyIC0geSkpXG4gICAgICAgICAgICAgICAgXV0sXG4gICAgICAgICAgICAgICAgdGFnczogaXNDbHVzdGVyID8gZ2V0Q2x1c3RlclByb3BlcnRpZXMoYykgOiB0aGlzLnBvaW50c1tjLmluZGV4XS5wcm9wZXJ0aWVzXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBhc3NpZ24gaWRcbiAgICAgICAgICAgIGxldCBpZDtcbiAgICAgICAgICAgIGlmIChpc0NsdXN0ZXIpIHtcbiAgICAgICAgICAgICAgICBpZCA9IGMuaWQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5nZW5lcmF0ZUlkKSB7XG4gICAgICAgICAgICAgICAgLy8gb3B0aW9uYWxseSBnZW5lcmF0ZSBpZFxuICAgICAgICAgICAgICAgIGlkID0gYy5pbmRleDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5wb2ludHNbYy5pbmRleF0uaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBrZWVwIGlkIGlmIGFscmVhZHkgYXNzaWduZWRcbiAgICAgICAgICAgICAgICBpZCA9IHRoaXMucG9pbnRzW2MuaW5kZXhdLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaWQgIT09IHVuZGVmaW5lZCkgZi5pZCA9IGlkO1xuXG4gICAgICAgICAgICB0aWxlLmZlYXR1cmVzLnB1c2goZik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfbGltaXRab29tKHopIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KHRoaXMub3B0aW9ucy5taW5ab29tLCBNYXRoLm1pbigreiwgdGhpcy5vcHRpb25zLm1heFpvb20gKyAxKSk7XG4gICAgfVxuXG4gICAgX2NsdXN0ZXIocG9pbnRzLCB6b29tKSB7XG4gICAgICAgIGNvbnN0IGNsdXN0ZXJzID0gW107XG4gICAgICAgIGNvbnN0IHtyYWRpdXMsIGV4dGVudCwgcmVkdWNlLCBtaW5Qb2ludHN9ID0gdGhpcy5vcHRpb25zO1xuICAgICAgICBjb25zdCByID0gcmFkaXVzIC8gKGV4dGVudCAqIE1hdGgucG93KDIsIHpvb20pKTtcblxuICAgICAgICAvLyBsb29wIHRocm91Z2ggZWFjaCBwb2ludFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcCA9IHBvaW50c1tpXTtcbiAgICAgICAgICAgIC8vIGlmIHdlJ3ZlIGFscmVhZHkgdmlzaXRlZCB0aGUgcG9pbnQgYXQgdGhpcyB6b29tIGxldmVsLCBza2lwIGl0XG4gICAgICAgICAgICBpZiAocC56b29tIDw9IHpvb20pIGNvbnRpbnVlO1xuICAgICAgICAgICAgcC56b29tID0gem9vbTtcblxuICAgICAgICAgICAgLy8gZmluZCBhbGwgbmVhcmJ5IHBvaW50c1xuICAgICAgICAgICAgY29uc3QgdHJlZSA9IHRoaXMudHJlZXNbem9vbSArIDFdO1xuICAgICAgICAgICAgY29uc3QgbmVpZ2hib3JJZHMgPSB0cmVlLndpdGhpbihwLngsIHAueSwgcik7XG5cbiAgICAgICAgICAgIGNvbnN0IG51bVBvaW50c09yaWdpbiA9IHAubnVtUG9pbnRzIHx8IDE7XG4gICAgICAgICAgICBsZXQgbnVtUG9pbnRzID0gbnVtUG9pbnRzT3JpZ2luO1xuXG4gICAgICAgICAgICAvLyBjb3VudCB0aGUgbnVtYmVyIG9mIHBvaW50cyBpbiBhIHBvdGVudGlhbCBjbHVzdGVyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JJZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiID0gdHJlZS5wb2ludHNbbmVpZ2hib3JJZF07XG4gICAgICAgICAgICAgICAgLy8gZmlsdGVyIG91dCBuZWlnaGJvcnMgdGhhdCBhcmUgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgICAgICAgICAgICBpZiAoYi56b29tID4gem9vbSkgbnVtUG9pbnRzICs9IGIubnVtUG9pbnRzIHx8IDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChudW1Qb2ludHMgPj0gbWluUG9pbnRzKSB7IC8vIGVub3VnaCBwb2ludHMgdG8gZm9ybSBhIGNsdXN0ZXJcbiAgICAgICAgICAgICAgICBsZXQgd3ggPSBwLnggKiBudW1Qb2ludHNPcmlnaW47XG4gICAgICAgICAgICAgICAgbGV0IHd5ID0gcC55ICogbnVtUG9pbnRzT3JpZ2luO1xuXG4gICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXJQcm9wZXJ0aWVzID0gcmVkdWNlICYmIG51bVBvaW50c09yaWdpbiA+IDEgPyB0aGlzLl9tYXAocCwgdHJ1ZSkgOiBudWxsO1xuXG4gICAgICAgICAgICAgICAgLy8gZW5jb2RlIGJvdGggem9vbSBhbmQgcG9pbnQgaW5kZXggb24gd2hpY2ggdGhlIGNsdXN0ZXIgb3JpZ2luYXRlZCAtLSBvZmZzZXQgYnkgdG90YWwgbGVuZ3RoIG9mIGZlYXR1cmVzXG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSAoaSA8PCA1KSArICh6b29tICsgMSkgKyB0aGlzLnBvaW50cy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG5laWdoYm9ySWQgb2YgbmVpZ2hib3JJZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYiA9IHRyZWUucG9pbnRzW25laWdoYm9ySWRdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChiLnpvb20gPD0gem9vbSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGIuem9vbSA9IHpvb207IC8vIHNhdmUgdGhlIHpvb20gKHNvIGl0IGRvZXNuJ3QgZ2V0IHByb2Nlc3NlZCB0d2ljZSlcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBudW1Qb2ludHMyID0gYi5udW1Qb2ludHMgfHwgMTtcbiAgICAgICAgICAgICAgICAgICAgd3ggKz0gYi54ICogbnVtUG9pbnRzMjsgLy8gYWNjdW11bGF0ZSBjb29yZGluYXRlcyBmb3IgY2FsY3VsYXRpbmcgd2VpZ2h0ZWQgY2VudGVyXG4gICAgICAgICAgICAgICAgICAgIHd5ICs9IGIueSAqIG51bVBvaW50czI7XG5cbiAgICAgICAgICAgICAgICAgICAgYi5wYXJlbnRJZCA9IGlkO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWR1Y2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlclByb3BlcnRpZXMpIGNsdXN0ZXJQcm9wZXJ0aWVzID0gdGhpcy5fbWFwKHAsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVkdWNlKGNsdXN0ZXJQcm9wZXJ0aWVzLCB0aGlzLl9tYXAoYikpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcC5wYXJlbnRJZCA9IGlkO1xuICAgICAgICAgICAgICAgIGNsdXN0ZXJzLnB1c2goY3JlYXRlQ2x1c3Rlcih3eCAvIG51bVBvaW50cywgd3kgLyBudW1Qb2ludHMsIGlkLCBudW1Qb2ludHMsIGNsdXN0ZXJQcm9wZXJ0aWVzKSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIGxlZnQgcG9pbnRzIGFzIHVuY2x1c3RlcmVkXG4gICAgICAgICAgICAgICAgY2x1c3RlcnMucHVzaChwKTtcblxuICAgICAgICAgICAgICAgIGlmIChudW1Qb2ludHMgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbmVpZ2hib3JJZCBvZiBuZWlnaGJvcklkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYiA9IHRyZWUucG9pbnRzW25laWdoYm9ySWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGIuem9vbSA8PSB6b29tKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGIuem9vbSA9IHpvb207XG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVycy5wdXNoKGIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsdXN0ZXJzO1xuICAgIH1cblxuICAgIC8vIGdldCBpbmRleCBvZiB0aGUgcG9pbnQgZnJvbSB3aGljaCB0aGUgY2x1c3RlciBvcmlnaW5hdGVkXG4gICAgX2dldE9yaWdpbklkKGNsdXN0ZXJJZCkge1xuICAgICAgICByZXR1cm4gKGNsdXN0ZXJJZCAtIHRoaXMucG9pbnRzLmxlbmd0aCkgPj4gNTtcbiAgICB9XG5cbiAgICAvLyBnZXQgem9vbSBvZiB0aGUgcG9pbnQgZnJvbSB3aGljaCB0aGUgY2x1c3RlciBvcmlnaW5hdGVkXG4gICAgX2dldE9yaWdpblpvb20oY2x1c3RlcklkKSB7XG4gICAgICAgIHJldHVybiAoY2x1c3RlcklkIC0gdGhpcy5wb2ludHMubGVuZ3RoKSAlIDMyO1xuICAgIH1cblxuICAgIF9tYXAocG9pbnQsIGNsb25lKSB7XG4gICAgICAgIGlmIChwb2ludC5udW1Qb2ludHMpIHtcbiAgICAgICAgICAgIHJldHVybiBjbG9uZSA/IGV4dGVuZCh7fSwgcG9pbnQucHJvcGVydGllcykgOiBwb2ludC5wcm9wZXJ0aWVzO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsID0gdGhpcy5wb2ludHNbcG9pbnQuaW5kZXhdLnByb3BlcnRpZXM7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMub3B0aW9ucy5tYXAob3JpZ2luYWwpO1xuICAgICAgICByZXR1cm4gY2xvbmUgJiYgcmVzdWx0ID09PSBvcmlnaW5hbCA/IGV4dGVuZCh7fSwgcmVzdWx0KSA6IHJlc3VsdDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNsdXN0ZXIoeCwgeSwgaWQsIG51bVBvaW50cywgcHJvcGVydGllcykge1xuICAgIHJldHVybiB7XG4gICAgICAgIHgsIC8vIHdlaWdodGVkIGNsdXN0ZXIgY2VudGVyXG4gICAgICAgIHksXG4gICAgICAgIHpvb206IEluZmluaXR5LCAvLyB0aGUgbGFzdCB6b29tIHRoZSBjbHVzdGVyIHdhcyBwcm9jZXNzZWQgYXRcbiAgICAgICAgaWQsIC8vIGVuY29kZXMgaW5kZXggb2YgdGhlIGZpcnN0IGNoaWxkIG9mIHRoZSBjbHVzdGVyIGFuZCBpdHMgem9vbSBsZXZlbFxuICAgICAgICBwYXJlbnRJZDogLTEsIC8vIHBhcmVudCBjbHVzdGVyIGlkXG4gICAgICAgIG51bVBvaW50cyxcbiAgICAgICAgcHJvcGVydGllc1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVBvaW50Q2x1c3RlcihwLCBpZCkge1xuICAgIGNvbnN0IFt4LCB5XSA9IHAuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgeDogbG5nWCh4KSwgLy8gcHJvamVjdGVkIHBvaW50IGNvb3JkaW5hdGVzXG4gICAgICAgIHk6IGxhdFkoeSksXG4gICAgICAgIHpvb206IEluZmluaXR5LCAvLyB0aGUgbGFzdCB6b29tIHRoZSBwb2ludCB3YXMgcHJvY2Vzc2VkIGF0XG4gICAgICAgIGluZGV4OiBpZCwgLy8gaW5kZXggb2YgdGhlIHNvdXJjZSBmZWF0dXJlIGluIHRoZSBvcmlnaW5hbCBpbnB1dCBhcnJheSxcbiAgICAgICAgcGFyZW50SWQ6IC0xIC8vIHBhcmVudCBjbHVzdGVyIGlkXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2x1c3RlckpTT04oY2x1c3Rlcikge1xuICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgICAgaWQ6IGNsdXN0ZXIuaWQsXG4gICAgICAgIHByb3BlcnRpZXM6IGdldENsdXN0ZXJQcm9wZXJ0aWVzKGNsdXN0ZXIpLFxuICAgICAgICBnZW9tZXRyeToge1xuICAgICAgICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBbeExuZyhjbHVzdGVyLngpLCB5TGF0KGNsdXN0ZXIueSldXG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBnZXRDbHVzdGVyUHJvcGVydGllcyhjbHVzdGVyKSB7XG4gICAgY29uc3QgY291bnQgPSBjbHVzdGVyLm51bVBvaW50cztcbiAgICBjb25zdCBhYmJyZXYgPVxuICAgICAgICBjb3VudCA+PSAxMDAwMCA/IGAke01hdGgucm91bmQoY291bnQgLyAxMDAwKSAgfWtgIDpcbiAgICAgICAgY291bnQgPj0gMTAwMCA/IGAke01hdGgucm91bmQoY291bnQgLyAxMDApIC8gMTAgIH1rYCA6IGNvdW50O1xuICAgIHJldHVybiBleHRlbmQoZXh0ZW5kKHt9LCBjbHVzdGVyLnByb3BlcnRpZXMpLCB7XG4gICAgICAgIGNsdXN0ZXI6IHRydWUsXG4gICAgICAgIGNsdXN0ZXJfaWQ6IGNsdXN0ZXIuaWQsXG4gICAgICAgIHBvaW50X2NvdW50OiBjb3VudCxcbiAgICAgICAgcG9pbnRfY291bnRfYWJicmV2aWF0ZWQ6IGFiYnJldlxuICAgIH0pO1xufVxuXG4vLyBsb25naXR1ZGUvbGF0aXR1ZGUgdG8gc3BoZXJpY2FsIG1lcmNhdG9yIGluIFswLi4xXSByYW5nZVxuZnVuY3Rpb24gbG5nWChsbmcpIHtcbiAgICByZXR1cm4gbG5nIC8gMzYwICsgMC41O1xufVxuZnVuY3Rpb24gbGF0WShsYXQpIHtcbiAgICBjb25zdCBzaW4gPSBNYXRoLnNpbihsYXQgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICBjb25zdCB5ID0gKDAuNSAtIDAuMjUgKiBNYXRoLmxvZygoMSArIHNpbikgLyAoMSAtIHNpbikpIC8gTWF0aC5QSSk7XG4gICAgcmV0dXJuIHkgPCAwID8gMCA6IHkgPiAxID8gMSA6IHk7XG59XG5cbi8vIHNwaGVyaWNhbCBtZXJjYXRvciB0byBsb25naXR1ZGUvbGF0aXR1ZGVcbmZ1bmN0aW9uIHhMbmcoeCkge1xuICAgIHJldHVybiAoeCAtIDAuNSkgKiAzNjA7XG59XG5mdW5jdGlvbiB5TGF0KHkpIHtcbiAgICBjb25zdCB5MiA9ICgxODAgLSB5ICogMzYwKSAqIE1hdGguUEkgLyAxODA7XG4gICAgcmV0dXJuIDM2MCAqIE1hdGguYXRhbihNYXRoLmV4cCh5MikpIC8gTWF0aC5QSSAtIDkwO1xufVxuXG5mdW5jdGlvbiBleHRlbmQoZGVzdCwgc3JjKSB7XG4gICAgZm9yIChjb25zdCBpZCBpbiBzcmMpIGRlc3RbaWRdID0gc3JjW2lkXTtcbiAgICByZXR1cm4gZGVzdDtcbn1cblxuZnVuY3Rpb24gZ2V0WChwKSB7XG4gICAgcmV0dXJuIHAueDtcbn1cbmZ1bmN0aW9uIGdldFkocCkge1xuICAgIHJldHVybiBwLnk7XG59XG4iLCJcbi8vIGNhbGN1bGF0ZSBzaW1wbGlmaWNhdGlvbiBkYXRhIHVzaW5nIG9wdGltaXplZCBEb3VnbGFzLVBldWNrZXIgYWxnb3JpdGhtXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHNpbXBsaWZ5KGNvb3JkcywgZmlyc3QsIGxhc3QsIHNxVG9sZXJhbmNlKSB7XG4gICAgdmFyIG1heFNxRGlzdCA9IHNxVG9sZXJhbmNlO1xuICAgIHZhciBtaWQgPSAobGFzdCAtIGZpcnN0KSA+PiAxO1xuICAgIHZhciBtaW5Qb3NUb01pZCA9IGxhc3QgLSBmaXJzdDtcbiAgICB2YXIgaW5kZXg7XG5cbiAgICB2YXIgYXggPSBjb29yZHNbZmlyc3RdO1xuICAgIHZhciBheSA9IGNvb3Jkc1tmaXJzdCArIDFdO1xuICAgIHZhciBieCA9IGNvb3Jkc1tsYXN0XTtcbiAgICB2YXIgYnkgPSBjb29yZHNbbGFzdCArIDFdO1xuXG4gICAgZm9yICh2YXIgaSA9IGZpcnN0ICsgMzsgaSA8IGxhc3Q7IGkgKz0gMykge1xuICAgICAgICB2YXIgZCA9IGdldFNxU2VnRGlzdChjb29yZHNbaV0sIGNvb3Jkc1tpICsgMV0sIGF4LCBheSwgYngsIGJ5KTtcblxuICAgICAgICBpZiAoZCA+IG1heFNxRGlzdCkge1xuICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgbWF4U3FEaXN0ID0gZDtcblxuICAgICAgICB9IGVsc2UgaWYgKGQgPT09IG1heFNxRGlzdCkge1xuICAgICAgICAgICAgLy8gYSB3b3JrYXJvdW5kIHRvIGVuc3VyZSB3ZSBjaG9vc2UgYSBwaXZvdCBjbG9zZSB0byB0aGUgbWlkZGxlIG9mIHRoZSBsaXN0LFxuICAgICAgICAgICAgLy8gcmVkdWNpbmcgcmVjdXJzaW9uIGRlcHRoLCBmb3IgY2VydGFpbiBkZWdlbmVyYXRlIGlucHV0c1xuICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21hcGJveC9nZW9qc29uLXZ0L2lzc3Vlcy8xMDRcbiAgICAgICAgICAgIHZhciBwb3NUb01pZCA9IE1hdGguYWJzKGkgLSBtaWQpO1xuICAgICAgICAgICAgaWYgKHBvc1RvTWlkIDwgbWluUG9zVG9NaWQpIHtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgbWluUG9zVG9NaWQgPSBwb3NUb01pZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtYXhTcURpc3QgPiBzcVRvbGVyYW5jZSkge1xuICAgICAgICBpZiAoaW5kZXggLSBmaXJzdCA+IDMpIHNpbXBsaWZ5KGNvb3JkcywgZmlyc3QsIGluZGV4LCBzcVRvbGVyYW5jZSk7XG4gICAgICAgIGNvb3Jkc1tpbmRleCArIDJdID0gbWF4U3FEaXN0O1xuICAgICAgICBpZiAobGFzdCAtIGluZGV4ID4gMykgc2ltcGxpZnkoY29vcmRzLCBpbmRleCwgbGFzdCwgc3FUb2xlcmFuY2UpO1xuICAgIH1cbn1cblxuLy8gc3F1YXJlIGRpc3RhbmNlIGZyb20gYSBwb2ludCB0byBhIHNlZ21lbnRcbmZ1bmN0aW9uIGdldFNxU2VnRGlzdChweCwgcHksIHgsIHksIGJ4LCBieSkge1xuXG4gICAgdmFyIGR4ID0gYnggLSB4O1xuICAgIHZhciBkeSA9IGJ5IC0geTtcblxuICAgIGlmIChkeCAhPT0gMCB8fCBkeSAhPT0gMCkge1xuXG4gICAgICAgIHZhciB0ID0gKChweCAtIHgpICogZHggKyAocHkgLSB5KSAqIGR5KSAvIChkeCAqIGR4ICsgZHkgKiBkeSk7XG5cbiAgICAgICAgaWYgKHQgPiAxKSB7XG4gICAgICAgICAgICB4ID0gYng7XG4gICAgICAgICAgICB5ID0gYnk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0ID4gMCkge1xuICAgICAgICAgICAgeCArPSBkeCAqIHQ7XG4gICAgICAgICAgICB5ICs9IGR5ICogdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGR4ID0gcHggLSB4O1xuICAgIGR5ID0gcHkgLSB5O1xuXG4gICAgcmV0dXJuIGR4ICogZHggKyBkeSAqIGR5O1xufVxuIiwiXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjcmVhdGVGZWF0dXJlKGlkLCB0eXBlLCBnZW9tLCB0YWdzKSB7XG4gICAgdmFyIGZlYXR1cmUgPSB7XG4gICAgICAgIGlkOiB0eXBlb2YgaWQgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IGlkLFxuICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICBnZW9tZXRyeTogZ2VvbSxcbiAgICAgICAgdGFnczogdGFncyxcbiAgICAgICAgbWluWDogSW5maW5pdHksXG4gICAgICAgIG1pblk6IEluZmluaXR5LFxuICAgICAgICBtYXhYOiAtSW5maW5pdHksXG4gICAgICAgIG1heFk6IC1JbmZpbml0eVxuICAgIH07XG4gICAgY2FsY0JCb3goZmVhdHVyZSk7XG4gICAgcmV0dXJuIGZlYXR1cmU7XG59XG5cbmZ1bmN0aW9uIGNhbGNCQm94KGZlYXR1cmUpIHtcbiAgICB2YXIgZ2VvbSA9IGZlYXR1cmUuZ2VvbWV0cnk7XG4gICAgdmFyIHR5cGUgPSBmZWF0dXJlLnR5cGU7XG5cbiAgICBpZiAodHlwZSA9PT0gJ1BvaW50JyB8fCB0eXBlID09PSAnTXVsdGlQb2ludCcgfHwgdHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XG4gICAgICAgIGNhbGNMaW5lQkJveChmZWF0dXJlLCBnZW9tKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1BvbHlnb24nIHx8IHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ2VvbS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2FsY0xpbmVCQm94KGZlYXR1cmUsIGdlb21baV0pO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBnZW9tLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGdlb21baV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBjYWxjTGluZUJCb3goZmVhdHVyZSwgZ2VvbVtpXVtqXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNhbGNMaW5lQkJveChmZWF0dXJlLCBnZW9tKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBnZW9tLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGZlYXR1cmUubWluWCA9IE1hdGgubWluKGZlYXR1cmUubWluWCwgZ2VvbVtpXSk7XG4gICAgICAgIGZlYXR1cmUubWluWSA9IE1hdGgubWluKGZlYXR1cmUubWluWSwgZ2VvbVtpICsgMV0pO1xuICAgICAgICBmZWF0dXJlLm1heFggPSBNYXRoLm1heChmZWF0dXJlLm1heFgsIGdlb21baV0pO1xuICAgICAgICBmZWF0dXJlLm1heFkgPSBNYXRoLm1heChmZWF0dXJlLm1heFksIGdlb21baSArIDFdKTtcbiAgICB9XG59XG4iLCJcbmltcG9ydCBzaW1wbGlmeSBmcm9tICcuL3NpbXBsaWZ5JztcbmltcG9ydCBjcmVhdGVGZWF0dXJlIGZyb20gJy4vZmVhdHVyZSc7XG5cbi8vIGNvbnZlcnRzIEdlb0pTT04gZmVhdHVyZSBpbnRvIGFuIGludGVybWVkaWF0ZSBwcm9qZWN0ZWQgSlNPTiB2ZWN0b3IgZm9ybWF0IHdpdGggc2ltcGxpZmljYXRpb24gZGF0YVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjb252ZXJ0KGRhdGEsIG9wdGlvbnMpIHtcbiAgICB2YXIgZmVhdHVyZXMgPSBbXTtcbiAgICBpZiAoZGF0YS50eXBlID09PSAnRmVhdHVyZUNvbGxlY3Rpb24nKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29udmVydEZlYXR1cmUoZmVhdHVyZXMsIGRhdGEuZmVhdHVyZXNbaV0sIG9wdGlvbnMsIGkpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKGRhdGEudHlwZSA9PT0gJ0ZlYXR1cmUnKSB7XG4gICAgICAgIGNvbnZlcnRGZWF0dXJlKGZlYXR1cmVzLCBkYXRhLCBvcHRpb25zKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHNpbmdsZSBnZW9tZXRyeSBvciBhIGdlb21ldHJ5IGNvbGxlY3Rpb25cbiAgICAgICAgY29udmVydEZlYXR1cmUoZmVhdHVyZXMsIHtnZW9tZXRyeTogZGF0YX0sIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBmZWF0dXJlcztcbn1cblxuZnVuY3Rpb24gY29udmVydEZlYXR1cmUoZmVhdHVyZXMsIGdlb2pzb24sIG9wdGlvbnMsIGluZGV4KSB7XG4gICAgaWYgKCFnZW9qc29uLmdlb21ldHJ5KSByZXR1cm47XG5cbiAgICB2YXIgY29vcmRzID0gZ2VvanNvbi5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICB2YXIgdHlwZSA9IGdlb2pzb24uZ2VvbWV0cnkudHlwZTtcbiAgICB2YXIgdG9sZXJhbmNlID0gTWF0aC5wb3cob3B0aW9ucy50b2xlcmFuY2UgLyAoKDEgPDwgb3B0aW9ucy5tYXhab29tKSAqIG9wdGlvbnMuZXh0ZW50KSwgMik7XG4gICAgdmFyIGdlb21ldHJ5ID0gW107XG4gICAgdmFyIGlkID0gZ2VvanNvbi5pZDtcbiAgICBpZiAob3B0aW9ucy5wcm9tb3RlSWQpIHtcbiAgICAgICAgaWQgPSBnZW9qc29uLnByb3BlcnRpZXNbb3B0aW9ucy5wcm9tb3RlSWRdO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5nZW5lcmF0ZUlkKSB7XG4gICAgICAgIGlkID0gaW5kZXggfHwgMDtcbiAgICB9XG4gICAgaWYgKHR5cGUgPT09ICdQb2ludCcpIHtcbiAgICAgICAgY29udmVydFBvaW50KGNvb3JkcywgZ2VvbWV0cnkpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlQb2ludCcpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnZlcnRQb2ludChjb29yZHNbaV0sIGdlb21ldHJ5KTtcbiAgICAgICAgfVxuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgY29udmVydExpbmUoY29vcmRzLCBnZW9tZXRyeSwgdG9sZXJhbmNlLCBmYWxzZSk7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmxpbmVNZXRyaWNzKSB7XG4gICAgICAgICAgICAvLyBleHBsb2RlIGludG8gbGluZXN0cmluZ3MgdG8gYmUgYWJsZSB0byB0cmFjayBtZXRyaWNzXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY29vcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgZ2VvbWV0cnkgPSBbXTtcbiAgICAgICAgICAgICAgICBjb252ZXJ0TGluZShjb29yZHNbaV0sIGdlb21ldHJ5LCB0b2xlcmFuY2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBmZWF0dXJlcy5wdXNoKGNyZWF0ZUZlYXR1cmUoaWQsICdMaW5lU3RyaW5nJywgZ2VvbWV0cnksIGdlb2pzb24ucHJvcGVydGllcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udmVydExpbmVzKGNvb3JkcywgZ2VvbWV0cnksIHRvbGVyYW5jZSwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdQb2x5Z29uJykge1xuICAgICAgICBjb252ZXJ0TGluZXMoY29vcmRzLCBnZW9tZXRyeSwgdG9sZXJhbmNlLCB0cnVlKTtcblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNvb3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHBvbHlnb24gPSBbXTtcbiAgICAgICAgICAgIGNvbnZlcnRMaW5lcyhjb29yZHNbaV0sIHBvbHlnb24sIHRvbGVyYW5jZSwgdHJ1ZSk7XG4gICAgICAgICAgICBnZW9tZXRyeS5wdXNoKHBvbHlnb24pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnR2VvbWV0cnlDb2xsZWN0aW9uJykge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZ2VvanNvbi5nZW9tZXRyeS5nZW9tZXRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb252ZXJ0RmVhdHVyZShmZWF0dXJlcywge1xuICAgICAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgICAgICBnZW9tZXRyeTogZ2VvanNvbi5nZW9tZXRyeS5nZW9tZXRyaWVzW2ldLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IGdlb2pzb24ucHJvcGVydGllc1xuICAgICAgICAgICAgfSwgb3B0aW9ucywgaW5kZXgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lucHV0IGRhdGEgaXMgbm90IGEgdmFsaWQgR2VvSlNPTiBvYmplY3QuJyk7XG4gICAgfVxuXG4gICAgZmVhdHVyZXMucHVzaChjcmVhdGVGZWF0dXJlKGlkLCB0eXBlLCBnZW9tZXRyeSwgZ2VvanNvbi5wcm9wZXJ0aWVzKSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQb2ludChjb29yZHMsIG91dCkge1xuICAgIG91dC5wdXNoKHByb2plY3RYKGNvb3Jkc1swXSkpO1xuICAgIG91dC5wdXNoKHByb2plY3RZKGNvb3Jkc1sxXSkpO1xuICAgIG91dC5wdXNoKDApO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0TGluZShyaW5nLCBvdXQsIHRvbGVyYW5jZSwgaXNQb2x5Z29uKSB7XG4gICAgdmFyIHgwLCB5MDtcbiAgICB2YXIgc2l6ZSA9IDA7XG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHJpbmcubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgdmFyIHggPSBwcm9qZWN0WChyaW5nW2pdWzBdKTtcbiAgICAgICAgdmFyIHkgPSBwcm9qZWN0WShyaW5nW2pdWzFdKTtcblxuICAgICAgICBvdXQucHVzaCh4KTtcbiAgICAgICAgb3V0LnB1c2goeSk7XG4gICAgICAgIG91dC5wdXNoKDApO1xuXG4gICAgICAgIGlmIChqID4gMCkge1xuICAgICAgICAgICAgaWYgKGlzUG9seWdvbikge1xuICAgICAgICAgICAgICAgIHNpemUgKz0gKHgwICogeSAtIHggKiB5MCkgLyAyOyAvLyBhcmVhXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNpemUgKz0gTWF0aC5zcXJ0KE1hdGgucG93KHggLSB4MCwgMikgKyBNYXRoLnBvdyh5IC0geTAsIDIpKTsgLy8gbGVuZ3RoXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgeDAgPSB4O1xuICAgICAgICB5MCA9IHk7XG4gICAgfVxuXG4gICAgdmFyIGxhc3QgPSBvdXQubGVuZ3RoIC0gMztcbiAgICBvdXRbMl0gPSAxO1xuICAgIHNpbXBsaWZ5KG91dCwgMCwgbGFzdCwgdG9sZXJhbmNlKTtcbiAgICBvdXRbbGFzdCArIDJdID0gMTtcblxuICAgIG91dC5zaXplID0gTWF0aC5hYnMoc2l6ZSk7XG4gICAgb3V0LnN0YXJ0ID0gMDtcbiAgICBvdXQuZW5kID0gb3V0LnNpemU7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRMaW5lcyhyaW5ncywgb3V0LCB0b2xlcmFuY2UsIGlzUG9seWdvbikge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGdlb20gPSBbXTtcbiAgICAgICAgY29udmVydExpbmUocmluZ3NbaV0sIGdlb20sIHRvbGVyYW5jZSwgaXNQb2x5Z29uKTtcbiAgICAgICAgb3V0LnB1c2goZ2VvbSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwcm9qZWN0WCh4KSB7XG4gICAgcmV0dXJuIHggLyAzNjAgKyAwLjU7XG59XG5cbmZ1bmN0aW9uIHByb2plY3RZKHkpIHtcbiAgICB2YXIgc2luID0gTWF0aC5zaW4oeSAqIE1hdGguUEkgLyAxODApO1xuICAgIHZhciB5MiA9IDAuNSAtIDAuMjUgKiBNYXRoLmxvZygoMSArIHNpbikgLyAoMSAtIHNpbikpIC8gTWF0aC5QSTtcbiAgICByZXR1cm4geTIgPCAwID8gMCA6IHkyID4gMSA/IDEgOiB5Mjtcbn1cbiIsIlxuaW1wb3J0IGNyZWF0ZUZlYXR1cmUgZnJvbSAnLi9mZWF0dXJlJztcblxuLyogY2xpcCBmZWF0dXJlcyBiZXR3ZWVuIHR3byBheGlzLXBhcmFsbGVsIGxpbmVzOlxuICogICAgIHwgICAgICAgIHxcbiAqICBfX198X19fICAgICB8ICAgICAvXG4gKiAvICAgfCAgIFxcX19fX3xfX19fL1xuICogICAgIHwgICAgICAgIHxcbiAqL1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjbGlwKGZlYXR1cmVzLCBzY2FsZSwgazEsIGsyLCBheGlzLCBtaW5BbGwsIG1heEFsbCwgb3B0aW9ucykge1xuXG4gICAgazEgLz0gc2NhbGU7XG4gICAgazIgLz0gc2NhbGU7XG5cbiAgICBpZiAobWluQWxsID49IGsxICYmIG1heEFsbCA8IGsyKSByZXR1cm4gZmVhdHVyZXM7IC8vIHRyaXZpYWwgYWNjZXB0XG4gICAgZWxzZSBpZiAobWF4QWxsIDwgazEgfHwgbWluQWxsID49IGsyKSByZXR1cm4gbnVsbDsgLy8gdHJpdmlhbCByZWplY3RcblxuICAgIHZhciBjbGlwcGVkID0gW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZlYXR1cmVzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgdmFyIGZlYXR1cmUgPSBmZWF0dXJlc1tpXTtcbiAgICAgICAgdmFyIGdlb21ldHJ5ID0gZmVhdHVyZS5nZW9tZXRyeTtcbiAgICAgICAgdmFyIHR5cGUgPSBmZWF0dXJlLnR5cGU7XG5cbiAgICAgICAgdmFyIG1pbiA9IGF4aXMgPT09IDAgPyBmZWF0dXJlLm1pblggOiBmZWF0dXJlLm1pblk7XG4gICAgICAgIHZhciBtYXggPSBheGlzID09PSAwID8gZmVhdHVyZS5tYXhYIDogZmVhdHVyZS5tYXhZO1xuXG4gICAgICAgIGlmIChtaW4gPj0gazEgJiYgbWF4IDwgazIpIHsgLy8gdHJpdmlhbCBhY2NlcHRcbiAgICAgICAgICAgIGNsaXBwZWQucHVzaChmZWF0dXJlKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKG1heCA8IGsxIHx8IG1pbiA+PSBrMikgeyAvLyB0cml2aWFsIHJlamVjdFxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV3R2VvbWV0cnkgPSBbXTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gJ1BvaW50JyB8fCB0eXBlID09PSAnTXVsdGlQb2ludCcpIHtcbiAgICAgICAgICAgIGNsaXBQb2ludHMoZ2VvbWV0cnksIG5ld0dlb21ldHJ5LCBrMSwgazIsIGF4aXMpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XG4gICAgICAgICAgICBjbGlwTGluZShnZW9tZXRyeSwgbmV3R2VvbWV0cnksIGsxLCBrMiwgYXhpcywgZmFsc2UsIG9wdGlvbnMubGluZU1ldHJpY3MpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpTGluZVN0cmluZycpIHtcbiAgICAgICAgICAgIGNsaXBMaW5lcyhnZW9tZXRyeSwgbmV3R2VvbWV0cnksIGsxLCBrMiwgYXhpcywgZmFsc2UpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ1BvbHlnb24nKSB7XG4gICAgICAgICAgICBjbGlwTGluZXMoZ2VvbWV0cnksIG5ld0dlb21ldHJ5LCBrMSwgazIsIGF4aXMsIHRydWUpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZ2VvbWV0cnkubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcG9seWdvbiA9IFtdO1xuICAgICAgICAgICAgICAgIGNsaXBMaW5lcyhnZW9tZXRyeVtqXSwgcG9seWdvbiwgazEsIGsyLCBheGlzLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBpZiAocG9seWdvbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3R2VvbWV0cnkucHVzaChwb2x5Z29uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3R2VvbWV0cnkubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saW5lTWV0cmljcyAmJiB0eXBlID09PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbmV3R2VvbWV0cnkubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY2xpcHBlZC5wdXNoKGNyZWF0ZUZlYXR1cmUoZmVhdHVyZS5pZCwgdHlwZSwgbmV3R2VvbWV0cnlbal0sIGZlYXR1cmUudGFncykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdMaW5lU3RyaW5nJyB8fCB0eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGlmIChuZXdHZW9tZXRyeS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA9ICdMaW5lU3RyaW5nJztcbiAgICAgICAgICAgICAgICAgICAgbmV3R2VvbWV0cnkgPSBuZXdHZW9tZXRyeVswXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0eXBlID0gJ011bHRpTGluZVN0cmluZyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdQb2ludCcgfHwgdHlwZSA9PT0gJ011bHRpUG9pbnQnKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IG5ld0dlb21ldHJ5Lmxlbmd0aCA9PT0gMyA/ICdQb2ludCcgOiAnTXVsdGlQb2ludCc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNsaXBwZWQucHVzaChjcmVhdGVGZWF0dXJlKGZlYXR1cmUuaWQsIHR5cGUsIG5ld0dlb21ldHJ5LCBmZWF0dXJlLnRhZ3MpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjbGlwcGVkLmxlbmd0aCA/IGNsaXBwZWQgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBjbGlwUG9pbnRzKGdlb20sIG5ld0dlb20sIGsxLCBrMiwgYXhpcykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ2VvbS5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICB2YXIgYSA9IGdlb21baSArIGF4aXNdO1xuXG4gICAgICAgIGlmIChhID49IGsxICYmIGEgPD0gazIpIHtcbiAgICAgICAgICAgIG5ld0dlb20ucHVzaChnZW9tW2ldKTtcbiAgICAgICAgICAgIG5ld0dlb20ucHVzaChnZW9tW2kgKyAxXSk7XG4gICAgICAgICAgICBuZXdHZW9tLnB1c2goZ2VvbVtpICsgMl0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbGlwTGluZShnZW9tLCBuZXdHZW9tLCBrMSwgazIsIGF4aXMsIGlzUG9seWdvbiwgdHJhY2tNZXRyaWNzKSB7XG5cbiAgICB2YXIgc2xpY2UgPSBuZXdTbGljZShnZW9tKTtcbiAgICB2YXIgaW50ZXJzZWN0ID0gYXhpcyA9PT0gMCA/IGludGVyc2VjdFggOiBpbnRlcnNlY3RZO1xuICAgIHZhciBsZW4gPSBnZW9tLnN0YXJ0O1xuICAgIHZhciBzZWdMZW4sIHQ7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20ubGVuZ3RoIC0gMzsgaSArPSAzKSB7XG4gICAgICAgIHZhciBheCA9IGdlb21baV07XG4gICAgICAgIHZhciBheSA9IGdlb21baSArIDFdO1xuICAgICAgICB2YXIgYXogPSBnZW9tW2kgKyAyXTtcbiAgICAgICAgdmFyIGJ4ID0gZ2VvbVtpICsgM107XG4gICAgICAgIHZhciBieSA9IGdlb21baSArIDRdO1xuICAgICAgICB2YXIgYSA9IGF4aXMgPT09IDAgPyBheCA6IGF5O1xuICAgICAgICB2YXIgYiA9IGF4aXMgPT09IDAgPyBieCA6IGJ5O1xuICAgICAgICB2YXIgZXhpdGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRyYWNrTWV0cmljcykgc2VnTGVuID0gTWF0aC5zcXJ0KE1hdGgucG93KGF4IC0gYngsIDIpICsgTWF0aC5wb3coYXkgLSBieSwgMikpO1xuXG4gICAgICAgIGlmIChhIDwgazEpIHtcbiAgICAgICAgICAgIC8vIC0tLXwtLT4gIHwgKGxpbmUgZW50ZXJzIHRoZSBjbGlwIHJlZ2lvbiBmcm9tIHRoZSBsZWZ0KVxuICAgICAgICAgICAgaWYgKGIgPiBrMSkge1xuICAgICAgICAgICAgICAgIHQgPSBpbnRlcnNlY3Qoc2xpY2UsIGF4LCBheSwgYngsIGJ5LCBrMSk7XG4gICAgICAgICAgICAgICAgaWYgKHRyYWNrTWV0cmljcykgc2xpY2Uuc3RhcnQgPSBsZW4gKyBzZWdMZW4gKiB0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGEgPiBrMikge1xuICAgICAgICAgICAgLy8gfCAgPC0tfC0tLSAobGluZSBlbnRlcnMgdGhlIGNsaXAgcmVnaW9uIGZyb20gdGhlIHJpZ2h0KVxuICAgICAgICAgICAgaWYgKGIgPCBrMikge1xuICAgICAgICAgICAgICAgIHQgPSBpbnRlcnNlY3Qoc2xpY2UsIGF4LCBheSwgYngsIGJ5LCBrMik7XG4gICAgICAgICAgICAgICAgaWYgKHRyYWNrTWV0cmljcykgc2xpY2Uuc3RhcnQgPSBsZW4gKyBzZWdMZW4gKiB0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWRkUG9pbnQoc2xpY2UsIGF4LCBheSwgYXopO1xuICAgICAgICB9XG4gICAgICAgIGlmIChiIDwgazEgJiYgYSA+PSBrMSkge1xuICAgICAgICAgICAgLy8gPC0tfC0tLSAgfCBvciA8LS18LS0tLS18LS0tIChsaW5lIGV4aXRzIHRoZSBjbGlwIHJlZ2lvbiBvbiB0aGUgbGVmdClcbiAgICAgICAgICAgIHQgPSBpbnRlcnNlY3Qoc2xpY2UsIGF4LCBheSwgYngsIGJ5LCBrMSk7XG4gICAgICAgICAgICBleGl0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChiID4gazIgJiYgYSA8PSBrMikge1xuICAgICAgICAgICAgLy8gfCAgLS0tfC0tPiBvciAtLS18LS0tLS18LS0+IChsaW5lIGV4aXRzIHRoZSBjbGlwIHJlZ2lvbiBvbiB0aGUgcmlnaHQpXG4gICAgICAgICAgICB0ID0gaW50ZXJzZWN0KHNsaWNlLCBheCwgYXksIGJ4LCBieSwgazIpO1xuICAgICAgICAgICAgZXhpdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNQb2x5Z29uICYmIGV4aXRlZCkge1xuICAgICAgICAgICAgaWYgKHRyYWNrTWV0cmljcykgc2xpY2UuZW5kID0gbGVuICsgc2VnTGVuICogdDtcbiAgICAgICAgICAgIG5ld0dlb20ucHVzaChzbGljZSk7XG4gICAgICAgICAgICBzbGljZSA9IG5ld1NsaWNlKGdlb20pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRyYWNrTWV0cmljcykgbGVuICs9IHNlZ0xlbjtcbiAgICB9XG5cbiAgICAvLyBhZGQgdGhlIGxhc3QgcG9pbnRcbiAgICB2YXIgbGFzdCA9IGdlb20ubGVuZ3RoIC0gMztcbiAgICBheCA9IGdlb21bbGFzdF07XG4gICAgYXkgPSBnZW9tW2xhc3QgKyAxXTtcbiAgICBheiA9IGdlb21bbGFzdCArIDJdO1xuICAgIGEgPSBheGlzID09PSAwID8gYXggOiBheTtcbiAgICBpZiAoYSA+PSBrMSAmJiBhIDw9IGsyKSBhZGRQb2ludChzbGljZSwgYXgsIGF5LCBheik7XG5cbiAgICAvLyBjbG9zZSB0aGUgcG9seWdvbiBpZiBpdHMgZW5kcG9pbnRzIGFyZSBub3QgdGhlIHNhbWUgYWZ0ZXIgY2xpcHBpbmdcbiAgICBsYXN0ID0gc2xpY2UubGVuZ3RoIC0gMztcbiAgICBpZiAoaXNQb2x5Z29uICYmIGxhc3QgPj0gMyAmJiAoc2xpY2VbbGFzdF0gIT09IHNsaWNlWzBdIHx8IHNsaWNlW2xhc3QgKyAxXSAhPT0gc2xpY2VbMV0pKSB7XG4gICAgICAgIGFkZFBvaW50KHNsaWNlLCBzbGljZVswXSwgc2xpY2VbMV0sIHNsaWNlWzJdKTtcbiAgICB9XG5cbiAgICAvLyBhZGQgdGhlIGZpbmFsIHNsaWNlXG4gICAgaWYgKHNsaWNlLmxlbmd0aCkge1xuICAgICAgICBuZXdHZW9tLnB1c2goc2xpY2UpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbmV3U2xpY2UobGluZSkge1xuICAgIHZhciBzbGljZSA9IFtdO1xuICAgIHNsaWNlLnNpemUgPSBsaW5lLnNpemU7XG4gICAgc2xpY2Uuc3RhcnQgPSBsaW5lLnN0YXJ0O1xuICAgIHNsaWNlLmVuZCA9IGxpbmUuZW5kO1xuICAgIHJldHVybiBzbGljZTtcbn1cblxuZnVuY3Rpb24gY2xpcExpbmVzKGdlb20sIG5ld0dlb20sIGsxLCBrMiwgYXhpcywgaXNQb2x5Z29uKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBnZW9tLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNsaXBMaW5lKGdlb21baV0sIG5ld0dlb20sIGsxLCBrMiwgYXhpcywgaXNQb2x5Z29uLCBmYWxzZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhZGRQb2ludChvdXQsIHgsIHksIHopIHtcbiAgICBvdXQucHVzaCh4KTtcbiAgICBvdXQucHVzaCh5KTtcbiAgICBvdXQucHVzaCh6KTtcbn1cblxuZnVuY3Rpb24gaW50ZXJzZWN0WChvdXQsIGF4LCBheSwgYngsIGJ5LCB4KSB7XG4gICAgdmFyIHQgPSAoeCAtIGF4KSAvIChieCAtIGF4KTtcbiAgICBvdXQucHVzaCh4KTtcbiAgICBvdXQucHVzaChheSArIChieSAtIGF5KSAqIHQpO1xuICAgIG91dC5wdXNoKDEpO1xuICAgIHJldHVybiB0O1xufVxuXG5mdW5jdGlvbiBpbnRlcnNlY3RZKG91dCwgYXgsIGF5LCBieCwgYnksIHkpIHtcbiAgICB2YXIgdCA9ICh5IC0gYXkpIC8gKGJ5IC0gYXkpO1xuICAgIG91dC5wdXNoKGF4ICsgKGJ4IC0gYXgpICogdCk7XG4gICAgb3V0LnB1c2goeSk7XG4gICAgb3V0LnB1c2goMSk7XG4gICAgcmV0dXJuIHQ7XG59XG4iLCJcbmltcG9ydCBjbGlwIGZyb20gJy4vY2xpcCc7XG5pbXBvcnQgY3JlYXRlRmVhdHVyZSBmcm9tICcuL2ZlYXR1cmUnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB3cmFwKGZlYXR1cmVzLCBvcHRpb25zKSB7XG4gICAgdmFyIGJ1ZmZlciA9IG9wdGlvbnMuYnVmZmVyIC8gb3B0aW9ucy5leHRlbnQ7XG4gICAgdmFyIG1lcmdlZCA9IGZlYXR1cmVzO1xuICAgIHZhciBsZWZ0ICA9IGNsaXAoZmVhdHVyZXMsIDEsIC0xIC0gYnVmZmVyLCBidWZmZXIsICAgICAwLCAtMSwgMiwgb3B0aW9ucyk7IC8vIGxlZnQgd29ybGQgY29weVxuICAgIHZhciByaWdodCA9IGNsaXAoZmVhdHVyZXMsIDEsICAxIC0gYnVmZmVyLCAyICsgYnVmZmVyLCAwLCAtMSwgMiwgb3B0aW9ucyk7IC8vIHJpZ2h0IHdvcmxkIGNvcHlcblxuICAgIGlmIChsZWZ0IHx8IHJpZ2h0KSB7XG4gICAgICAgIG1lcmdlZCA9IGNsaXAoZmVhdHVyZXMsIDEsIC1idWZmZXIsIDEgKyBidWZmZXIsIDAsIC0xLCAyLCBvcHRpb25zKSB8fCBbXTsgLy8gY2VudGVyIHdvcmxkIGNvcHlcblxuICAgICAgICBpZiAobGVmdCkgbWVyZ2VkID0gc2hpZnRGZWF0dXJlQ29vcmRzKGxlZnQsIDEpLmNvbmNhdChtZXJnZWQpOyAvLyBtZXJnZSBsZWZ0IGludG8gY2VudGVyXG4gICAgICAgIGlmIChyaWdodCkgbWVyZ2VkID0gbWVyZ2VkLmNvbmNhdChzaGlmdEZlYXR1cmVDb29yZHMocmlnaHQsIC0xKSk7IC8vIG1lcmdlIHJpZ2h0IGludG8gY2VudGVyXG4gICAgfVxuXG4gICAgcmV0dXJuIG1lcmdlZDtcbn1cblxuZnVuY3Rpb24gc2hpZnRGZWF0dXJlQ29vcmRzKGZlYXR1cmVzLCBvZmZzZXQpIHtcbiAgICB2YXIgbmV3RmVhdHVyZXMgPSBbXTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGZlYXR1cmUgPSBmZWF0dXJlc1tpXSxcbiAgICAgICAgICAgIHR5cGUgPSBmZWF0dXJlLnR5cGU7XG5cbiAgICAgICAgdmFyIG5ld0dlb21ldHJ5O1xuXG4gICAgICAgIGlmICh0eXBlID09PSAnUG9pbnQnIHx8IHR5cGUgPT09ICdNdWx0aVBvaW50JyB8fCB0eXBlID09PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgICAgIG5ld0dlb21ldHJ5ID0gc2hpZnRDb29yZHMoZmVhdHVyZS5nZW9tZXRyeSwgb2Zmc2V0KTtcblxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnIHx8IHR5cGUgPT09ICdQb2x5Z29uJykge1xuICAgICAgICAgICAgbmV3R2VvbWV0cnkgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgZmVhdHVyZS5nZW9tZXRyeS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIG5ld0dlb21ldHJ5LnB1c2goc2hpZnRDb29yZHMoZmVhdHVyZS5nZW9tZXRyeVtqXSwgb2Zmc2V0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgICAgICAgIG5ld0dlb21ldHJ5ID0gW107XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgZmVhdHVyZS5nZW9tZXRyeS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciBuZXdQb2x5Z29uID0gW107XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBmZWF0dXJlLmdlb21ldHJ5W2pdLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1BvbHlnb24ucHVzaChzaGlmdENvb3JkcyhmZWF0dXJlLmdlb21ldHJ5W2pdW2tdLCBvZmZzZXQpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbmV3R2VvbWV0cnkucHVzaChuZXdQb2x5Z29uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG5ld0ZlYXR1cmVzLnB1c2goY3JlYXRlRmVhdHVyZShmZWF0dXJlLmlkLCB0eXBlLCBuZXdHZW9tZXRyeSwgZmVhdHVyZS50YWdzKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld0ZlYXR1cmVzO1xufVxuXG5mdW5jdGlvbiBzaGlmdENvb3Jkcyhwb2ludHMsIG9mZnNldCkge1xuICAgIHZhciBuZXdQb2ludHMgPSBbXTtcbiAgICBuZXdQb2ludHMuc2l6ZSA9IHBvaW50cy5zaXplO1xuXG4gICAgaWYgKHBvaW50cy5zdGFydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG5ld1BvaW50cy5zdGFydCA9IHBvaW50cy5zdGFydDtcbiAgICAgICAgbmV3UG9pbnRzLmVuZCA9IHBvaW50cy5lbmQ7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgbmV3UG9pbnRzLnB1c2gocG9pbnRzW2ldICsgb2Zmc2V0LCBwb2ludHNbaSArIDFdLCBwb2ludHNbaSArIDJdKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1BvaW50cztcbn1cbiIsIlxuLy8gVHJhbnNmb3JtcyB0aGUgY29vcmRpbmF0ZXMgb2YgZWFjaCBmZWF0dXJlIGluIHRoZSBnaXZlbiB0aWxlIGZyb21cbi8vIG1lcmNhdG9yLXByb2plY3RlZCBzcGFjZSBpbnRvIChleHRlbnQgeCBleHRlbnQpIHRpbGUgc3BhY2UuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0cmFuc2Zvcm1UaWxlKHRpbGUsIGV4dGVudCkge1xuICAgIGlmICh0aWxlLnRyYW5zZm9ybWVkKSByZXR1cm4gdGlsZTtcblxuICAgIHZhciB6MiA9IDEgPDwgdGlsZS56LFxuICAgICAgICB0eCA9IHRpbGUueCxcbiAgICAgICAgdHkgPSB0aWxlLnksXG4gICAgICAgIGksIGosIGs7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGlsZS5mZWF0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZmVhdHVyZSA9IHRpbGUuZmVhdHVyZXNbaV0sXG4gICAgICAgICAgICBnZW9tID0gZmVhdHVyZS5nZW9tZXRyeSxcbiAgICAgICAgICAgIHR5cGUgPSBmZWF0dXJlLnR5cGU7XG5cbiAgICAgICAgZmVhdHVyZS5nZW9tZXRyeSA9IFtdO1xuXG4gICAgICAgIGlmICh0eXBlID09PSAxKSB7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgZ2VvbS5sZW5ndGg7IGogKz0gMikge1xuICAgICAgICAgICAgICAgIGZlYXR1cmUuZ2VvbWV0cnkucHVzaCh0cmFuc2Zvcm1Qb2ludChnZW9tW2pdLCBnZW9tW2ogKyAxXSwgZXh0ZW50LCB6MiwgdHgsIHR5KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgZ2VvbS5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHZhciByaW5nID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChrID0gMDsgayA8IGdlb21bal0ubGVuZ3RoOyBrICs9IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmluZy5wdXNoKHRyYW5zZm9ybVBvaW50KGdlb21bal1ba10sIGdlb21bal1bayArIDFdLCBleHRlbnQsIHoyLCB0eCwgdHkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZmVhdHVyZS5nZW9tZXRyeS5wdXNoKHJpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGlsZS50cmFuc2Zvcm1lZCA9IHRydWU7XG5cbiAgICByZXR1cm4gdGlsZTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtUG9pbnQoeCwgeSwgZXh0ZW50LCB6MiwgdHgsIHR5KSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgTWF0aC5yb3VuZChleHRlbnQgKiAoeCAqIHoyIC0gdHgpKSxcbiAgICAgICAgTWF0aC5yb3VuZChleHRlbnQgKiAoeSAqIHoyIC0gdHkpKV07XG59XG4iLCJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNyZWF0ZVRpbGUoZmVhdHVyZXMsIHosIHR4LCB0eSwgb3B0aW9ucykge1xuICAgIHZhciB0b2xlcmFuY2UgPSB6ID09PSBvcHRpb25zLm1heFpvb20gPyAwIDogb3B0aW9ucy50b2xlcmFuY2UgLyAoKDEgPDwgeikgKiBvcHRpb25zLmV4dGVudCk7XG4gICAgdmFyIHRpbGUgPSB7XG4gICAgICAgIGZlYXR1cmVzOiBbXSxcbiAgICAgICAgbnVtUG9pbnRzOiAwLFxuICAgICAgICBudW1TaW1wbGlmaWVkOiAwLFxuICAgICAgICBudW1GZWF0dXJlczogMCxcbiAgICAgICAgc291cmNlOiBudWxsLFxuICAgICAgICB4OiB0eCxcbiAgICAgICAgeTogdHksXG4gICAgICAgIHo6IHosXG4gICAgICAgIHRyYW5zZm9ybWVkOiBmYWxzZSxcbiAgICAgICAgbWluWDogMixcbiAgICAgICAgbWluWTogMSxcbiAgICAgICAgbWF4WDogLTEsXG4gICAgICAgIG1heFk6IDBcbiAgICB9O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmVhdHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGlsZS5udW1GZWF0dXJlcysrO1xuICAgICAgICBhZGRGZWF0dXJlKHRpbGUsIGZlYXR1cmVzW2ldLCB0b2xlcmFuY2UsIG9wdGlvbnMpO1xuXG4gICAgICAgIHZhciBtaW5YID0gZmVhdHVyZXNbaV0ubWluWDtcbiAgICAgICAgdmFyIG1pblkgPSBmZWF0dXJlc1tpXS5taW5ZO1xuICAgICAgICB2YXIgbWF4WCA9IGZlYXR1cmVzW2ldLm1heFg7XG4gICAgICAgIHZhciBtYXhZID0gZmVhdHVyZXNbaV0ubWF4WTtcblxuICAgICAgICBpZiAobWluWCA8IHRpbGUubWluWCkgdGlsZS5taW5YID0gbWluWDtcbiAgICAgICAgaWYgKG1pblkgPCB0aWxlLm1pblkpIHRpbGUubWluWSA9IG1pblk7XG4gICAgICAgIGlmIChtYXhYID4gdGlsZS5tYXhYKSB0aWxlLm1heFggPSBtYXhYO1xuICAgICAgICBpZiAobWF4WSA+IHRpbGUubWF4WSkgdGlsZS5tYXhZID0gbWF4WTtcbiAgICB9XG4gICAgcmV0dXJuIHRpbGU7XG59XG5cbmZ1bmN0aW9uIGFkZEZlYXR1cmUodGlsZSwgZmVhdHVyZSwgdG9sZXJhbmNlLCBvcHRpb25zKSB7XG5cbiAgICB2YXIgZ2VvbSA9IGZlYXR1cmUuZ2VvbWV0cnksXG4gICAgICAgIHR5cGUgPSBmZWF0dXJlLnR5cGUsXG4gICAgICAgIHNpbXBsaWZpZWQgPSBbXTtcblxuICAgIGlmICh0eXBlID09PSAnUG9pbnQnIHx8IHR5cGUgPT09ICdNdWx0aVBvaW50Jykge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20ubGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgICAgICAgIHNpbXBsaWZpZWQucHVzaChnZW9tW2ldKTtcbiAgICAgICAgICAgIHNpbXBsaWZpZWQucHVzaChnZW9tW2kgKyAxXSk7XG4gICAgICAgICAgICB0aWxlLm51bVBvaW50cysrO1xuICAgICAgICAgICAgdGlsZS5udW1TaW1wbGlmaWVkKys7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0xpbmVTdHJpbmcnKSB7XG4gICAgICAgIGFkZExpbmUoc2ltcGxpZmllZCwgZ2VvbSwgdGlsZSwgdG9sZXJhbmNlLCBmYWxzZSwgZmFsc2UpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnTXVsdGlMaW5lU3RyaW5nJyB8fCB0eXBlID09PSAnUG9seWdvbicpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGdlb20ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZExpbmUoc2ltcGxpZmllZCwgZ2VvbVtpXSwgdGlsZSwgdG9sZXJhbmNlLCB0eXBlID09PSAnUG9seWdvbicsIGkgPT09IDApO1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdNdWx0aVBvbHlnb24nKSB7XG5cbiAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBnZW9tLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICB2YXIgcG9seWdvbiA9IGdlb21ba107XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcG9seWdvbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGFkZExpbmUoc2ltcGxpZmllZCwgcG9seWdvbltpXSwgdGlsZSwgdG9sZXJhbmNlLCB0cnVlLCBpID09PSAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzaW1wbGlmaWVkLmxlbmd0aCkge1xuICAgICAgICB2YXIgdGFncyA9IGZlYXR1cmUudGFncyB8fCBudWxsO1xuICAgICAgICBpZiAodHlwZSA9PT0gJ0xpbmVTdHJpbmcnICYmIG9wdGlvbnMubGluZU1ldHJpY3MpIHtcbiAgICAgICAgICAgIHRhZ3MgPSB7fTtcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBmZWF0dXJlLnRhZ3MpIHRhZ3Nba2V5XSA9IGZlYXR1cmUudGFnc1trZXldO1xuICAgICAgICAgICAgdGFnc1snbWFwYm94X2NsaXBfc3RhcnQnXSA9IGdlb20uc3RhcnQgLyBnZW9tLnNpemU7XG4gICAgICAgICAgICB0YWdzWydtYXBib3hfY2xpcF9lbmQnXSA9IGdlb20uZW5kIC8gZ2VvbS5zaXplO1xuICAgICAgICB9XG4gICAgICAgIHZhciB0aWxlRmVhdHVyZSA9IHtcbiAgICAgICAgICAgIGdlb21ldHJ5OiBzaW1wbGlmaWVkLFxuICAgICAgICAgICAgdHlwZTogdHlwZSA9PT0gJ1BvbHlnb24nIHx8IHR5cGUgPT09ICdNdWx0aVBvbHlnb24nID8gMyA6XG4gICAgICAgICAgICAgICAgdHlwZSA9PT0gJ0xpbmVTdHJpbmcnIHx8IHR5cGUgPT09ICdNdWx0aUxpbmVTdHJpbmcnID8gMiA6IDEsXG4gICAgICAgICAgICB0YWdzOiB0YWdzXG4gICAgICAgIH07XG4gICAgICAgIGlmIChmZWF0dXJlLmlkICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aWxlRmVhdHVyZS5pZCA9IGZlYXR1cmUuaWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGlsZS5mZWF0dXJlcy5wdXNoKHRpbGVGZWF0dXJlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFkZExpbmUocmVzdWx0LCBnZW9tLCB0aWxlLCB0b2xlcmFuY2UsIGlzUG9seWdvbiwgaXNPdXRlcikge1xuICAgIHZhciBzcVRvbGVyYW5jZSA9IHRvbGVyYW5jZSAqIHRvbGVyYW5jZTtcblxuICAgIGlmICh0b2xlcmFuY2UgPiAwICYmIChnZW9tLnNpemUgPCAoaXNQb2x5Z29uID8gc3FUb2xlcmFuY2UgOiB0b2xlcmFuY2UpKSkge1xuICAgICAgICB0aWxlLm51bVBvaW50cyArPSBnZW9tLmxlbmd0aCAvIDM7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcmluZyA9IFtdO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBnZW9tLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGlmICh0b2xlcmFuY2UgPT09IDAgfHwgZ2VvbVtpICsgMl0gPiBzcVRvbGVyYW5jZSkge1xuICAgICAgICAgICAgdGlsZS5udW1TaW1wbGlmaWVkKys7XG4gICAgICAgICAgICByaW5nLnB1c2goZ2VvbVtpXSk7XG4gICAgICAgICAgICByaW5nLnB1c2goZ2VvbVtpICsgMV0pO1xuICAgICAgICB9XG4gICAgICAgIHRpbGUubnVtUG9pbnRzKys7XG4gICAgfVxuXG4gICAgaWYgKGlzUG9seWdvbikgcmV3aW5kKHJpbmcsIGlzT3V0ZXIpO1xuXG4gICAgcmVzdWx0LnB1c2gocmluZyk7XG59XG5cbmZ1bmN0aW9uIHJld2luZChyaW5nLCBjbG9ja3dpc2UpIHtcbiAgICB2YXIgYXJlYSA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJpbmcubGVuZ3RoLCBqID0gbGVuIC0gMjsgaSA8IGxlbjsgaiA9IGksIGkgKz0gMikge1xuICAgICAgICBhcmVhICs9IChyaW5nW2ldIC0gcmluZ1tqXSkgKiAocmluZ1tpICsgMV0gKyByaW5nW2ogKyAxXSk7XG4gICAgfVxuICAgIGlmIChhcmVhID4gMCA9PT0gY2xvY2t3aXNlKSB7XG4gICAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJpbmcubGVuZ3RoOyBpIDwgbGVuIC8gMjsgaSArPSAyKSB7XG4gICAgICAgICAgICB2YXIgeCA9IHJpbmdbaV07XG4gICAgICAgICAgICB2YXIgeSA9IHJpbmdbaSArIDFdO1xuICAgICAgICAgICAgcmluZ1tpXSA9IHJpbmdbbGVuIC0gMiAtIGldO1xuICAgICAgICAgICAgcmluZ1tpICsgMV0gPSByaW5nW2xlbiAtIDEgLSBpXTtcbiAgICAgICAgICAgIHJpbmdbbGVuIC0gMiAtIGldID0geDtcbiAgICAgICAgICAgIHJpbmdbbGVuIC0gMSAtIGldID0geTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIlxuaW1wb3J0IGNvbnZlcnQgZnJvbSAnLi9jb252ZXJ0JzsgICAgIC8vIEdlb0pTT04gY29udmVyc2lvbiBhbmQgcHJlcHJvY2Vzc2luZ1xuaW1wb3J0IGNsaXAgZnJvbSAnLi9jbGlwJzsgICAgICAgICAgIC8vIHN0cmlwZSBjbGlwcGluZyBhbGdvcml0aG1cbmltcG9ydCB3cmFwIGZyb20gJy4vd3JhcCc7ICAgICAgICAgICAvLyBkYXRlIGxpbmUgcHJvY2Vzc2luZ1xuaW1wb3J0IHRyYW5zZm9ybSBmcm9tICcuL3RyYW5zZm9ybSc7IC8vIGNvb3JkaW5hdGUgdHJhbnNmb3JtYXRpb25cbmltcG9ydCBjcmVhdGVUaWxlIGZyb20gJy4vdGlsZSc7ICAgICAvLyBmaW5hbCBzaW1wbGlmaWVkIHRpbGUgZ2VuZXJhdGlvblxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZW9qc29udnQoZGF0YSwgb3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgR2VvSlNPTlZUKGRhdGEsIG9wdGlvbnMpO1xufVxuXG5mdW5jdGlvbiBHZW9KU09OVlQoZGF0YSwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMgPSBleHRlbmQoT2JqZWN0LmNyZWF0ZSh0aGlzLm9wdGlvbnMpLCBvcHRpb25zKTtcblxuICAgIHZhciBkZWJ1ZyA9IG9wdGlvbnMuZGVidWc7XG5cbiAgICBpZiAoZGVidWcpIGNvbnNvbGUudGltZSgncHJlcHJvY2VzcyBkYXRhJyk7XG5cbiAgICBpZiAob3B0aW9ucy5tYXhab29tIDwgMCB8fCBvcHRpb25zLm1heFpvb20gPiAyNCkgdGhyb3cgbmV3IEVycm9yKCdtYXhab29tIHNob3VsZCBiZSBpbiB0aGUgMC0yNCByYW5nZScpO1xuICAgIGlmIChvcHRpb25zLnByb21vdGVJZCAmJiBvcHRpb25zLmdlbmVyYXRlSWQpIHRocm93IG5ldyBFcnJvcigncHJvbW90ZUlkIGFuZCBnZW5lcmF0ZUlkIGNhbm5vdCBiZSB1c2VkIHRvZ2V0aGVyLicpO1xuXG4gICAgdmFyIGZlYXR1cmVzID0gY29udmVydChkYXRhLCBvcHRpb25zKTtcblxuICAgIHRoaXMudGlsZXMgPSB7fTtcbiAgICB0aGlzLnRpbGVDb29yZHMgPSBbXTtcblxuICAgIGlmIChkZWJ1Zykge1xuICAgICAgICBjb25zb2xlLnRpbWVFbmQoJ3ByZXByb2Nlc3MgZGF0YScpO1xuICAgICAgICBjb25zb2xlLmxvZygnaW5kZXg6IG1heFpvb206ICVkLCBtYXhQb2ludHM6ICVkJywgb3B0aW9ucy5pbmRleE1heFpvb20sIG9wdGlvbnMuaW5kZXhNYXhQb2ludHMpO1xuICAgICAgICBjb25zb2xlLnRpbWUoJ2dlbmVyYXRlIHRpbGVzJyk7XG4gICAgICAgIHRoaXMuc3RhdHMgPSB7fTtcbiAgICAgICAgdGhpcy50b3RhbCA9IDA7XG4gICAgfVxuXG4gICAgZmVhdHVyZXMgPSB3cmFwKGZlYXR1cmVzLCBvcHRpb25zKTtcblxuICAgIC8vIHN0YXJ0IHNsaWNpbmcgZnJvbSB0aGUgdG9wIHRpbGUgZG93blxuICAgIGlmIChmZWF0dXJlcy5sZW5ndGgpIHRoaXMuc3BsaXRUaWxlKGZlYXR1cmVzLCAwLCAwLCAwKTtcblxuICAgIGlmIChkZWJ1Zykge1xuICAgICAgICBpZiAoZmVhdHVyZXMubGVuZ3RoKSBjb25zb2xlLmxvZygnZmVhdHVyZXM6ICVkLCBwb2ludHM6ICVkJywgdGhpcy50aWxlc1swXS5udW1GZWF0dXJlcywgdGhpcy50aWxlc1swXS5udW1Qb2ludHMpO1xuICAgICAgICBjb25zb2xlLnRpbWVFbmQoJ2dlbmVyYXRlIHRpbGVzJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKCd0aWxlcyBnZW5lcmF0ZWQ6JywgdGhpcy50b3RhbCwgSlNPTi5zdHJpbmdpZnkodGhpcy5zdGF0cykpO1xuICAgIH1cbn1cblxuR2VvSlNPTlZULnByb3RvdHlwZS5vcHRpb25zID0ge1xuICAgIG1heFpvb206IDE0LCAgICAgICAgICAgIC8vIG1heCB6b29tIHRvIHByZXNlcnZlIGRldGFpbCBvblxuICAgIGluZGV4TWF4Wm9vbTogNSwgICAgICAgIC8vIG1heCB6b29tIGluIHRoZSB0aWxlIGluZGV4XG4gICAgaW5kZXhNYXhQb2ludHM6IDEwMDAwMCwgLy8gbWF4IG51bWJlciBvZiBwb2ludHMgcGVyIHRpbGUgaW4gdGhlIHRpbGUgaW5kZXhcbiAgICB0b2xlcmFuY2U6IDMsICAgICAgICAgICAvLyBzaW1wbGlmaWNhdGlvbiB0b2xlcmFuY2UgKGhpZ2hlciBtZWFucyBzaW1wbGVyKVxuICAgIGV4dGVudDogNDA5NiwgICAgICAgICAgIC8vIHRpbGUgZXh0ZW50XG4gICAgYnVmZmVyOiA2NCwgICAgICAgICAgICAgLy8gdGlsZSBidWZmZXIgb24gZWFjaCBzaWRlXG4gICAgbGluZU1ldHJpY3M6IGZhbHNlLCAgICAgLy8gd2hldGhlciB0byBjYWxjdWxhdGUgbGluZSBtZXRyaWNzXG4gICAgcHJvbW90ZUlkOiBudWxsLCAgICAgICAgLy8gbmFtZSBvZiBhIGZlYXR1cmUgcHJvcGVydHkgdG8gYmUgcHJvbW90ZWQgdG8gZmVhdHVyZS5pZFxuICAgIGdlbmVyYXRlSWQ6IGZhbHNlLCAgICAgIC8vIHdoZXRoZXIgdG8gZ2VuZXJhdGUgZmVhdHVyZSBpZHMuIENhbm5vdCBiZSB1c2VkIHdpdGggcHJvbW90ZUlkXG4gICAgZGVidWc6IDAgICAgICAgICAgICAgICAgLy8gbG9nZ2luZyBsZXZlbCAoMCwgMSBvciAyKVxufTtcblxuR2VvSlNPTlZULnByb3RvdHlwZS5zcGxpdFRpbGUgPSBmdW5jdGlvbiAoZmVhdHVyZXMsIHosIHgsIHksIGN6LCBjeCwgY3kpIHtcblxuICAgIHZhciBzdGFjayA9IFtmZWF0dXJlcywgeiwgeCwgeV0sXG4gICAgICAgIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsXG4gICAgICAgIGRlYnVnID0gb3B0aW9ucy5kZWJ1ZztcblxuICAgIC8vIGF2b2lkIHJlY3Vyc2lvbiBieSB1c2luZyBhIHByb2Nlc3NpbmcgcXVldWVcbiAgICB3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG4gICAgICAgIHkgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgeCA9IHN0YWNrLnBvcCgpO1xuICAgICAgICB6ID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGZlYXR1cmVzID0gc3RhY2sucG9wKCk7XG5cbiAgICAgICAgdmFyIHoyID0gMSA8PCB6LFxuICAgICAgICAgICAgaWQgPSB0b0lEKHosIHgsIHkpLFxuICAgICAgICAgICAgdGlsZSA9IHRoaXMudGlsZXNbaWRdO1xuXG4gICAgICAgIGlmICghdGlsZSkge1xuICAgICAgICAgICAgaWYgKGRlYnVnID4gMSkgY29uc29sZS50aW1lKCdjcmVhdGlvbicpO1xuXG4gICAgICAgICAgICB0aWxlID0gdGhpcy50aWxlc1tpZF0gPSBjcmVhdGVUaWxlKGZlYXR1cmVzLCB6LCB4LCB5LCBvcHRpb25zKTtcbiAgICAgICAgICAgIHRoaXMudGlsZUNvb3Jkcy5wdXNoKHt6OiB6LCB4OiB4LCB5OiB5fSk7XG5cbiAgICAgICAgICAgIGlmIChkZWJ1Zykge1xuICAgICAgICAgICAgICAgIGlmIChkZWJ1ZyA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RpbGUgeiVkLSVkLSVkIChmZWF0dXJlczogJWQsIHBvaW50czogJWQsIHNpbXBsaWZpZWQ6ICVkKScsXG4gICAgICAgICAgICAgICAgICAgICAgICB6LCB4LCB5LCB0aWxlLm51bUZlYXR1cmVzLCB0aWxlLm51bVBvaW50cywgdGlsZS5udW1TaW1wbGlmaWVkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS50aW1lRW5kKCdjcmVhdGlvbicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gJ3onICsgejtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRzW2tleV0gPSAodGhpcy5zdGF0c1trZXldIHx8IDApICsgMTtcbiAgICAgICAgICAgICAgICB0aGlzLnRvdGFsKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzYXZlIHJlZmVyZW5jZSB0byBvcmlnaW5hbCBnZW9tZXRyeSBpbiB0aWxlIHNvIHRoYXQgd2UgY2FuIGRyaWxsIGRvd24gbGF0ZXIgaWYgd2Ugc3RvcCBub3dcbiAgICAgICAgdGlsZS5zb3VyY2UgPSBmZWF0dXJlcztcblxuICAgICAgICAvLyBpZiBpdCdzIHRoZSBmaXJzdC1wYXNzIHRpbGluZ1xuICAgICAgICBpZiAoIWN6KSB7XG4gICAgICAgICAgICAvLyBzdG9wIHRpbGluZyBpZiB3ZSByZWFjaGVkIG1heCB6b29tLCBvciBpZiB0aGUgdGlsZSBpcyB0b28gc2ltcGxlXG4gICAgICAgICAgICBpZiAoeiA9PT0gb3B0aW9ucy5pbmRleE1heFpvb20gfHwgdGlsZS5udW1Qb2ludHMgPD0gb3B0aW9ucy5pbmRleE1heFBvaW50cykgY29udGludWU7XG5cbiAgICAgICAgLy8gaWYgYSBkcmlsbGRvd24gdG8gYSBzcGVjaWZpYyB0aWxlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBzdG9wIHRpbGluZyBpZiB3ZSByZWFjaGVkIGJhc2Ugem9vbSBvciBvdXIgdGFyZ2V0IHRpbGUgem9vbVxuICAgICAgICAgICAgaWYgKHogPT09IG9wdGlvbnMubWF4Wm9vbSB8fCB6ID09PSBjeikgY29udGludWU7XG5cbiAgICAgICAgICAgIC8vIHN0b3AgdGlsaW5nIGlmIGl0J3Mgbm90IGFuIGFuY2VzdG9yIG9mIHRoZSB0YXJnZXQgdGlsZVxuICAgICAgICAgICAgdmFyIG0gPSAxIDw8IChjeiAtIHopO1xuICAgICAgICAgICAgaWYgKHggIT09IE1hdGguZmxvb3IoY3ggLyBtKSB8fCB5ICE9PSBNYXRoLmZsb29yKGN5IC8gbSkpIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgd2Ugc2xpY2UgZnVydGhlciBkb3duLCBubyBuZWVkIHRvIGtlZXAgc291cmNlIGdlb21ldHJ5XG4gICAgICAgIHRpbGUuc291cmNlID0gbnVsbDtcblxuICAgICAgICBpZiAoZmVhdHVyZXMubGVuZ3RoID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICBpZiAoZGVidWcgPiAxKSBjb25zb2xlLnRpbWUoJ2NsaXBwaW5nJyk7XG5cbiAgICAgICAgLy8gdmFsdWVzIHdlJ2xsIHVzZSBmb3IgY2xpcHBpbmdcbiAgICAgICAgdmFyIGsxID0gMC41ICogb3B0aW9ucy5idWZmZXIgLyBvcHRpb25zLmV4dGVudCxcbiAgICAgICAgICAgIGsyID0gMC41IC0gazEsXG4gICAgICAgICAgICBrMyA9IDAuNSArIGsxLFxuICAgICAgICAgICAgazQgPSAxICsgazEsXG4gICAgICAgICAgICB0bCwgYmwsIHRyLCBiciwgbGVmdCwgcmlnaHQ7XG5cbiAgICAgICAgdGwgPSBibCA9IHRyID0gYnIgPSBudWxsO1xuXG4gICAgICAgIGxlZnQgID0gY2xpcChmZWF0dXJlcywgejIsIHggLSBrMSwgeCArIGszLCAwLCB0aWxlLm1pblgsIHRpbGUubWF4WCwgb3B0aW9ucyk7XG4gICAgICAgIHJpZ2h0ID0gY2xpcChmZWF0dXJlcywgejIsIHggKyBrMiwgeCArIGs0LCAwLCB0aWxlLm1pblgsIHRpbGUubWF4WCwgb3B0aW9ucyk7XG4gICAgICAgIGZlYXR1cmVzID0gbnVsbDtcblxuICAgICAgICBpZiAobGVmdCkge1xuICAgICAgICAgICAgdGwgPSBjbGlwKGxlZnQsIHoyLCB5IC0gazEsIHkgKyBrMywgMSwgdGlsZS5taW5ZLCB0aWxlLm1heFksIG9wdGlvbnMpO1xuICAgICAgICAgICAgYmwgPSBjbGlwKGxlZnQsIHoyLCB5ICsgazIsIHkgKyBrNCwgMSwgdGlsZS5taW5ZLCB0aWxlLm1heFksIG9wdGlvbnMpO1xuICAgICAgICAgICAgbGVmdCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmlnaHQpIHtcbiAgICAgICAgICAgIHRyID0gY2xpcChyaWdodCwgejIsIHkgLSBrMSwgeSArIGszLCAxLCB0aWxlLm1pblksIHRpbGUubWF4WSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBiciA9IGNsaXAocmlnaHQsIHoyLCB5ICsgazIsIHkgKyBrNCwgMSwgdGlsZS5taW5ZLCB0aWxlLm1heFksIG9wdGlvbnMpO1xuICAgICAgICAgICAgcmlnaHQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRlYnVnID4gMSkgY29uc29sZS50aW1lRW5kKCdjbGlwcGluZycpO1xuXG4gICAgICAgIHN0YWNrLnB1c2godGwgfHwgW10sIHogKyAxLCB4ICogMiwgICAgIHkgKiAyKTtcbiAgICAgICAgc3RhY2sucHVzaChibCB8fCBbXSwgeiArIDEsIHggKiAyLCAgICAgeSAqIDIgKyAxKTtcbiAgICAgICAgc3RhY2sucHVzaCh0ciB8fCBbXSwgeiArIDEsIHggKiAyICsgMSwgeSAqIDIpO1xuICAgICAgICBzdGFjay5wdXNoKGJyIHx8IFtdLCB6ICsgMSwgeCAqIDIgKyAxLCB5ICogMiArIDEpO1xuICAgIH1cbn07XG5cbkdlb0pTT05WVC5wcm90b3R5cGUuZ2V0VGlsZSA9IGZ1bmN0aW9uICh6LCB4LCB5KSB7XG4gICAgdmFyIG9wdGlvbnMgPSB0aGlzLm9wdGlvbnMsXG4gICAgICAgIGV4dGVudCA9IG9wdGlvbnMuZXh0ZW50LFxuICAgICAgICBkZWJ1ZyA9IG9wdGlvbnMuZGVidWc7XG5cbiAgICBpZiAoeiA8IDAgfHwgeiA+IDI0KSByZXR1cm4gbnVsbDtcblxuICAgIHZhciB6MiA9IDEgPDwgejtcbiAgICB4ID0gKCh4ICUgejIpICsgejIpICUgejI7IC8vIHdyYXAgdGlsZSB4IGNvb3JkaW5hdGVcblxuICAgIHZhciBpZCA9IHRvSUQoeiwgeCwgeSk7XG4gICAgaWYgKHRoaXMudGlsZXNbaWRdKSByZXR1cm4gdHJhbnNmb3JtKHRoaXMudGlsZXNbaWRdLCBleHRlbnQpO1xuXG4gICAgaWYgKGRlYnVnID4gMSkgY29uc29sZS5sb2coJ2RyaWxsaW5nIGRvd24gdG8geiVkLSVkLSVkJywgeiwgeCwgeSk7XG5cbiAgICB2YXIgejAgPSB6LFxuICAgICAgICB4MCA9IHgsXG4gICAgICAgIHkwID0geSxcbiAgICAgICAgcGFyZW50O1xuXG4gICAgd2hpbGUgKCFwYXJlbnQgJiYgejAgPiAwKSB7XG4gICAgICAgIHowLS07XG4gICAgICAgIHgwID0gTWF0aC5mbG9vcih4MCAvIDIpO1xuICAgICAgICB5MCA9IE1hdGguZmxvb3IoeTAgLyAyKTtcbiAgICAgICAgcGFyZW50ID0gdGhpcy50aWxlc1t0b0lEKHowLCB4MCwgeTApXTtcbiAgICB9XG5cbiAgICBpZiAoIXBhcmVudCB8fCAhcGFyZW50LnNvdXJjZSkgcmV0dXJuIG51bGw7XG5cbiAgICAvLyBpZiB3ZSBmb3VuZCBhIHBhcmVudCB0aWxlIGNvbnRhaW5pbmcgdGhlIG9yaWdpbmFsIGdlb21ldHJ5LCB3ZSBjYW4gZHJpbGwgZG93biBmcm9tIGl0XG4gICAgaWYgKGRlYnVnID4gMSkgY29uc29sZS5sb2coJ2ZvdW5kIHBhcmVudCB0aWxlIHolZC0lZC0lZCcsIHowLCB4MCwgeTApO1xuXG4gICAgaWYgKGRlYnVnID4gMSkgY29uc29sZS50aW1lKCdkcmlsbGluZyBkb3duJyk7XG4gICAgdGhpcy5zcGxpdFRpbGUocGFyZW50LnNvdXJjZSwgejAsIHgwLCB5MCwgeiwgeCwgeSk7XG4gICAgaWYgKGRlYnVnID4gMSkgY29uc29sZS50aW1lRW5kKCdkcmlsbGluZyBkb3duJyk7XG5cbiAgICByZXR1cm4gdGhpcy50aWxlc1tpZF0gPyB0cmFuc2Zvcm0odGhpcy50aWxlc1tpZF0sIGV4dGVudCkgOiBudWxsO1xufTtcblxuZnVuY3Rpb24gdG9JRCh6LCB4LCB5KSB7XG4gICAgcmV0dXJuICgoKDEgPDwgeikgKiB5ICsgeCkgKiAzMikgKyB6O1xufVxuXG5mdW5jdGlvbiBleHRlbmQoZGVzdCwgc3JjKSB7XG4gICAgZm9yICh2YXIgaSBpbiBzcmMpIGRlc3RbaV0gPSBzcmNbaV07XG4gICAgcmV0dXJuIGRlc3Q7XG59XG4iLCIvLyBAZmxvd1xuXG5pbXBvcnQge2dldEpTT059IGZyb20gJy4uL3V0aWwvYWpheCc7XG5cbmltcG9ydCB7UmVxdWVzdFBlcmZvcm1hbmNlfSBmcm9tICcuLi91dGlsL3BlcmZvcm1hbmNlJztcbmltcG9ydCByZXdpbmQgZnJvbSAnQG1hcGJveC9nZW9qc29uLXJld2luZCc7XG5pbXBvcnQgR2VvSlNPTldyYXBwZXIgZnJvbSAnLi9nZW9qc29uX3dyYXBwZXInO1xuaW1wb3J0IHZ0cGJmIGZyb20gJ3Z0LXBiZic7XG5pbXBvcnQgU3VwZXJjbHVzdGVyIGZyb20gJ3N1cGVyY2x1c3Rlcic7XG5pbXBvcnQgZ2VvanNvbnZ0IGZyb20gJ2dlb2pzb24tdnQnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IFZlY3RvclRpbGVXb3JrZXJTb3VyY2UgZnJvbSAnLi92ZWN0b3JfdGlsZV93b3JrZXJfc291cmNlJztcbmltcG9ydCB7Y3JlYXRlRXhwcmVzc2lvbn0gZnJvbSAnLi4vc3R5bGUtc3BlYy9leHByZXNzaW9uJztcblxuaW1wb3J0IHR5cGUge1xuICAgIFdvcmtlclRpbGVQYXJhbWV0ZXJzLFxuICAgIFdvcmtlclRpbGVDYWxsYmFjayxcbn0gZnJvbSAnLi4vc291cmNlL3dvcmtlcl9zb3VyY2UnO1xuXG5pbXBvcnQgdHlwZSBBY3RvciBmcm9tICcuLi91dGlsL2FjdG9yJztcbmltcG9ydCB0eXBlIFN0eWxlTGF5ZXJJbmRleCBmcm9tICcuLi9zdHlsZS9zdHlsZV9sYXllcl9pbmRleCc7XG5cbmltcG9ydCB0eXBlIHtMb2FkVmVjdG9yRGF0YUNhbGxiYWNrfSBmcm9tICcuL3ZlY3Rvcl90aWxlX3dvcmtlcl9zb3VyY2UnO1xuaW1wb3J0IHR5cGUge1JlcXVlc3RQYXJhbWV0ZXJzLCBSZXNwb25zZUNhbGxiYWNrfSBmcm9tICcuLi91dGlsL2FqYXgnO1xuaW1wb3J0IHR5cGUge0NhbGxiYWNrfSBmcm9tICcuLi90eXBlcy9jYWxsYmFjayc7XG5pbXBvcnQgdHlwZSB7R2VvSlNPTkZlYXR1cmV9IGZyb20gJ0BtYXBib3gvZ2VvanNvbi10eXBlcyc7XG5cbmV4cG9ydCB0eXBlIExvYWRHZW9KU09OUGFyYW1ldGVycyA9IHtcbiAgICByZXF1ZXN0PzogUmVxdWVzdFBhcmFtZXRlcnMsXG4gICAgZGF0YT86IHN0cmluZyxcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBjbHVzdGVyOiBib29sZWFuLFxuICAgIHN1cGVyY2x1c3Rlck9wdGlvbnM/OiBPYmplY3QsXG4gICAgZ2VvanNvblZ0T3B0aW9ucz86IE9iamVjdCxcbiAgICBjbHVzdGVyUHJvcGVydGllcz86IE9iamVjdCxcbiAgICBmaWx0ZXI/OiBBcnJheTxtaXhlZD5cbn07XG5cbmV4cG9ydCB0eXBlIExvYWRHZW9KU09OID0gKHBhcmFtczogTG9hZEdlb0pTT05QYXJhbWV0ZXJzLCBjYWxsYmFjazogUmVzcG9uc2VDYWxsYmFjazxPYmplY3Q+KSA9PiB2b2lkO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdlb0pTT05JbmRleCB7XG4gICAgZ2V0VGlsZSh6OiBudW1iZXIsIHg6IG51bWJlciwgeTogbnVtYmVyKTogT2JqZWN0O1xuXG4gICAgLy8gc3VwZXJjbHVzdGVyIG1ldGhvZHNcbiAgICBnZXRDbHVzdGVyRXhwYW5zaW9uWm9vbShjbHVzdGVySWQ6IG51bWJlcik6IG51bWJlcjtcbiAgICBnZXRDaGlsZHJlbihjbHVzdGVySWQ6IG51bWJlcik6IEFycmF5PEdlb0pTT05GZWF0dXJlPjtcbiAgICBnZXRMZWF2ZXMoY2x1c3RlcklkOiBudW1iZXIsIGxpbWl0OiBudW1iZXIsIG9mZnNldDogbnVtYmVyKTogQXJyYXk8R2VvSlNPTkZlYXR1cmU+O1xufVxuXG5mdW5jdGlvbiBsb2FkR2VvSlNPTlRpbGUocGFyYW1zOiBXb3JrZXJUaWxlUGFyYW1ldGVycywgY2FsbGJhY2s6IExvYWRWZWN0b3JEYXRhQ2FsbGJhY2spIHtcbiAgICBjb25zdCBjYW5vbmljYWwgPSBwYXJhbXMudGlsZUlELmNhbm9uaWNhbDtcblxuICAgIGlmICghdGhpcy5fZ2VvSlNPTkluZGV4KSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBudWxsKTsgIC8vIHdlIGNvdWxkbid0IGxvYWQgdGhlIGZpbGVcbiAgICB9XG5cbiAgICBjb25zdCBnZW9KU09OVGlsZSA9IHRoaXMuX2dlb0pTT05JbmRleC5nZXRUaWxlKGNhbm9uaWNhbC56LCBjYW5vbmljYWwueCwgY2Fub25pY2FsLnkpO1xuICAgIGlmICghZ2VvSlNPTlRpbGUpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwsIG51bGwpOyAvLyBub3RoaW5nIGluIHRoZSBnaXZlbiB0aWxlXG4gICAgfVxuXG4gICAgY29uc3QgZ2VvanNvbldyYXBwZXIgPSBuZXcgR2VvSlNPTldyYXBwZXIoZ2VvSlNPTlRpbGUuZmVhdHVyZXMpO1xuXG4gICAgLy8gRW5jb2RlIHRoZSBnZW9qc29uLXZ0IHRpbGUgaW50byBiaW5hcnkgdmVjdG9yIHRpbGUgZm9ybS4gIFRoaXNcbiAgICAvLyBpcyBhIGNvbnZlbmllbmNlIHRoYXQgYWxsb3dzIGBGZWF0dXJlSW5kZXhgIHRvIG9wZXJhdGUgdGhlIHNhbWUgd2F5XG4gICAgLy8gYWNyb3NzIGBWZWN0b3JUaWxlU291cmNlYCBhbmQgYEdlb0pTT05Tb3VyY2VgIGRhdGEuXG4gICAgbGV0IHBiZiA9IHZ0cGJmKGdlb2pzb25XcmFwcGVyKTtcbiAgICBpZiAocGJmLmJ5dGVPZmZzZXQgIT09IDAgfHwgcGJmLmJ5dGVMZW5ndGggIT09IHBiZi5idWZmZXIuYnl0ZUxlbmd0aCkge1xuICAgICAgICAvLyBDb21wYXRpYmlsaXR5IHdpdGggbm9kZSBCdWZmZXIgKGh0dHBzOi8vZ2l0aHViLmNvbS9tYXBib3gvcGJmL2lzc3Vlcy8zNSlcbiAgICAgICAgcGJmID0gbmV3IFVpbnQ4QXJyYXkocGJmKTtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIHZlY3RvclRpbGU6IGdlb2pzb25XcmFwcGVyLFxuICAgICAgICByYXdEYXRhOiBwYmYuYnVmZmVyXG4gICAgfSk7XG59XG5cbmV4cG9ydCB0eXBlIFNvdXJjZVN0YXRlID1cbiAgICB8ICdJZGxlJyAgICAgICAgICAgIC8vIFNvdXJjZSBlbXB0eSBvciBkYXRhIGxvYWRlZFxuICAgIHwgJ0NvYWxlc2NpbmcnICAgICAgLy8gRGF0YSBmaW5pc2hlZCBsb2FkaW5nLCBidXQgZGlzY2FyZCAnbG9hZERhdGEnIG1lc3NhZ2VzIHVudGlsIHJlY2VpdmluZyAnY29hbGVzY2VkJ1xuICAgIHwgJ05lZWRzTG9hZERhdGEnOyAgLy8gJ2xvYWREYXRhJyByZWNlaXZlZCB3aGlsZSBjb2FsZXNjaW5nLCB0cmlnZ2VyIG9uZSBtb3JlICdsb2FkRGF0YScgb24gcmVjZWl2aW5nICdjb2FsZXNjZWQnXG5cbi8qKlxuICogVGhlIHtAbGluayBXb3JrZXJTb3VyY2V9IGltcGxlbWVudGF0aW9uIHRoYXQgc3VwcG9ydHMge0BsaW5rIEdlb0pTT05Tb3VyY2V9LlxuICogVGhpcyBjbGFzcyBpcyBkZXNpZ25lZCB0byBiZSBlYXNpbHkgcmV1c2VkIHRvIHN1cHBvcnQgY3VzdG9tIHNvdXJjZSB0eXBlc1xuICogZm9yIGRhdGEgZm9ybWF0cyB0aGF0IGNhbiBiZSBwYXJzZWQvY29udmVydGVkIGludG8gYW4gaW4tbWVtb3J5IEdlb0pTT05cbiAqIHJlcHJlc2VudGF0aW9uLiAgVG8gZG8gc28sIGNyZWF0ZSBpdCB3aXRoXG4gKiBgbmV3IEdlb0pTT05Xb3JrZXJTb3VyY2UoYWN0b3IsIGxheWVySW5kZXgsIGN1c3RvbUxvYWRHZW9KU09ORnVuY3Rpb24pYC5cbiAqIEZvciBhIGZ1bGwgZXhhbXBsZSwgc2VlIFttYXBib3gtZ2wtdG9wb2pzb25dKGh0dHBzOi8vZ2l0aHViLmNvbS9kZXZlbG9wbWVudHNlZWQvbWFwYm94LWdsLXRvcG9qc29uKS5cbiAqXG4gKiBAcHJpdmF0ZVxuICovXG5jbGFzcyBHZW9KU09OV29ya2VyU291cmNlIGV4dGVuZHMgVmVjdG9yVGlsZVdvcmtlclNvdXJjZSB7XG4gICAgbG9hZEdlb0pTT046IExvYWRHZW9KU09OO1xuICAgIF9zdGF0ZTogU291cmNlU3RhdGU7XG4gICAgX3BlbmRpbmdDYWxsYmFjazogQ2FsbGJhY2s8e1xuICAgICAgICByZXNvdXJjZVRpbWluZz86IHtbXzogc3RyaW5nXTogQXJyYXk8UGVyZm9ybWFuY2VSZXNvdXJjZVRpbWluZz59LFxuICAgICAgICBhYmFuZG9uZWQ/OiBib29sZWFuIH0+O1xuICAgIF9wZW5kaW5nTG9hZERhdGFQYXJhbXM6IExvYWRHZW9KU09OUGFyYW1ldGVycztcbiAgICBfZ2VvSlNPTkluZGV4OiBHZW9KU09OSW5kZXhcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBbbG9hZEdlb0pTT05dIE9wdGlvbmFsIG1ldGhvZCBmb3IgY3VzdG9tIGxvYWRpbmcvcGFyc2luZyBvZlxuICAgICAqIEdlb0pTT04gYmFzZWQgb24gcGFyYW1ldGVycyBwYXNzZWQgZnJvbSB0aGUgbWFpbi10aHJlYWQgU291cmNlLlxuICAgICAqIFNlZSB7QGxpbmsgR2VvSlNPTldvcmtlclNvdXJjZSNsb2FkR2VvSlNPTn0uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhY3RvcjogQWN0b3IsIGxheWVySW5kZXg6IFN0eWxlTGF5ZXJJbmRleCwgYXZhaWxhYmxlSW1hZ2VzOiBBcnJheTxzdHJpbmc+LCBsb2FkR2VvSlNPTjogP0xvYWRHZW9KU09OKSB7XG4gICAgICAgIHN1cGVyKGFjdG9yLCBsYXllckluZGV4LCBhdmFpbGFibGVJbWFnZXMsIGxvYWRHZW9KU09OVGlsZSk7XG4gICAgICAgIGlmIChsb2FkR2VvSlNPTikge1xuICAgICAgICAgICAgdGhpcy5sb2FkR2VvSlNPTiA9IGxvYWRHZW9KU09OO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmV0Y2hlcyAoaWYgYXBwcm9wcmlhdGUpLCBwYXJzZXMsIGFuZCBpbmRleCBnZW9qc29uIGRhdGEgaW50byB0aWxlcy4gVGhpc1xuICAgICAqIHByZXBhcmF0b3J5IG1ldGhvZCBtdXN0IGJlIGNhbGxlZCBiZWZvcmUge0BsaW5rIEdlb0pTT05Xb3JrZXJTb3VyY2UjbG9hZFRpbGV9XG4gICAgICogY2FuIGNvcnJlY3RseSBzZXJ2ZSB1cCB0aWxlcy5cbiAgICAgKlxuICAgICAqIERlZmVycyB0byB7QGxpbmsgR2VvSlNPTldvcmtlclNvdXJjZSNsb2FkR2VvSlNPTn0gZm9yIHRoZSBmZXRjaGluZy9wYXJzaW5nLFxuICAgICAqIGV4cGVjdGluZyBgY2FsbGJhY2soZXJyb3IsIGRhdGEpYCB0byBiZSBjYWxsZWQgd2l0aCBlaXRoZXIgYW4gZXJyb3Igb3IgYVxuICAgICAqIHBhcnNlZCBHZW9KU09OIG9iamVjdC5cbiAgICAgKlxuICAgICAqIFdoZW4gYGxvYWREYXRhYCByZXF1ZXN0cyBjb21lIGluIGZhc3RlciB0aGFuIHRoZXkgY2FuIGJlIHByb2Nlc3NlZCxcbiAgICAgKiB0aGV5IGFyZSBjb2FsZXNjZWQgaW50byBhIHNpbmdsZSByZXF1ZXN0IHVzaW5nIHRoZSBsYXRlc3QgZGF0YS5cbiAgICAgKiBTZWUge0BsaW5rIEdlb0pTT05Xb3JrZXJTb3VyY2UjY29hbGVzY2V9XG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGFyYW1zXG4gICAgICogQHBhcmFtIGNhbGxiYWNrXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsb2FkRGF0YShwYXJhbXM6IExvYWRHZW9KU09OUGFyYW1ldGVycywgY2FsbGJhY2s6IENhbGxiYWNrPHtcbiAgICAgICAgcmVzb3VyY2VUaW1pbmc/OiB7W186IHN0cmluZ106IEFycmF5PFBlcmZvcm1hbmNlUmVzb3VyY2VUaW1pbmc+fSxcbiAgICAgICAgYWJhbmRvbmVkPzogYm9vbGVhbiB9Pikge1xuICAgICAgICBpZiAodGhpcy5fcGVuZGluZ0NhbGxiYWNrKSB7XG4gICAgICAgICAgICAvLyBUZWxsIHRoZSBmb3JlZ3JvdW5kIHRoZSBwcmV2aW91cyBjYWxsIGhhcyBiZWVuIGFiYW5kb25lZFxuICAgICAgICAgICAgdGhpcy5fcGVuZGluZ0NhbGxiYWNrKG51bGwsIHthYmFuZG9uZWQ6IHRydWV9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wZW5kaW5nQ2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgICAgICAgdGhpcy5fcGVuZGluZ0xvYWREYXRhUGFyYW1zID0gcGFyYW1zO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAmJlxuICAgICAgICAgICAgdGhpcy5fc3RhdGUgIT09ICdJZGxlJykge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSAnTmVlZHNMb2FkRGF0YSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9ICdDb2FsZXNjaW5nJztcbiAgICAgICAgICAgIHRoaXMuX2xvYWREYXRhKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbjogY2FsbGVkIGRpcmVjdGx5IGJ5IGBsb2FkRGF0YWBcbiAgICAgKiBvciBieSBgY29hbGVzY2VgIHVzaW5nIHN0b3JlZCBwYXJhbWV0ZXJzLlxuICAgICAqL1xuICAgIF9sb2FkRGF0YSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wZW5kaW5nQ2FsbGJhY2sgfHwgIXRoaXMuX3BlbmRpbmdMb2FkRGF0YVBhcmFtcykge1xuICAgICAgICAgICAgYXNzZXJ0KGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjYWxsYmFjayA9IHRoaXMuX3BlbmRpbmdDYWxsYmFjaztcbiAgICAgICAgY29uc3QgcGFyYW1zID0gdGhpcy5fcGVuZGluZ0xvYWREYXRhUGFyYW1zO1xuICAgICAgICBkZWxldGUgdGhpcy5fcGVuZGluZ0NhbGxiYWNrO1xuICAgICAgICBkZWxldGUgdGhpcy5fcGVuZGluZ0xvYWREYXRhUGFyYW1zO1xuXG4gICAgICAgIGNvbnN0IHBlcmYgPSAocGFyYW1zICYmIHBhcmFtcy5yZXF1ZXN0ICYmIHBhcmFtcy5yZXF1ZXN0LmNvbGxlY3RSZXNvdXJjZVRpbWluZykgP1xuICAgICAgICAgICAgbmV3IFJlcXVlc3RQZXJmb3JtYW5jZShwYXJhbXMucmVxdWVzdCkgOiBmYWxzZTtcblxuICAgICAgICB0aGlzLmxvYWRHZW9KU09OKHBhcmFtcywgKGVycjogP0Vycm9yLCBkYXRhOiA/T2JqZWN0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyIHx8ICFkYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoYElucHV0IGRhdGEgZ2l2ZW4gdG8gJyR7cGFyYW1zLnNvdXJjZX0nIGlzIG5vdCBhIHZhbGlkIEdlb0pTT04gb2JqZWN0LmApKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV3aW5kKGRhdGEsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmFtcy5maWx0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBpbGVkID0gY3JlYXRlRXhwcmVzc2lvbihwYXJhbXMuZmlsdGVyLCB7dHlwZTogJ2Jvb2xlYW4nLCAncHJvcGVydHktdHlwZSc6ICdkYXRhLWRyaXZlbicsIG92ZXJyaWRhYmxlOiBmYWxzZSwgdHJhbnNpdGlvbjogZmFsc2V9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb21waWxlZC5yZXN1bHQgPT09ICdlcnJvcicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGNvbXBpbGVkLnZhbHVlLm1hcChlcnIgPT4gYCR7ZXJyLmtleX06ICR7ZXJyLm1lc3NhZ2V9YCkuam9pbignLCAnKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZlYXR1cmVzID0gZGF0YS5mZWF0dXJlcy5maWx0ZXIoZmVhdHVyZSA9PiBjb21waWxlZC52YWx1ZS5ldmFsdWF0ZSh7em9vbTogMH0sIGZlYXR1cmUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSB7dHlwZTogJ0ZlYXR1cmVDb2xsZWN0aW9uJywgZmVhdHVyZXN9O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2VvSlNPTkluZGV4ID0gcGFyYW1zLmNsdXN0ZXIgP1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFN1cGVyY2x1c3RlcihnZXRTdXBlcmNsdXN0ZXJPcHRpb25zKHBhcmFtcykpLmxvYWQoZGF0YS5mZWF0dXJlcykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2VvanNvbnZ0KGRhdGEsIHBhcmFtcy5nZW9qc29uVnRPcHRpb25zKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkZWQgPSB7fTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgICAgICAgICAgIGlmIChwZXJmKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc291cmNlVGltaW5nRGF0YSA9IHBlcmYuZmluaXNoKCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGl0J3MgbmVjZXNzYXJ5IHRvIGV2YWwgdGhlIHJlc3VsdCBvZiBnZXRFbnRyaWVzQnlOYW1lKCkgaGVyZSB2aWEgcGFyc2Uvc3RyaW5naWZ5XG4gICAgICAgICAgICAgICAgICAgIC8vIGxhdGUgZXZhbHVhdGlvbiBpbiB0aGUgbWFpbiB0aHJlYWQgY2F1c2VzIFR5cGVFcnJvcjogaWxsZWdhbCBpbnZvY2F0aW9uXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXNvdXJjZVRpbWluZ0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5yZXNvdXJjZVRpbWluZyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnJlc291cmNlVGltaW5nW3BhcmFtcy5zb3VyY2VdID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShyZXNvdXJjZVRpbWluZ0RhdGEpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaGlsZSBwcm9jZXNzaW5nIGBsb2FkRGF0YWAsIHdlIGNvYWxlc2NlIGFsbCBmdXJ0aGVyXG4gICAgICogYGxvYWREYXRhYCBtZXNzYWdlcyBpbnRvIGEgc2luZ2xlIGNhbGwgdG8gX2xvYWREYXRhXG4gICAgICogdGhhdCB3aWxsIGhhcHBlbiBvbmNlIHdlJ3ZlIGZpbmlzaGVkIHByb2Nlc3NpbmcgdGhlXG4gICAgICogZmlyc3QgbWVzc2FnZS4ge0BsaW5rIEdlb0pTT05Tb3VyY2UjX3VwZGF0ZVdvcmtlckRhdGF9XG4gICAgICogaXMgcmVzcG9uc2libGUgZm9yIHNlbmRpbmcgdXMgdGhlIGBjb2FsZXNjZWAgbWVzc2FnZVxuICAgICAqIGF0IHRoZSB0aW1lIGl0IHJlY2VpdmVzIGEgcmVzcG9uc2UgZnJvbSBgbG9hZERhdGFgXG4gICAgICpcbiAgICAgKiAgICAgICAgICBTdGF0ZTogSWRsZVxuICAgICAqICAgICAgICAgIOKGkSAgICAgICAgICB8XG4gICAgICogICAgICdjb2FsZXNjZScgICAnbG9hZERhdGEnXG4gICAgICogICAgICAgICAgfCAgICAgKHRyaWdnZXJzIGxvYWQpXG4gICAgICogICAgICAgICAgfCAgICAgICAgICDihpNcbiAgICAgKiAgICAgICAgU3RhdGU6IENvYWxlc2NpbmdcbiAgICAgKiAgICAgICAgICDihpEgICAgICAgICAgfFxuICAgICAqICAgKHRyaWdnZXJzIGxvYWQpICAgfFxuICAgICAqICAgICAnY29hbGVzY2UnICAgJ2xvYWREYXRhJ1xuICAgICAqICAgICAgICAgIHwgICAgICAgICAg4oaTXG4gICAgICogICAgICAgIFN0YXRlOiBOZWVkc0xvYWREYXRhXG4gICAgICovXG4gICAgY29hbGVzY2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gJ0NvYWxlc2NpbmcnKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9ICdJZGxlJztcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9zdGF0ZSA9PT0gJ05lZWRzTG9hZERhdGEnKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9ICdDb2FsZXNjaW5nJztcbiAgICAgICAgICAgIHRoaXMuX2xvYWREYXRhKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAqIEltcGxlbWVudHMge0BsaW5rIFdvcmtlclNvdXJjZSNyZWxvYWRUaWxlfS5cbiAgICAqXG4gICAgKiBJZiB0aGUgdGlsZSBpcyBsb2FkZWQsIHVzZXMgdGhlIGltcGxlbWVudGF0aW9uIGluIFZlY3RvclRpbGVXb3JrZXJTb3VyY2UuXG4gICAgKiBPdGhlcndpc2UsIHN1Y2ggYXMgYWZ0ZXIgYSBzZXREYXRhKCkgY2FsbCwgd2UgbG9hZCB0aGUgdGlsZSBmcmVzaC5cbiAgICAqXG4gICAgKiBAcGFyYW0gcGFyYW1zXG4gICAgKiBAcGFyYW0gcGFyYW1zLnVpZCBUaGUgVUlEIGZvciB0aGlzIHRpbGUuXG4gICAgKiBAcHJpdmF0ZVxuICAgICovXG4gICAgcmVsb2FkVGlsZShwYXJhbXM6IFdvcmtlclRpbGVQYXJhbWV0ZXJzLCBjYWxsYmFjazogV29ya2VyVGlsZUNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IGxvYWRlZCA9IHRoaXMubG9hZGVkLFxuICAgICAgICAgICAgdWlkID0gcGFyYW1zLnVpZDtcblxuICAgICAgICBpZiAobG9hZGVkICYmIGxvYWRlZFt1aWRdKSB7XG4gICAgICAgICAgICByZXR1cm4gc3VwZXIucmVsb2FkVGlsZShwYXJhbXMsIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxvYWRUaWxlKHBhcmFtcywgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmV0Y2ggYW5kIHBhcnNlIEdlb0pTT04gYWNjb3JkaW5nIHRvIHRoZSBnaXZlbiBwYXJhbXMuICBDYWxscyBgY2FsbGJhY2tgXG4gICAgICogd2l0aCBgKGVyciwgZGF0YSlgLCB3aGVyZSBgZGF0YWAgaXMgYSBwYXJzZWQgR2VvSlNPTiBvYmplY3QuXG4gICAgICpcbiAgICAgKiBHZW9KU09OIGlzIGxvYWRlZCBhbmQgcGFyc2VkIGZyb20gYHBhcmFtcy51cmxgIGlmIGl0IGV4aXN0cywgb3IgZWxzZVxuICAgICAqIGV4cGVjdGVkIGFzIGEgbGl0ZXJhbCAoc3RyaW5nIG9yIG9iamVjdCkgYHBhcmFtcy5kYXRhYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYXJhbXNcbiAgICAgKiBAcGFyYW0gW3BhcmFtcy51cmxdIEEgVVJMIHRvIHRoZSByZW1vdGUgR2VvSlNPTiBkYXRhLlxuICAgICAqIEBwYXJhbSBbcGFyYW1zLmRhdGFdIExpdGVyYWwgR2VvSlNPTiBkYXRhLiBNdXN0IGJlIHByb3ZpZGVkIGlmIGBwYXJhbXMudXJsYCBpcyBub3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsb2FkR2VvSlNPTihwYXJhbXM6IExvYWRHZW9KU09OUGFyYW1ldGVycywgY2FsbGJhY2s6IFJlc3BvbnNlQ2FsbGJhY2s8T2JqZWN0Pikge1xuICAgICAgICAvLyBCZWNhdXNlIG9mIHNhbWUgb3JpZ2luIGlzc3VlcywgdXJscyBtdXN0IGVpdGhlciBpbmNsdWRlIGFuIGV4cGxpY2l0XG4gICAgICAgIC8vIG9yaWdpbiBvciBhYnNvbHV0ZSBwYXRoLlxuICAgICAgICAvLyBpZTogL2Zvby9iYXIuanNvbiBvciBodHRwOi8vZXhhbXBsZS5jb20vYmFyLmpzb25cbiAgICAgICAgLy8gYnV0IG5vdCAuLi9mb28vYmFyLmpzb25cbiAgICAgICAgaWYgKHBhcmFtcy5yZXF1ZXN0KSB7XG4gICAgICAgICAgICBnZXRKU09OKHBhcmFtcy5yZXF1ZXN0LCBjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHBhcmFtcy5kYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgSlNPTi5wYXJzZShwYXJhbXMuZGF0YSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoYElucHV0IGRhdGEgZ2l2ZW4gdG8gJyR7cGFyYW1zLnNvdXJjZX0nIGlzIG5vdCBhIHZhbGlkIEdlb0pTT04gb2JqZWN0LmApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoYElucHV0IGRhdGEgZ2l2ZW4gdG8gJyR7cGFyYW1zLnNvdXJjZX0nIGlzIG5vdCBhIHZhbGlkIEdlb0pTT04gb2JqZWN0LmApKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZVNvdXJjZShwYXJhbXM6IHtzb3VyY2U6IHN0cmluZ30sIGNhbGxiYWNrOiBDYWxsYmFjazxtaXhlZD4pIHtcbiAgICAgICAgaWYgKHRoaXMuX3BlbmRpbmdDYWxsYmFjaykge1xuICAgICAgICAgICAgLy8gRG9uJ3QgbGVhayBjYWxsYmFja3NcbiAgICAgICAgICAgIHRoaXMuX3BlbmRpbmdDYWxsYmFjayhudWxsLCB7YWJhbmRvbmVkOiB0cnVlfSk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBnZXRDbHVzdGVyRXhwYW5zaW9uWm9vbShwYXJhbXM6IHtjbHVzdGVySWQ6IG51bWJlcn0sIGNhbGxiYWNrOiBDYWxsYmFjazxudW1iZXI+KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLl9nZW9KU09OSW5kZXguZ2V0Q2x1c3RlckV4cGFuc2lvblpvb20ocGFyYW1zLmNsdXN0ZXJJZCkpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldENsdXN0ZXJDaGlsZHJlbihwYXJhbXM6IHtjbHVzdGVySWQ6IG51bWJlcn0sIGNhbGxiYWNrOiBDYWxsYmFjazxBcnJheTxHZW9KU09ORmVhdHVyZT4+KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0aGlzLl9nZW9KU09OSW5kZXguZ2V0Q2hpbGRyZW4ocGFyYW1zLmNsdXN0ZXJJZCkpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldENsdXN0ZXJMZWF2ZXMocGFyYW1zOiB7Y2x1c3RlcklkOiBudW1iZXIsIGxpbWl0OiBudW1iZXIsIG9mZnNldDogbnVtYmVyfSwgY2FsbGJhY2s6IENhbGxiYWNrPEFycmF5PEdlb0pTT05GZWF0dXJlPj4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMuX2dlb0pTT05JbmRleC5nZXRMZWF2ZXMocGFyYW1zLmNsdXN0ZXJJZCwgcGFyYW1zLmxpbWl0LCBwYXJhbXMub2Zmc2V0KSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRTdXBlcmNsdXN0ZXJPcHRpb25zKHtzdXBlcmNsdXN0ZXJPcHRpb25zLCBjbHVzdGVyUHJvcGVydGllc30pIHtcbiAgICBpZiAoIWNsdXN0ZXJQcm9wZXJ0aWVzIHx8ICFzdXBlcmNsdXN0ZXJPcHRpb25zKSByZXR1cm4gc3VwZXJjbHVzdGVyT3B0aW9ucztcblxuICAgIGNvbnN0IG1hcEV4cHJlc3Npb25zID0ge307XG4gICAgY29uc3QgcmVkdWNlRXhwcmVzc2lvbnMgPSB7fTtcbiAgICBjb25zdCBnbG9iYWxzID0ge2FjY3VtdWxhdGVkOiBudWxsLCB6b29tOiAwfTtcbiAgICBjb25zdCBmZWF0dXJlID0ge3Byb3BlcnRpZXM6IG51bGx9O1xuICAgIGNvbnN0IHByb3BlcnR5TmFtZXMgPSBPYmplY3Qua2V5cyhjbHVzdGVyUHJvcGVydGllcyk7XG5cbiAgICBmb3IgKGNvbnN0IGtleSBvZiBwcm9wZXJ0eU5hbWVzKSB7XG4gICAgICAgIGNvbnN0IFtvcGVyYXRvciwgbWFwRXhwcmVzc2lvbl0gPSBjbHVzdGVyUHJvcGVydGllc1trZXldO1xuXG4gICAgICAgIGNvbnN0IG1hcEV4cHJlc3Npb25QYXJzZWQgPSBjcmVhdGVFeHByZXNzaW9uKG1hcEV4cHJlc3Npb24pO1xuICAgICAgICBjb25zdCByZWR1Y2VFeHByZXNzaW9uUGFyc2VkID0gY3JlYXRlRXhwcmVzc2lvbihcbiAgICAgICAgICAgIHR5cGVvZiBvcGVyYXRvciA9PT0gJ3N0cmluZycgPyBbb3BlcmF0b3IsIFsnYWNjdW11bGF0ZWQnXSwgWydnZXQnLCBrZXldXSA6IG9wZXJhdG9yKTtcblxuICAgICAgICBhc3NlcnQobWFwRXhwcmVzc2lvblBhcnNlZC5yZXN1bHQgPT09ICdzdWNjZXNzJyk7XG4gICAgICAgIGFzc2VydChyZWR1Y2VFeHByZXNzaW9uUGFyc2VkLnJlc3VsdCA9PT0gJ3N1Y2Nlc3MnKTtcblxuICAgICAgICBtYXBFeHByZXNzaW9uc1trZXldID0gbWFwRXhwcmVzc2lvblBhcnNlZC52YWx1ZTtcbiAgICAgICAgcmVkdWNlRXhwcmVzc2lvbnNba2V5XSA9IHJlZHVjZUV4cHJlc3Npb25QYXJzZWQudmFsdWU7XG4gICAgfVxuXG4gICAgc3VwZXJjbHVzdGVyT3B0aW9ucy5tYXAgPSAocG9pbnRQcm9wZXJ0aWVzKSA9PiB7XG4gICAgICAgIGZlYXR1cmUucHJvcGVydGllcyA9IHBvaW50UHJvcGVydGllcztcbiAgICAgICAgY29uc3QgcHJvcGVydGllcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBwcm9wZXJ0eU5hbWVzKSB7XG4gICAgICAgICAgICBwcm9wZXJ0aWVzW2tleV0gPSBtYXBFeHByZXNzaW9uc1trZXldLmV2YWx1YXRlKGdsb2JhbHMsIGZlYXR1cmUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgIH07XG4gICAgc3VwZXJjbHVzdGVyT3B0aW9ucy5yZWR1Y2UgPSAoYWNjdW11bGF0ZWQsIGNsdXN0ZXJQcm9wZXJ0aWVzKSA9PiB7XG4gICAgICAgIGZlYXR1cmUucHJvcGVydGllcyA9IGNsdXN0ZXJQcm9wZXJ0aWVzO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBwcm9wZXJ0eU5hbWVzKSB7XG4gICAgICAgICAgICBnbG9iYWxzLmFjY3VtdWxhdGVkID0gYWNjdW11bGF0ZWRba2V5XTtcbiAgICAgICAgICAgIGFjY3VtdWxhdGVkW2tleV0gPSByZWR1Y2VFeHByZXNzaW9uc1trZXldLmV2YWx1YXRlKGdsb2JhbHMsIGZlYXR1cmUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBzdXBlcmNsdXN0ZXJPcHRpb25zO1xufVxuXG5leHBvcnQgZGVmYXVsdCBHZW9KU09OV29ya2VyU291cmNlO1xuIiwiLy8gQGZsb3dcblxuaW1wb3J0IEFjdG9yIGZyb20gJy4uL3V0aWwvYWN0b3InO1xuXG5pbXBvcnQgU3R5bGVMYXllckluZGV4IGZyb20gJy4uL3N0eWxlL3N0eWxlX2xheWVyX2luZGV4JztcbmltcG9ydCBWZWN0b3JUaWxlV29ya2VyU291cmNlIGZyb20gJy4vdmVjdG9yX3RpbGVfd29ya2VyX3NvdXJjZSc7XG5pbXBvcnQgUmFzdGVyREVNVGlsZVdvcmtlclNvdXJjZSBmcm9tICcuL3Jhc3Rlcl9kZW1fdGlsZV93b3JrZXJfc291cmNlJztcbmltcG9ydCBHZW9KU09OV29ya2VyU291cmNlIGZyb20gJy4vZ2VvanNvbl93b3JrZXJfc291cmNlJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7cGx1Z2luIGFzIGdsb2JhbFJUTFRleHRQbHVnaW59IGZyb20gJy4vcnRsX3RleHRfcGx1Z2luJztcbmltcG9ydCB7ZW5mb3JjZUNhY2hlU2l6ZUxpbWl0fSBmcm9tICcuLi91dGlsL3RpbGVfcmVxdWVzdF9jYWNoZSc7XG5cbmltcG9ydCB0eXBlIHtcbiAgICBXb3JrZXJTb3VyY2UsXG4gICAgV29ya2VyVGlsZVBhcmFtZXRlcnMsXG4gICAgV29ya2VyREVNVGlsZVBhcmFtZXRlcnMsXG4gICAgV29ya2VyVGlsZUNhbGxiYWNrLFxuICAgIFdvcmtlckRFTVRpbGVDYWxsYmFjayxcbiAgICBUaWxlUGFyYW1ldGVyc1xufSBmcm9tICcuLi9zb3VyY2Uvd29ya2VyX3NvdXJjZSc7XG5cbmltcG9ydCB0eXBlIHtXb3JrZXJHbG9iYWxTY29wZUludGVyZmFjZX0gZnJvbSAnLi4vdXRpbC93ZWJfd29ya2VyJztcbmltcG9ydCB0eXBlIHtDYWxsYmFja30gZnJvbSAnLi4vdHlwZXMvY2FsbGJhY2snO1xuaW1wb3J0IHR5cGUge0xheWVyU3BlY2lmaWNhdGlvbn0gZnJvbSAnLi4vc3R5bGUtc3BlYy90eXBlcyc7XG5pbXBvcnQgdHlwZSB7UGx1Z2luU3RhdGV9IGZyb20gJy4vcnRsX3RleHRfcGx1Z2luJztcblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBXb3JrZXIge1xuICAgIHNlbGY6IFdvcmtlckdsb2JhbFNjb3BlSW50ZXJmYWNlO1xuICAgIGFjdG9yOiBBY3RvcjtcbiAgICBsYXllckluZGV4ZXM6IHtbXzogc3RyaW5nXTogU3R5bGVMYXllckluZGV4IH07XG4gICAgYXZhaWxhYmxlSW1hZ2VzOiB7W186IHN0cmluZ106IEFycmF5PHN0cmluZz4gfTtcbiAgICB3b3JrZXJTb3VyY2VUeXBlczoge1tfOiBzdHJpbmddOiBDbGFzczxXb3JrZXJTb3VyY2U+IH07XG4gICAgd29ya2VyU291cmNlczoge1tfOiBzdHJpbmddOiB7W186IHN0cmluZ106IHtbXzogc3RyaW5nXTogV29ya2VyU291cmNlIH0gfSB9O1xuICAgIGRlbVdvcmtlclNvdXJjZXM6IHtbXzogc3RyaW5nXToge1tfOiBzdHJpbmddOiBSYXN0ZXJERU1UaWxlV29ya2VyU291cmNlIH0gfTtcbiAgICByZWZlcnJlcjogP3N0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKHNlbGY6IFdvcmtlckdsb2JhbFNjb3BlSW50ZXJmYWNlKSB7XG4gICAgICAgIGRlYnVnZ2VyO1xuXG4gICAgICAgIHRoaXMuc2VsZiA9IHNlbGY7XG4gICAgICAgIHRoaXMuYWN0b3IgPSBuZXcgQWN0b3Ioc2VsZiwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5sYXllckluZGV4ZXMgPSB7fTtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVJbWFnZXMgPSB7fTtcblxuICAgICAgICB0aGlzLndvcmtlclNvdXJjZVR5cGVzID0ge1xuICAgICAgICAgICAgdmVjdG9yOiBWZWN0b3JUaWxlV29ya2VyU291cmNlLFxuICAgICAgICAgICAgZ2VvanNvbjogR2VvSlNPTldvcmtlclNvdXJjZVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFttYXBJZF1bc291cmNlVHlwZV1bc291cmNlTmFtZV0gPT4gd29ya2VyIHNvdXJjZSBpbnN0YW5jZVxuICAgICAgICB0aGlzLndvcmtlclNvdXJjZXMgPSB7fTtcbiAgICAgICAgdGhpcy5kZW1Xb3JrZXJTb3VyY2VzID0ge307XG5cbiAgICAgICAgdGhpcy5zZWxmLnJlZ2lzdGVyV29ya2VyU291cmNlID0gKG5hbWU6IHN0cmluZywgV29ya2VyU291cmNlOiBDbGFzczxXb3JrZXJTb3VyY2U+KSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy53b3JrZXJTb3VyY2VUeXBlc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgV29ya2VyIHNvdXJjZSB3aXRoIG5hbWUgXCIke25hbWV9XCIgYWxyZWFkeSByZWdpc3RlcmVkLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy53b3JrZXJTb3VyY2VUeXBlc1tuYW1lXSA9IFdvcmtlclNvdXJjZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUaGlzIGlzIGludm9rZWQgYnkgdGhlIFJUTCB0ZXh0IHBsdWdpbiB3aGVuIHRoZSBkb3dubG9hZCB2aWEgdGhlIGBpbXBvcnRTY3JpcHRzYCBjYWxsIGhhcyBmaW5pc2hlZCwgYW5kIHRoZSBjb2RlIGhhcyBiZWVuIHBhcnNlZC5cbiAgICAgICAgdGhpcy5zZWxmLnJlZ2lzdGVyUlRMVGV4dFBsdWdpbiA9IChydGxUZXh0UGx1Z2luOiB7YXBwbHlBcmFiaWNTaGFwaW5nOiBGdW5jdGlvbiwgcHJvY2Vzc0JpZGlyZWN0aW9uYWxUZXh0OiBGdW5jdGlvbiwgcHJvY2Vzc1N0eWxlZEJpZGlyZWN0aW9uYWxUZXh0PzogRnVuY3Rpb259KSA9PiB7XG4gICAgICAgICAgICBpZiAoZ2xvYmFsUlRMVGV4dFBsdWdpbi5pc1BhcnNlZCgpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdSVEwgdGV4dCBwbHVnaW4gYWxyZWFkeSByZWdpc3RlcmVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZ2xvYmFsUlRMVGV4dFBsdWdpblsnYXBwbHlBcmFiaWNTaGFwaW5nJ10gPSBydGxUZXh0UGx1Z2luLmFwcGx5QXJhYmljU2hhcGluZztcbiAgICAgICAgICAgIGdsb2JhbFJUTFRleHRQbHVnaW5bJ3Byb2Nlc3NCaWRpcmVjdGlvbmFsVGV4dCddID0gcnRsVGV4dFBsdWdpbi5wcm9jZXNzQmlkaXJlY3Rpb25hbFRleHQ7XG4gICAgICAgICAgICBnbG9iYWxSVExUZXh0UGx1Z2luWydwcm9jZXNzU3R5bGVkQmlkaXJlY3Rpb25hbFRleHQnXSA9IHJ0bFRleHRQbHVnaW4ucHJvY2Vzc1N0eWxlZEJpZGlyZWN0aW9uYWxUZXh0O1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHNldFJlZmVycmVyKG1hcElEOiBzdHJpbmcsIHJlZmVycmVyOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5yZWZlcnJlciA9IHJlZmVycmVyO1xuICAgIH1cblxuICAgIHNldEltYWdlcyhtYXBJZDogc3RyaW5nLCBpbWFnZXM6IEFycmF5PHN0cmluZz4sIGNhbGxiYWNrOiBXb3JrZXJUaWxlQ2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5hdmFpbGFibGVJbWFnZXNbbWFwSWRdID0gaW1hZ2VzO1xuICAgICAgICBmb3IgKGNvbnN0IHdvcmtlclNvdXJjZSBpbiB0aGlzLndvcmtlclNvdXJjZXNbbWFwSWRdKSB7XG4gICAgICAgICAgICBjb25zdCB3cyA9IHRoaXMud29ya2VyU291cmNlc1ttYXBJZF1bd29ya2VyU291cmNlXTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlIGluIHdzKSB7XG4gICAgICAgICAgICAgICAgd3Nbc291cmNlXS5hdmFpbGFibGVJbWFnZXMgPSBpbWFnZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBzZXRMYXllcnMobWFwSWQ6IHN0cmluZywgbGF5ZXJzOiBBcnJheTxMYXllclNwZWNpZmljYXRpb24+LCBjYWxsYmFjazogV29ya2VyVGlsZUNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZ2V0TGF5ZXJJbmRleChtYXBJZCkucmVwbGFjZShsYXllcnMpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH1cblxuICAgIHVwZGF0ZUxheWVycyhtYXBJZDogc3RyaW5nLCBwYXJhbXM6IHtsYXllcnM6IEFycmF5PExheWVyU3BlY2lmaWNhdGlvbj4sIHJlbW92ZWRJZHM6IEFycmF5PHN0cmluZz59LCBjYWxsYmFjazogV29ya2VyVGlsZUNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZ2V0TGF5ZXJJbmRleChtYXBJZCkudXBkYXRlKHBhcmFtcy5sYXllcnMsIHBhcmFtcy5yZW1vdmVkSWRzKTtcbiAgICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBsb2FkVGlsZShtYXBJZDogc3RyaW5nLCBwYXJhbXM6IFdvcmtlclRpbGVQYXJhbWV0ZXJzICYge3R5cGU6IHN0cmluZ30sIGNhbGxiYWNrOiBXb3JrZXJUaWxlQ2FsbGJhY2spIHtcbiAgICAgICAgZGVidWdnZXI7XG5cbiAgICAgICAgYXNzZXJ0KHBhcmFtcy50eXBlKTtcbiAgICAgICAgdGhpcy5nZXRXb3JrZXJTb3VyY2UobWFwSWQsIHBhcmFtcy50eXBlLCBwYXJhbXMuc291cmNlKS5sb2FkVGlsZShwYXJhbXMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBsb2FkREVNVGlsZShtYXBJZDogc3RyaW5nLCBwYXJhbXM6IFdvcmtlckRFTVRpbGVQYXJhbWV0ZXJzLCBjYWxsYmFjazogV29ya2VyREVNVGlsZUNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZ2V0REVNV29ya2VyU291cmNlKG1hcElkLCBwYXJhbXMuc291cmNlKS5sb2FkVGlsZShwYXJhbXMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICByZWxvYWRUaWxlKG1hcElkOiBzdHJpbmcsIHBhcmFtczogV29ya2VyVGlsZVBhcmFtZXRlcnMgJiB7dHlwZTogc3RyaW5nfSwgY2FsbGJhY2s6IFdvcmtlclRpbGVDYWxsYmFjaykge1xuICAgICAgICBhc3NlcnQocGFyYW1zLnR5cGUpO1xuICAgICAgICB0aGlzLmdldFdvcmtlclNvdXJjZShtYXBJZCwgcGFyYW1zLnR5cGUsIHBhcmFtcy5zb3VyY2UpLnJlbG9hZFRpbGUocGFyYW1zLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgYWJvcnRUaWxlKG1hcElkOiBzdHJpbmcsIHBhcmFtczogVGlsZVBhcmFtZXRlcnMgJiB7dHlwZTogc3RyaW5nfSwgY2FsbGJhY2s6IFdvcmtlclRpbGVDYWxsYmFjaykge1xuICAgICAgICBhc3NlcnQocGFyYW1zLnR5cGUpO1xuICAgICAgICB0aGlzLmdldFdvcmtlclNvdXJjZShtYXBJZCwgcGFyYW1zLnR5cGUsIHBhcmFtcy5zb3VyY2UpLmFib3J0VGlsZShwYXJhbXMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICByZW1vdmVUaWxlKG1hcElkOiBzdHJpbmcsIHBhcmFtczogVGlsZVBhcmFtZXRlcnMgJiB7dHlwZTogc3RyaW5nfSwgY2FsbGJhY2s6IFdvcmtlclRpbGVDYWxsYmFjaykge1xuICAgICAgICBhc3NlcnQocGFyYW1zLnR5cGUpO1xuICAgICAgICB0aGlzLmdldFdvcmtlclNvdXJjZShtYXBJZCwgcGFyYW1zLnR5cGUsIHBhcmFtcy5zb3VyY2UpLnJlbW92ZVRpbGUocGFyYW1zLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgcmVtb3ZlREVNVGlsZShtYXBJZDogc3RyaW5nLCBwYXJhbXM6IFRpbGVQYXJhbWV0ZXJzKSB7XG4gICAgICAgIHRoaXMuZ2V0REVNV29ya2VyU291cmNlKG1hcElkLCBwYXJhbXMuc291cmNlKS5yZW1vdmVUaWxlKHBhcmFtcyk7XG4gICAgfVxuXG4gICAgcmVtb3ZlU291cmNlKG1hcElkOiBzdHJpbmcsIHBhcmFtczoge3NvdXJjZTogc3RyaW5nfSAmIHt0eXBlOiBzdHJpbmd9LCBjYWxsYmFjazogV29ya2VyVGlsZUNhbGxiYWNrKSB7XG4gICAgICAgIGFzc2VydChwYXJhbXMudHlwZSk7XG4gICAgICAgIGFzc2VydChwYXJhbXMuc291cmNlKTtcblxuICAgICAgICBpZiAoIXRoaXMud29ya2VyU291cmNlc1ttYXBJZF0gfHxcbiAgICAgICAgICAgICF0aGlzLndvcmtlclNvdXJjZXNbbWFwSWRdW3BhcmFtcy50eXBlXSB8fFxuICAgICAgICAgICAgIXRoaXMud29ya2VyU291cmNlc1ttYXBJZF1bcGFyYW1zLnR5cGVdW3BhcmFtcy5zb3VyY2VdKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3b3JrZXIgPSB0aGlzLndvcmtlclNvdXJjZXNbbWFwSWRdW3BhcmFtcy50eXBlXVtwYXJhbXMuc291cmNlXTtcbiAgICAgICAgZGVsZXRlIHRoaXMud29ya2VyU291cmNlc1ttYXBJZF1bcGFyYW1zLnR5cGVdW3BhcmFtcy5zb3VyY2VdO1xuXG4gICAgICAgIGlmICh3b3JrZXIucmVtb3ZlU291cmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHdvcmtlci5yZW1vdmVTb3VyY2UocGFyYW1zLCBjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhIHtAbGluayBXb3JrZXJTb3VyY2V9IHNjcmlwdCBhdCBwYXJhbXMudXJsLiAgVGhlIHNjcmlwdCBpcyBydW5cbiAgICAgKiAodXNpbmcgaW1wb3J0U2NyaXB0cykgd2l0aCBgcmVnaXN0ZXJXb3JrZXJTb3VyY2VgIGluIHNjb3BlLCB3aGljaCBpcyBhXG4gICAgICogZnVuY3Rpb24gdGFraW5nIGAobmFtZSwgd29ya2VyU291cmNlT2JqZWN0KWAuXG4gICAgICogIEBwcml2YXRlXG4gICAgICovXG4gICAgbG9hZFdvcmtlclNvdXJjZShtYXA6IHN0cmluZywgcGFyYW1zOiB7IHVybDogc3RyaW5nIH0sIGNhbGxiYWNrOiBDYWxsYmFjazx2b2lkPikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5zZWxmLmltcG9ydFNjcmlwdHMocGFyYW1zLnVybCk7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlLnRvU3RyaW5nKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3luY1JUTFBsdWdpblN0YXRlKG1hcDogc3RyaW5nLCBzdGF0ZTogUGx1Z2luU3RhdGUsIGNhbGxiYWNrOiBDYWxsYmFjazxib29sZWFuPikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZ2xvYmFsUlRMVGV4dFBsdWdpbi5zZXRTdGF0ZShzdGF0ZSk7XG4gICAgICAgICAgICBjb25zdCBwbHVnaW5VUkwgPSBnbG9iYWxSVExUZXh0UGx1Z2luLmdldFBsdWdpblVSTCgpO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGdsb2JhbFJUTFRleHRQbHVnaW4uaXNMb2FkZWQoKSAmJlxuICAgICAgICAgICAgICAgICFnbG9iYWxSVExUZXh0UGx1Z2luLmlzUGFyc2VkKCkgJiZcbiAgICAgICAgICAgICAgICBwbHVnaW5VUkwgIT0gbnVsbCAvLyBOb3QgcG9zc2libGUgd2hlbiBgaXNMb2FkZWRgIGlzIHRydWUsIGJ1dCBrZWVwcyBmbG93IGhhcHB5XG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGYuaW1wb3J0U2NyaXB0cyhwbHVnaW5VUkwpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBsZXRlID0gZ2xvYmFsUlRMVGV4dFBsdWdpbi5pc1BhcnNlZCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVycm9yID0gY29tcGxldGUgPyB1bmRlZmluZWQgOiBuZXcgRXJyb3IoYFJUTCBUZXh0IFBsdWdpbiBmYWlsZWQgdG8gaW1wb3J0IHNjcmlwdHMgZnJvbSAke3BsdWdpblVSTH1gKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvciwgY29tcGxldGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlLnRvU3RyaW5nKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0QXZhaWxhYmxlSW1hZ2VzKG1hcElkOiBzdHJpbmcpIHtcbiAgICAgICAgbGV0IGF2YWlsYWJsZUltYWdlcyA9IHRoaXMuYXZhaWxhYmxlSW1hZ2VzW21hcElkXTtcblxuICAgICAgICBpZiAoIWF2YWlsYWJsZUltYWdlcykge1xuICAgICAgICAgICAgYXZhaWxhYmxlSW1hZ2VzID0gW107XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXZhaWxhYmxlSW1hZ2VzO1xuICAgIH1cblxuICAgIGdldExheWVySW5kZXgobWFwSWQ6IHN0cmluZykge1xuICAgICAgICBsZXQgbGF5ZXJJbmRleGVzID0gdGhpcy5sYXllckluZGV4ZXNbbWFwSWRdO1xuICAgICAgICBpZiAoIWxheWVySW5kZXhlcykge1xuICAgICAgICAgICAgbGF5ZXJJbmRleGVzID0gdGhpcy5sYXllckluZGV4ZXNbbWFwSWRdID0gbmV3IFN0eWxlTGF5ZXJJbmRleCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsYXllckluZGV4ZXM7XG4gICAgfVxuXG4gICAgZ2V0V29ya2VyU291cmNlKG1hcElkOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgc291cmNlOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKCF0aGlzLndvcmtlclNvdXJjZXNbbWFwSWRdKVxuICAgICAgICAgICAgdGhpcy53b3JrZXJTb3VyY2VzW21hcElkXSA9IHt9O1xuICAgICAgICBpZiAoIXRoaXMud29ya2VyU291cmNlc1ttYXBJZF1bdHlwZV0pXG4gICAgICAgICAgICB0aGlzLndvcmtlclNvdXJjZXNbbWFwSWRdW3R5cGVdID0ge307XG5cbiAgICAgICAgaWYgKCF0aGlzLndvcmtlclNvdXJjZXNbbWFwSWRdW3R5cGVdW3NvdXJjZV0pIHtcbiAgICAgICAgICAgIC8vIHVzZSBhIHdyYXBwZWQgYWN0b3Igc28gdGhhdCB3ZSBjYW4gYXR0YWNoIGEgdGFyZ2V0IG1hcElkIHBhcmFtXG4gICAgICAgICAgICAvLyB0byBhbnkgbWVzc2FnZXMgaW52b2tlZCBieSB0aGUgV29ya2VyU291cmNlXG4gICAgICAgICAgICBjb25zdCBhY3RvciA9IHtcbiAgICAgICAgICAgICAgICBzZW5kOiAodHlwZSwgZGF0YSwgY2FsbGJhY2spID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hY3Rvci5zZW5kKHR5cGUsIGRhdGEsIGNhbGxiYWNrLCBtYXBJZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMud29ya2VyU291cmNlc1ttYXBJZF1bdHlwZV1bc291cmNlXSA9IG5ldyAodGhpcy53b3JrZXJTb3VyY2VUeXBlc1t0eXBlXTogYW55KSgoYWN0b3I6IGFueSksIHRoaXMuZ2V0TGF5ZXJJbmRleChtYXBJZCksIHRoaXMuZ2V0QXZhaWxhYmxlSW1hZ2VzKG1hcElkKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy53b3JrZXJTb3VyY2VzW21hcElkXVt0eXBlXVtzb3VyY2VdO1xuICAgIH1cblxuICAgIGdldERFTVdvcmtlclNvdXJjZShtYXBJZDogc3RyaW5nLCBzb3VyY2U6IHN0cmluZykge1xuICAgICAgICBpZiAoIXRoaXMuZGVtV29ya2VyU291cmNlc1ttYXBJZF0pXG4gICAgICAgICAgICB0aGlzLmRlbVdvcmtlclNvdXJjZXNbbWFwSWRdID0ge307XG5cbiAgICAgICAgaWYgKCF0aGlzLmRlbVdvcmtlclNvdXJjZXNbbWFwSWRdW3NvdXJjZV0pIHtcbiAgICAgICAgICAgIHRoaXMuZGVtV29ya2VyU291cmNlc1ttYXBJZF1bc291cmNlXSA9IG5ldyBSYXN0ZXJERU1UaWxlV29ya2VyU291cmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5kZW1Xb3JrZXJTb3VyY2VzW21hcElkXVtzb3VyY2VdO1xuICAgIH1cblxuICAgIGVuZm9yY2VDYWNoZVNpemVMaW1pdChtYXBJZDogc3RyaW5nLCBsaW1pdDogbnVtYmVyKSB7XG4gICAgICAgIGVuZm9yY2VDYWNoZVNpemVMaW1pdChsaW1pdCk7XG4gICAgfVxufVxuXG4vKiBnbG9iYWwgc2VsZiwgV29ya2VyR2xvYmFsU2NvcGUgKi9cbmlmICh0eXBlb2YgV29ya2VyR2xvYmFsU2NvcGUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnICYmXG4gICAgc2VsZiBpbnN0YW5jZW9mIFdvcmtlckdsb2JhbFNjb3BlKSB7XG4gICAgc2VsZi53b3JrZXIgPSBuZXcgV29ya2VyKHNlbGYpO1xufVxuIl0sIm5hbWVzIjpbImNvbnN0IiwibGV0Iiwic3RyIiwicmVmUHJvcGVydGllcyIsImsiLCJjcmVhdGVTdHlsZUxheWVyIiwiZmVhdHVyZUZpbHRlciIsInZhbHVlcyIsImxheWVyQ29uZmlncyIsInRoaXMiLCJsYXllciIsInBvdHBhY2siLCJBbHBoYUltYWdlIiwic3RhY2siLCJnbHlwaHMiLCJpZCIsInNyYyIsImJpbiIsInJlZ2lzdGVyIiwiT3ZlcnNjYWxlZFRpbGVJRCIsIkNvbGxpc2lvbkJveEFycmF5IiwiRGljdGlvbmFyeUNvZGVyIiwiRmVhdHVyZUluZGV4Iiwid2Fybk9uY2UiLCJhc3NlcnQiLCJtYXBPYmplY3QiLCJJbWFnZUF0bGFzIiwiU3ltYm9sQnVja2V0IiwicGVyZm9ybVN5bWJvbExheW91dCIsIkxpbmVCdWNrZXQiLCJGaWxsQnVja2V0IiwiRmlsbEV4dHJ1c2lvbkJ1Y2tldCIsIkV2YWx1YXRpb25QYXJhbWV0ZXJzIiwiZ2V0QXJyYXlCdWZmZXIiLCJ2dCIsIlByb3RvYnVmIiwiUmVxdWVzdFBlcmZvcm1hbmNlIiwiZXh0ZW5kIiwiREVNRGF0YSIsIlJHQkFJbWFnZSIsIm12dCIsIkVYVEVOVCIsIlBvaW50IiwiZ2VvbWV0cnkiLCJwb2ludCIsInJlcXVpcmUkJDAiLCJHZW9KU09OV3JhcHBlciIsIkZlYXR1cmVXcmFwcGVyIiwiUGJmIiwic29ydCIsIm5laWdoYm9ySWQiLCJiIiwicmV3aW5kIiwidHJhbnNmb3JtIiwidnRwYmYiLCJzdXBlciIsImNyZWF0ZUV4cHJlc3Npb24iLCJnZXRKU09OIiwiQWN0b3IiLCJnbG9iYWxSVExUZXh0UGx1Z2luIiwiZW5mb3JjZUNhY2hlU2l6ZUxpbWl0Il0sIm1hcHBpbmdzIjoiOztBQUdBLFNBQVMsU0FBUyxDQUFDLEdBQUcsRUFBRTtBQUN4QixJQUFJQSxJQUFNLElBQUksR0FBRyxPQUFPLEdBQUcsQ0FBQztBQUM1QixJQUFJLElBQUksSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLEtBQUssU0FBUyxJQUFJLElBQUksS0FBSyxRQUFRLElBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxHQUFHLEtBQUssSUFBSTtBQUN6RyxVQUFRLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBQztBQUNuQztBQUNBLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLFFBQVFDLElBQUlDLEtBQUcsR0FBRyxHQUFHLENBQUM7QUFDdEIsUUFBUSx5QkFBa0IsZ0NBQUcsRUFBRTtBQUMvQixZQURhRixJQUFNOztZQUNQRSxLQUFHLEtBQU8sU0FBUyxDQUFDLEdBQUcsUUFBSSxDQUFDO0FBQ3hDLFNBQVM7QUFDVCxRQUFRLFFBQVVBLEtBQUcsUUFBSTtBQUN6QixLQUFLO0FBQ0w7QUFDQSxJQUFJRixJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3pDO0FBQ0EsSUFBSUMsSUFBSSxHQUFHLEdBQUcsR0FB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QUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixJQUFJLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLElBQUksR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFDRDtBQUNBLFNBQVMsWUFBWSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRTtBQUN4RCxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzNDLFFBQVEsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ3RCLFFBQVEsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQzFELFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN2QixLQUFLO0FBQ0wsQ0FBQztBQUNEO0FBQ0EsU0FBUyxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3JCLElBQUksT0FBTyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUN6QixDQUFDO0FBQ0Q7QUFDQSxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDckIsSUFBSSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQzFDLElBQUksSUFBSSxFQUFFLEdBQUcsR0FBRyxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO0FBQ3BFLElBQUksT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFF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Q0E7QUFDQSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztBQUM1QixJQUFJLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzlGLFFBQVEsUUFBUSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RELEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7QUFDdEIsUUFBUSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVCLEtBQUs7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLFFBQVEsQ0FBQyxJQUFJLEVBQUU7QUFDeEIsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDbkIsSUFBSSxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDM0IsSUFBSSxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDN0IsSUFBSSxLQUFLLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDekIsSUFBSSxPQUFPLEtBQUssQ0FBQztBQUNqQixDQUFDO0FBQ0Q7QUFDQSxTQUFTLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtBQUMzRCxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzFDLFFBQVEsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ25FLEtBQUs7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDaEMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEIsQ0FBQztBQUNEO0FBQ0EsU0FBUyxVQUFVLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDNUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNqQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEIsSUFBSSxPQUFPLENBQUMsQ0FBQztBQUNiLENBQUM7QUFDRDtBQUNBLFNBQVMsVUFBVSxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQzVDLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUNqQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENB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QUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM5QyxRQUFRLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUMzQixRQUFRLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMxRDtBQUNBLFFBQVEsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNwQyxRQUFRLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDcEMsUUFBUSxJQUFJLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3BDLFFBQVEsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNwQztBQUNBLFFBQVEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBQztBQUMvQyxRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUM7QUFDL0MsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFDO0FBQy9DLFFBQVEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBQztBQUMvQyxLQUFLO0FBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQixDQUFDO0FBQ0Q7QUFDQSxTQUFTLFVBQVUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUU7QUFDdkQ7QUFDQSxJQUFJLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxRQUFRO0FBQy9CLFFBQVEsSUFBSSxHQUFHLE9B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QUFDLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbEYsWUFBWSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFDbkIsWUFBWSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbkYsWUFBWSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbkYsWUFBWSxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ3pCLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUM7QUFDbkQ7QUFDQSxRQUFRLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3RELFFBQVEsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzFELFFBQVEsS0FBSyxDQUFDLElB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
