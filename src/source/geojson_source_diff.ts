import { mercatorXfromLng, mercatorYfromLat } from '../geo/mercator_coordinate';
import {TileBitmask} from '../util/tile_bitmask';

export type GeoJSONFeatureId = number | string;
export interface GeoJSONSourceDiff {
    removeAll?: boolean;
    remove?: Array<GeoJSONFeatureId>;
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
export function applySourceDiff(updateable: Map<GeoJSONFeatureId, GeoJSON.Feature>, diff: GeoJSONSourceDiff, invalidated: TileBitmask, promoteId?: string): void {
    if (diff.removeAll) {
        invalidated.mark(0, 0, 0);
        updateable.clear();
    }

    if (diff.remove) {
        for (const id of diff.remove) {
            const existing = updateable.get(id);
            markInvalidated(updateable, id, invalidated, existing);
            updateable.delete(id);
        }
    }

    if (diff.add) {
        for (const feature of diff.add) {
            const id = getFeatureId(feature, promoteId);

            if (id != null) {
                // just in case someone uses the add path as an update, invalidate any preexisting feature
                markInvalidated(updateable, id, invalidated, updateable.get(id));

                markInvalidated(updateable, id, invalidated, feature);
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

            // invalidate the original feature
            markInvalidated(updateable, update.id, invalidated, feature);

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
                // need to clear the bbox when we change the geometry, it'll be recalculated on demand
                delete feature.bbox;
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

            // invalidate the updated feature
            markInvalidated(updateable, update.id, invalidated, feature);
        }
    }
}

function markInvalidated(updateable: Map<GeoJSONFeatureId, GeoJSON.Feature>, id: GeoJSONFeatureId, invalidated: TileBitmask, feature: GeoJSON.Feature | undefined) {
    if (!feature || !feature.geometry) {
        return;
    }

    let bbox = feature.bbox;
    if (!bbox || bbox.length !== 4) {
        if (bbox && bbox.length === 6) {
            // downgrade a 3d -> 2d bbox
            bbox = [bbox[0], bbox[1], bbox[3], bbox[4]];
        } else {
            // create a bbox from scratch
            bbox = getBbox(feature.geometry);
        }

        // store off the bbox for reuse later
        feature = {...feature, bbox};
        updateable.set(id, feature);
    }

    const [minX, minY, maxX, maxY] = bbox;
    let minTileX = convertToTileCoord(mercatorXfromLng(minX));
    let minTileY = convertToTileCoord(mercatorYfromLat(minY));
    let maxTileX = convertToTileCoord(mercatorXfromLng(maxX));
    let maxTileY = convertToTileCoord(mercatorYfromLat(maxY));
    let zoom = TileBitmask.MaxZoom;
    // zoom out here to avoid having to compact ancestors in the tile bitmask
    while (zoom > 0 && maxTileX > 2 + minTileX && maxTileY > 2 + minTileY) {
        zoom--;
        minTileX >>= 1;
        minTileY >>= 1;
        maxTileX >>= 1;
        maxTileY >>= 1;
    }
    for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            invalidated.mark(zoom, tileX, tileY);
        }
    }
}

function convertToTileCoord(val: number): number {
    const result = Math.floor(val * TileBitmask.MaxZoomTiles);
    if (result < 0) {
        return 0;
    } else if (result >= TileBitmask.MaxZoomTiles) {
        return TileBitmask.MaxZoomTiles - 1;
    } else {
        return result;
    }
}

function getBbox(geometry: GeoJSON.Geometry, bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]): [number, number, number, number] {
    switch (geometry.type) {
        case 'Point':
            updateBbox(bbox, geometry.coordinates);
            break;
        case 'LineString':
        case 'MultiPoint':
            for (const pos of geometry.coordinates) {
                updateBbox(bbox, pos);
            }
            break;
        case 'Polygon':
        case 'MultiLineString':
            for (const ring of geometry.coordinates) {
                for (const pos of ring) {
                    updateBbox(bbox, pos);
                }
            }
            break;
        case 'MultiPolygon':
            for (const polygon of geometry.coordinates) {
                for (const ring of polygon) {
                    for (const pos of ring) {
                        updateBbox(bbox, pos);
                    }
                }
            }
            break;
        case 'GeometryCollection':
            for (const geom of geometry.geometries) {
                getBbox(geom, bbox);
            }
            break;
    }

    return bbox;
}

function updateBbox(bbox: [number, number, number, number], [x, y]: GeoJSON.Position) {
    bbox[0] = Math.min(bbox[0], x);
    bbox[1] = Math.min(bbox[1], y);
    bbox[2] = Math.max(bbox[2], x);
    bbox[3] = Math.max(bbox[3], y);
}
