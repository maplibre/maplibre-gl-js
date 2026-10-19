import {clamp} from './util.ts';

import type {CRSWorldCoordinateHelper} from '../geo/projection/crs.ts';
import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';
import type {GeoJSONSourceDiff} from '../source/geojson_source_diff.ts';

/**
 * A function mapping one GeoJSON position to another: the first two ordinates are the horizontal position, and any
 * further ones (altitude and beyond) are carried over as they are.
 */
type PositionMapper = (position: GeoJSON.Position) => GeoJSON.Position;

/**
 * A function mapping the positions of a line or ring to new ones, which may be more than there were.
 */
type LineMapper = (line: GeoJSON.Position[]) => GeoJSON.Position[];

/**
 * The longitude step, in degrees, between the positions an edge along a clamped latitude gets, so that it follows the
 * parallel in the projection instead of cutting across it.
 */
const PARALLEL_STEP = 10;

/**
 * @internal
 * Rewrites every position of a GeoJSON object from the map's lng/lat to the map projection's world coordinates, x and
 * y from 0 to 1 across its world square with y growing down, which geojson-vt tiles with `coordinates: 'unitSquare'`.
 * When the CRS's {@link CRSWorldCoordinateHelper.latitudeRange} leaves latitudes out, the positions of lines and rings
 * past it move onto it, and an edge that then runs along it gets a position every {@link PARALLEL_STEP} degrees of
 * longitude. What lies past it, like the opposite pole of a polar projection, which projects to infinity, then ends up
 * along it, off the map. A line or ring within it costs one latitude check per position. Points are left as they
 * are: geojson-vt leaves out the ones outside the world square.
 * Returns a new object; the input is never mutated, and non-coordinate members are carried over as they are.
 */
export function reprojectGeoJSONToWorld<T extends GeoJSON.GeoJSON>(data: T, crsHelper: CRSWorldCoordinateHelper): T {
    const toWorld: PositionMapper = ([lng, lat, ...rest]) => {
        const {x, y} = crsHelper.worldFromLngLat(lng, lat);
        return [x, y, ...rest];
    };
    const [south, north] = crsHelper.latitudeRange;
    if (south === -90 && north === 90) return mapPositions(data, toWorld);
    const isLimit = (lat: number) => lat === south && south > -90 || lat === north && north < 90;
    return mapPositions(data, toWorld, line => {
        let isPastLimit = false;
        const projected = line.map(position => {
            if (position[1] >= south && position[1] <= north) return toWorld(position);
            isPastLimit = true;
            return position;
        });
        if (!isPastLimit) return projected;
        const clamped: GeoJSON.Position[] = [];
        let previousLng = 0;
        let previousLat = NaN;
        for (let i = 0; i < line.length; i++) {
            const [lng, lat, ...rest] = line[i];
            const clampedLat = clamp(lat, south, north);
            if (clampedLat === previousLat && isLimit(clampedLat)) {
                const steps = Math.ceil(Math.abs(lng - previousLng) / PARALLEL_STEP);
                for (let step = 1; step < steps; step++) {
                    clamped.push(toWorld([previousLng + (lng - previousLng) * step / steps, clampedLat]));
                }
            }
            clamped.push(clampedLat === lat ? projected[i] : toWorld([lng, clampedLat, ...rest]));
            previousLng = lng;
            previousLat = clampedLat;
        }
        return clamped;
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

function mapPositions<T extends GeoJSON.GeoJSON>(data: T, mapper: PositionMapper, lineMapper: LineMapper = line => line.map(mapper)): T {
    if (!data || typeof data !== 'object') return data;
    switch (data.type) {
        case 'FeatureCollection':
            return {...data, features: data.features.map(feature => mapPositions(feature, mapper, lineMapper))};
        case 'Feature':
            return {...data, geometry: data.geometry ? mapPositions(data.geometry, mapper, lineMapper) : data.geometry};
        case 'GeometryCollection':
            return {...data, geometries: data.geometries.map(geometry => mapPositions(geometry, mapper, lineMapper))};
        case 'Point':
            return {...data, coordinates: mapper(data.coordinates)};
        case 'MultiPoint':
            return {...data, coordinates: data.coordinates.map(mapper)};
        case 'LineString':
            return {...data, coordinates: lineMapper(data.coordinates)};
        case 'MultiLineString':
        case 'Polygon':
            return {...data, coordinates: data.coordinates.map(line => lineMapper(line))};
        case 'MultiPolygon':
            return {...data, coordinates: data.coordinates.map(polygon => polygon.map(ring => lineMapper(ring)))};
        default:
            return data;
    }
}

