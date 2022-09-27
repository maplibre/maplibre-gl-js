import {getJSON} from '../util/ajax';

import {RequestPerformance} from '../util/performance';
import rewind from '@mapbox/geojson-rewind';
import GeoJSONWrapper from './geojson_wrapper';
import vtpbf from 'vt-pbf';
import Supercluster from 'supercluster';
import geojsonvt from 'geojson-vt';
import VectorTileWorkerSource from './vector_tile_worker_source';
import {createExpression} from '../style-spec/expression';

import type {
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';

import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';

import type {LoadVectorDataCallback} from './vector_tile_worker_source';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export type LoadGeoJSONParameters = {
    request?: RequestParameters;
    data?: string;
    source: string;
    cluster: boolean;
    superclusterOptions?: any;
    geojsonVtOptions?: any;
    clusterProperties?: any;
    filter?: Array<unknown>;
};

export type LoadGeoJSON = (params: LoadGeoJSONParameters, callback: ResponseCallback<any>) => Cancelable;

export interface GeoJSONIndex {
    getTile(z: number, x: number, y: number): any;
    // supercluster methods
    getClusterExpansionZoom(clusterId: number): number;
    getChildren(clusterId: number): Array<GeoJSON.Feature>;
    getLeaves(clusterId: number, limit: number, offset: number): Array<GeoJSON.Feature>;
}

function loadGeoJSONTile(params: WorkerTileParameters, callback: LoadVectorDataCallback): (() => void) | void {
    const canonical = params.tileID.canonical;

    if (!this._geoJSONIndex) {
        return callback(null, null);  // we couldn't load the file
    }

    const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
    if (!geoJSONTile) {
        return callback(null, null); // nothing in the given tile
    }

    const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

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
    _pendingCallback: Callback<{
        resourceTiming?: {[_: string]: Array<PerformanceResourceTiming>};
        abandoned?: boolean;
    }>;
    _pendingRequest: Cancelable;
    _geoJSONIndex: GeoJSONIndex;

    /**
     * @param [loadGeoJSON] Optional method for custom loading/parsing of
     * GeoJSON based on parameters passed from the main-thread Source.
     * See {@link GeoJSONWorkerSource#loadGeoJSON}.
     * @private
     */
    constructor(actor: Actor, layerIndex: StyleLayerIndex, availableImages: Array<string>, loadGeoJSON?: LoadGeoJSON | null) {
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
     * When a `loadData` request comes in while a previous one is being processed,
     * the previous one is aborted.
     *
     * @param params
     * @param callback
     * @private
     */
    loadData(params: LoadGeoJSONParameters, callback: Callback<{
        resourceTiming?: {[_: string]: Array<PerformanceResourceTiming>};
        abandoned?: boolean;
    }>) {
        this._pendingRequest?.cancel();
        if (this._pendingCallback) {
            // Tell the foreground the previous call has been abandoned
            this._pendingCallback(null, {abandoned: true});
        }

        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new RequestPerformance(params.request) : false;

        this._pendingCallback = callback;
        this._pendingRequest = this.loadGeoJSON(params, (err?: Error | null, data?: any | null) => {
            delete this._pendingCallback;
            delete this._pendingRequest;

            if (err || !data) {
                return callback(err);
            } else if (typeof data !== 'object') {
                return callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
            } else {
                rewind(data, true);

                try {
                    if (params.filter) {
                        const compiled = createExpression(params.filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false} as any);
                        if (compiled.result === 'error')
                            throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));

                        const features = data.features.filter(feature => compiled.value.evaluate({zoom: 0}, feature));
                        data = {type: 'FeatureCollection', features};
                    }

                    this._geoJSONIndex = params.cluster ?
                        new Supercluster(getSuperclusterOptions(params)).load(data.features) :
                        geojsonvt(data, params.geojsonVtOptions);
                } catch (err) {
                    return callback(err);
                }

                this.loaded = {};

                const result = {} as { resourceTiming: any };
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
    * Implements {@link WorkerSource#reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params
    * @param params.uid The UID for this tile.
    * @private
    */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback) {
        const loaded = this.loaded,
            uid = params.uid;

        if (loaded && loaded[uid]) {
            return super.reloadTile(params, callback);
        } else {
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
     * @returns {Cancelable} A Cancelable object.
     * @private
     */
    loadGeoJSON(params: LoadGeoJSONParameters, callback: ResponseCallback<any>): Cancelable {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            return getJSON(params.request, callback);
        } else if (typeof params.data === 'string') {
            try {
                callback(null, JSON.parse(params.data));
            } catch (e) {
                callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
            }
        } else {
            callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
        }

        return {cancel: () => {}};
    }

    removeSource(params: {
        source: string;
    }, callback: WorkerTileCallback) {
        if (this._pendingCallback) {
            // Don't leak callbacks
            this._pendingCallback(null, {abandoned: true});
        }
        callback();
    }

    getClusterExpansionZoom(params: {
        clusterId: number;
    }, callback: Callback<number>) {
        try {
            callback(null, this._geoJSONIndex.getClusterExpansionZoom(params.clusterId));
        } catch (e) {
            callback(e);
        }
    }

    getClusterChildren(params: {
        clusterId: number;
    }, callback: Callback<Array<GeoJSON.Feature>>) {
        try {
            callback(null, this._geoJSONIndex.getChildren(params.clusterId));
        } catch (e) {
            callback(e);
        }
    }

    getClusterLeaves(params: {
        clusterId: number;
        limit: number;
        offset: number;
    }, callback: Callback<Array<GeoJSON.Feature>>) {
        try {
            callback(null, this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset));
        } catch (e) {
            callback(e);
        }
    }
}

function getSuperclusterOptions({superclusterOptions, clusterProperties}: { superclusterOptions?: any; clusterProperties?: any}) {
    if (!clusterProperties || !superclusterOptions) return superclusterOptions;

    const mapExpressions = {};
    const reduceExpressions = {};
    const globals = {accumulated: null, zoom: 0};
    const feature = {properties: null};
    const propertyNames = Object.keys(clusterProperties);

    for (const key of propertyNames) {
        const [operator, mapExpression] = clusterProperties[key];

        const mapExpressionParsed = createExpression(mapExpression);
        const reduceExpressionParsed = createExpression(
            typeof operator === 'string' ? [operator, ['accumulated'], ['get', key]] : operator);

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

export default GeoJSONWorkerSource;
