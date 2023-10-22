import {getJSON} from '../util/ajax';

import {RequestPerformance} from '../util/performance';
import rewind from '@mapbox/geojson-rewind';
import {GeoJSONWrapper} from './geojson_wrapper';
import vtpbf from 'vt-pbf';
import Supercluster, {type Options, type ClusterProperties} from 'supercluster';
import geojsonvt from 'geojson-vt';
import {VectorTileWorkerSource} from './vector_tile_worker_source';
import {createExpression} from '@maplibre/maplibre-gl-style-spec';

import type {
    WorkerTileParameters,
    WorkerTileResult,
} from '../source/worker_source';

import type {Actor} from '../util/actor';
import type {StyleLayerIndex} from '../style/style_layer_index';

import type {LoadVectorDataCallback} from './vector_tile_worker_source';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {Cancelable} from '../types/cancelable';
import {isUpdateableGeoJSON, type GeoJSONSourceDiff, applySourceDiff, toUpdateable, GeoJSONFeatureId} from './geojson_source_diff';
import type {ClusterIDAndSource, GeoJSONWorkerSourceLoadDataResult, RemoveSourceParams} from '../util/actor_messages';

export type LoadGeoJSONParameters = {
    type: 'geojson';
    request?: RequestParameters;
    /**
     * Literal GeoJSON data. Must be provided if `request.url` is not.
     */
    data?: string;
    dataDiff?: GeoJSONSourceDiff;
    source: string;
    cluster: boolean;
    superclusterOptions?: Options<any, any>;
    geojsonVtOptions?: any;
    clusterProperties?: ClusterProperties;
    filter?: Array<unknown>;
    promoteId?: string;
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
 */
export class GeoJSONWorkerSource extends VectorTileWorkerSource {
    _pendingPromise: (value: GeoJSONWorkerSourceLoadDataResult) => void;
    _pendingRequest: Cancelable;
    _geoJSONIndex: GeoJSONIndex;
    _dataUpdateable = new Map<GeoJSONFeatureId, GeoJSON.Feature>();

    /**
     * @param loadGeoJSON - Optional method for custom loading/parsing of
     * GeoJSON based on parameters passed from the main-thread Source.
     * See {@link GeoJSONWorkerSource#loadGeoJSON}.
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
     * @param params - the parameters
     * @param callback - the callback for completion or error
     */
    loadData(params: LoadGeoJSONParameters): Promise<GeoJSONWorkerSourceLoadDataResult> {
        this._pendingRequest?.cancel();
        if (this._pendingPromise) {
            // Tell the foreground the previous call has been abandoned
            this._pendingPromise({abandoned: true});
        }
        return new Promise<GeoJSONWorkerSourceLoadDataResult>((resolve, reject) => {
            const perf = (params && params.request && params.request.collectResourceTiming) ?
                new RequestPerformance(params.request) : false;

            this._pendingPromise = resolve;
            this._pendingRequest = this.loadGeoJSON(params, (err?: Error | null, data?: any | null) => {
                delete this._pendingPromise;
                delete this._pendingRequest;

                if (err || !data) {
                    reject(err);
                    return;
                }
                if (typeof data !== 'object') {
                    reject(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
                    return;
                }
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
                    reject(err);
                    return;
                }

                this.loaded = {};

                const result = {} as { resourceTiming: {[_: string]: Array<PerformanceResourceTiming>} };
                if (perf) {
                    const resourceTimingData = perf.finish();
                    // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                    // late evaluation in the main thread causes TypeError: illegal invocation
                    if (resourceTimingData) {
                        result.resourceTiming = {};
                        result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                    }
                }
                resolve(result);
            });
        });
    }

    /**
    * Implements {@link WorkerSource#reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params - the parameters
    * @param callback - the callback for completion or error
    */
    reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult> {
        const loaded = this.loaded,
            uid = params.uid;

        if (loaded && loaded[uid]) {
            return super.reloadTile(params);
        } else {
            return this.loadTile(params);
        }
    }

    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param params - the parameters
     * @param callback - the callback for completion or error
     * @returns A Cancelable object.
     */
    loadGeoJSON = (params: LoadGeoJSONParameters, callback: ResponseCallback<any>): Cancelable => {
        const {promoteId} = params;
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.request) {
            return getJSON(params.request, (
                error?: Error,
                data?: any,
                cacheControl?: string,
                expires?: string
            ) => {
                this._dataUpdateable = isUpdateableGeoJSON(data, promoteId) ? toUpdateable(data, promoteId) : undefined;
                callback(error, data, cacheControl, expires);
            });
        } else if (typeof params.data === 'string') {
            try {
                const parsed = JSON.parse(params.data);
                this._dataUpdateable = isUpdateableGeoJSON(parsed, promoteId) ? toUpdateable(parsed, promoteId) : undefined;
                callback(null, parsed);
            } catch (e) {
                callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
            }
        } else if (params.dataDiff) {
            if (this._dataUpdateable) {
                applySourceDiff(this._dataUpdateable, params.dataDiff, promoteId);
                callback(null, {type: 'FeatureCollection', features: Array.from(this._dataUpdateable.values())});
            } else {
                callback(new Error(`Cannot update existing geojson data in ${params.source}`));
            }
        } else {
            callback(new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`));
        }

        return {cancel: () => {}};
    };

    async removeSource(_params: RemoveSourceParams): Promise<void> {
        if (this._pendingPromise) {
            // Don't leak callbacks
            this._pendingPromise({abandoned: true});
        }
    }

    getClusterExpansionZoom(params: ClusterIDAndSource): number {
        return this._geoJSONIndex.getClusterExpansionZoom(params.clusterId);
    }

    getClusterChildren(params: ClusterIDAndSource): Array<GeoJSON.Feature> {
        return this._geoJSONIndex.getChildren(params.clusterId);
    }

    getClusterLeaves(params: {
        clusterId: number;
        limit: number;
        offset: number;
    }): Array<GeoJSON.Feature> {
        return this._geoJSONIndex.getLeaves(params.clusterId, params.limit, params.offset);
    }
}

function getSuperclusterOptions({superclusterOptions, clusterProperties}: LoadGeoJSONParameters) {
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
