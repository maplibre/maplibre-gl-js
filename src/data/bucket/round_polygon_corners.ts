import Point from '@mapbox/point-geometry';
import {vec2} from 'gl-matrix';
import {EXTENT} from '../extent.ts';
import {MercatorCoordinate} from '../../geo/mercator_coordinate.ts';
import {tileCoordinatesToLocation} from '../../geo/projection/mercator_utils.ts';
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

function roundRing(ring: Point[], distanceInTileUnits: number): Point[] {
    if (!ring || ring.length < 3) {
        return ring;
    }

    const isClosed = ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y;
    const vertexCount = isClosed ? ring.length - 1 : ring.length;

    if (vertexCount < 3) {
        return ring;
    }

    const vertices: vec2[] = ring.map(p => vec2.fromValues(p.x,p.y));
    const newRing: vec2[] = [];

    for (let i = 0; i < vertexCount; i++) {
        const prev = vertices[(i - 1 + vertexCount) % vertexCount];
        const current = vertices[i];
        const next = vertices[(i + 1) % vertexCount];

        appendRoundCorner(newRing, prev, current, next, distanceInTileUnits);
    }

    if (isClosed && newRing.length > 0) {
        newRing.push(vec2.clone(newRing[0]));
    }

    return newRing.map(p => new Point(p[0], p[1]));
}

function appendRoundCorner(
    newRing: vec2[],
    prev: vec2,
    current: vec2,
    next: vec2,
    distanceInTileUnits: number
): void {
    // Unit edge vectors from the current vertex towards its neighbours
    const ua = vec2.sub(vec2.create(), prev, current);
    const ub = vec2.sub(vec2.create(), next, current);
    const lenA = vec2.length(ua);
    const lenB = vec2.length(ub);

    if (lenA < 1e-6 || lenB < 1e-6) {
        newRing.push(vec2.clone(current));
        return;
    }

    vec2.scale(ua, ua, 1 / lenA);
    vec2.scale(ub, ub, 1 / lenB);

    // Straight lines or zero-degree turns
    const dot = vec2.dot(ua, ub);
    if (Math.abs(dot) > Math.cos(5 * Math.PI / 180)) {
        newRing.push(vec2.clone(current));
        return;
    }

    // we clamp to not have circles in the extremes
    const maxEdgeLenPercent = 0.2;
    const r = Math.min(distanceInTileUnits, lenA * maxEdgeLenPercent, lenB * maxEdgeLenPercent);

    // Tangent points on edges to prevPoint and nextPoint
    const tangentA = vec2.scaleAndAdd(vec2.create(), current, ua, r);
    const tangentB = vec2.scaleAndAdd(vec2.create(), current, ub, r);

    const bisector = vec2.add(vec2.create(), ua, ub);
    vec2.normalize(bisector, bisector);

    // Center of the rounding arc, at r / cos(theta/2) along the bisector
    const cosHalfTheta = Math.sqrt((1 + dot) / 2);
    const center = vec2.scaleAndAdd(vec2.create(), current, bisector, r / cosHalfTheta);

    // Both tangent points lie on the arc circle.
    // Rotating tangent A around the center traces the fillet onto tangent B along the shortest arc.
    const radiusA = vec2.sub(vec2.create(), tangentA, center);
    const radiusB = vec2.sub(vec2.create(), tangentB, center);
    const sweepAngle = vec2.angle(radiusA, radiusB);
    const direction = Math.sign(radiusA[0] * radiusB[1] - radiusA[1] * radiusB[0]); // 2D cross product -> winding direction

    // ~30 deg per segment; epsilon keeps fp noise from adding one at exact multiples.
    const numSegments = Math.max(2, Math.ceil(sweepAngle / (Math.PI / 6) - 1e-6));
    for (let s = 0; s <= numSegments; s++) {
        const angle = direction * sweepAngle * (s / numSegments);
        newRing.push(vec2.rotate(vec2.create(), tangentA, center, angle));
    }
}
