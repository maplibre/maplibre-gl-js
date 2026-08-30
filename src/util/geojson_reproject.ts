import {latFromMercatorY, lngFromMercatorX, mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.ts';

import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';

/**
 * A function mapping the first two ordinates of a GeoJSON position to a new position; the callers carry any
 * further ordinates (altitude and beyond) over.
 */
type PositionMapper = (lng: number, lat: number) => [number, number];

/**
 * The lng/lat that geojson-vt's (and supercluster's) own web mercator projection sends to the given world
 * position. Feeding a planar map's GeoJSON through this makes the worker, which only speaks mercator,
 * tile it at the right place in the map's own world square.
 */
function pseudoLngLatFromWorld(x: number, y: number): [number, number] {
    return [lngFromMercatorX(x), latFromMercatorY(y)];
}

/**
 * @internal
 * Rewrites every position of a GeoJSON object from the map's lng/lat to the "pseudo lng/lat" whose mercator
 * projection lands on the map projection's world position (see `pseudoLngLatFromWorld`).
 * Returns a new object; the input is never mutated. Non-coordinate members are carried over as-is.
 */
export function reprojectGeoJSONToPseudoLngLat<T extends GeoJSON.GeoJSON>(data: T, worldCoordinateHelper: WorldCoordinateHelper): T {
    return mapGeoJSONPositions(data, (lng, lat) => {
        const {x, y} = worldCoordinateHelper.worldFromLngLat(lng, lat);
        return pseudoLngLatFromWorld(x, y);
    });
}

/**
 * @internal
 * The inverse of {@link reprojectGeoJSONToPseudoLngLat}: rewrites pseudo lng/lat positions (as returned by the
 * worker for cluster children and leaves) back to the map's lng/lat. Returns a new object.
 */
export function reprojectGeoJSONFromPseudoLngLat<T extends GeoJSON.GeoJSON>(data: T, worldCoordinateHelper: WorldCoordinateHelper): T {
    return mapGeoJSONPositions(data, (pseudoLng, pseudoLat) => {
        const lngLat = worldCoordinateHelper.lngLatFromWorld(mercatorXfromLng(pseudoLng), mercatorYfromLat(pseudoLat));
        return [lngLat.lng, lngLat.lat];
    });
}

function mapGeoJSONPositions<T extends GeoJSON.GeoJSON>(data: T, mapper: PositionMapper): T {
    if (!data || typeof data !== 'object') return data;
    switch (data.type) {
        case 'FeatureCollection':
            return {...data, features: data.features.map(feature => mapGeoJSONPositions(feature, mapper))};
        case 'Feature':
            return {...data, geometry: data.geometry ? mapGeoJSONPositions(data.geometry, mapper) : data.geometry};
        case 'GeometryCollection':
            return {...data, geometries: data.geometries.map(geometry => mapGeoJSONPositions(geometry, mapper))};
        case 'Point':
        case 'MultiPoint':
        case 'LineString':
        case 'MultiLineString':
        case 'Polygon':
        case 'MultiPolygon':
            return {...data, coordinates: mapCoordinates(data.coordinates, mapper)};
        default:
            return data;
    }
}

function mapCoordinates<C extends GeoJSON.Position | GeoJSON.Position[] | GeoJSON.Position[][] | GeoJSON.Position[][][]>(coordinates: C, mapper: PositionMapper): C {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return coordinates;
    if (typeof coordinates[0] === 'number') {
        const position = coordinates as GeoJSON.Position;
        return [...mapper(position[0], position[1]), ...position.slice(2)] as C;
    }
    return (coordinates as GeoJSON.Position[]).map(nested => mapCoordinates(nested, mapper)) as C;
}
