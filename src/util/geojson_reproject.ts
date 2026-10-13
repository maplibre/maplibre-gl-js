import {latFromMercatorY, lngFromMercatorX, mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.ts';
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
 * The longitude step, in degrees, between the positions a clipped ring gets along the parallel that closes it, so
 * that the ring follows the parallel in the projection instead of cutting across it.
 */
const PARALLEL_STEP = 10;

/**
 * @internal
 * Rewrites every position of a GeoJSON object from the map's lng/lat to the "pseudo lng/lat" whose web mercator
 * projection is the map projection's world position, so that geojson-vt and supercluster, which only speak
 * mercator, tile a planar map's data in the right place of its world square. The data is first clipped to the
 * CRS's {@link CRSWorldCoordinateHelper.latitudeRange}, with edges straight in lng/lat as GeoJSON specifies:
 * points beyond it move onto its edge, lines are cut where they leave it, and rings are closed along the parallel
 * they leave it by.
 * Returns a new object; the input is never mutated, and non-coordinate members are carried over as they are.
 */
export function reprojectGeoJSONToPseudoLngLat<T extends GeoJSON.GeoJSON>(data: T, crsHelper: CRSWorldCoordinateHelper): T {
    const [south, north] = crsHelper.latitudeRange;
    const clipped = south > -90 || north < 90 ? clipToLatitudes(data, south, north) : data;
    return mapPositions(clipped, ([lng, lat, ...rest]) => {
        const {x, y} = crsHelper.worldFromLngLat(lng, lat);
        return [lngFromMercatorX(x), latFromMercatorY(y), ...rest];
    });
}

/**
 * @internal
 * The inverse of {@link reprojectGeoJSONToPseudoLngLat}: rewrites pseudo lng/lat positions (as returned by the
 * worker for cluster children and leaves) back to the map's lng/lat. Returns a new object.
 */
export function reprojectGeoJSONFromPseudoLngLat<T extends GeoJSON.GeoJSON>(data: T, worldCoordinateHelper: WorldCoordinateHelper): T {
    return mapPositions(data, ([pseudoLng, pseudoLat, ...rest]) => {
        const lngLat = worldCoordinateHelper.lngLatFromWorld(mercatorXfromLng(pseudoLng), mercatorYfromLat(pseudoLat));
        return [lngLat.lng, lngLat.lat, ...rest];
    });
}

/**
 * @internal
 * Rewrites the geometries a diff adds or replaces, as {@link reprojectGeoJSONToPseudoLngLat} does for whole data.
 * Returns a new diff; removals and property changes are carried over as they are.
 */
export function reprojectGeoJSONSourceDiffToPseudoLngLat(diff: GeoJSONSourceDiff, crsHelper: CRSWorldCoordinateHelper): GeoJSONSourceDiff {
    const reprojected = {...diff};
    if (diff.add) {
        reprojected.add = diff.add.map(feature => reprojectGeoJSONToPseudoLngLat(feature, crsHelper));
    }
    if (diff.update) {
        reprojected.update = diff.update.map(update => update.newGeometry ?
            {...update, newGeometry: reprojectGeoJSONToPseudoLngLat(update.newGeometry, crsHelper)} :
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

/**
 * Clips a GeoJSON object to the latitudes from `south` to `north`, as {@link reprojectGeoJSONToPseudoLngLat} describes.
 * A line or polygon with nothing inside is left with no coordinates.
 */
function clipToLatitudes<T extends GeoJSON.GeoJSON>(data: T, south: number, north: number): T {
    if (!data || typeof data !== 'object') return data;
    switch (data.type) {
        case 'FeatureCollection':
            return {...data, features: data.features.map(feature => clipToLatitudes(feature, south, north))};
        case 'Feature':
            return {...data, geometry: data.geometry ? clipToLatitudes(data.geometry, south, north) : data.geometry};
        case 'GeometryCollection':
            return {...data, geometries: data.geometries.map(geometry => clipToLatitudes(geometry, south, north))};
        case 'Point':
            return {...data, coordinates: clampLatitude(data.coordinates, south, north)};
        case 'MultiPoint':
            return {...data, coordinates: data.coordinates.map(position => clampLatitude(position, south, north))};
        case 'LineString': {
            const lines = clipLine(data.coordinates, south, north);
            return lines.length > 1 ? {...data, type: 'MultiLineString', coordinates: lines} : {...data, coordinates: lines[0] ?? []};
        }
        case 'MultiLineString':
            return {...data, coordinates: data.coordinates.flatMap(line => clipLine(line, south, north))};
        case 'Polygon':
            return {...data, coordinates: clipPolygon(data.coordinates, south, north)};
        case 'MultiPolygon':
            return {...data, coordinates: data.coordinates.map(polygon => clipPolygon(polygon, south, north)).filter(polygon => polygon.length > 0)};
        default:
            return data;
    }
}

/**
 * The position with its latitude moved to the nearest one from `south` to `north`; the position itself when it is
 * between them already.
 */
function clampLatitude(position: GeoJSON.Position, south: number, north: number): GeoJSON.Position {
    return position[1] >= south && position[1] <= north ? position : [position[0], clamp(position[1], south, north), ...position.slice(2)];
}

/**
 * Cuts a line where it leaves the latitudes from `south` to `north`, returning the pieces inside.
 */
function clipLine(line: GeoJSON.Position[], south: number, north: number): GeoJSON.Position[][] {
    if (line.every(([, lat]) => lat >= south && lat <= north)) return [line];
    const pieces: GeoJSON.Position[][] = [];
    let continuesPiece = false;
    for (let i = 1; i < line.length; i++) {
        const [start, end] = latitudeInterval(line[i - 1], line[i], south, north);
        if (start > end) continue;
        if (!continuesPiece) pieces.push([pointAlong(line[i - 1], line[i], start)]);
        pieces[pieces.length - 1].push(pointAlong(line[i - 1], line[i], end));
        continuesPiece = end === 1;
    }
    return pieces;
}

/**
 * Clips each ring of a polygon to the latitudes from `south` to `north`, dropping the rings with nothing inside.
 */
function clipPolygon(rings: GeoJSON.Position[][], south: number, north: number): GeoJSON.Position[][] {
    return rings.map(ring => clipRingToParallel(clipRingToParallel(ring, south, 1), north, -1)).filter(ring => ring.length > 0);
}

/**
 * Clips a ring to one side of the parallel at `latitude`, north of it when `side` is 1 and south of it when -1. The
 * ring is closed along the parallel: from where it leaves to where it comes back, it gets a position every
 * {@link PARALLEL_STEP} degrees of longitude. The walk starts at a position inside, so the ring always comes back
 * before the walk ends.
 */
function clipRingToParallel(ring: GeoJSON.Position[], latitude: number, side: 1 | -1): GeoJSON.Position[] {
    const isInside = (position: GeoJSON.Position) => (position[1] - latitude) * side >= 0;
    if (ring.every(isInside)) return ring;
    const start = ring.findIndex(isInside);
    if (start === -1) return [];
    const [first, last] = [ring[0], ring[ring.length - 1]];
    const count = first[0] === last[0] && first[1] === last[1] ? ring.length - 1 : ring.length;
    const clipped = [ring[start]];
    let exit = ring[start];
    for (let i = 1; i <= count; i++) {
        const previous = ring[(start + i - 1) % count];
        const current = ring[(start + i) % count];
        if (isInside(previous) !== isInside(current)) {
            const crossing = pointAlong(previous, current, (latitude - previous[1]) / (current[1] - previous[1]));
            if (isInside(previous)) {
                exit = crossing;
            } else {
                clipped.push(...alongParallel(exit, crossing, latitude));
            }
            clipped.push(crossing);
        }
        if (isInside(current)) clipped.push(current);
    }
    return clipped;
}

/**
 * The part of the edge from `a` to `b` between the latitudes `south` and `north`, as fractions of the way along it;
 * the start is past the end when no part is.
 */
function latitudeInterval(a: GeoJSON.Position, b: GeoJSON.Position, south: number, north: number): [number, number] {
    const latitudeChange = b[1] - a[1];
    if (latitudeChange === 0) return a[1] >= south && a[1] <= north ? [0, 1] : [1, 0];
    const toSouth = (south - a[1]) / latitudeChange;
    const toNorth = (north - a[1]) / latitudeChange;
    return [Math.max(0, Math.min(toSouth, toNorth)), Math.min(1, Math.max(toSouth, toNorth))];
}

/**
 * The position `fraction` of the way from `a` to `b`, in a straight line in lng/lat.
 */
function pointAlong(a: GeoJSON.Position, b: GeoJSON.Position, fraction: number): GeoJSON.Position {
    if (fraction === 0) return a;
    if (fraction === 1) return b;
    return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
}

/**
 * The positions every {@link PARALLEL_STEP} degrees of longitude along the parallel at `latitude`, strictly between
 * the longitudes of `from` and `to`.
 */
function alongParallel(from: GeoJSON.Position, to: GeoJSON.Position, latitude: number): GeoJSON.Position[] {
    const steps = Math.ceil(Math.abs(to[0] - from[0]) / PARALLEL_STEP);
    const positions: GeoJSON.Position[] = [];
    for (let step = 1; step < steps; step++) {
        positions.push([from[0] + (to[0] - from[0]) * step / steps, latitude]);
    }
    return positions;
}
