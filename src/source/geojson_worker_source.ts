import {getJSON} from '../util/ajax';
import {RequestPerformance} from '../util/performance';
import rewind from '@mapbox/geojson-rewind';
import {fromVectorTileJs, GeoJSONWrapper} from '@maplibre/vt-pbf';
import {EXTENT} from '../data/extent';
import Supercluster, {type Options as SuperclusterOptions, type ClusterProperties} from 'supercluster';
import geojsonvt, {type Options as GeoJSONVTOptions} from 'geojson-vt';
import {VectorTileWorkerSource} from './vector_tile_worker_source';
import {createExpression} from '@maplibre/maplibre-gl-style-spec';
import {isAbortError} from '../util/abort_error';

import type {
    WorkerTileParameters,
    WorkerTileResult,
} from '../source/worker_source';

import type {LoadVectorTileResult} from './vector_tile_worker_source';
import type {RequestParameters} from '../util/ajax';
import {isUpdateableGeoJSON, type GeoJSONSourceDiff, applySourceDiff, toUpdateable, type GeoJSONFeatureId} from './geojson_source_diff';
import type {ClusterIDAndSource, GeoJSONWorkerSourceLoadDataResult, RemoveSourceParams} from '../util/actor_messages';

/**
 * The geojson worker options that can be passed to the worker
 */
export type GeoJSONWorkerOptions = {
    source?: string;
    cluster?: boolean;
    geojsonVtOptions?: GeoJSONVTOptions;
    superclusterOptions?: SuperclusterOptions<any, any>;
    clusterProperties?: ClusterProperties;
    filter?: Array<unknown>;
    promoteId?: string;
    collectResourceTiming?: boolean;
};

/**
 * Parameters needed to load a geojson to the worker
 */
export type LoadGeoJSONParameters = GeoJSONWorkerOptions & {
    type: 'geojson';
    request?: RequestParameters;
    /**
     * Literal GeoJSON data. Must be provided if `request.url` is not.
     */
    data?: string;
    dataDiff?: GeoJSONSourceDiff;
};

export type LoadGeoJSON = (params: LoadGeoJSONParameters, abortController: AbortController) => Promise<GeoJSON.GeoJSON>;

type GeoJSONIndex = ReturnType<typeof geojsonvt> | Supercluster;

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation. To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 */
export class GeoJSONWorkerSource extends VectorTileWorkerSource {
    /**
     * The actual GeoJSON takes some time to load (as there may be a need to parse a diff, or to apply filters, or the
     * data may even need to be loaded via a URL). This promise resolves with a ready-to-be-consumed GeoJSON which is
     * ready to be returned by the `getData` method.
     */
    _pendingData: Promise<GeoJSON.GeoJSON>;
    _pendingRequest: AbortController;
    _geoJSONIndex: GeoJSONIndex;
    _dataUpdateable = new Map<GeoJSONFeatureId, GeoJSON.Feature>();

    override async loadVectorTile(params: WorkerTileParameters, _abortController: AbortController): Promise<LoadVectorTileResult | null> {
        const canonical = params.tileID.canonical;

        if (!this._geoJSONIndex) {
            throw new Error('Unable to parse the data into a cluster or geojson');
        }

        const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
        if (!geoJSONTile) {
            return null;
        }

        const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features, {version: 2, extent: EXTENT});
        // Encode the geojson-vt tile into binary vector tile form.
        // This is a convenience that allows `FeatureIndex` to operate the same way
        // across `VectorTileSource` and `GeoJSONSource` data.
        let pbf = fromVectorTileJs(geojsonWrapper);
        if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
            // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
            pbf = new Uint8Array(pbf);
        }

        return {
            vectorTile: geojsonWrapper,
            rawData: pbf.buffer
        };
    }

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource.loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource.loadAndProcessGeoJSON} for the pre-processing.
     *
     * When a `loadData` request comes in while a previous one is being processed,
     * the previous one is aborted.
     *
     * @param params - the parameters
     * @returns a promise that resolves when the data is loaded and parsed into a GeoJSON object
     */
    async loadData(params: LoadGeoJSONParameters): Promise<GeoJSONWorkerSourceLoadDataResult> {
        this._pendingRequest?.abort();
        const perf = (params && params.request && params.request.collectResourceTiming) ?
            new RequestPerformance(params.request) : false;

        this._pendingRequest = new AbortController();
        try {
            this._pendingData = this.loadAndProcessGeoJSON(params, this._pendingRequest);

            const data = await this._pendingData;

            this._geoJSONIndex = params.cluster ?
                new Supercluster(getSuperclusterOptions(params)).load((data as any).features) :
                geojsonvt(data, params.geojsonVtOptions);

            this.loaded = {};

            const result = {data} as GeoJSONWorkerSourceLoadDataResult;
            if (perf) {
                const resourceTimingData = perf.finish();
                // it's necessary to eval the result of getEntriesByName() here via parse/stringify
                // late evaluation in the main thread causes TypeError: illegal invocation
                if (resourceTimingData) {
                    result.resourceTiming = {};
                    result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
                }
            }
            return result;
        } catch (err) {
            delete this._pendingRequest;
            if (isAbortError(err)) {
                return {abandoned: true};
            }
            throw err;
        }
    }

    /**
     * Allows to get the source's actual GeoJSON.
     *
     * @returns a promise which is resolved with the source's actual GeoJSON
     */
    async getData(): Promise<GeoJSON.GeoJSON> {
        return this._pendingData;
    }

    /**
    * Implements {@link WorkerSource.reloadTile}.
    *
    * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
    * Otherwise, such as after a setData() call, we load the tile fresh.
    *
    * @param params - the parameters
    * @returns A promise that resolves when the tile is reloaded
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
     * Fetch, parse and process GeoJSON according to the given params.
     *
     * Defers to {@link GeoJSONWorkerSource.loadGeoJSON} for the fetching and parsing.
     *
     * @param params - the parameters
     * @param abortController - the abort controller that allows aborting this operation
     * @returns a promise that is resolved with the processes GeoJSON
     */
    async loadAndProcessGeoJSON(params: LoadGeoJSONParameters, abortController: AbortController): Promise<GeoJSON.GeoJSON> {
        let data = await this.loadGeoJSON(params, abortController);

        delete this._pendingRequest;
        if (typeof data !== 'object') {
            throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
        }
        rewind(data, true);

        if (params.filter) {
            const compiled = createExpression(params.filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false} as any);
            if (compiled.result === 'error')
                throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));

            const features = (data as any).features.filter(feature => compiled.value.evaluate({zoom: 0}, feature));
            data = {type: 'FeatureCollection', features};
        }

        return data;
    }

    /**
     * Fetch and parse GeoJSON according to the given params.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param params - the parameters
     * @param abortController - the abort controller that allows aborting this operation
     * @returns a promise that resolves when the data is loaded
     */
    async loadGeoJSON(params: LoadGeoJSONParameters, abortController: AbortController): Promise<GeoJSON.GeoJSON> {
        const {promoteId} = params;
        if (params.request) {
            const response = await getJSON<GeoJSON.GeoJSON>(params.request, abortController);
            this._dataUpdateable = isUpdateableGeoJSON(response.data, promoteId) ? toUpdateable(response.data, promoteId) : undefined;
            return response.data;
        }
        if (typeof params.data === 'string') {
            try {
                const parsed = JSON.parse(params.data);
                this._dataUpdateable = isUpdateableGeoJSON(parsed, promoteId) ? toUpdateable(parsed, promoteId) : undefined;
                return parsed;
            } catch {
                throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
            }
        }
        if (!params.dataDiff) {
            throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
        }
        if (!this._dataUpdateable) {
            throw new Error(`Cannot update existing geojson data in ${params.source}`);
        }
        applySourceDiff(this._dataUpdateable, params.dataDiff, promoteId);
        return {type: 'FeatureCollection', features: Array.from(this._dataUpdateable.values())};
    }

    async removeSource(_params: RemoveSourceParams): Promise<void> {
        if (this._pendingRequest) {
            this._pendingRequest.abort();
        }
    }

    getClusterExpansionZoom(params: ClusterIDAndSource): number {
        return (this._geoJSONIndex as Supercluster).getClusterExpansionZoom(params.clusterId);
    }

    getClusterChildren(params: ClusterIDAndSource): Array<GeoJSON.Feature> {
        return (this._geoJSONIndex as Supercluster).getChildren(params.clusterId);
    }

    getClusterLeaves(params: {
        clusterId: number;
        limit: number;
        offset: number;
    }): Array<GeoJSON.Feature> {
        return (this._geoJSONIndex as Supercluster).getLeaves(params.clusterId, params.limit, params.offset);
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
