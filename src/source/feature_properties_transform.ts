import {type VectorTileFeature} from '@mapbox/vector-tile';
import {type Geometry} from 'geojson';

/**
 * Options to pass to the feature properties tranform function
 */
export type FeaturePropertiesTransformOptions = {
    /**
     * The ID of the vector tile source
     */
    source: string;

    /**
     * The name of the vector tile layer
     */
    sourceLayer: string;

    /**
     * The tile id serialized to a string of the form z/x/y
     */
    tileID: string;

    /**
     * The feature's geometry
     */
    geometry: Geometry;

    /**
     * The id of the feature in the vector tile
     */
    featureID: number;

    /**
     * The original properties of the feature
     */
    properties: VectorTileFeature['properties'];
};

/**
 * A function that transforms the properties of a vector tile feature.
 */
export type FeaturePropertiesTransform = (options: FeaturePropertiesTransformOptions) => Promise<VectorTileFeature['properties'] | null>;
