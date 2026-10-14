import type {CRSWorldCoordinateHelper} from '../geo/projection/crs.ts';
import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';
import type {GeoJSONSourceDiff} from '../source/geojson_source_diff.ts';

/**
 * A function mapping one GeoJSON position to another: the first two ordinates are the horizontal position, and any
 * further ones (altitude and beyond) are carried over as they are.
 */
type PositionMapper = (position: GeoJSON.Position) => GeoJSON.Position;

/**
 * @internal
 * Rewrites every position of a GeoJSON object from the map's lng/lat to the map projection's world coordinates, x and
 * y from 0 to 1 across its world square with y growing down, which geojson-vt tiles with its `worldCoordinates` option.
 * Returns a new object; the input is never mutated, and non-coordinate members are carried over as they are.
 */
export function reprojectGeoJSONToWorld<T extends GeoJSON.GeoJSON>(data: T, crsHelper: CRSWorldCoordinateHelper): T {
    return mapPositions(data, ([lng, lat, ...rest]) => {
        const {x, y} = crsHelper.worldFromLngLat(lng, lat);
        return [x, y, ...rest];
    });
}

/**
 * @internal
 * The inverse of {@link reprojectGeoJSONToWorld}: rewrites world coordinates (as returned by the worker for cluster
 * children and leaves) back to the map's lng/lat. Returns a new object.
 */
export function reprojectGeoJSONFromWorld<T extends GeoJSON.GeoJSON>(data: T, worldCoordinateHelper: WorldCoordinateHelper): T {
    return mapPositions(data, ([x, y, ...rest]) => {
        const lngLat = worldCoordinateHelper.lngLatFromWorld(x, y);
        return [lngLat.lng, lngLat.lat, ...rest];
    });
}

/**
 * @internal
 * Rewrites the geometries a diff adds or replaces, as {@link reprojectGeoJSONToWorld} does for whole data.
 * Returns a new diff; removals and property changes are carried over as they are.
 */
export function reprojectGeoJSONSourceDiffToWorld(diff: GeoJSONSourceDiff, crsHelper: CRSWorldCoordinateHelper): GeoJSONSourceDiff {
    const reprojected = {...diff};
    if (diff.add) {
        reprojected.add = diff.add.map(feature => reprojectGeoJSONToWorld(feature, crsHelper));
    }
    if (diff.update) {
        reprojected.update = diff.update.map(update => update.newGeometry ?
            {...update, newGeometry: reprojectGeoJSONToWorld(update.newGeometry, crsHelper)} :
            update);
    }
    return reprojected;
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
            return {...data, coordinates: mapper(data.coordinates)};
        case 'MultiPoint':
        case 'LineString':
            return {...data, coordinates: data.coordinates.map(mapper)};
        case 'MultiLineString':
        case 'Polygon':
            return {...data, coordinates: data.coordinates.map(line => line.map(mapper))};
        case 'MultiPolygon':
            return {...data, coordinates: data.coordinates.map(polygon => polygon.map(ring => ring.map(mapper)))};
        default:
            return data;
    }
}

