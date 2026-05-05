import type Point from '@mapbox/point-geometry';
import {type VectorTileFeatureLike, type VectorTileLayerLike, GEOJSON_TILE_LAYER_NAME} from '@maplibre/vt-pbf';
import {loadGeometry} from './load_geometry.ts';
import {toEvaluationFeature} from './evaluation_feature.ts';
import {EXTENT} from './extent.ts';
import {featureFilter} from '@maplibre/maplibre-gl-style-spec';
import {TransferableGridIndex} from '../util/transferable_grid_index.ts';
import {DictionaryCoder} from '../util/dictionary_coder.ts';
import Protobuf from 'pbf';
import {GeoJSONFeature} from '../util/vectortile_to_geojson.ts';
import {mapObject, extend} from '../util/util.ts';
import {register} from '../util/web_worker_transfer.ts';
import {EvaluationParameters} from '../style/evaluation_parameters.ts';
import {polygonIntersectsBox} from '../util/intersection_tests.ts';
import {PossiblyEvaluated} from '../style/properties.ts';
import {FeatureIndexArray} from './array_types.g.ts';
import {MLTVectorTile} from '../source/vector_tile_mlt.ts';
import {Bounds} from '../geo/bounds.ts';
import {VectorTile} from '@mapbox/vector-tile';

import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {SourceFeatureState} from '../source/source_state.ts';
import type {mat4} from 'gl-matrix';
import type {MapGeoJSONFeature} from '../util/vectortile_to_geojson.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {FeatureFilter, FeatureState, FilterSpecification, PromoteIdSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {IReadonlyTransform} from '../geo/transform_interface.ts';
import type {TileEncoding} from '../source/worker_source.ts';

export {GEOJSON_TILE_LAYER_NAME};

type QueryParameters = {
    scale: number;
    pixelPosMatrix: mat4;
    transform: IReadonlyTransform;
    tileSize: number;
    queryGeometry: Point[];
    cameraQueryGeometry: Point[];
    queryPadding: number;
    getElevation: undefined | ((x: number, y: number) => number);
    params: {
        filter?: FilterSpecification;
        layers?: Set<string> | null;
        availableImages?: string[];
        globalState?: Record<string, any>;
    };
};

export type QueryResults = {
    [_: string]: QueryResultsItem[];
};

export type QueryResultsItem = {
    featureIndex: number;
    feature: GeoJSONFeature;
    intersectionZ?: boolean | number;
};

/**
 * An in memory index class to allow fast interaction with features
 */
export class FeatureIndex {
    tileID: OverscaledTileID;
    x: number;
    y: number;
    z: number;
    grid: TransferableGridIndex;
    grid3D: TransferableGridIndex;
    featureIndexArray: FeatureIndexArray;
    promoteId?: PromoteIdSpecification;
    encoding: TileEncoding;
    rawTileData: ArrayBuffer;
    bucketLayerIDs: string[][];

    vtLayers: {[_: string]: VectorTileLayerLike};
    sourceLayerCoder: DictionaryCoder;

    constructor(tileID: OverscaledTileID, promoteId?: PromoteIdSpecification | null) {
        this.tileID = tileID;
        this.x = tileID.canonical.x;
        this.y = tileID.canonical.y;
        this.z = tileID.canonical.z;
        this.grid = new TransferableGridIndex(EXTENT, 16, 0);
        this.grid3D = new TransferableGridIndex(EXTENT, 16, 0);
        this.featureIndexArray = new FeatureIndexArray();
        this.promoteId = promoteId;
    }

    insert(feature: VectorTileFeatureLike, geometry: Point[][], featureIndex: number, sourceLayerIndex: number, bucketIndex: number, is3D?: boolean): void {
        const key = this.featureIndexArray.length;
        this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex);

        const grid = is3D ? this.grid3D : this.grid;

        for (const ring of geometry) {

            const bbox = [Infinity, Infinity, -Infinity, -Infinity];
            for (const p of ring) {
                bbox[0] = Math.min(bbox[0], p.x);
                bbox[1] = Math.min(bbox[1], p.y);
                bbox[2] = Math.max(bbox[2], p.x);
                bbox[3] = Math.max(bbox[3], p.y);
            }

            if (bbox[0] < EXTENT &&
                bbox[1] < EXTENT &&
                bbox[2] >= 0 &&
                bbox[3] >= 0) {
                grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
            }
        }
    }

    loadVTLayers(): {[_: string]: VectorTileLayerLike} {
        if (!this.vtLayers) {
            switch (this.encoding) {
                case 'mlt':
                    this.vtLayers = new MLTVectorTile(this.rawTileData).layers;
                    break;
                case 'mvt':
                default:
                    this.vtLayers = new VectorTile(new Protobuf(this.rawTileData)).layers;
            }
            this.sourceLayerCoder = new DictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers).sort() : [GEOJSON_TILE_LAYER_NAME]);
        }
        return this.vtLayers;
    }

    // Finds non-symbol features in this tile at a particular position.
    query(
        args: QueryParameters,
        styleLayers: {[_: string]: StyleLayer},
        serializedLayers: {[_: string]: any},
        sourceFeatureState: SourceFeatureState
    ): QueryResults {
        this.loadVTLayers();

        const params = args.params;
        const pixelsToTileUnits = EXTENT / args.tileSize / args.scale;
        const filter = featureFilter(params.filter, params.globalState);

        const queryGeometry = args.queryGeometry;
        const queryPadding = args.queryPadding * pixelsToTileUnits;

        const bounds = Bounds.fromPoints(queryGeometry);
        const matching = this.grid.query(bounds.minX - queryPadding, bounds.minY - queryPadding, bounds.maxX + queryPadding, bounds.maxY + queryPadding);

        const cameraBounds = Bounds.fromPoints(args.cameraQueryGeometry).expandBy(queryPadding);
        const matching3D = this.grid3D.query(
            cameraBounds.minX, cameraBounds.minY, cameraBounds.maxX, cameraBounds.maxY,
            (bx1, by1, bx2, by2) => {
                return polygonIntersectsBox(args.cameraQueryGeometry, bx1 - queryPadding, by1 - queryPadding, bx2 + queryPadding, by2 + queryPadding);
            });

        for (const key of matching3D) {
            matching.push(key);
        }

        matching.sort(topDownFeatureComparator);

        const result: QueryResults = {};
        let previousIndex;
        for (const index of matching) {

            // don't check the same feature more than once
            if (index === previousIndex) continue;
            previousIndex = index;

            const match = this.featureIndexArray.get(index);
            let featureGeometry = null;
            this.loadMatchingFeature(
                result,
                match.bucketIndex,
                match.sourceLayerIndex,
                match.featureIndex,
                filter,
                params.layers,
                params.availableImages,
                styleLayers,
                serializedLayers,
                sourceFeatureState,
                (feature: VectorTileFeatureLike, styleLayer: StyleLayer, featureState: FeatureState) => {
                    featureGeometry ||= loadGeometry(feature);

                    return styleLayer.queryIntersectsFeature({
                        queryGeometry,
                        feature,
                        featureState,
                        geometry: featureGeometry,
                        zoom: this.z,
                        transform: args.transform,
                        pixelsToTileUnits,
                        pixelPosMatrix: args.pixelPosMatrix,
                        unwrappedTileID: this.tileID.toUnwrapped(),
                        getElevation: args.getElevation
                    });
                }
            );
        }

        return result;
    }

    loadMatchingFeature(
        result: QueryResults,
        bucketIndex: number,
        sourceLayerIndex: number,
        featureIndex: number,
        filter: FeatureFilter,
        filterLayerIDs: Set<string> | undefined,
        availableImages: string[],
        styleLayers: {[_: string]: StyleLayer},
        serializedLayers: {[_: string]: any},
        sourceFeatureState?: SourceFeatureState,
        intersectionTest?: (
            feature: VectorTileFeatureLike,
            styleLayer: StyleLayer,
            featureState: any,
            id: string | number | void
        ) => boolean | number): void {

        const layerIDs = this.bucketLayerIDs[bucketIndex];
        if (filterLayerIDs && !layerIDs.some(id => filterLayerIDs.has(id)))
            return;

        const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);
        const sourceLayer = this.vtLayers[sourceLayerName];
        const feature = sourceLayer.feature(featureIndex);

        if (filter.needGeometry) {
            const evaluationFeature = toEvaluationFeature(feature, true);
            if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ), evaluationFeature, this.tileID.canonical)) {
                return;
            }
        } else if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) {
            return;
        }

        const id = this.getId(feature, sourceLayerName);

        for (const layerID of layerIDs) {

            if (filterLayerIDs && !filterLayerIDs.has(layerID)) {
                continue;
            }

            const styleLayer = styleLayers[layerID];

            if (!styleLayer) continue;

            let featureState = {};
            if (id && sourceFeatureState) {
                // `feature-state` expression evaluation requires feature state to be available
                featureState = sourceFeatureState.getState(styleLayer.sourceLayer || GEOJSON_TILE_LAYER_NAME, id);
            }

            const serializedLayer = extend({}, serializedLayers[layerID]);

            serializedLayer.paint = evaluateProperties(serializedLayer.paint, styleLayer.paint, feature, featureState, availableImages);
            serializedLayer.layout = evaluateProperties(serializedLayer.layout, styleLayer.layout, feature, featureState, availableImages);

            const intersectionZ = !intersectionTest || intersectionTest(feature, styleLayer, featureState);
            if (!intersectionZ) {
                // Only applied for non-symbol features
                continue;
            }

            const geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y, id) as MapGeoJSONFeature;
            geojsonFeature.layer = serializedLayer;
            let layerResult = result[layerID];
            if (layerResult === undefined) {
                layerResult = result[layerID] = [];
            }
            layerResult.push({featureIndex, feature: geojsonFeature, intersectionZ});
        }
    }

    // Given a set of symbol indexes that have already been looked up,
    // return a matching set of GeoJSONFeatures
    lookupSymbolFeatures(symbolFeatureIndexes: number[],
        serializedLayers: {[_: string]: StyleLayer},
        bucketIndex: number,
        sourceLayerIndex: number,
        filterParams: {
            filterSpec: FilterSpecification;
            globalState: Record<string, any>;
        },
        filterLayerIDs: Set<string> | null,
        availableImages: string[],
        styleLayers: {[_: string]: StyleLayer}): QueryResults {
        const result: QueryResults = {};
        this.loadVTLayers();

        const filter = featureFilter(filterParams.filterSpec, filterParams.globalState);

        for (const symbolFeatureIndex of symbolFeatureIndexes) {
            this.loadMatchingFeature(
                result,
                bucketIndex,
                sourceLayerIndex,
                symbolFeatureIndex,
                filter,
                filterLayerIDs,
                availableImages,
                styleLayers,
                serializedLayers
            );

        }
        return result;
    }

    hasLayer(id: string): boolean {
        for (const layerIDs of this.bucketLayerIDs) {
            for (const layerID of layerIDs) {
                if (id === layerID) return true;
            }
        }

        return false;
    }

    getId(feature: VectorTileFeatureLike, sourceLayerId: string): string | number {
        let id: string | number = feature.id;
        if (this.promoteId) {
            const propName = typeof this.promoteId === 'string' ? this.promoteId : this.promoteId[sourceLayerId];
            id = feature.properties[propName] as string | number;
            if (typeof id === 'boolean') id = Number(id);

            // When cluster is true, the id is the cluster_id even though promoteId is set
            if (id === undefined && feature.properties?.cluster && this.promoteId) {
                id = Number(feature.properties.cluster_id);
            }
        }
        return id;
    }
}

register(
    'FeatureIndex',
    FeatureIndex,
    {omit: ['rawTileData', 'sourceLayerCoder']}
);

function evaluateProperties(serializedProperties, styleLayerProperties, feature, featureState, availableImages) {
    return mapObject(serializedProperties, (property, key) => {
        const prop = styleLayerProperties instanceof PossiblyEvaluated ? styleLayerProperties.get(key) : null;
        return prop?.evaluate ? prop.evaluate(feature, featureState, availableImages) : prop;
    });
}

function topDownFeatureComparator(a, b) {
    return b - a;
}
