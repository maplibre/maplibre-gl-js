/**
 * A unified Bucket interface that supports both “normal” (ArrayGroup-based)
 * and “columnar” (FeatureTable-based) data paths. This allows consumer code
 * to treat all buckets the same way regardless of their internal representation.
 */

import type { CollisionBoxArray } from './array_types.g';
import type { Style } from '../style/style';
import type { TypedStyleLayer } from '../style/style_layer/typed_style_layer';
import type { FeatureIndex } from './feature_index';
import type { Context } from '../gl/context';
import type { FeatureStates } from '../source/source_state';
import type { ImagePosition } from '../render/image_atlas';
import type { CanonicalTileID } from '../source/tile_id';
import type { VectorTileFeature, VectorTileLayer } from '@mapbox/vector-tile';
import type Point from '@mapbox/point-geometry';
import { FeatureTable } from '@maplibre/mlt';
import {SubdivisionGranularitySetting} from "../render/subdivision_granularity_settings";
import {StyleLayer} from "../style/style_layer";
import {DashEntry} from "../render/line_atlas";

//
// Shared Type Definitions
//

export type BucketParameters<L extends StyleLayer> = {
    index: number;
    encoding?: string;
    layers: L[];
    zoom: number;
    pixelRatio: number;
    overscaling: number;
    collisionBoxArray: CollisionBoxArray;
    sourceLayerIndex: number;
    sourceID: string;
};

export type PopulateParameters = {
    featureIndex: FeatureIndex;
    iconDependencies: {};
    patternDependencies: {};
    glyphDependencies: {};
    dashDependencies: Record<string, { round: boolean; dasharray: number[] }>;
    availableImages: string[];
    subdivisionGranularity?: SubdivisionGranularitySetting;
};

export type IndexedFeature = {
    feature: VectorTileFeature;
    id: number | string;
    index: number;
    sourceLayerIndex: number;
};

export type BucketFeature = {
    index: number;
    sourceLayerIndex: number;
    geometry: Point[][];
    properties: any;
    type: 0 | 1 | 2 | 3;
    id?: any;
    readonly patterns: {
        [key: string]: { min: string; mid: string; max: string };
    };
    readonly dashes?: NonNullable<BucketFeature['patterns']>;
    sortKey?: number;
};

/**
 * The unified Bucket interface. Implementations may use either:
 *  - an ArrayGroup (classic) with `populateClassic(...)`
 *  - a FeatureTable (columnar) with `populateColumnar(...)`
 */
export interface Bucket {
    layerIds: string[];
    hasDependencies: boolean;
    readonly layers: Array<any>;
    readonly stateDependentLayers: Array<any>;
    readonly stateDependentLayerIds: Array<string>;

    /**
     * Populate using classic IndexedFeature[] path.
     */
    populate(
        features: IndexedFeature[],
        options: PopulateParameters,
        canonical: CanonicalTileID
    ): void;

    /**
     * Populate using columnar FeatureTable path.
     */
    populateColumnar(
        table: FeatureTable,
        options: PopulateParameters,
        canonical: CanonicalTileID
    ): void;

    /**
     * Update dynamic state (e.g. icon positions, dash patterns).
     */
    update(
        states: FeatureStates,
        vtLayer: VectorTileLayer,
        imagePositions: Record<string, ImagePosition>,
        dashPositions?: Record<string, DashEntry>
    ): void;

    updateColumnar(
        states: FeatureStates,
        vtLayer: VectorTileLayer,
        imagePositions: {[_: string]: ImagePosition}
    ): void;

    isEmpty(): boolean;
    upload(context: Context): void;
    uploadPending(): boolean;
    /**
     * Release all WebGL resources held by this bucket.
     */
    destroy(): void;
}

/**
 * Deserialize an array of serialized buckets into a lookup map by layer id.
 * Works for both classic- and columnar-style buckets so long as they implement
 * Bucket.
 */
export function deserialize(
    input: Array<Bucket>,
    style: Style
): { [p: string]: Bucket } {
    const output: { [layerId: string]: Bucket } = {};

    // If style is unset (e.g. during style reset), return empty map.
    if (!style) return output;

    for (const bucket of input) {
        // Resolve layer references by id
        const layers = bucket.layerIds
            .map(id => style.getLayer(id))
            .filter(Boolean) as any[];
        if (layers.length === 0) continue;

        // Attach actual StyleLayer instances
        (bucket as any).layers = layers;
        if (bucket.stateDependentLayerIds) {
            (bucket as any).stateDependentLayers = bucket.stateDependentLayerIds
                .map(id => layers.find(l => l.id === id))
                .filter(Boolean);
        }

        // Map each layer id to this bucket
        for (const layer of layers) {
            output[layer.id] = <Bucket>bucket;
        }
    }
    return output;
}
