import {LngLatBounds} from '../geo/lng_lat_bounds';

function getCoordinatesFromGeometry(geometry: GeoJSON.Geometry): number[] {
    if (geometry.type === 'GeometryCollection') {
        return geometry.geometries.map((g: Exclude<GeoJSON.Geometry, GeoJSON.GeometryCollection>) => g.coordinates).flat(Infinity) as number[];
    }
    return geometry.coordinates.flat(Infinity) as number[];
}

/**
 * Calculates the bounding box of GeoJSON data.
 * @param data - The GeoJSON data to calculate bounds for
 * @returns The bounding box of the GeoJSON data
 */
export function getGeoJSONBounds(data: GeoJSON.GeoJSON): LngLatBounds {
    const bounds = new LngLatBounds();
    let coordinates: number[];
    switch (data.type) {
        case 'FeatureCollection':
            coordinates = data.features.map(f => getCoordinatesFromGeometry(f.geometry)).flat(Infinity) as number[];
            break;
        case 'Feature':
            coordinates = getCoordinatesFromGeometry(data.geometry);
            break;
        default:
            coordinates = getCoordinatesFromGeometry(data);
            break;
    }
    if (coordinates.length == 0) {
        return bounds;
    }
    for (let i = 0; i < coordinates.length - 1; i += 2) {
        bounds.extend([coordinates[i], coordinates[i+1]]);
    }
    return bounds;
}
