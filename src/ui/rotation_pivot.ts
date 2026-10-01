import Point from '@mapbox/point-geometry';
import {vec3} from 'gl-matrix';
import {earthRadius} from '../geo/lng_lat.ts';
import {angularCoordinatesToSurfaceVector} from '../geo/projection/globe_utils.ts';
import {scaleZoom, zoomScale} from '../util/util.ts';

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
    /** The elevation of a pivot on mercator terrain. Without it the pivot lies on the ground the transform unprojects to. */
    elevation?: number;
    distance: number;
};

/**
 * Picks the terrain under the point, or the ground without terrain there, and the center for a point in the sky.
 * On the globe, which holds no location at an elevation, a pivot on terrain is held by the planet's surface under it.
 */
export function captureRotationPivot(tr: IReadonlyTransform, point: Point, terrain: Terrain | null, onGlobe: boolean): RotationPivot {
    if (!isBelowHorizon(tr, point)) {
        return {point: tr.centerPoint, location: tr.center, distance: distanceFromCamera(tr, tr.center)};
    }
    const hit = terrain ? tr.screenTerrainPointToMercatorCoordinate(point, terrain) : null;
    const location = hit ? hit.toLngLat() : tr.screenPointToLocation(point);
    if (hit && onGlobe) {
        return {point: tr.locationToScreenPoint(location), location, distance: distanceFromCamera(tr, location)};
    }
    return {point, location, elevation: hit?.z, distance: distanceFromCamera(tr, location, hit?.z)};
}

/**
 * Turns the camera around the pivot, keeping only the change of bearing where the tilt would bring the pivot close to the horizon.
 * A pivot at the center turns the camera in place, without that limit.
 * Returns false where the pivot cannot be held, as next to a pole of the globe, and turns the camera in place there too.
 */
export function orbitRotationPivot(tr: ITransform, pivot: RotationPivot, deltas: HandlerResult): boolean {
    if (pivot.point.equals(tr.centerPoint)) {
        turnInPlace(tr, deltas);
        return true;
    }
    const camera = turnAroundPivot(tr, pivot, deltas) ?? turnAroundPivot(tr, pivot, {bearingDelta: deltas.bearingDelta});
    if (!camera) {
        turnInPlace(tr, deltas);
        return false;
    }
    tr.apply(camera, false);
    return true;
}

function turnInPlace(tr: ITransform, deltas: HandlerResult): void {
    tr.setBearing(tr.bearing + (deltas.bearingDelta || 0));
    tr.setPitch(tr.pitch + (deltas.pitchDelta || 0));
    tr.setRoll(tr.roll + (deltas.rollDelta || 0));
}

/** Returns the camera turned around the pivot, or null where that would make it look up, bring the pivot close to the horizon or lose it. */
function turnAroundPivot(start: ITransform, pivot: RotationPivot, deltas: HandlerResult): ITransform | null {
    const camera = start.clone();
    turnInPlace(camera, deltas);
    if (camera.pitch >= 90 || !isBelowHorizon(camera, pivot.point)) return null;
    return holdPivot(camera, pivot) && isAtScreenPoint(camera, pivot) ? camera : null;
}

/**
 * Zooms and moves the camera so the pivot is at its screen point and distance, or as close to the distance as the zoom limits allow.
 * Returns false where no zoom gives the distance, which is where the camera would have to go below the ground.
 *
 * The distance grows with the span of the view, in a straight line on mercator and nearly so on the globe,
 * so the span is found with the secant method.
 */
function holdPivot(tr: ITransform, pivot: RotationPivot): boolean {
    let span = 1;
    let distance = placePivot(tr, pivot);
    let nextSpan = pivot.distance / distance;
    for (let i = 0; i < MAX_ZOOM_CORRECTIONS && !isAtDistance(distance, pivot); i++) {
        if (!Number.isFinite(nextSpan) || nextSpan <= 0) return false;
        const zoom = tr.zoom;
        tr.setZoom(zoom + scaleZoom(span / nextSpan));
        const reachedSpan = span * zoomScale(zoom - tr.zoom);
        if (reachedSpan === span) return true;
        const reachedDistance = placePivot(tr, pivot);
        nextSpan = reachedSpan + (pivot.distance - reachedDistance) * (reachedSpan - span) / (reachedDistance - distance);
        span = reachedSpan;
        distance = reachedDistance;
    }
    return isAtDistance(distance, pivot);
}

/** Moves the camera so the pivot is at its screen point, and returns the pivot's distance from the camera. */
function placePivot(tr: ITransform, pivot: RotationPivot): number {
    tr.setLocationAtPoint(pivot.location, pivot.point, pivot.elevation);
    return distanceFromCamera(tr, pivot.location, pivot.elevation);
}

function isAtDistance(distance: number, pivot: RotationPivot): boolean {
    return Math.abs(distance / pivot.distance - 1) < DISTANCE_TOLERANCE;
}

/** Whether the ground under the pivot's screen point is the pivot, which the edge of the map or a pole of the globe can prevent. A pivot on terrain is not checked. */
function isAtScreenPoint(tr: IReadonlyTransform, pivot: RotationPivot): boolean {
    if (pivot.elevation !== undefined) return true;
    const offset = vec3.distance(positionOf(tr.screenPointToLocation(pivot.point), 0), positionOf(pivot.location, 0));
    return offset < pivot.distance * POINT_TOLERANCE;
}

function isBelowHorizon(tr: IReadonlyTransform, point: Point): boolean {
    return tr.isPointOnMapSurface(new Point(point.x, point.y - HORIZON_MARGIN));
}

/** Returns the straight-line distance in meters from the camera to a location, at the center's elevation unless it has its own. */
function distanceFromCamera(tr: IReadonlyTransform, location: LngLat, elevation: number = tr.elevation): number {
    return vec3.distance(positionOf(tr.getCameraLngLat(), tr.getCameraAltitude()), positionOf(location, elevation));
}

/** Returns the position of a location in meters from the center of the earth. */
function positionOf(location: LngLat, elevation: number): vec3 {
    const position = angularCoordinatesToSurfaceVector(location);
    return vec3.scale(position, position, earthRadius + elevation);
}
