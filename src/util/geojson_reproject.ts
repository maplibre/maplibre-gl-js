import {latFromMercatorY, lngFromMercatorX, mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.ts';

import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';

/**
 * A function mapping the first two ordinates of a GeoJSON position to a new position; any further ordinates
 * (altitude and beyond) are carried over.
 */
type PositionMapper = (lng: number, lat: number) => [number, number];

/**
 * @internal
 * Rewrites every position of a GeoJSON object from the map's lng/lat to the "pseudo lng/lat" whose web mercator
 * projection is the map projection's world position, so that geojson-vt and supercluster, which only speak
 * mercator, tile a planar map's data in the right place of its world square.
 * Returns a new object; the input is never mutated, and non-coordinate members are carried over as they are.
 */
export function reprojectGeoJSONToPseudoLngLat<T extends GeoJSON.GeoJSON>(data: T, worldCoordinateHelper: WorldCoordinateHelper): T {
    return mapPositions(data, (lng, lat) => {
        const {x, y} = worldCoordinateHelper.worldFromLngLat(lng, lat);
        return [lngFromMercatorX(x), latFromMercatorY(y)];
    });
}

/**
 * @internal
 * The inverse of {@link reprojectGeoJSONToPseudoLngLat}: rewrites pseudo lng/lat positions (as returned by the
 * worker for cluster children and leaves) back to the map's lng/lat. Returns a new object.
 */
export function reprojectGeoJSONFromPseudoLngLat<T extends GeoJSON.GeoJSON>(data: T, worldCoordinateHelper: WorldCoordinateHelper): T {
    return mapPositions(data, (pseudoLng, pseudoLat) => {
        const lngLat = worldCoordinateHelper.lngLatFromWorld(mercatorXfromLng(pseudoLng), mercatorYfromLat(pseudoLat));
        return [lngLat.lng, lngLat.lat];
    });
}

function mapPositions<T extends GeoJSON.GeoJSON>(data: T, mapper: PositionMapper): T {
    if (!data || typeof data !== 'object') return data;
    switch (data.type) {
        case 'FeatureCollection':
            return {...data, features: data.features.map(feature => mapPositions(feature, mapper))};
        case 'Feature':
            return {...data, geometry: data.geometry ? mapPositions(data.geometry, mapper) : data.geometry};
        case 'GeometryCollection':
            return {...data, geometries: data.geometries.map(geometry => mapPositions(geometry, mapper))};
        case 'Point':
            return {...data, coordinates: mapPosition(data.coordinates, mapper)};
        case 'MultiPoint':
        case 'LineString':
            return {...data, coordinates: data.coordinates.map(position => mapPosition(position, mapper))};
        case 'MultiLineString':
        case 'Polygon':
            return {...data, coordinates: data.coordinates.map(line => line.map(position => mapPosition(position, mapper)))};
        case 'MultiPolygon':
            return {...data, coordinates: data.coordinates.map(polygon => polygon.map(ring => ring.map(position => mapPosition(position, mapper))))};
        default:
            return data;
    }
}

function mapPosition(position: GeoJSON.Position, mapper: PositionMapper): GeoJSON.Position {
    return [...mapper(position[0], position[1]), ...position.slice(2)];
}
