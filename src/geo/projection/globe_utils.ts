import {quat, type ReadonlyVec4, vec3} from 'gl-matrix';
import {clamp, createVec3f64, createVec4f64, lerp, MAX_VALID_LATITUDE, mod, remapSaturate, scaleZoom, wrap} from '../../util/util.ts';
import {LngLat} from '../lng_lat.ts';
import {EXTENT} from '../../data/extent.ts';
import type Point from '@mapbox/point-geometry';
import type {ITransform} from '../transform_interface.ts';

export function getGlobeCircumferencePixels(transform: {worldSize: number; center: {lat: number}}): number {
    const radius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
    return 2.0 * Math.PI * radius;
}

export function globeDistanceOfLocationsPixels(transform: {worldSize: number; center: {lat: number}}, a: LngLat, b: LngLat): number {
    const vecA = angularCoordinatesToSurfaceVector(a);
    const vecB = angularCoordinatesToSurfaceVector(b);
    const dot = vec3.dot(vecA, vecB);
    const radians = Math.acos(dot);
    const circumference = getGlobeCircumferencePixels(transform);
    return radians / (2.0 * Math.PI) * circumference;
}

/**
 * For given mercator coordinates in range 0..1, returns the angular coordinates on the sphere's surface, in radians.
 */
export function mercatorCoordinatesToAngularCoordinatesRadians(mercatorX: number, mercatorY: number): [number, number] {
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    return [sphericalX, sphericalY];
}

/**
 * For a given longitude and latitude (note: in radians) returns the normalized vector from the planet center to the specified place on the surface.
 * @param lngRadians - Longitude in radians.
 * @param latRadians - Latitude in radians.
 */
export function angularCoordinatesRadiansToVector(lngRadians: number, latRadians: number): vec3 {
    const len = Math.cos(latRadians);
    const vec = new Float64Array(3) as any;
    vec[0] = Math.sin(lngRadians) * len;
    vec[1] = Math.sin(latRadians);
    vec[2] = Math.cos(lngRadians) * len;
    return vec;
}

/**
 * Projects a point within a tile to the surface of the unit sphere globe.
 * @param inTileX - X coordinate inside the tile in range [0 .. 8192].
 * @param inTileY - Y coordinate inside the tile in range [0 .. 8192].
 * @param tileIdX - Tile's X coordinate in range [0 .. 2^zoom - 1].
 * @param tileIdY - Tile's Y coordinate in range [0 .. 2^zoom - 1].
 * @param tileIdZ - Tile's zoom.
 * @returns A 3D vector - coordinates of the projected point on a unit sphere.
 */
export function projectTileCoordinatesToSphere(inTileX: number, inTileY: number, tileIdX: number, tileIdY: number, tileIdZ: number): vec3 {
    // This code could be assembled from 3 functions, but this is a hot path for symbol placement,
    // so for optimization purposes everything is inlined by hand.
    //
    // Non-inlined variant of this function would be this:
    //     const mercator = tileCoordinatesToMercatorCoordinates(inTileX, inTileY, tileID);
    //     const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator.x, mercator.y);
    //     const sphere = angularCoordinatesRadiansToVector(angular[0], angular[1]);
    //     return sphere;
    const scale = 1.0 / (1 << tileIdZ);
    const mercatorX = inTileX / EXTENT * scale + tileIdX * scale;
    const mercatorY = inTileY / EXTENT * scale + tileIdY * scale;
    const sphericalX = mod(mercatorX * Math.PI * 2.0 + Math.PI, Math.PI * 2);
    const sphericalY = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
    const len = Math.cos(sphericalY);
    const vec = new Float64Array(3) as any;
    vec[0] = Math.sin(sphericalX) * len;
    vec[1] = Math.sin(sphericalY);
    vec[2] = Math.cos(sphericalX) * len;
    return vec;
}

/**
 * For a given longitude and latitude (note: in degrees) returns the normalized vector from the planet center to the specified place on the surface.
 */
export function angularCoordinatesToSurfaceVector(lngLat: LngLat): vec3 {
    return angularCoordinatesRadiansToVector(lngLat.lng * Math.PI / 180, lngLat.lat * Math.PI / 180);
}

export function getGlobeRadiusPixels(worldSize: number, latitudeDegrees: number): number {
    // We want zoom levels to be consistent between globe and flat views.
    // This means that the pixel size of features at the map center point
    // should be the same for both globe and flat view.
    // For this reason we scale the globe up when map center is nearer to the poles.
    return worldSize / (2.0 * Math.PI) / Math.cos(latitudeDegrees * Math.PI / 180);
}

/**
 * Given a 3D point on the surface of a unit sphere, returns its angular coordinates in degrees.
 * The input vector must be normalized.
 */
export function sphereSurfacePointToCoordinates(surface: vec3): LngLat {
    const latRadians = Math.asin(surface[1]);
    const latDegrees = latRadians / Math.PI * 180.0;
    const lengthXZ = Math.sqrt(surface[0] * surface[0] + surface[2] * surface[2]);
    if (lengthXZ > 1e-6) {
        const projX = surface[0] / lengthXZ;
        const projZ = surface[2] / lengthXZ;
        const acosZ = Math.acos(projZ);
        const lngRadians = (projX > 0) ? acosZ : -acosZ;
        const lngDegrees = lngRadians / Math.PI * 180.0;
        return new LngLat(wrap(lngDegrees, -180, 180), latDegrees);
    } else {
        return new LngLat(0.0, latDegrees);
    }
}

/**
 * Returns the globe orientation quaternion for the given map center and bearing.
 * The inverse of {@link lngLatBearingFromOrientation}.
 */
export function orientationFromLngLatBearing(lngLat: LngLat, bearing: number): quat {
    return quat.fromEuler(createVec4f64(), -lngLat.lng, -lngLat.lat, bearing);
}

/**
 * Given a globe orientation quaternion, returns the corresponding map center and bearing.
 * The inverse of {@link orientationFromLngLatBearing}.
 */
export function lngLatBearingFromOrientation(q: quat): { lng: number; lat: number; bearing: number } {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const lng = -Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * 180 / Math.PI;
    const lat = -Math.asin(clamp(2 * (w * y - z * x), -1, 1)) * 180 / Math.PI;
    const bearing = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180 / Math.PI;
    return {lng, lat, bearing};
}

/**
 * How much of the angle between the view axis and the horizon is given over to easing off, measured
 * inward from the horizon. Only the outermost sliver of the globe is affected, where a pixel is
 * already worth degrees of arc.
 *
 * This is the one number here open to taste, and it sets two things at once: narrowing it keeps the
 * drag exact over more of the globe, and, since the exact curve steepens towards tangency, hands
 * over at a higher rate too. Bell has no such freedom, as a hyperbola of the fixed form `k/d` meets
 * a sphere in both value and slope at exactly one radius.
 */
const PAN_FALLOFF_BAND = 0.1;

/** Kept just below a half turn so the center cannot land exactly on the far side of the globe. */
const PAN_MAX_ANGLE = Math.PI * 0.98;

/**
 * Returns the point on the globe that a drag towards `point` should aim at.
 *
 * Exact tracking breaks down at the silhouette: the ray meets the globe at `asin(D sin a) - a`,
 * whose slope runs away to infinity as the ray goes tangent, and past it there is no intersection
 * at all. So the exact curve is left {@link PAN_FALLOFF_BAND} early and continued with a hyperbola
 * matching it in value and slope, easing off and saturating short of the far side. Bell's virtual
 * trackball takes the same idea of easing a sphere into a hyperbola before the rim, though it fits
 * the curve differently: SGI's `trackball.c`, described in Henriksen, Sporring and Hornbæk,
 * "Virtual Trackballs Revisited", IEEE TVCG 10(2):206-216, 2004.
 *
 * The angle comes from atan2, so a ray pointing away from the globe is a wide angle the falloff
 * saturates rather than a case to reject.
 * @param tr - The transform being dragged.
 * @param point - The cursor position.
 */
function panSurfaceLocation(tr: ITransform, point: Point): LngLat {
    const origin = tr.cameraPosition;
    const distance = vec3.length(origin);
    if (distance <= 1) {
        return tr.screenPointToLocation(point);
    }

    const u = createVec3f64();
    vec3.normalize(u, origin);
    const direction = tr.getRayDirectionFromPixel(point);
    const c = -vec3.dot(direction, u);
    const lateral = createVec3f64();
    vec3.scaleAndAdd(lateral, direction, u, c);
    const s = vec3.length(lateral);
    if (s < 1e-9) {
        return tr.screenPointToLocation(point);
    }

    const angle = Math.atan2(s, c);
    const horizonAngle = Math.asin(1 / distance);
    const handoverAngle = horizonAngle * (1 - PAN_FALLOFF_BAND);
    if (angle < handoverAngle) {
        return tr.screenPointToLocation(point);
    }

    const sinHandover = distance * Math.sin(handoverAngle);
    const targetAtHandover = Math.asin(clamp(sinHandover, -1, 1)) - handoverAngle;
    const slopeAtHandover = distance * Math.cos(handoverAngle) / Math.sqrt(Math.max(1 - sinHandover * sinHandover, 1e-12)) - 1;
    const room = PAN_MAX_ANGLE - targetAtHandover;
    const excess = angle - handoverAngle;
    const target = targetAtHandover + room * (slopeAtHandover * excess) / (room + slopeAtHandover * excess);

    const e = createVec3f64();
    vec3.scale(e, lateral, 1 / s);
    const surface = createVec3f64();
    vec3.scale(surface, u, Math.cos(clamp(target, 0, PAN_MAX_ANGLE)));
    vec3.scaleAndAdd(surface, surface, e, Math.sin(clamp(target, 0, PAN_MAX_ANGLE)));
    vec3.normalize(surface, surface);
    return sphereSurfacePointToCoordinates(surface);
}

/**
 * Rotates the globe so that the given location appears at the given screen point, by composing
 * versors, the unit quaternions that represent rotations. Unlike the bearing-preserving
 * {@link ITransform.setLocationAtPoint}, this stays smooth near and across the poles, and keeps
 * panning once the cursor leaves the globe.
 *
 * Note: the delta rotation's axis is in the surface-vector frame of
 * {@link angularCoordinatesToSurfaceVector}, while the orientation quaternion uses the Euler frame
 * of {@link orientationFromLngLatBearing}, hence the component swizzle where they combine. Zoom is
 * adjusted to keep the planet the same size, as `setLocationAtPoint` does.
 * @param tr - The transform to rotate.
 * @param lnglat - The location to bring under `point`.
 * @param point - The screen point that `lnglat` should appear at.
 * @param panDelta - The drag's pixel delta. Used to re-derive the previous cursor location through
 * {@link panSurfaceLocation}, since both ends of the rotation must come from the same mapping.
 * @param fixedBearing - Applies the swing only, keeping the bearing fixed, which is what dragging
 * the globe does. Pass `false` to apply the twist about the view axis as well, so that the grabbed
 * location tracks the cursor exactly and the bearing drifts with it.
 */
/**
 * How far the center may move, as a multiple of the angle the drag subtends on the sphere. Only
 * bites on the silhouette, where a center that tracks the grab exactly can still be half a globe
 * away; everywhere else the solve already lands well inside it.
 */
const TRACK_REACH = 2;

/** Floor on that, in radians, so the smallest drags can still move the globe. */
const TRACK_MIN_TURN = 0.02;

/**
 * Returns the center that carries `grabbed` to where `aimed` is now, or the closest center to it
 * that the drag can reach.
 *
 * A bearing-locked center enters the projection as `Rx(lat) . Ry(-lng)`, and those two angles are
 * the center's own latitude and longitude, so a drag is a question about that pair directly rather
 * than about a rotation that then has to be cut down to fit. `Ry` turns about the poles and leaves
 * the grabbed location's latitude alone; `Rx` turns about the screen's horizontal axis and leaves
 * its x alone. Between them a location at latitude `theta` reaches exactly the directions with
 * `|x| <= cos(theta)`, a band around the screen's vertical midline. Bearing, pitch and roll are
 * applied outside the pair and held fixed, so they cancel from both sides and never enter.
 *
 * Inside the band the answer is two atan2s and no iteration. Outside it there is no center that
 * tracks the drag at all, and the nearest point of the band is the best there is. Taking it is
 * what makes a grab near the pole a dial: the band narrows as `cos(theta)` closes, until a
 * location on the pole itself can only ever sit on the midline and every drag becomes a spin
 * about the pole.
 * @param tr - The transform being dragged.
 * @param grabbed - The location the drag started from.
 * @param aimed - The location the cursor is over now, which `grabbed` should be brought to.
 */
function trackedCenter(tr: ITransform, grabbed: LngLat, aimed: LngLat): LngLat {
    const g = angularCoordinatesToSurfaceVector(grabbed);
    const target = angularCoordinatesToSurfaceVector(aimed);

    // `aimed` carried into the frame the center's own two turns act in.
    const lngRadians = tr.center.lng * Math.PI / 180;
    const latRadians = tr.center.lat * Math.PI / 180;
    const spunX = Math.cos(lngRadians) * target[0] - Math.sin(lngRadians) * target[2];
    const spunZ = Math.sin(lngRadians) * target[0] + Math.cos(lngRadians) * target[2];
    const v = [
        spunX,
        Math.cos(latRadians) * target[1] - Math.sin(latRadians) * spunZ,
        Math.sin(latRadians) * target[1] + Math.cos(latRadians) * spunZ
    ];

    // The half-width of the band, and the point of it to aim at.
    const reach = Math.hypot(g[0], g[2]);
    if (reach < 1e-9) {
        // The grab is on a pole, where the band has no width and every longitude names the same
        // place. There is nothing for the drag to turn.
        return tr.center;
    }
    let aim = v;
    if (Math.abs(v[0]) > reach) {
        const x = Math.sign(v[0]) * reach;
        const rest = Math.sqrt(Math.max(1 - x * x, 0)) / Math.max(Math.hypot(v[1], v[2]), 1e-12);
        aim = [x, v[1] * rest, v[2] * rest];
    }

    // The grabbed location after the longitude turn: it keeps its own latitude and takes the aim's
    // x. Two of those, mirrored front to back, one the drag and one the way around.
    // Which of the two mirrored solutions is this drag's: the one that leaves the grabbed location
    // on the side it is already on. Picking by which center ends up nearer instead lets the choice
    // swap between neighbouring cursor positions, and a swap is a snap. This cannot swap without
    // the grab itself crossing the plane, and at zero drag it returns the center unmoved.
    const side = Math.sin(lngRadians) * g[0] + Math.cos(lngRadians) * g[2] >= 0 ? 1 : -1;
    const behind = Math.sqrt(Math.max(1 - aim[0] * aim[0] - g[1] * g[1], 0));
    let settled: LngLat | undefined;
    let wanted = tr.center.lat;
    {
        const w = [aim[0], g[1], side * behind];
        const lng = (Math.atan2(g[0], g[2]) - Math.atan2(w[0], w[2])) * 180 / Math.PI;
        const lat = -Math.atan2(aim[1] * w[2] - aim[2] * w[1], aim[1] * w[1] + aim[2] * w[2]) * 180 / Math.PI;
        // A latitude past a pole is not the same center named from the other side: carrying it
        // over would roll the view by half a turn, which a held bearing cannot do. Nor is one past
        // MAX_VALID_LATITUDE, which `setCenter` would clamp back. Either way there is no such
        // center, and the drag falls to the limited turn below.
        wanted = lat;
        if (Math.abs(lat) <= MAX_VALID_LATITUDE) {
            settled = new LngLat(wrap(lng, -180, 180), lat);
        }
    }
    if (settled) {
        return limitToDrag(tr, settled, g, target);
    }

    // Neither branch is a latitude the center can hold: `setCenter` would clamp it back and the
    // drag would track nothing, which with a pole near the middle of the screen leaves it standing
    // still. So sit at the limit and turn about the poles as far as that allows, which is one more
    // azimuth match, and is what reads as a dial.
    const held = Math.sign(wanted) * MAX_VALID_LATITUDE;
    const heldRadians = held * Math.PI / 180;
    const liftedZ = Math.cos(heldRadians) * aim[2] - Math.sin(heldRadians) * aim[1];
    const lng = (Math.atan2(g[0], g[2]) - Math.atan2(aim[0], liftedZ)) * 180 / Math.PI;
    return limitToDrag(tr, new LngLat(wrap(lng, -180, 180), held), g, target);
}

/**
 * Holds a solved center to a move in proportion to the drag that asked for it, easing towards it
 * along the way rather than jumping.
 *
 * On the silhouette the solve can be exact and still useless: the center that tracks the grab may
 * be half the globe away, because the near answer needs a latitude past the pole and a held bearing
 * cannot name one. Rather than take a jump or refuse to move, this walks the same distance in the
 * same direction, which is the closest the center can get to doing what was asked.
 */
function limitToDrag(tr: ITransform, settled: LngLat, g: vec3, target: vec3): LngLat {
    const dragTurn = Math.acos(clamp(vec3.dot(g, target), -1, 1));
    const allowed = Math.max(dragTurn * TRACK_REACH, TRACK_MIN_TURN);
    const from = angularCoordinatesToSurfaceVector(tr.center);
    const to = angularCoordinatesToSurfaceVector(settled);
    const turn = Math.acos(clamp(vec3.dot(from, to), -1, 1));
    if (turn <= allowed || turn < 1e-9) {
        return settled;
    }
    const t = allowed / turn;
    const eased = createVec3f64();
    vec3.scale(eased, from, Math.sin((1 - t) * turn) / Math.sin(turn));
    vec3.scaleAndAdd(eased, eased, to, Math.sin(t * turn) / Math.sin(turn));
    vec3.normalize(eased, eased);
    return sphereSurfacePointToCoordinates(eased);
}

export function versorSetLocationAtPoint(tr: ITransform, lnglat: LngLat, point: Point, panDelta?: Point, fixedBearing = true, leverPoint?: Point): void {
    const pointLngLat = panSurfaceLocation(tr, point);
    let sourceLngLat = lnglat;
    if (panDelta) {
        sourceLngLat = panSurfaceLocation(tr, point.sub(panDelta));
    } else if (!tr.isPointOnMapSurface(point)) {
        return;
    }

    // A drag has a location it grabbed and a place to put it, both through the same falloff, so
    // solve for the center that does that. The cursor is `leverPoint` where there is one: `point`
    // off the globe has already been swapped for the screen center. Off the globe the falloff
    // still supplies both ends, so this stays one equation there rather than a separate dial.
    if (fixedBearing && panDelta) {
        const grabAt = leverPoint ?? point;
        const oldLat = tr.center.lat;
        const oldZoom = tr.zoom;
        tr.setCenter(trackedCenter(tr, panSurfaceLocation(tr, grabAt.sub(panDelta)), panSurfaceLocation(tr, grabAt)));
        tr.setZoom(oldZoom + getZoomAdjustment(oldLat, tr.center.lat));
        return;
    }

    const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
    const vecToTarget = angularCoordinatesToSurfaceVector(sourceLngLat);
    const centerQuat = orientationFromLngLatBearing(tr.center, tr.bearing);
    const w = vec3.cross(createVec3f64(), vecToTarget, vecToPixelCurrent);
    const l = Math.sqrt(vec3.dot(w, w));
    const t = Math.acos(clamp(vec3.dot(vecToTarget, vecToPixelCurrent), -1, 1)) / 2;
    const s = Math.sin(t);
    const delta = l ? quat.fromValues((w[1] / l) * s, (-w[0] / l) * s, (w[2] / l) * s, Math.cos(t)) : quat.fromValues(0, 0, 0, 1);
    const newCenterQuat = quat.multiply(createVec4f64(), centerQuat, delta);
    const {lng: newCenterLng, lat: newCenterLat, bearing: newBearing} = lngLatBearingFromOrientation(newCenterQuat);

    const oldLat = tr.center.lat;
    const oldZoom = tr.zoom;
    const finalLat = clamp(newCenterLat, -90, 90);
    const finalLng = fixedBearing ? fixedBearingLongitude(tr, newCenterLng) : newCenterLng;

    tr.setCenter(new LngLat(wrap(finalLng, -180, 180), finalLat));
    if (!fixedBearing) {
        tr.setBearing(newBearing);
    }
    tr.setZoom(oldZoom + getZoomAdjustment(oldLat, tr.center.lat));
}

/**
 * Returns the center longitude to apply when the bearing is held fixed and there is no drag delta.
 *
 * This is the {@link ITransform.setLocationAtPoint} path, which has a location and a screen point
 * but no motion, so it can only take the swing's longitude. That swing becomes ill-conditioned
 * near the pole and lets the location slip away from the point, so within the last ~12 degrees of
 * latitude it is eased off with a smoothstep anchored on {@link MAX_VALID_LATITUDE}, the highest
 * latitude the center can reach. Drags do not come through here: they are solved outright by
 * {@link trackedCenter}.
 * @param tr - The transform being moved.
 * @param newCenterLng - The swing target longitude.
 * @returns the center longitude to apply.
 */
function fixedBearingLongitude(tr: ITransform, newCenterLng: number): number {
    const oldLng = tr.center.lng;
    const dLngSwing = mod(newCenterLng - oldLng + 180, 360) - 180;
    const tRamp = clamp(1 - (MAX_VALID_LATITUDE - Math.abs(tr.center.lat)) / 12, 0, 1);
    const easeOff = tRamp * tRamp * (3 - 2 * tRamp);
    return oldLng + (1 - easeOff) * dLngSwing;
}

/**
 * Given a normalized horizon plane in Ax+By+Cz+D=0 format, compute the center and radius of
 * the circle in that plain that contains the entire visible portion of the unit sphere from horizon
 * to horizon.
 * @param horizonPlane - The plane that passes through visible horizon in Ax + By + Cz + D = 0 format where mag(A,B,C)=1
 * @returns the center point and radius of the disc that passes through the entire visible horizon
 */
export function horizonPlaneToCenterAndRadius(horizonPlane: ReadonlyVec4): { center: vec3; radius: number } {
    const center = createVec3f64();
    center[0] = horizonPlane[0] * -horizonPlane[3];
    center[1] = horizonPlane[1] * -horizonPlane[3];
    center[2] = horizonPlane[2] * -horizonPlane[3];
    /*
                     .*******
                 ****|\
               **    | \
             **      |  1
            * radius |   \
           *         |    \
           *  center +--D--+(0,0,0)
     */
    const radius = Math.sqrt(1 - horizonPlane[3] * horizonPlane[3]);
    return {center, radius};
}

/**
 * Computes the closest point on a sphere to `point`.
 * @param center - Center of the sphere
 * @param radius - Radius of the sphere
 * @param point - Point inside or outside the sphere
 * @returns A 3d vector of the point on the sphere closest to `point`
 */
export function clampToSphere(center: vec3, radius: number, point: vec3): vec3 {
    const relativeToCenter = createVec3f64();
    vec3.sub(relativeToCenter, point, center);
    const clamped = createVec3f64();
    vec3.scaleAndAdd(clamped, center, relativeToCenter, radius / vec3.len(relativeToCenter));
    return clamped;
}

function planetScaleAtLatitude(latitudeDegrees: number): number {
    return Math.cos(latitudeDegrees * Math.PI / 180);
}

/**
 * Computes how much to modify zoom to keep the globe size constant when changing latitude.
 * @param transform - An instance of any transform. Does not have any relation on the computed values.
 * @param oldLat - Latitude before change, in degrees.
 * @param newLat - Latitude after change, in degrees.
 * @returns A value to add to zoom level used for old latitude to keep same planet radius at new latitude.
 */
export function getZoomAdjustment(oldLat: number, newLat: number): number {
    const oldCircumference = planetScaleAtLatitude(oldLat);
    const newCircumference = planetScaleAtLatitude(newLat);
    return scaleZoom(newCircumference / oldCircumference);
}

export function getDegreesPerPixel(worldSize: number, lat: number): number {
    return 360.0 / getGlobeCircumferencePixels({worldSize, center: {lat}});
}

/**
 * Returns transform's new center rotation after applying panning.
 * @param panDelta - Panning delta, in same units as what is supplied to {@link HandlerManager}.
 * @param tr - Current transform. This object is not modified by the function.
 * @returns New center location to set to the map's transform to apply the specified panning.
 */
export function computeGlobePanCenter(panDelta: Point, tr: {
    readonly bearingInRadians: number;
    readonly worldSize: number;
    readonly center: LngLat;
    readonly zoom: number;
}): LngLat {
    // Apply map bearing to the panning vector
    const rotatedPanDelta = panDelta.rotate(tr.bearingInRadians);
    // Compute what the current zoom would be if the transform center would be moved to latitude 0.
    const normalizedGlobeZoom = tr.zoom + getZoomAdjustment(tr.center.lat, 0);
    // Note: we divide longitude speed by planet width at the given latitude. But we diminish this effect when the globe is zoomed out a lot.
    const lngSpeed = lerp(
        1.0 / planetScaleAtLatitude(tr.center.lat), // speed adjusted by latitude
        1.0 / planetScaleAtLatitude(Math.min(Math.abs(tr.center.lat), 60)), // also adjusted, but latitude is clamped to 60° to avoid too large speeds near poles
        remapSaturate(normalizedGlobeZoom, 7, 3, 0, 1.0) // Values chosen so that globe interactions feel good. Not scientific by any means.
    );
    const panningDegreesPerPixel = getDegreesPerPixel(tr.worldSize, tr.center.lat);
    return new LngLat(
        tr.center.lng - rotatedPanDelta.x * panningDegreesPerPixel * lngSpeed,
        clamp(tr.center.lat + rotatedPanDelta.y * panningDegreesPerPixel, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
    );
}

/**
 * Integration of `1 / cos(x)`.
 */
function integrateSecX(x: number): number {
    const xHalf = 0.5 * x;
    const sin = Math.sin(xHalf);
    const cos = Math.cos(xHalf);
    return Math.log(sin + cos) - Math.log(cos - sin);
}

/**
 * Interpolates globe center between two locations while preserving apparent rotation speed during interpolation.
 * @param start - The starting location of the interpolation.
 * @param deltaLng - Longitude delta to the end of the interpolation.
 * @param deltaLat - Latitude delta to the end of the interpolation.
 * @param t - The interpolation point in [0..1], where 0 is starting location, 1 is end location and other values are in between.
 * @returns The interpolated location.
 */
export function interpolateLngLatForGlobe(start: LngLat, deltaLng: number, deltaLat: number, t: number): LngLat {
    // Rate of change of longitude when moving the globe should be roughly 1/cos(latitude)
    // We want to use this rate of change, even for interpolation during easing.
    // Thus we know the derivative of our interpolation function: 1/cos(x)
    // To get our interpolation function, we need to integrate that.

    const interpolatedLat = start.lat + deltaLat * t;

    if (Math.abs(deltaLat) > 1) {
        const endLat = start.lat + deltaLat;
        const onDifferentHemispheres = Math.sign(endLat) !== Math.sign(start.lat);
        // Where do we sample the integrated speed curve?
        const samplePointStart = (onDifferentHemispheres ? -Math.abs(start.lat) : Math.abs(start.lat)) * Math.PI / 180;
        const samplePointEnd = Math.abs(start.lat + deltaLat) * Math.PI / 180;
        // Read the integrated speed curve at those points, and at the interpolation value "t".
        const valueT = integrateSecX(samplePointStart + t * (samplePointEnd - samplePointStart));
        const valueStart = integrateSecX(samplePointStart);
        const valueEnd = integrateSecX(samplePointEnd);
        // Compute new interpolation factor based on the speed curve
        const newT = (valueT - valueStart) / (valueEnd - valueStart);
        // Interpolate using that factor
        const interpolatedLng = start.lng + deltaLng * newT;
        return new LngLat(
            interpolatedLng,
            interpolatedLat
        );
    } else {
        // Fall back to simple interpolation when latitude doesn't change much.
        const interpolatedLng = start.lng + deltaLng * t;
        return new LngLat(
            interpolatedLng,
            interpolatedLat
        );
    }
}

/**
 * Describes the intersection of ray and sphere.
 * When null, no intersection occurred.
 * When both "t" values are the same, the ray just touched the sphere's surface.
 * When both value are different, a full intersection occurred.
 */
export type RaySphereIntersection = {
    /**
     * The ray parameter for intersection that is "less" along the ray direction.
     * Note that this value can be negative, meaning that this intersection occurred before the ray's origin.
     * The intersection point can be computed as `origin + direction * tMin`.
     */
    tMin: number;
    /**
     * The ray parameter for intersection that is "more" along the ray direction.
     * Note that this value can be negative, meaning that this intersection occurred before the ray's origin.
     * The intersection point can be computed as `origin + direction * tMax`.
     */
    tMax: number;
} | null;

/**
 * Returns the two intersection points of the ray and a sphere centered at the origin,
 * or null if no intersection occurs.
 * The intersections are encoded as the parameter for parametric ray equation,
 * with `tMin` being the first intersection and `tMax` being the second.
 * The quadratic is solved as suggested in Ray Tracing Gems, chapter 7, since the
 * schoolbook approach leads to floating point precision issues:
 * https://www.realtimerendering.com/raytracinggems/rtg/index.html
 * @param origin - The ray origin.
 * @param direction - The normalized ray direction.
 * @param radius - The sphere radius, defaults to the unit sphere of the planet.
 */
export function raySphereIntersection(origin: vec3, direction: vec3, radius: number = 1.0): RaySphereIntersection {
    const originDotDirection = vec3.dot(origin, direction);
    const radiusSquared = radius * radius;

    const inner = createVec3f64();
    const scaledDir = createVec3f64();
    vec3.scale(scaledDir, direction, originDotDirection);
    vec3.sub(inner, origin, scaledDir);
    const discriminant = radiusSquared - vec3.dot(inner, inner);

    if (discriminant < 0) {
        return null;
    }

    const c = vec3.dot(origin, origin) - radiusSquared;
    const q = -originDotDirection + (originDotDirection < 0 ? 1 : -1) * Math.sqrt(discriminant);
    const t0 = c / q;
    const t1 = q;
    return {
        tMin: Math.min(t0, t1),
        tMax: Math.max(t0, t1)
    };
}
