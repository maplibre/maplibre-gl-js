import Point from '@mapbox/point-geometry';

import type {LngLat} from '../geo/lng_lat.ts';
import type {IReadonlyTransform, ITransform} from '../geo/transform_interface.ts';
import type {Terrain} from '../render/terrain.ts';
import type {HandlerResult} from './handler_manager.ts';

/** Pixels a pivot keeps below the horizon, closer to which a pixel spans too much ground to hold it. */
const HORIZON_MARGIN = 16;

/** The point a drag turns the camera around, with the screen point and the distance in meters from the camera it keeps. */
export type RotationPivot = {
    point: Point;
    location: LngLat;
    elevation: number;
    distance: number;
};

/** Picks the terrain under the point, or the ground at the center's elevation, and the center when the point is in the sky. */
export function captureRotationPivot(tr: IReadonlyTransform, point: Point, terrain: Terrain | null): RotationPivot {
    if (!isBelowHorizon(tr, point)) {
        return {point: tr.centerPoint, location: tr.center, elevation: tr.elevation, distance: distanceFromCamera(tr, tr.center, tr.elevation)};
    }
    const hit = terrain ? tr.screenTerrainPointToMercatorCoordinate(point, terrain) : null;
    const elevation = hit ? hit.z : tr.elevation;
    const location = hit ? hit.toLngLat() : tr.screenPointToLocationAtElevation(point, elevation);
    return {point, location, elevation, distance: distanceFromCamera(tr, location, elevation)};
}

/** Turns the camera around the pivot, keeping only the change of bearing where the tilt would bring the pivot close to the horizon. */
export function orbitRotationPivot(tr: ITransform, pivot: RotationPivot, deltas: HandlerResult): void {
    const camera = turnAroundPivot(tr, pivot, deltas) ?? turnAroundPivot(tr, pivot, {bearingDelta: deltas.bearingDelta});
    if (camera) tr.apply(camera, false);
}

/** Returns the camera turned around the pivot, or null where that would bring the pivot close to the horizon. */
function turnAroundPivot(start: ITransform, pivot: RotationPivot, deltas: HandlerResult): ITransform | null {
    const camera = start.clone();
    camera.setBearing(start.bearing + (deltas.bearingDelta || 0));
    camera.setPitch(start.pitch + (deltas.pitchDelta || 0));
    camera.setRoll(start.roll + (deltas.rollDelta || 0));
    return isBelowHorizon(camera, pivot.point) && holdPivot(camera, pivot) ? camera : null;
}

/** Zooms and moves the camera so the pivot is at its screen point and distance. Returns false where that would put the camera below the center's elevation. */
function holdPivot(tr: ITransform, pivot: RotationPivot): boolean {
    const height = tr.getCameraAltitude() - tr.elevation;
    const ground = tr.screenPointToLocation(pivot.point);
    const descent = height / Math.hypot(height, tr.getCameraLngLat().distanceTo(ground));
    const targetHeight = pivot.distance * descent + pivot.elevation - tr.elevation;
    if (height <= 0 || targetHeight <= 0) return false;
    tr.setZoom(tr.zoom + Math.log2(height / targetHeight));
    tr.setLocationAtPoint(pivot.location, pivot.point, pivot.elevation);
    return true;
}

function isBelowHorizon(tr: IReadonlyTransform, point: Point): boolean {
    return tr.isPointOnMapSurface(new Point(point.x, point.y - HORIZON_MARGIN));
}

function distanceFromCamera(tr: IReadonlyTransform, location: LngLat, elevation: number): number {
    return Math.hypot(tr.getCameraLngLat().distanceTo(location), tr.getCameraAltitude() - elevation);
}
