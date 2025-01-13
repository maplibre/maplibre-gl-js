import {type VectorTileFeature} from '@mapbox/vector-tile';

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
     * TODO: what is the sourceLayer in case of a GeoJSON source?
     */
    sourceLayer: string;

    /**
     * The tile id serialized to a string of the form z/x/y
     */
    tileID: string;

    /**
     * The geometry type: "Unknown", "Point", "LineString", or "Polygon"
     */
    geometryType: string;

    /**
     * The id of the feature in the vector tile
     */
    featureID: number;

    /**
     * The oroginal properties of the feature
     */
    properties: VectorTileFeature['properties'];
};

/**
 * A function that transforms the properties of a vector tile feature.
 */
export type FeaturePropertiesTransform = (options: FeaturePropertiesTransformOptions) => Promise<VectorTileFeature['properties'] | null>;
