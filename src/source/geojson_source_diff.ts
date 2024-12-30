/**
 * A way to identify a feature, either by string or by number
 */
export type GeoJSONFeatureId = number | string;

/**
 * The geojson source diff object
 */
export type GeoJSONSourceDiff = {
    /**
     * When set to `true` it will remove all features
     */
    removeAll?: boolean;
    /**
     * An array of features IDs to remove
     */
    remove?: Array<GeoJSONFeatureId>;
    /**
     * An array of features to add
     */
    add?: Array<GeoJSON.Feature>;
    /**
     * An array of update objects
     */
    update?: Array<GeoJSONFeatureDiff>;
};

/**
 * A geojson feature diff object
 */
export type GeoJSONFeatureDiff = {
    /**
     * The feature ID
     */
    id: GeoJSONFeatureId;
    /**
     * If it's a new geometry, place it here
     */
    newGeometry?: GeoJSON.Geometry;
    /**
     * Setting to `true` will remove all preperties
     */
    removeAllProperties?: boolean;
    /**
     * The properties keys to remove
     */
    removeProperties?: Array<string>;
    /**
     * The properties to add or update along side their values
     */
    addOrUpdateProperties?: Array<{key: string; value: any}>;
};

export type UpdateableGeoJSON = GeoJSON.Feature | GeoJSON.FeatureCollection | undefined;

function getFeatureId(feature: GeoJSON.Feature, promoteId?: string): GeoJSONFeatureId | undefined {
    return promoteId ? feature.properties[promoteId] : feature.id;
}

export function isUpdateableGeoJSON(data: GeoJSON.GeoJSON | undefined, promoteId?: string): data is UpdateableGeoJSON {
    // null can be updated
    if (data == null) {
        return true;
    }

    // a single feature with an id can be updated, need to explicitly check against null because 0 is a valid feature id that is falsy
    if (data.type === 'Feature') {
        return getFeatureId(data, promoteId) != null;
    }

    // a feature collection can be updated if every feature has an id, and the ids are all unique
    // this prevents us from silently dropping features if ids get reused
    if (data.type === 'FeatureCollection') {
        const seenIds = new Set<GeoJSONFeatureId>();
        for (const feature of data.features) {
            const id = getFeatureId(feature, promoteId);
            if (id == null) {
                return false;
            }

            if (seenIds.has(id)) {
                return false;
            }

            seenIds.add(id);
        }

        return true;
    }

    return false;
}

export function toUpdateable(data: UpdateableGeoJSON, promoteId?: string) {
    const result = new Map<GeoJSONFeatureId, GeoJSON.Feature>();
    if (data == null) {
        // empty result
    } else if (data.type === 'Feature') {
        result.set(getFeatureId(data, promoteId)!, data);
    } else {
        for (const feature of data.features) {
            result.set(getFeatureId(feature, promoteId)!, feature);
        }
    }

    return result;
}

// mutates updateable
export function applySourceDiff(updateable: Map<GeoJSONFeatureId, GeoJSON.Feature>, diff: GeoJSONSourceDiff, promoteId?: string): void {
    if (diff.removeAll) {
        updateable.clear();
    }

    if (diff.remove) {
        for (const id of diff.remove) {
            updateable.delete(id);
        }
    }

    if (diff.add) {
        for (const feature of diff.add) {
            const id = getFeatureId(feature, promoteId);

            if (id != null) {
                updateable.set(id, feature);
            }
        }
    }

    if (diff.update) {
        for (const update of diff.update) {
            let feature = updateable.get(update.id);

            if (feature == null) {
                continue;
            }

            // be careful to clone the feature and/or properties objects to avoid mutating our input
            const cloneFeature = update.newGeometry || update.removeAllProperties;
            // note: removeAllProperties gives us a new properties object, so we can skip the clone step
            const cloneProperties = !update.removeAllProperties && (update.removeProperties?.length > 0 || update.addOrUpdateProperties?.length > 0);
            if (cloneFeature || cloneProperties) {
                feature = {...feature};
                updateable.set(update.id, feature);
                if (cloneProperties) {
                    feature.properties = {...feature.properties};
                }
            }

            if (update.newGeometry) {
                feature.geometry = update.newGeometry;
            }

            if (update.removeAllProperties) {
                feature.properties = {};
            } else if (update.removeProperties?.length > 0) {
                for (const prop of update.removeProperties) {
                    if (Object.prototype.hasOwnProperty.call(feature.properties, prop)) {
                        delete feature.properties[prop];
                    }
                }
            }

            if (update.addOrUpdateProperties?.length > 0) {
                for (const {key, value} of update.addOrUpdateProperties) {
                    feature.properties[key] = value;
                }
            }
        }
    }
}
