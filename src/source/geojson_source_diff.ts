/**
 * A way to identify a feature, either by string or by number
 */
export type GeoJSONFeatureId = number | string;

/**
 * The geojson source diff object - processed in the following order: remove, add, update. Provides an efficient
 * way to update GeoJSON data in a map source without having to replace the entire dataset.
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
 * A geojson feature diff object - processed in the following order: new geometry, remove properties, add/update properties.
 * Provides an efficient way to update GeoJSON features in a map source without replacing the entire feature.
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

/**
 * Converts a GeoJSON object into a map of feature IDs to GeoJSON features.
 * @param data - The GeoJSON object to convert.
 * @param promoteId - If set, the feature id will be set to the promoteId property value.
 * @returns A map of feature IDs to GeoJSON features, or `undefined` if the GeoJSON object is not a valid updateable object.
 *
 * Features must have unique identifiers to be updateable. IDs can come from:
 * - The feature's `id` property (standard GeoJSON)
 * - A promoted property specified by `promoteId` (e.g., a "name" property)
 */
export function toUpdateable(data: GeoJSON.GeoJSON | undefined, promoteId?: string): Map<GeoJSONFeatureId, GeoJSON.Feature> | undefined {
    const updateable = new Map<GeoJSONFeatureId, GeoJSON.Feature>();

    // null can be updated - empty updateable
    if (data == null) {
        return updateable;
    }

    // {} can be updated - empty updateable
    if (data.type == null) {
        return updateable;
    }

    // a single feature with an id can be updated, need to explicitly check against null because 0 is a valid feature id that is falsy
    if (data.type === 'Feature') {
        const id = getFeatureId(data, promoteId);
        if (id == null) return undefined;

        updateable.set(id, data);
        return updateable;
    }

    // a feature collection can be updated if every feature has a unique id, which prevents the silent dropping of features
    if (data.type === 'FeatureCollection') {
        const seenIds = new Set<GeoJSONFeatureId>();

        for (const feature of data.features) {
            const id = getFeatureId(feature, promoteId);
            if (id == null) return undefined;

            if (seenIds.has(id)) return undefined;
            seenIds.add(id);

            updateable.set(id, feature);
        }

        return updateable;
    }

    return undefined;
}

/**
 * Mutates updateable and applies a {@link GeoJSONSourceDiff}. Operations are processed in a specific order to ensure predictable behavior:
 * 1. Remove operations (removeAll, remove)
 * 2. Add operations (add)
 * 3. Update operations (update)
 * @returns an array of geometries that were affected by the diff - with the exception of removeAll which does not track any affected geometries.
 */
export function applySourceDiff(updateable: Map<GeoJSONFeatureId, GeoJSON.Feature>, diff: GeoJSONSourceDiff, promoteId?: string): GeoJSON.Geometry[] {
    const affectedGeometries: GeoJSON.Geometry[] = [];

    if (diff.removeAll) {
        updateable.clear();
    }
    else if (diff.remove) {
        for (const id of diff.remove) {
            const existing = updateable.get(id);
            if (!existing) continue;

            affectedGeometries.push(existing.geometry);
            updateable.delete(id);
        }
    }

    if (diff.add) {
        for (const feature of diff.add) {
            const id = getFeatureId(feature, promoteId);
            if (id == null) continue;

            const existing = updateable.get(id);
            if (existing) affectedGeometries.push(existing.geometry);

            affectedGeometries.push(feature.geometry);
            updateable.set(id, feature);
        }
    }

    if (diff.update) {
        for (const update of diff.update) {
            const existing = updateable.get(update.id);
            if (!existing) continue;

            const changeGeometry = !!update.newGeometry;

            const changeProps =
                update.removeAllProperties ||
                update.removeProperties?.length > 0 ||
                update.addOrUpdateProperties?.length > 0;

            // nothing to do
            if (!changeGeometry && !changeProps) continue;

            // clone once since we'll mutate
            affectedGeometries.push(existing.geometry);
            const feature = {...existing};
            updateable.set(update.id, feature);

            if (changeGeometry) {
                affectedGeometries.push(update.newGeometry);
                feature.geometry = update.newGeometry;
            }

            if (changeProps) {
                if (update.removeAllProperties) {
                    feature.properties = {};
                } else {
                    feature.properties = {...feature.properties || {}};
                }

                if (update.removeProperties) {
                    for (const key of update.removeProperties) {
                        delete feature.properties[key];
                    }
                }

                if (update.addOrUpdateProperties) {
                    for (const {key, value} of update.addOrUpdateProperties) {
                        feature.properties[key] = value;
                    }
                }
            }
        }
    }

    return affectedGeometries;
}

/**
 * Merge two GeoJSONSourceDiffs, considering the order of operations as specified above (remove, add, update).
 *
 * For `add` features that use promoteId, the feature id will be set to the promoteId value temporarily so that
 * the merge can be completed, then reverted to the original promoteId state after the merge.
 */
export function mergeSourceDiffs(
    prevDiff: GeoJSONSourceDiff | undefined,
    nextDiff: GeoJSONSourceDiff | undefined,
    promoteId?: string
): GeoJSONSourceDiff {
    if (!prevDiff) return nextDiff || {};
    if (!nextDiff) return prevDiff || {};

    if (promoteId) {
        // Temporarily normalize diff.add for features using promoteId
        promoteFeatureIds(prevDiff.add, promoteId);
        promoteFeatureIds(nextDiff.add, promoteId);
    }

    // Hash for o(1) lookups while creating a mutatable copy of the collections
    const prev = diffToHashed(prevDiff);
    const next = diffToHashed(nextDiff);

    // Resolve merge conflicts
    resolveMergeConflicts(prev, next);

    // Simply merge the two diffs now that conflicts have been resolved
    const merged: GeoJSONSourceDiffHashed = {};
    if (prev.removeAll || next.removeAll) merged.removeAll = true;
    merged.remove = new Set([...prev.remove , ...next.remove]);
    merged.add    = new Map([...prev.add    , ...next.add]);
    merged.update = new Map([...prev.update , ...next.update]);

    // Squash the merge - removing then adding the same feature
    if (merged.remove.size && merged.add.size) {
        for (const id of merged.add.keys()) {
            merged.remove.delete(id);
        }
    }

    // Convert back to array-based representation
    const mergedDiff = hashedToDiff(merged);

    if (promoteId) {
        // Revert diff.add for features using promoteId
        demoteFeatureIds(mergedDiff.add, promoteId);
    }

    return mergedDiff;
}

/**
 * Resolve merge conflicts between two GeoJSONSourceDiffs considering the ordering above (remove/add/update).
 *
 * - If you `removeAll` and then `add` features in the same diff, the added features will be kept.
 * - Updates only apply to features that exist after removes and adds have been processed.
 */
function resolveMergeConflicts(prev: GeoJSONSourceDiffHashed, next: GeoJSONSourceDiffHashed) {
    // Removing all features with added or updated features in previous - and clear no-op removes
    if (next.removeAll) {
        prev.add.clear();
        prev.update.clear();
        prev.remove.clear();
        next.remove.clear();
    }

    // Removing features that were added or updated in previous
    for (const id of next.remove) {
        prev.add.delete(id);
        prev.update.delete(id);
    }

    // Updating features that were updated in previous
    for (const [id, nextUpdate] of next.update) {
        const prevUpdate = prev.update.get(id);
        if (!prevUpdate) continue;

        next.update.set(id, mergeFeatureDiffs(prevUpdate, nextUpdate));
        prev.update.delete(id);
    }
}

/**
 * Merge two feature diffs for the same feature id, considering the order of operations as specified above (remove, add/update).
 */
function mergeFeatureDiffs(prev: GeoJSONFeatureDiff, next: GeoJSONFeatureDiff): GeoJSONFeatureDiff {
    const merged: GeoJSONFeatureDiff = {id: prev.id};

    // Removing all properties with added or updated properties in previous - and clear no-op removes
    if (next.removeAllProperties) {
        delete prev.removeProperties;
        delete prev.addOrUpdateProperties;
        delete next.removeProperties;
    }
    // Removing properties that were added or updated in previous
    if (next.removeProperties) {
        for (const key of next.removeProperties) {
            const index = prev.addOrUpdateProperties.findIndex(prop => prop.key === key);
            if (index > -1) prev.addOrUpdateProperties.splice(index, 1);
        }
    }

    // Merge the two diffs
    if (prev.removeAllProperties || next.removeAllProperties) {
        merged.removeAllProperties = true;
    }
    if (prev.removeProperties || next.removeProperties) {
        merged.removeProperties = [...prev.removeProperties || [], ...next.removeProperties || []];
    }
    if (prev.addOrUpdateProperties || next.addOrUpdateProperties) {
        merged.addOrUpdateProperties = [...prev.addOrUpdateProperties || [], ...next.addOrUpdateProperties || []];
    }
    if (prev.newGeometry || next.newGeometry) {
        merged.newGeometry = next.newGeometry || prev.newGeometry;
    }

    return merged;
}

/**
 * Mutates diff.add and applies a feature id using the promoteId property
 */
function promoteFeatureIds(add: Array<GeoJSON.Feature>, promoteId: string) {
    if (!add) return;

    for (const feature of add) {
        const id = getFeatureId(feature, promoteId);
        if (id != null) feature.id = id;
    }
}

/**
 * Mutates diff.add and removes the feature id if using the promoteId property
 */
function demoteFeatureIds(add: Array<GeoJSON.Feature>, promoteId: string) {
    if (!add) return;

    for (const feature of add) {
        const id = getFeatureId(feature, promoteId);
        if (id != null) delete feature.id;
    }
}

/**
 * @internal
 * Internal representation of GeoJSONSourceDiff using Sets and Maps for efficient operations
 */
type GeoJSONSourceDiffHashed = {
    removeAll?: boolean;
    remove?: Set<GeoJSONFeatureId>;
    add?: Map<GeoJSONFeatureId, GeoJSON.Feature>;
    update?: Map<GeoJSONFeatureId, GeoJSONFeatureDiff>;
};

/**
 * @internal
 * Convert a GeoJSONSourceDiff to an idempotent hashed representation using Sets and Maps
 */
function diffToHashed(diff: GeoJSONSourceDiff | undefined): GeoJSONSourceDiffHashed {
    if (!diff) return {};

    const hashed: GeoJSONSourceDiffHashed = {};

    hashed.removeAll = diff.removeAll;
    hashed.remove = new Set(diff.remove || []);
    hashed.add    = new Map(diff.add?.map(feature => [feature.id, feature]));
    hashed.update = new Map(diff.update?.map(update => [update.id, update]));

    return hashed;
}

/**
 * @internal
 * Convert a hashed GeoJSONSourceDiff back to the array-based representation
 */
function hashedToDiff(hashed: GeoJSONSourceDiffHashed): GeoJSONSourceDiff {
    const diff: GeoJSONSourceDiff = {};

    if (hashed.removeAll) {
        diff.removeAll = hashed.removeAll;
    }
    if (hashed.remove) {
        diff.remove = Array.from(hashed.remove);
    }
    if (hashed.add) {
        diff.add = Array.from(hashed.add.values());
    }
    if (hashed.update) {
        diff.update = Array.from(hashed.update.values());
    }

    return diff;
}
