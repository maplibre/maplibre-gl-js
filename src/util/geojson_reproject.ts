import {latFromMercatorY, lngFromMercatorX, mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.ts';
import {clamp} from './util.ts';

import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';

/**
 * A function mapping one GeoJSON position to another: the first two ordinates are the horizontal position, and any
 * further ones (altitude and beyond) are carried over as they are.
 */
type PositionMapper = (position: GeoJSON.Position) => GeoJSON.Position;

/**
 * The world square's four edges, each as the axis it bounds (0 for x, 1 for y) and the value it bounds it to.
 */
const WORLD_SQUARE_EDGES = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;

/**
 * @internal
 * Rewrites a GeoJSON object from the map's lng/lat to the "pseudo lng/lat" whose web mercator projection is the map
 * projection's world position, so that geojson-vt and supercluster, which only speak mercator, tile a planar map's
 * data in the right place of its world square. What lies outside the square is cut away first, since geojson-vt
 * wraps its world around and clamps it at the top and bottom, which would draw it inside: a feature with nothing
 * left inside drops out, and data with nothing left at all becomes an empty feature collection.
 * Returns a new object; the input is never mutated, and non-coordinate members are carried over as they are.
 */
export function reprojectGeoJSONToPseudoLngLat(data: GeoJSON.GeoJSON, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.GeoJSON {
    if (!data || typeof data !== 'object') return data;
    let reprojected: GeoJSON.GeoJSON | null;
    switch (data.type) {
        case 'FeatureCollection':
            return {
                ...data,
                features: data.features
                    .map(feature => reprojectFeatureToPseudoLngLat(feature, worldCoordinateHelper))
                    .filter((feature): feature is GeoJSON.Feature => feature !== null)
            };
        case 'Feature':
            reprojected = reprojectFeatureToPseudoLngLat(data, worldCoordinateHelper);
            break;
        default:
            reprojected = reprojectGeometryToPseudoLngLat(data, worldCoordinateHelper);
    }
    return reprojected ?? {type: 'FeatureCollection', features: []};
}

/**
 * @internal
 * {@link reprojectGeoJSONToPseudoLngLat} for one feature, or null when nothing of it lies inside the world square,
 * which includes a feature without a geometry.
 */
export function reprojectFeatureToPseudoLngLat(feature: GeoJSON.Feature, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.Feature | null {
    const geometry = feature.geometry && reprojectGeometryToPseudoLngLat(feature.geometry, worldCoordinateHelper);
    return geometry ? {...feature, geometry} : null;
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

function reprojectGeometryToPseudoLngLat(geometry: GeoJSON.Geometry, worldCoordinateHelper: WorldCoordinateHelper): GeoJSON.Geometry | null {
    const world = mapPositions(geometry, ([lng, lat, ...rest]) => {
        const {x, y} = worldCoordinateHelper.worldFromLngLat(lng, lat);
        return [x, y, ...rest];
    });
    const clipped = clipToWorldSquare(world);
    return clipped && mapPositions(clipped, ([x, y, ...rest]) => [lngFromMercatorX(x), latFromMercatorY(y), ...rest]);
}

/**
 * Cuts a geometry in world coordinates to the world square, 0 to 1 on both axes: points outside it drop out, a line
 * is cut where it crosses the edge, into several lines where it leaves and comes back, and polygons are clipped.
 * Returns null when nothing is left inside.
 */
function clipToWorldSquare(geometry: GeoJSON.Geometry): GeoJSON.Geometry | null {
    switch (geometry.type) {
        case 'Point':
            return isInWorldSquare(geometry.coordinates) ? geometry : null;
        case 'MultiPoint': {
            const points = geometry.coordinates.filter(isInWorldSquare);
            return points.length ? {...geometry, coordinates: points} : null;
        }
        case 'LineString': {
            const lines = clipLine(geometry.coordinates);
            if (!lines.length) return null;
            return lines.length === 1 ? {...geometry, coordinates: lines[0]} : {...geometry, type: 'MultiLineString', coordinates: lines};
        }
        case 'MultiLineString': {
            const lines = geometry.coordinates.flatMap(clipLine);
            return lines.length ? {...geometry, coordinates: lines} : null;
        }
        case 'Polygon': {
            const rings = clipPolygon(geometry.coordinates);
            return rings ? {...geometry, coordinates: rings} : null;
        }
        case 'MultiPolygon': {
            const polygons = geometry.coordinates.map(clipPolygon).filter((rings): rings is GeoJSON.Position[][] => rings !== null);
            return polygons.length ? {...geometry, coordinates: polygons} : null;
        }
        case 'GeometryCollection': {
            const geometries = geometry.geometries.map(clipToWorldSquare).filter((clipped): clipped is GeoJSON.Geometry => clipped !== null);
            return geometries.length ? {...geometry, geometries} : null;
        }
        default:
            return geometry;
    }
}

function isInWorldSquare(position: GeoJSON.Position): boolean {
    return position[0] >= 0 && position[0] <= 1 && position[1] >= 0 && position[1] <= 1;
}

/**
 * The parts of a line in world coordinates that lie inside the world square, segment by segment, see
 * {@link clipSegment}: a part ends where the line leaves the square, and the next starts where it comes back.
 */
function clipLine(line: GeoJSON.Position[]): GeoJSON.Position[][] {
    if (line.every(isInWorldSquare)) return [line];
    const parts: GeoJSON.Position[][] = [];
    let part: GeoJSON.Position[] = [];
    for (let i = 0; i + 1 < line.length; i++) {
        const segment = clipSegment(line[i], line[i + 1]);
        if (segment && part.length && segment[0] === part[part.length - 1]) {
            part.push(segment[1]);
            continue;
        }
        if (part.length > 1) parts.push(part);
        part = segment ?? [];
    }
    if (part.length > 1) parts.push(part);
    return parts;
}

/**
 * The part of the segment from `a` to `b` inside the world square, by Liang-Barsky clipping, or null when none of it
 * is. An end inside the square is returned as it is, so that consecutive segments of a line share it.
 */
function clipSegment(a: GeoJSON.Position, b: GeoJSON.Position): GeoJSON.Position[] | null {
    let start = 0;
    let end = 1;
    for (const [axis, bound] of WORLD_SQUARE_EDGES) {
        // The segment is a + t (b - a), and this edge keeps the t where p t <= q.
        const delta = b[axis] - a[axis];
        const p = bound === 0 ? -delta : delta;
        const q = bound === 0 ? a[axis] : 1 - a[axis];
        if (p === 0) {
            if (q < 0) return null;
            continue;
        }
        const t = q / p;
        if (p < 0) {
            if (t > end) return null;
            start = Math.max(start, t);
        } else {
            if (t < start) return null;
            end = Math.min(end, t);
        }
    }
    return [start > 0 ? interpolate(a, b, start) : a, end < 1 ? interpolate(a, b, end) : b];
}

/**
 * A polygon's rings in world coordinates clipped to the world square, see {@link clipRing}, or null when nothing of
 * its outer ring is inside, which leaves its holes nothing to cut out of.
 */
function clipPolygon(rings: GeoJSON.Position[][]): GeoJSON.Position[][] | null {
    const clipped: GeoJSON.Position[][] = [];
    for (let i = 0; i < rings.length; i++) {
        const ring = clipRing(rings[i]);
        if (ring) {
            clipped.push(ring);
        } else if (i === 0) {
            return null;
        }
    }
    return clipped;
}

/**
 * A closed ring in world coordinates clipped to the world square one edge at a time, or null
 * when less than a triangle is left. Where the ring runs outside, the clipped ring runs along the square's edge.
 */
function clipRing(ring: GeoJSON.Position[]): GeoJSON.Position[] | null {
    if (ring.every(isInWorldSquare)) return ring;
    let points = ring.slice(0, -1);
    for (const [axis, bound] of WORLD_SQUARE_EDGES) {
        points = clipToEdge(points, axis, bound);
    }
    return points.length < 3 ? null : [...points, points[0]];
}

/**
 * The points of an open ring on the world square's side of one of its edges, with a point added where the ring
 * crosses the edge.
 */
function clipToEdge(points: GeoJSON.Position[], axis: number, bound: number): GeoJSON.Position[] {
    const isInside = (position: GeoJSON.Position) => bound === 0 ? position[axis] >= 0 : position[axis] <= bound;
    const clipped: GeoJSON.Position[] = [];
    for (let i = 0; i < points.length; i++) {
        const previous = points[(i + points.length - 1) % points.length];
        const current = points[i];
        if (isInside(current) !== isInside(previous)) {
            clipped.push(interpolate(previous, current, (bound - previous[axis]) / (current[axis] - previous[axis])));
        }
        if (isInside(current)) clipped.push(current);
    }
    return clipped;
}

/**
 * The position at `t` along the segment from `a` to `b`, with x and y held inside the world square against rounding,
 * since `t` puts it on the square's edge.
 */
function interpolate(a: GeoJSON.Position, b: GeoJSON.Position, t: number): GeoJSON.Position {
    return a.map((value, i) => {
        const interpolated = value + ((b[i] ?? value) - value) * t;
        return i < 2 ? clamp(interpolated, 0, 1) : interpolated;
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
