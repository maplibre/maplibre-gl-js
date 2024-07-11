/**
 * Options to pass to the feature properties tranform function
 */
export type FeaturePropertiesTransformOptions = {
    /**
     * The name of the vector tile source.
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
     * The properties of the feature. Edit the content of this dictionarry
     * to transform vector tile feature properties.
     */
    properties: { [_: string]: string | number | boolean };
};

/**
 * A function that transforms the properties of a vector tile feature.
 */
export type FeaturePropertiesTransform = (options: FeaturePropertiesTransformOptions) => Promise<void>
