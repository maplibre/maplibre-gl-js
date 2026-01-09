import {getJSON} from '../util/ajax';
import {RequestPerformance} from '../util/performance';
import rewind from '@mapbox/geojson-rewind';
import {GeoJSONWrapper} from '@maplibre/vt-pbf';
import {EXTENT} from '../data/extent';
import Supercluster, {type Options as SuperclusterOptions, type ClusterProperties} from 'supercluster';
import geojsonvt, {type Options as GeoJSONVTOptions} from 'geojson-vt';
import {VectorTileWorkerSource} from './vector_tile_worker_source';
import {createExpression} from '@maplibre/maplibre-gl-style-spec';
import {isAbortError} from '../util/abort_error';
import {toVirtualVectorTile} from './vector_tile_overzoomed';
import {type GeoJSONSourceDiff, applySourceDiff, toUpdateable, type GeoJSONFeatureId} from './geojson_source_diff';
import type {WorkerTileParameters, WorkerTileResult} from './worker_source';
import type {LoadVectorTileResult} from './vector_tile_worker_source';
import type {RequestParameters} from '../util/ajax';
import type {ClusterIDAndSource, GeoJSONWorkerSourceLoadDataResult, RemoveSourceParams} from '../util/actor_messages';
import type {IActor} from '../util/actor';
import type {StyleLayerIndex} from '../style/style_layer_index';

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
 * Parameters needed to load GeoJSON to the worker - must specify either a `request`, `data` or `dataDiff`.
 */
export type LoadGeoJSONParameters = GeoJSONWorkerOptions & {
    type: 'geojson';
    /**
     * Request parameters including a URL to fetch GeoJSON data.
     */
    request?: RequestParameters;
    /**
     * GeoJSON data to set as the source's data.
     */
    data?: GeoJSON.GeoJSON;
    /**
     * GeoJSONSourceDiff to apply to the existing GeoJSON source data.
     */
    dataDiff?: GeoJSONSourceDiff;
};

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
    _createGeoJSONIndex: typeof createGeoJSONIndex;

    constructor(actor: IActor, layerIndex: StyleLayerIndex, availableImages: Array<string>, createGeoJSONIndexFunc: typeof createGeoJSONIndex = createGeoJSONIndex) {
        super(actor, layerIndex, availableImages);
        this._createGeoJSONIndex = createGeoJSONIndexFunc;
    }

    /**
     * Retrieves and sends loaded vector tiles to the main thread.
     */
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

        return toVirtualVectorTile(geojsonWrapper);
    }

    /**
     * Fetches (if appropriate), parses and indexes geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource.loadTile}
     * can correctly serve up tiles. The first call to this method must contain a valid
     * {@link params.data}, {@link params.request} or {@link params.dataDiff}. Subsequent
     * calls may omit these parameters to reprocess the existing data (such as to update
     * clustering options).
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

        const perf = this._startPerformance(params);
        this._pendingRequest = new AbortController();
        try {
            // Load and process the GeoJSON data if it hasn't been loaded yet or if the data is changed.
            if (!this._pendingData || params.request || params.data || params.dataDiff) {
                this._pendingData = this.loadAndProcessGeoJSON(params, this._pendingRequest);
            }

            const data = await this._pendingData;
            this._geoJSONIndex = this._createGeoJSONIndex(data, params);
            this.loaded = {};

            const result: GeoJSONWorkerSourceLoadDataResult = {};

            // Sending a large GeoJSON payload from the worker thread to the main thread
            // is SLOW so we only do it if absolutely nescessary.
            // The main thread already has a copy of this data UNLESS it was loaded
            // from a URL.
            if (params.request) result.data = data;

            this._finishPerformance(perf, params, result);
            return result;
        } catch (err) {
            delete this._pendingRequest;
            if (isAbortError(err)) return {abandoned: true};
            throw err;
        }
    }

    _startPerformance(params: LoadGeoJSONParameters): RequestPerformance | undefined {
        if (!params?.request?.collectResourceTiming) return;
        return new RequestPerformance(params.request);
    }

    _finishPerformance(perf: RequestPerformance, params: LoadGeoJSONParameters, result: GeoJSONWorkerSourceLoadDataResult): void {
        if (!perf) return;
        const resourceTimingData = perf.finish();
        // it's necessary to eval the result of getEntriesByName() here via parse/stringify
        // late evaluation in the main thread causes TypeError: illegal invocation
        if (resourceTimingData) {
            result.resourceTiming = {};
            result.resourceTiming[params.source] = JSON.parse(JSON.stringify(resourceTimingData));
        }
    }

    /**
     * Get the source's full GeoJSON data source.
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
        const loaded = this.loaded;
        const uid = params.uid;

        if (loaded && loaded[uid]) {
            return super.reloadTile(params);
        } else {
            return this.loadTile(params);
        }
    }

    /**
     * Fetch, parse and process GeoJSON according to the given parameters.
     * Defers to {@link GeoJSONWorkerSource._loadGeoJSONFromString} for the fetching and parsing.
     *
     * @param params - the parameters
     * @param abortController - the abort controller that allows aborting this operation
     * @returns a promise that is resolved with the processes GeoJSON
     */
    async loadAndProcessGeoJSON(params: LoadGeoJSONParameters, abortController: AbortController): Promise<GeoJSON.GeoJSON> {
        let data: GeoJSON.GeoJSON;

        if (params.request) {
            // Data is loaded from a fetchable URL
            data = await this.loadGeoJSONFromUrl(params.request, params.promoteId, abortController);

        } else if (params.data) {
            // Data is loaded from a GeoJSON Object
            data = this._loadGeoJSONFromObject(params.data, params.promoteId);

        } else if (params.dataDiff) {
            // Data is loaded from a GeoJSONSourceDiff
            data = this._loadGeoJSONFromDiff(params.dataDiff, params.promoteId, params.source);
        }

        delete this._pendingRequest;

        if (typeof data !== 'object') {
            throw new Error(`Input data given to '${params.source}' is not a valid GeoJSON object.`);
        }

        // Generate winding-order compliant GeoJSON Polygon and MultiPolygon geometries
        rewind(data, true);

        if (params.filter) {
            data = this._filterGeoJSON(data, params.filter);
        }

        return data;
    }

    /**
     * Loads GeoJSON from a URL and sets the sources updateable GeoJSON object.
     */
    async loadGeoJSONFromUrl(request: RequestParameters, promoteId: string, abortController: AbortController): Promise<GeoJSON.GeoJSON> {
        const response = await getJSON<GeoJSON.GeoJSON>(request, abortController);
        this._dataUpdateable = toUpdateable(response.data, promoteId);
        return response.data;
    }

    /**
     * Loads GeoJSON from a string and sets the sources updateable GeoJSON object.
     */
    _loadGeoJSONFromObject(data: GeoJSON.GeoJSON, promoteId: string): GeoJSON.GeoJSON {
        this._dataUpdateable = toUpdateable(data, promoteId);
        return data;
    }

    /**
     * Loads GeoJSON from a GeoJSONSourceDiff and applies it to the existing source updateable GeoJSON object.
     */
    _loadGeoJSONFromDiff(dataDiff: GeoJSONSourceDiff, promoteId: string, source: string): GeoJSON.FeatureCollection {
        if (!this._dataUpdateable) {
            throw new Error(`Cannot update existing geojson data in ${source}`);
        }

        // Incrementally apply the diff to existing source data
        applySourceDiff(this._dataUpdateable, dataDiff, promoteId);

        const features = Array.from(this._dataUpdateable.values());
        return this._toFeatureCollection(features);
    }

    /**
     * Applies a filter to a GeoJSON object.
     */
    _filterGeoJSON(data: GeoJSON.GeoJSON, filter: Array<unknown>): GeoJSON.FeatureCollection {
        const compiled = createExpression(filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false} as any);

        if (compiled.result === 'error') {
            throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
        }

        const features = (data as any).features.filter(feature => compiled.value.evaluate({zoom: 0}, feature));
        return this._toFeatureCollection(features);
    }

    /**
     * Converts an array of GeoJSON features into a GeoJSON FeatureCollection.
     */
    _toFeatureCollection(features: Array<GeoJSON.Feature>): GeoJSON.FeatureCollection {
        return {type: 'FeatureCollection', features};
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

export function createGeoJSONIndex(data: GeoJSON.GeoJSON, params: LoadGeoJSONParameters): GeoJSONIndex {
    if (params.cluster) {
        return new Supercluster(getSuperclusterOptions(params)).load((data as any).features);
    }
    return geojsonvt(data, params.geojsonVtOptions);
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
