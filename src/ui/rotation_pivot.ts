import Point from '@mapbox/point-geometry';
import {earthRadius} from '../geo/lng_lat.ts';
import {degreesToRadians} from '../util/util.ts';

import type {LngLat} from '../geo/lng_lat.ts';
import type {IReadonlyTransform, ITransform} from '../geo/transform_interface.ts';
import type {Terrain} from '../render/terrain.ts';
import type {HandlerResult} from './handler_manager.ts';

/** Pixels a pivot keeps below the horizon, closer to which a pixel spans too much ground to hold it. */
const HORIZON_MARGIN = 16;

/** How many times the zoom is corrected to reach the pivot's distance. Mercator needs two, the globe a few more. */
const MAX_ZOOM_CORRECTIONS = 5;

/** The share of the pivot's distance within which the camera counts as being at that distance. */
const DISTANCE_TOLERANCE = 1e-7;

/** The share of the pivot's distance within which the ground under its screen point counts as the pivot, about a tenth of a pixel. */
const POINT_TOLERANCE = 1e-4;

/** The point a drag turns the camera around, with the screen point and the distance in meters from the camera it keeps. */
export type RotationPivot = {
    point: Point;
    location: LngLat;
    /** The elevation of a pivot on terrain. Without it the pivot lies on the ground the transform unprojects to. */
    elevation?: number;
    distance: number;
};

/** Picks the terrain under the point, or the ground without terrain there, and the center for a point in the sky. */
export function captureRotationPivot(tr: IReadonlyTransform, point: Point, terrain: Terrain | null): RotationPivot {
    if (!isBelowHorizon(tr, point)) {
        return {point: tr.centerPoint, location: tr.center, distance: distanceFromCamera(tr, tr.center)};
    }
    const hit = terrain ? tr.screenTerrainPointToMercatorCoordinate(point, terrain) : null;
    const location = hit ? hit.toLngLat() : tr.screenPointToLocation(point);
    return {point, location, elevation: hit?.z, distance: distanceFromCamera(tr, location, hit?.z)};
}

/**
 * Turns the camera around the pivot, keeping only the change of bearing where the tilt would bring the pivot close to the horizon.
 * A pivot at the center turns the camera in place, without that limit.
 * Returns false where the pivot cannot be held, as for a camera that looks up or next to a pole of the globe, and turns the camera in place there too.
 */
export function orbitRotationPivot(tr: ITransform, pivot: RotationPivot, deltas: HandlerResult): boolean {
    if (pivot.point.equals(tr.centerPoint)) {
        turn(tr, deltas);
        return true;
    }
    const camera = turnAroundPivot(tr, pivot, deltas) ?? turnAroundPivot(tr, pivot, {bearingDelta: deltas.bearingDelta});
    if (!camera) {
        turn(tr, deltas);
        return false;
    }
    tr.apply(camera, false);
    return true;
}

/** Changes the bearing, pitch and roll of the camera, which turns it in place. */
function turn(tr: ITransform, deltas: HandlerResult): void {
    tr.setBearing(tr.bearing + (deltas.bearingDelta || 0));
    tr.setPitch(tr.pitch + (deltas.pitchDelta || 0));
    tr.setRoll(tr.roll + (deltas.rollDelta || 0));
}

/** Returns the camera turned around the pivot, or null where that would make it look up, bring the pivot close to the horizon or lose it. */
function turnAroundPivot(start: ITransform, pivot: RotationPivot, deltas: HandlerResult): ITransform | null {
    const camera = start.clone();
    turn(camera, deltas);
    if (camera.pitch >= 90 || !isBelowHorizon(camera, pivot.point)) return null;
    return holdPivot(camera, pivot) && isAtScreenPoint(camera, pivot) ? camera : null;
}

/**
 * Zooms and moves the camera so the pivot is at its screen point and distance. A zoom limit can keep it from the distance.
 * Returns false where no zoom gives the distance, which is where the camera would have to go below the ground.
 *
 * The distance grows with the span of the view, in a straight line on mercator and nearly so on the globe,
 * so the span is found with the secant method.
 */
function holdPivot(tr: ITransform, pivot: RotationPivot): boolean {
    let span = 1;
    let distance = placePivot(tr, pivot);
    let nextSpan = pivot.distance / distance;
    for (let i = 0; ; i++) {
        if (Math.abs(distance / pivot.distance - 1) < DISTANCE_TOLERANCE) return true;
        if (i === MAX_ZOOM_CORRECTIONS || !Number.isFinite(nextSpan) || nextSpan <= 0) return false;
        const zoom = tr.zoom;
        tr.setZoom(zoom + Math.log2(span / nextSpan));
        nextSpan = span * 2 ** (zoom - tr.zoom);
        if (nextSpan === span) return true;
        const nextDistance = placePivot(tr, pivot);
        const distancePerSpan = (nextDistance - distance) / (nextSpan - span);
        span = nextSpan;
        distance = nextDistance;
        nextSpan = span + (pivot.distance - distance) / distancePerSpan;
    }
}

/** Moves the camera so the pivot is at its screen point, and returns the pivot's distance from the camera. */
function placePivot(tr: ITransform, pivot: RotationPivot): number {
    tr.setLocationAtPoint(pivot.location, pivot.point, pivot.elevation);
    return distanceFromCamera(tr, pivot.location, pivot.elevation);
}

/** Whether the ground under the pivot's screen point is the pivot, which the edge of the map or a pole of the globe can prevent. A pivot on terrain is not checked. */
function isAtScreenPoint(tr: IReadonlyTransform, pivot: RotationPivot): boolean {
    if (pivot.elevation !== undefined) return true;
    const offset = 2 * earthRadius * Math.sqrt(haversine(tr.screenPointToLocation(pivot.point), pivot.location));
    return offset < pivot.distance * POINT_TOLERANCE;
}

function isBelowHorizon(tr: IReadonlyTransform, point: Point): boolean {
    return tr.isPointOnMapSurface(new Point(point.x, point.y - HORIZON_MARGIN));
}

/** Returns the straight-line distance in meters from the camera to a location, at the center's elevation unless it has its own. */
function distanceFromCamera(tr: IReadonlyTransform, location: LngLat, elevation: number = tr.elevation): number {
    const cameraRadius = earthRadius + tr.getCameraAltitude();
    const radius = earthRadius + elevation;
    return Math.hypot(cameraRadius - radius, 2 * Math.sqrt(cameraRadius * radius * haversine(tr.getCameraLngLat(), location)));
}

/** Returns the haversine of the angle between two locations, which unlike {@link LngLat.distanceTo} stays exact for locations a pixel apart. */
function haversine(a: LngLat, b: LngLat): number {
    const latitudeA = degreesToRadians(a.lat);
    const latitudeB = degreesToRadians(b.lat);
    const longitudes = degreesToRadians(b.lng - a.lng);
    return Math.sin((latitudeB - latitudeA) / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudes / 2) ** 2;
}
