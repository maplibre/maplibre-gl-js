import {mat4} from 'gl-matrix';
import type Point from '@mapbox/point-geometry';
import type {SourceCache} from './source_cache';
import type {StyleLayer} from '../style/style_layer';
import type {CollisionIndex} from '../symbol/collision_index';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {RetainedQueryData} from '../symbol/placement';
import type {FilterSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {GeoJSONFeature, MapGeoJSONFeature} from '../util/vectortile_to_geojson';
import type {QueryResults, QueryResultsItem} from '../data/feature_index';
import type {OverscaledTileID} from './tile_id';

type RenderedFeatureLayer = {
    wrappedTileID: string;
    queryResults: QueryResults;
};

/**
 * Options to pass to query the map for the rendered features
 */
export type QueryRenderedFeaturesOptions = {
    /**
     * An array or set of [style layer IDs](https://maplibre.org/maplibre-style-spec/#layer-id) for the query to inspect.
     * Only features within these layers will be returned. If this parameter is undefined, all layers will be checked.
     */
    layers?: Array<string> | Set<string>;
    /**
     * A [filter](https://maplibre.org/maplibre-style-spec/layers/#filter) to limit query results.
     */
    filter?: FilterSpecification;
    /**
     * An array of string representing the available images
     */
    availableImages?: Array<string>;
    /**
     * Whether to check if the [options.filter] conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     */
    validate?: boolean;
};

/**
 * @internal
 * A version of QueryRenderedFeaturesOptions used internally
 */
export type QueryRenderedFeaturesOptionsStrict = Omit<QueryRenderedFeaturesOptions, 'layers'> & {
    layers: Set<string> | null;
    globalState?: Record<string, any>;
};

/**
 * The options object related to the {@link Map.querySourceFeatures} method
 */
export type QuerySourceFeatureOptions = {
    /**
     * The name of the source layer to query. *For vector tile sources, this parameter is required.* For GeoJSON sources, it is ignored.
     */
    sourceLayer?: string;
    /**
     * A [filter](https://maplibre.org/maplibre-style-spec/layers/#filter)
     * to limit query results.
     */
    filter?: FilterSpecification;
    /**
     * Whether to check if the [parameters.filter] conforms to the MapLibre Style Specification. Disabling validation is a performance optimization that should only be used if you have previously validated the values you will be passing to this function.
     * @defaultValue true
     */
    validate?: boolean;
};

/**
 * @internal
 * A version of QuerySourceFeatureOptions used internally
 */
export type QuerySourceFeatureOptionsStrict = QuerySourceFeatureOptions & {
    globalState?: Record<string, any>;
};

export type QueryRenderedFeaturesResults = {
    [key: string]: QueryRenderedFeaturesResultsItem[];
};

export type QueryRenderedFeaturesResultsItem = QueryResultsItem & { feature: MapGeoJSONFeature };

/*
 * Returns a matrix that can be used to convert from tile coordinates to viewport pixel coordinates.
 */
function getPixelPosMatrix(transform, tileID: OverscaledTileID) {
    const t = mat4.create();
    mat4.translate(t, t, [1, 1, 0]);
    mat4.scale(t, t, [transform.width * 0.5, transform.height * 0.5, 1]);
    if (transform.calculatePosMatrix) { // Globe: TODO: remove this hack once queryRendererFeatures supports globe properly
        return mat4.multiply(t, t, transform.calculatePosMatrix(tileID.toUnwrapped()));
    } else {
        return t;
    }
}

function queryIncludes3DLayer(layers: Set<string> | undefined, styleLayers: {[_: string]: StyleLayer}, sourceID: string) {
    if (layers) {
        for (const layerID of layers) {
            const layer = styleLayers[layerID];
            if (layer && layer.source === sourceID && layer.type === 'fill-extrusion') {
                return true;
            }
        }
    } else {
        for (const key in styleLayers) {
            const layer = styleLayers[key];
            if (layer.source === sourceID && layer.type === 'fill-extrusion') {
                return true;
            }
        }
    }
    return false;
}

export function queryRenderedFeatures(
    sourceCache: SourceCache,
    styleLayers: {[_: string]: StyleLayer},
    serializedLayers: {[_: string]: any},
    queryGeometry: Array<Point>,
    params: QueryRenderedFeaturesOptionsStrict | undefined,
    transform: IReadonlyTransform,
    getElevation: undefined | ((id: OverscaledTileID, x: number, y: number) => number)
): QueryRenderedFeaturesResults {

    const has3DLayer = queryIncludes3DLayer(params?.layers ?? null, styleLayers, sourceCache.id);
    const maxPitchScaleFactor = transform.maxPitchScaleFactor();
    const tilesIn = sourceCache.tilesIn(queryGeometry, maxPitchScaleFactor, has3DLayer);

    tilesIn.sort(sortTilesIn);
    const renderedFeatureLayers: RenderedFeatureLayer[] = [];
    for (const tileIn of tilesIn) {
        renderedFeatureLayers.push({
            wrappedTileID: tileIn.tileID.wrapped().key,
            queryResults: tileIn.tile.queryRenderedFeatures(
                styleLayers,
                serializedLayers,
                sourceCache._state,
                tileIn.queryGeometry,
                tileIn.cameraQueryGeometry,
                tileIn.scale,
                params,
                transform,
                maxPitchScaleFactor,
                getPixelPosMatrix(sourceCache.transform, tileIn.tileID),
                getElevation ? (x: number, y: number) => getElevation(tileIn.tileID, x, y) : undefined,
            )
        });
    }

    const result = mergeRenderedFeatureLayers(renderedFeatureLayers);

    return convertFeaturesToMapFeatures(result, sourceCache);
}

export function queryRenderedSymbols(styleLayers: {[_: string]: StyleLayer},
    serializedLayers: {[_: string]: StyleLayer},
    sourceCaches: {[_: string]: SourceCache},
    queryGeometry: Array<Point>,
    params: QueryRenderedFeaturesOptionsStrict,
    collisionIndex: CollisionIndex,
    retainedQueryData: {
        [_: number]: RetainedQueryData;
    }): QueryRenderedFeaturesResults {
    const result: QueryResults = {};
    const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
    const bucketQueryData: RetainedQueryData[] = [];
    for (const bucketInstanceId of Object.keys(renderedSymbols).map(Number)) {
        bucketQueryData.push(retainedQueryData[bucketInstanceId]);
    }
    bucketQueryData.sort(sortTilesIn);

    for (const queryData of bucketQueryData) {
        const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(
            renderedSymbols[queryData.bucketInstanceId],
            serializedLayers,
            queryData.bucketIndex,
            queryData.sourceLayerIndex,
            {
                filterSpec: params.filter,
                globalState: params.globalState
            },
            params.layers,
            params.availableImages,
            styleLayers);

        for (const layerID in bucketSymbols) {
            const resultFeatures = result[layerID] = result[layerID] || [];
            const layerSymbols = bucketSymbols[layerID];
            layerSymbols.sort((a, b) => {
                // Match topDownFeatureComparator from FeatureIndex, but using
                // most recent sorting of features from bucket.sortFeatures
                const featureSortOrder = queryData.featureSortOrder;
                if (featureSortOrder) {
                    // queryRenderedSymbols documentation says we'll return features in
                    // "top-to-bottom" rendering order (aka last-to-first).
                    // Actually there can be multiple symbol instances per feature, so
                    // we sort each feature based on the first matching symbol instance.
                    const sortedA = featureSortOrder.indexOf(a.featureIndex);
                    const sortedB = featureSortOrder.indexOf(b.featureIndex);
                    return sortedB - sortedA;
                } else {
                    // Bucket hasn't been re-sorted based on angle, so use the
                    // reverse of the order the features appeared in the data.
                    return b.featureIndex - a.featureIndex;
                }
            });
            for (const symbolFeature of layerSymbols) {
                resultFeatures.push(symbolFeature);
            }
        }
    }

    return convertFeaturesToMapFeaturesMultiple(result, styleLayers, sourceCaches);
}

export function querySourceFeatures(sourceCache: SourceCache, params: QuerySourceFeatureOptionsStrict | undefined): GeoJSONFeature[] {
    const tiles = sourceCache.getRenderableIds().map((id) => {
        return sourceCache.getTileByID(id);
    });

    const result: GeoJSONFeature[] = [];

    const dataTiles = {};
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const dataID = tile.tileID.canonical.key;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }

    return result;
}

function sortTilesIn(a: {tileID: OverscaledTileID}, b: {tileID: OverscaledTileID}) {
    const idA = a.tileID;
    const idB = b.tileID;
    return (idA.overscaledZ - idB.overscaledZ) || (idA.canonical.y - idB.canonical.y) || (idA.wrap - idB.wrap) || (idA.canonical.x - idB.canonical.x);
}

function mergeRenderedFeatureLayers(tiles: RenderedFeatureLayer[]): QueryResults {
    // Merge results from all tiles, but if two tiles share the same
    // wrapped ID, don't duplicate features between the two tiles
    const result: QueryResults = {};
    const wrappedIDLayerMap = {};
    for (const tile of tiles) {
        const queryResults = tile.queryResults;
        const wrappedID = tile.wrappedTileID;
        const wrappedIDLayers = wrappedIDLayerMap[wrappedID] = wrappedIDLayerMap[wrappedID] || {};
        for (const layerID in queryResults) {
            const tileFeatures = queryResults[layerID];
            const wrappedIDFeatures = wrappedIDLayers[layerID] = wrappedIDLayers[layerID] || {};
            const resultFeatures = result[layerID] = result[layerID] || [];
            for (const tileFeature of tileFeatures) {
                if (!wrappedIDFeatures[tileFeature.featureIndex]) {
                    wrappedIDFeatures[tileFeature.featureIndex] = true;
                    resultFeatures.push(tileFeature);
                }
            }
        }
    }
    return result;
}

function convertFeaturesToMapFeatures(result: QueryResults, sourceCache: SourceCache): QueryRenderedFeaturesResults {
    // Merge state from SourceCache into the results
    for (const layerID in result) {
        for (const featureWrapper of result[layerID]) {
            convertFeatureToMapFeature(featureWrapper, sourceCache);
        };
    }
    return result as QueryRenderedFeaturesResults;
}

function convertFeaturesToMapFeaturesMultiple(result: QueryResults, styleLayers: {[_: string]: StyleLayer}, sourceCaches: {[_: string]: SourceCache}): QueryRenderedFeaturesResults {
    // Merge state from SourceCache into the results
    for (const layerName in result) {
        for (const featureWrapper of result[layerName]) {
            const layer = styleLayers[layerName];
            const sourceCache = sourceCaches[layer.source];
            convertFeatureToMapFeature(featureWrapper, sourceCache);
        };
    }
    return result as QueryRenderedFeaturesResults;
}

function convertFeatureToMapFeature(featureWrapper: QueryResultsItem, sourceCache: SourceCache) {
    const feature = featureWrapper.feature as MapGeoJSONFeature;
    const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
    feature.source = feature.layer.source;
    if (feature.layer['source-layer']) {
        feature.sourceLayer = feature.layer['source-layer'];
    }
    feature.state = state;
}
