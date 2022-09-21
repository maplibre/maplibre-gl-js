export type GeoJSONFeatureId = number | string;
export interface GeoJSONSourceDiff {
    removeAll?: boolean;
    removed?: Array<GeoJSONFeatureId>;
    add?: Array<GeoJSON.Feature>;
    update?: Array<GeoJSONFeatureDiff>;
}

export interface GeoJSONFeatureDiff {
    id: GeoJSONFeatureId;
    newGeometry?: GeoJSON.Geometry;
    removeAllProperties?: boolean;
    removeProperties?: Array<string>;
    addOrUpdateProperties?: Array<{key: string; value: any}>;
}

export type UpdateableGeoJSON = GeoJSON.Feature | GeoJSON.FeatureCollection;

function getFeatureId(feature: GeoJSON.Feature, promoteId?: string): GeoJSONFeatureId | undefined {
    return promoteId ? feature.properties[promoteId] : feature.id;
}

export function isUpdateableGeoJSON(data: string | GeoJSON.GeoJSON, promoteId?: string): data is UpdateableGeoJSON {
    // strings are not updateable
    if (typeof data === 'string') {
        return false;
    }

    // a single feature with an id can be updated, need to explicitly check against null because 0 is a valid feature id that is falsy
    if (data.type === 'Feature' && getFeatureId(data, promoteId) != null) {
        return true;
    }

    // a feature collection can be updated if every feature has an id, and the ids are all unique
    // this prevents us from silently dropping features if ids get reused
    if (data.type === 'FeatureCollection') {
        const seenIds: {[id: GeoJSONFeatureId]: boolean} = {};
        for (const feature of data.features) {
            const id = getFeatureId(feature, promoteId);
            if (id == null) {
                return false;
            }

            if (seenIds[id]) {
                return false;
            }

            seenIds[id] = true;
        }
    }

    return true;
}

export function toUpdateable(data: UpdateableGeoJSON, promoteId?: string) {
    const result: {[id: GeoJSONFeatureId]: GeoJSON.Feature} = {};
    if (data.type === 'Feature') {
        result[getFeatureId(data, promoteId)!] = data;
    } else {
        for (const feature of data.features) {
            result[getFeatureId(feature, promoteId)!] = feature;
        }
    }

    return result;
}

// may mutate updateable, but may also return a completely different object entirely
export function applySourceDiff(updateable: {[id: GeoJSONFeatureId]: GeoJSON.Feature}, diff: GeoJSONSourceDiff, promoteId?: string) {
    if (diff.removeAll) {
        updateable = {};
    }

    if (diff.removed) {
        for (const id of diff.removed) {
            delete updateable[id];
        }
    }

    if (diff.add) {
        for (const feature of diff.add) {
            const id = getFeatureId(feature, promoteId);

            if (id != null) {
                updateable[id] = feature;
            }
        }
    }

    if (diff.update) {
        for (const update of diff.update) {
            let feature = updateable[update.id];

            if (feature == null) {
                continue;
            }

            // be careful to clone the feature and/or properties objects to avoid mutating our input
            const cloneFeature = update.newGeometry || update.removeAllProperties;
            const cloneProperties = update.removeProperties?.length > 0 || update.addOrUpdateProperties?.length > 0;
            if (cloneFeature || cloneProperties) {
                feature = {...feature};
                updateable[update.id] = feature;
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

    return updateable;
}
