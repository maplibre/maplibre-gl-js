import {LngLatBounds} from '../geo/lng_lat_bounds';

type DeepCoordinates = GeoJSON.Position | DeepCoordinates[];

function extractCoordinates(coords: DeepCoordinates): number[][] {
    if (!coords || coords.length === 0) return [];

    if (typeof coords[0] === 'number') {
        return [coords as number[]];
    }

    return coords.flatMap(c => extractCoordinates(c));
}

function getCoordinatesFromGeometry(geometry: GeoJSON.Geometry): number[][] {
    if (geometry.type === 'GeometryCollection') {
        return geometry.geometries.flatMap(g => getCoordinatesFromGeometry(g));
    }

    return extractCoordinates(geometry.coordinates);
}

/**
 * Calculates the bounding box of GeoJSON data.
 * @param data - The GeoJSON data to calculate bounds for
 * @returns The bounding box of the GeoJSON data
 */
export function getGeoJSONBounds(data: GeoJSON.GeoJSON): LngLatBounds {
    const bounds = new LngLatBounds();
    let coordinates: number[][];

    switch (data.type) {
        case 'FeatureCollection':
            coordinates = data.features.flatMap(f => getCoordinatesFromGeometry(f.geometry));
            break;
        case 'Feature':
            coordinates = getCoordinatesFromGeometry(data.geometry);
            break;
        default:
            coordinates = getCoordinatesFromGeometry(data);
            break;
    }

    if (coordinates.length === 0) {
        return bounds;
    }

    for (let i = 0; i < coordinates.length; i++) {
        const [lng, lat] = coordinates[i];

        bounds.extend([lng, lat]);
    }
    return bounds;
}
