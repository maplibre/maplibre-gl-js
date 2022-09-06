
export type GeoJSONFeatureId = number | string;
export interface GeoJSONSourceDiff {
    removeAll?: boolean;
    removed?: Array<GeoJSONFeatureId>;
    add?: Array<GeoJSON.Feature>;
    update?: Array<GeoJSONFeatureDiff>;
}

export interface GeoJSONSourceDiffWithAddIds extends GeoJSONSourceDiff {
    addIds?: Array<GeoJSONFeatureId>;
}

export interface GeoJSONFeatureDiff {
    id: GeoJSONFeatureId;
    newGeometry?: GeoJSON.Geometry;
    removeAllProperties?: boolean;
    removeProperties?: Array<string>;
    addOrUpdateProperties?: Array<{key: string; value: any}>;
}

export type UpdateableGeoJSON = GeoJSON.Feature | GeoJSON.FeatureCollection;

export function isUpdateable(data: string | GeoJSON.GeoJSON): data is UpdateableGeoJSON {
    if (typeof data === 'string') {
        return false;
    }

    if (data.type === 'Feature' && data.id != null) {
        return true;
    }

    if (data.type === 'FeatureCollection' && data.features.every(feature => feature.id != null)) {
        return true;
    }

    return false;
}

export function getUpdateable(data: UpdateableGeoJSON): {[id: GeoJSONFeatureId]: GeoJSON.Feature} {
    const result: {[id: GeoJSONFeatureId]: GeoJSON.Feature} = {};
    if (data.type === 'Feature') {
        result[data.id] = data;
    } else {
        for (const feature of data.features) {
            data[feature.id] = feature;
        }
    }
    return result;
}

// may mutate updateable, but may also return a completely different object entirely
export function applySourceDiff(updateable: {[id: string]: GeoJSON.Feature}, diff: GeoJSONSourceDiffWithAddIds) {
    if (diff.removeAll) {
        updateable = {};
    }

    if (diff.removed != null) {
        for (const id of diff.removed) {
            if (Object.prototype.hasOwnProperty.call(updateable, id)) {
                delete updateable[id];
            } else {
                throw new Error(`Cannot delete feature ${id} because it does not exist`);
            }
        }
    }

    if (diff.add != null) {
        if (diff.addIds == null || diff.addIds.length !== diff.add.length) {
            throw new Error('Cannot add data without corresponding ids');
        }

        for (let i = 0; i < diff.add.length; i++) {
            const feature = diff.add[i];
            const id = diff.addIds[i];

            if (updateable[id] != null) {
                throw new Error(`Cannot add '${id}' because it already exists`);
            }

            updateable[id] = feature;
        }
    }

    if (diff.update != null) {
        for (const update of diff.update) {
            let feature = updateable[update.id];

            if (feature == null) {
                throw new Error(`Cannot update '${feature.id}' which does not exist`);
            }

            // be careful to clone the feature and/or properties objects to avoid mutating our input
            const cloneFeature = update.newGeometry != null || update.removeAllProperties;
            const cloneProperties = update.removeProperties?.length > 0 || update.addOrUpdateProperties?.length > 0;
            if (cloneFeature || cloneProperties) {
                feature = {...feature};
                updateable[update.id] = feature;
                if (cloneProperties) {
                    feature.properties = {...feature.properties};
                }
            }

            if (update.newGeometry != null) {
                feature.geometry = update.newGeometry;
            }

            if (update.removeAllProperties) {
                feature.properties = {};
            } else if (update.removeProperties?.length > 0) {
                for (const prop of update.removeProperties) {
                    if (Object.prototype.hasOwnProperty.call(feature.properties, prop)) {
                        delete feature.properties[prop];
                    } else {
                        throw new Error(`Cannot delete property ${prop} on feature ${feature.id} because it does not exist`);
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
