import {EXTENT} from '../extent.ts';
import {isBoundaryEdge} from '../extent_bounds.ts';
import {MercatorCoordinate} from '../../geo/mercator_coordinate.ts';
import {tileCoordinatesToLocation} from '../../geo/projection/mercator_utils.ts';
import type Point from '@mapbox/point-geometry';
import type {CanonicalTileID} from '../../tile/tile_id.ts';

/**
 * Rounds polygon corners by calculating arc points at each corner vertex.
 * @param polygon - Collection of polygon rings (outer ring and hole rings)
 * @param distanceInMeters - Desired corner rounding distance in meters
 * @param canonical - Canonical tile ID used for meter to tile unit conversion
 */
export function roundPolygonCorners(
    polygon: Point[][],
    distanceInMeters: number,
    canonical: CanonicalTileID
): Point[][] {
    if (distanceInMeters <= 0 || !polygon || polygon.length === 0) {
        return polygon;
    }

    const distanceInTileUnits = getTileUnitsForMeters(distanceInMeters, canonical);
    return polygon.map(ring => roundRing(ring, distanceInTileUnits));
}

function getTileUnitsForMeters(distanceInMeters: number, canonical: CanonicalTileID): number {
    const centerLocation = tileCoordinatesToLocation(EXTENT / 2, EXTENT / 2, canonical);
    const mercatorCoord = MercatorCoordinate.fromLngLat(centerLocation);
    const meterInMercator = mercatorCoord.meterInMercatorCoordinateUnits();
    const tileUnitsPerMercator = (1 << canonical.z) * EXTENT;
    return distanceInMeters * meterInMercator * tileUnitsPerMercator;
}

/**
 * Rounds the corners of a single ring.
 *
 * Corners that tile clipping created are left sharp: they belong to the cut rather than to the
 * feature, and the neighbouring tile cuts the same feature elsewhere, so rounding them would leave
 * the two halves out of step. Every vertex ends up on the integer tile grid, because triangulation,
 * subdivision and the vertex buffers snap and deduplicate vertices there - arcs finer than a tile
 * unit would otherwise be merged only after they were triangulated, turning the mesh into spikes.
 *
 * A ring that collapses into fewer than three distinct vertices is returned unchanged.
 * @param ring - Ring to round, closed or open
 * @param distanceInTileUnits - Corner rounding distance, already converted to tile units
 */
function roundRing(ring: Point[], distanceInTileUnits: number): Point[] {
    if (!ring || ring.length < 3) {
        return ring;
    }

    const isClosed = ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y;
    const vertexCount = isClosed ? ring.length - 1 : ring.length;

    if (vertexCount < 3) {
        return ring;
    }

    const newRing: Point[] = [];

    for (let i = 0; i < vertexCount; i++) {
        const previous = ring[(i - 1 + vertexCount) % vertexCount];
        const current = ring[i];
        const next = ring[(i + 1) % vertexCount];

        if (isBoundaryEdge(previous, current) || isBoundaryEdge(current, next)) {
            newRing.push(current.clone());
            continue;
        }

        appendRoundCorner(newRing, previous, current, next, distanceInTileUnits);
    }

    const snapped = snapToIntegerGrid(newRing);

    if (snapped.length < 3) {
        return ring;
    }

    if (isClosed) {
        snapped.push(snapped[0].clone());
    }

    return snapped;
}

/**
 * Rounds every vertex to the integer tile grid, dropping vertices that collapse onto their neighbour.
 * The ring is treated as closed, so the wrap-around duplicate is dropped as well.
 * @param ring - Ring to snap
 */
function snapToIntegerGrid(ring: Point[]): Point[] {
    const snapped: Point[] = [];

    for (const p of ring) {
        const point = p.round();
        const previous = snapped[snapped.length - 1];

        if (previous?.x === point.x && previous?.y === point.y) {
            continue;
        }

        snapped.push(point);
    }

    while (snapped.length > 1 && snapped[0].x === snapped[snapped.length - 1].x && snapped[0].y === snapped[snapped.length - 1].y) {
        snapped.pop();
    }

    return snapped;
}

/**
 * Appends the arc that replaces one corner, or the corner itself when it is too shallow or too sharp
 * to round.
 * @param newRing - Ring being built, the arc points are appended to it
 * @param prev - Vertex before the corner
 * @param current - The corner
 * @param next - Vertex after the corner
 * @param distanceInTileUnits - Corner rounding distance, already converted to tile units
 */
function appendRoundCorner(
    newRing: Point[],
    prev: Point,
    current: Point,
    next: Point,
    distanceInTileUnits: number
): void {
    // Unit edge vectors from the current vertex towards its neighbours
    const ua = prev.sub(current);
    const ub = next.sub(current);
    const lenA = ua.mag();
    const lenB = ub.mag();

    if (lenA < 1e-6 || lenB < 1e-6) {
        newRing.push(current.clone());
        return;
    }

    ua._div(lenA);
    ub._div(lenB);

    // Straight lines or zero-degree turns
    const dot = ua.x * ub.x + ua.y * ub.y;
    if (Math.abs(dot) > Math.cos(5 * Math.PI / 180)) {
        newRing.push(current.clone());
        return;
    }

    // we clamp to not have circles in the extremes
    const maxEdgeLenPercent = 0.2;
    const r = Math.min(distanceInTileUnits, lenA * maxEdgeLenPercent, lenB * maxEdgeLenPercent);

    // Tangent points on edges to prevPoint and nextPoint
    const tangentA = current.add(ua.mult(r));
    const tangentB = current.add(ub.mult(r));

    // Center of the rounding arc, at r / cos(theta/2) along the bisector
    const cosHalfTheta = Math.sqrt((1 + dot) / 2);
    const center = current.add(ua.add(ub)._unit()._mult(r / cosHalfTheta));

    // Both tangent points lie on the arc circle, so rotating tangent A around the center by the angle
    // between the two radii traces the fillet onto tangent B along the shortest arc.
    const sweepAngle = tangentA.sub(center).angleWith(tangentB.sub(center));

    // ~30 deg per segment; epsilon keeps fp noise from adding one at exact multiples.
    const numSegments = Math.max(2, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 6) - 1e-6));
    for (let s = 0; s <= numSegments; s++) {
        newRing.push(tangentA.rotateAround(sweepAngle * (s / numSegments), center));
    }
}
