import Point from '@mapbox/point-geometry';
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
    if (distanceInTileUnits < 0.5) {
        return polygon;
    }

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

    const newRing: Point[] = [];

    for (let i = 0; i < vertexCount; i++) {
        const prevPoint = ring[(i - 1 + vertexCount) % vertexCount];
        const currentPoint = ring[i];
        const nextPoint = ring[(i + 1) % vertexCount];

        appendRoundCorner(newRing, prevPoint, currentPoint, nextPoint, distanceInTileUnits);
    }

    if (isClosed && newRing.length > 0) {
        newRing.push(new Point(newRing[0].x, newRing[0].y));
    }

    return newRing;
}

function appendRoundCorner(
    newRing: Point[],
    prevPoint: Point,
    currentPoint: Point,
    nextPoint: Point,
    distanceInTileUnits: number
): void {
    const ax = prevPoint.x - currentPoint.x;
    const ay = prevPoint.y - currentPoint.y;
    const bx = nextPoint.x - currentPoint.x;
    const by = nextPoint.y - currentPoint.y;

    const lenA = Math.sqrt(ax * ax + ay * ay);
    const lenB = Math.sqrt(bx * bx + by * by);

    if (lenA < 1e-6 || lenB < 1e-6) {
        pushPoint(newRing, currentPoint.x, currentPoint.y);
        return;
    }

    const uax = ax / lenA;
    const uay = ay / lenA;
    const ubx = bx / lenB;
    const uby = by / lenB;

    const dot = uax * ubx + uay * uby;

    // Straight lines (colinear ~180 deg) or zero-degree turns
    if (dot < -0.99999 || dot > 0.99999) {
        pushPoint(newRing, currentPoint.x, currentPoint.y);
        return;
    }

    // Corner distance clamped to at most half the adjacent edge lengths
    const r = Math.min(distanceInTileUnits, lenA / 2, lenB / 2);

    // Tangent points on edges to prevPoint and nextPoint
    const tangentAx = currentPoint.x + uax * r;
    const tangentAy = currentPoint.y + uay * r;
    const tangentBx = currentPoint.x + ubx * r;
    const tangentBy = currentPoint.y + uby * r;

    // Bisector vector
    let bisectorX = uax + ubx;
    let bisectorY = uay + uby;
    const bisectorLen = Math.sqrt(bisectorX * bisectorX + bisectorY * bisectorY);
    bisectorX /= bisectorLen;
    bisectorY /= bisectorLen;

    // Fast half-angle trigonometry identities without acos/cos/tan
    const cosHalfTheta = Math.sqrt((1 + dot) / 2);
    const tanHalfTheta = Math.sqrt((1 - dot) / (1 + dot));

    // Center of the rounding arc
    const centerDist = r / cosHalfTheta;
    const centerX = currentPoint.x + bisectorX * centerDist;
    const centerY = currentPoint.y + bisectorY * centerDist;
    const radius = r * tanHalfTheta;

    // Angles from center to tangent points A and B
    const angleA = Math.atan2(tangentAy - centerY, tangentAx - centerX);
    const angleB = Math.atan2(tangentBy - centerY, tangentBx - centerX);

    // Always take the shortest arc (minor arc <= PI) connecting A and B around center
    let diff = angleB - angleA;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;

    const sweepAngle = Math.abs(diff);
    const numSegments = Math.max(2, Math.min(8, Math.ceil(sweepAngle / (Math.PI / 6))));

    for (let s = 0; s <= numSegments; s++) {
        const t = s / numSegments;
        const angle = angleA + t * diff;
        const px = centerX + radius * Math.cos(angle);
        const py = centerY + radius * Math.sin(angle);
        pushPoint(newRing, px, py);
    }
}

function pushPoint(ring: Point[], x: number, y: number): void {
    const normX = Math.abs(x) < 1e-12 ? 0 : x;
    const normY = Math.abs(y) < 1e-12 ? 0 : y;
    ring.push(new Point(normX, normY));
}
