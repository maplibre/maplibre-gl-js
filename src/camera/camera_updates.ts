import {LngLat, type LngLatLike} from '../geo/lng_lat.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, scaleZoom, warnOnce, wrap} from '../util/util.ts';
import {cameraDirectionFromPitchBearing, maxMercatorHorizonAngle} from '../geo/projection/mercator_utils.ts';
import {getBearing, getFov, getPitch, interpolatePadding as interpolatePaddingValues, isPaddingEqual} from './camera_view_state.ts';
import {applyConstrain} from './camera_constrain.ts';
import {getCameraMetrics} from './project_camera.ts';
import {getRollPitchBearing, rollPitchBearingToQuat} from '../util/util.ts';
import {quat} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';

import type {CameraContext} from './camera_context.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {NearFarZ} from './camera_types.ts';
import type {RollPitchBearing} from '../util/util.ts';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

/** The most passes {@link centerAlongView} takes to agree on the mercator scale at the center it finds. */
const MAX_CENTER_PASSES = 10;

/**
 * @internal
 * Snaps the camera's center and zoom into the range its constrain allows, see {@link applyConstrain}. A camera
 * without a size is not constrained. Snapping into range does not count as moving the camera, so the state keeps
 * whether it was {@link CameraViewState.unmodified}.
 */
export function constrainState(view: CameraViewState, context: CameraContext): CameraViewState {
    if (!view.width || !view.height) return view;
    const {center, zoom} = applyConstrain(view, context, view.center, view.zoom);
    let next = view;
    if (center.lat !== next.center.lat || center.lng !== next.center.lng) next = {...next, center};
    const constrainedZoom = applyConstrain(next, context, next.center, zoom).zoom;
    if (next.zoom !== constrainedZoom) next = {...next, zoom: constrainedZoom};
    return next;
}

/**
 * @internal
 * Where the constrain puts a camera moved to `center` and `zoom`. A camera without a size is not constrained, so it
 * keeps the two as they are.
 */
export function getConstrainedCamera(view: CameraViewState, context: CameraContext, center: LngLat, zoom: number): {center: LngLat; zoom: number} {
    if (!view.width || !view.height) return {center, zoom};
    const constrained = applyConstrain(view, context, center, zoom);
    return {center: constrained.center, zoom: applyConstrain(view, context, constrained.center, constrained.zoom).zoom};
}

/** @internal Sets the lowest zoom, and keeps the zoom at or above it. */
export function setMinZoom(view: CameraViewState, context: CameraContext, minZoom: number): CameraViewState {
    if (view.minZoom === minZoom) return view;
    return keepUnmodified(view, (s) => {
        const next = {...s, minZoom};
        return setZoom(next, context, applyConstrain(next, context, next.center, next.zoom).zoom);
    });
}

/** @internal Sets the highest zoom, and keeps the zoom at or below it. */
export function setMaxZoom(view: CameraViewState, context: CameraContext, maxZoom: number): CameraViewState {
    if (view.maxZoom === maxZoom) return view;
    return keepUnmodified(view, (s) => {
        const next = {...s, maxZoom};
        return setZoom(next, context, applyConstrain(next, context, next.center, next.zoom).zoom);
    });
}

/** @internal Sets the lowest pitch, in degrees, and keeps the pitch at or above it. */
export function setMinPitch(view: CameraViewState, minPitch: number): CameraViewState {
    if (view.minPitch === minPitch) return view;
    return keepUnmodified(view, (s) => {
        const next = {...s, minPitch};
        return setPitch(next, Math.max(getPitch(next), minPitch));
    });
}

/** @internal Sets the highest pitch, in degrees, and keeps the pitch at or below it. */
export function setMaxPitch(view: CameraViewState, maxPitch: number): CameraViewState {
    if (view.maxPitch === maxPitch) return view;
    return keepUnmodified(view, (s) => {
        const next = {...s, maxPitch};
        return setPitch(next, Math.min(getPitch(next), maxPitch));
    });
}

/**
 * @internal
 * Sets whether the world is drawn more than once, side by side, which a world that does not wrap ignores. Undefined
 * draws it more than once, null once.
 */
export function setRenderWorldCopies(view: CameraViewState, worldCoordinateHelper: WorldCoordinateHelper, renderWorldCopies: boolean | null | undefined): CameraViewState {
    if (renderWorldCopies === undefined) {
        renderWorldCopies = true;
    } else if (renderWorldCopies === null) {
        renderWorldCopies = false;
    }
    if (renderWorldCopies && !worldCoordinateHelper.wraps) {
        warnOnce('renderWorldCopies has no effect in a projection whose world does not wrap.');
    }
    return view.renderWorldCopies === renderWorldCopies ? view : {...view, renderWorldCopies};
}

/** @internal Sets the bearing, in degrees. */
export function setBearing(view: CameraViewState, bearing: number): CameraViewState {
    const b = wrap(bearing, -180, 180) * Math.PI / 180;
    if (view.bearingInRadians === b) return view;
    return {...view, unmodified: false, bearingInRadians: b};
}

/** @internal Sets the pitch, in degrees, within the camera's pitch limits. */
export function setPitch(view: CameraViewState, pitch: number): CameraViewState {
    const p = clamp(pitch, view.minPitch, view.maxPitch) / 180 * Math.PI;
    if (view.pitchInRadians === p) return view;
    return {...view, unmodified: false, pitchInRadians: p};
}

/** @internal Sets the roll, in degrees. */
export function setRoll(view: CameraViewState, roll: number): CameraViewState {
    const r = roll / 180 * Math.PI;
    if (view.rollInRadians === r) return view;
    return {...view, unmodified: false, rollInRadians: r};
}

/** @internal Sets the vertical field of view, in degrees, between 0.1 and 150. */
export function setFov(view: CameraViewState, fov: number): CameraViewState {
    fov = clamp(fov, 0.1, 150);
    if (getFov(view) === fov) return view;
    return {...view, unmodified: false, fovInRadians: degreesToRadians(fov)};
}

/** @internal Sets the zoom, as the constrain allows it at the current center, and constrains the camera. */
export function setZoom(view: CameraViewState, context: CameraContext, zoom: number): CameraViewState {
    const constrainedZoom = applyConstrain(view, context, view.center, zoom).zoom;
    if (view.zoom === constrainedZoom) return view;
    return constrainState({...view, unmodified: false, zoom: constrainedZoom}, context);
}

/** @internal Sets the center, and constrains the camera. */
export function setCenter(view: CameraViewState, context: CameraContext, center: LngLat): CameraViewState {
    if (center.lat === view.center.lat && center.lng === view.center.lng) return view;
    return constrainState({...view, unmodified: false, center}, context);
}

/** @internal Moves the center and the zoom in one change, to a camera that is already constrained. */
export function setCenterAndZoom(view: CameraViewState, center: LngLat, zoom: number): CameraViewState {
    return {...view, unmodified: false, center, zoom};
}

/** @internal Sets the elevation of the center, in meters above sea level, and constrains the camera. */
export function setElevation(view: CameraViewState, context: CameraContext, elevation: number): CameraViewState {
    if (elevation === view.elevation) return view;
    return constrainState({...view, elevation}, context);
}

/** @internal Sets the padding, and constrains the camera. */
export function setPadding(view: CameraViewState, context: CameraContext, padding: PaddingOptions): CameraViewState {
    if (isPaddingEqual(view.padding, padding)) return view;
    return constrainState({...view, unmodified: false, padding: interpolatePaddingValues(view.padding, padding, 1)}, context);
}

/** @internal Moves the padding `t` of the way from `start` to `target`, and constrains the camera. */
export function interpolatePadding(view: CameraViewState, context: CameraContext, start: PaddingOptions, target: PaddingOptions, t: number): CameraViewState {
    return constrainState({...view, unmodified: false, padding: interpolatePaddingValues(start, target, t)}, context);
}

/** @internal Sets the size of the viewport, in pixels, and constrains the camera where `constrain` is set. */
export function resize(view: CameraViewState, context: CameraContext, width: number, height: number, constrain: boolean = true): CameraViewState {
    const next = view.width === width && view.height === height ? view : {...view, width, height};
    return constrain ? constrainState(next, context) : next;
}

/** @internal Sets the lowest elevation of the terrain tile under the center. */
export function setMinElevationForCurrentTile(view: CameraViewState, minElevationForCurrentTile: number): CameraViewState {
    return minElevationForCurrentTile === view.minElevationForCurrentTile ? view : {...view, minElevationForCurrentTile};
}

/** @internal Sets the depth range to use instead of the one the projection computes, or null to let it compute one. */
export function setNearFarZOverride(view: CameraViewState, nearFarZOverride: NearFarZ | null): CameraViewState {
    return {...view, nearFarZOverride};
}

/**
 * @internal
 * Sets or clears the geographical bounds the camera keeps to, and constrains the camera to the new bounds.
 * @param bounds - The bounds, or null to clear them.
 */
export function setMaxBounds(view: CameraViewState, context: CameraContext, bounds?: LngLatBounds | null): CameraViewState {
    if (!bounds) {
        return {...view, lngRange: null, latRange: [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE]};
    }

    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    const longitudeUnconstrained = west === -Infinity && east === Infinity;
    if ((!Number.isFinite(west) || !Number.isFinite(east)) && !longitudeUnconstrained) {
        throw new Error('Longitude maxBounds values must either be finite or span from -Infinity to Infinity');
    }

    return constrainState({
        ...view,
        lngRange: longitudeUnconstrained ? null : [west, east],
        latRange: [
            clamp(south, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE),
            clamp(north, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
        ],
    }, context);
}

/**
 * @internal
 * Moves the center along the view to the given elevation with the camera where it is, and sets the zoom to match.
 * The center is found along the view from the camera's position, which is kept, by {@link centerAlongView}, starting
 * from the old center's mercator scale.
 * @param elevation - the elevation in meters for the center
 */
export function moveCenterToElevation(view: CameraViewState, context: CameraContext, elevation: number): CameraViewState {
    if (view.elevation - elevation === 0) return view;
    const worldCoordinateHelper = context.worldCoordinateHelper;
    const metrics = getCameraMetrics(view, worldCoordinateHelper);

    const {x, y, z} = cameraDirectionFromPitchBearing(metrics.pitch, metrics.bearing);
    const originalCenterMercator = worldCoordinateHelper.worldFromLngLat(metrics.center.lng, metrics.center.lat, metrics.elevation);
    const originalMetersPerMercUnit = 1 / worldCoordinateHelper.worldZFromAltitude(1, metrics.center);
    const dCamMercator = metrics.cameraToCenterDistance / metrics.worldSize;
    const camMercator = new MercatorCoordinate(originalCenterMercator.x - x * dCamMercator, originalCenterMercator.y - y * dCamMercator, originalCenterMercator.z + z * dCamMercator);

    const {distanceToCenter, clampedElevation} = distanceToCenterFromAltElevationPitch(camMercator.z * originalMetersPerMercUnit, elevation, metrics.pitch);
    const {centerMercator, dMercator} = centerAlongView(worldCoordinateHelper, camMercator, x, y, distanceToCenter, originalMetersPerMercUnit);
    const center = worldCoordinateHelper.lngLatFromWorld(centerMercator.x, centerMercator.y);
    const zoom = scaleZoom(metrics.cameraToCenterDistance / dMercator / metrics.tileSize);

    const moved = {...view, elevation: clampedElevation, center};
    const zoomed = setZoom(moved, context, zoom);
    if (zoomed.zoom !== moved.zoom) return zoomed;
    return constrainState({...zoomed, unmodified: false}, context);
}

/**
 * @internal
 * The center, elevation and zoom of the camera that sits at `lnglat`, `alt` meters above sea level, and looks with the
 * given bearing and pitch, by default the camera's own.
 */
export function calculateCenterFromCameraLngLatAlt(view: CameraViewState, worldCoordinateHelper: WorldCoordinateHelper, lnglat: LngLatLike, alt: number, bearing?: number, pitch?: number): {center: LngLat; elevation: number; zoom: number} {
    const cameraBearing = bearing !== undefined ? bearing : getBearing(view);
    const cameraPitch = pitch !== undefined ? pitch : getPitch(view);

    const {distanceToCenter, clampedElevation} = distanceToCenterFromAltElevationPitch(alt, view.elevation, cameraPitch);
    const {x, y} = cameraDirectionFromPitchBearing(cameraPitch, cameraBearing);

    const cameraLngLat = LngLat.convert(lnglat);
    const camMercator = worldCoordinateHelper.worldFromLngLat(cameraLngLat.lng, cameraLngLat.lat, alt);
    const {centerMercator, dMercator} = centerAlongView(worldCoordinateHelper, camMercator, x, y, distanceToCenter, worldCoordinateHelper.metersPerWorldUnit(camMercator.x, camMercator.y));
    const center = worldCoordinateHelper.lngLatFromWorld(centerMercator.x, centerMercator.y);
    const zoom = scaleZoom(view.height / 2 / Math.tan(view.fovInRadians / 2) / dMercator / view.tileSize);
    return {center, elevation: clampedElevation, zoom};
}

/**
 * The center `distanceToCenter` meters from the camera along the view, in world units, and that distance in
 * world units. The mercator scale changes with latitude and the center's latitude is unknown until the center
 * is: each pass places the center with the scale at the center the last pass found, from `metersPerMercUnit`,
 * and stops once two passes agree. Zoomed far out at a high latitude the scale changes faster along the view than
 * a pass follows; a pass that would move the center further than the last one did ends the search at the last
 * stable center instead of oscillating (#6775).
 * @param cameraMercator - the camera's position
 * @param x - the view direction's x component, see {@link cameraDirectionFromPitchBearing}
 * @param y - the view direction's y component
 * @param distanceToCenter - the camera's distance to the center in meters
 * @param metersPerMercUnit - the mercator scale to start from
 */
function centerAlongView(worldCoordinateHelper: WorldCoordinateHelper, cameraMercator: MercatorCoordinate, x: number, y: number, distanceToCenter: number, metersPerMercUnit: number): {centerMercator: MercatorCoordinate; dMercator: number} {
    let dMercator = distanceToCenter / metersPerMercUnit;
    let centerMercator = new MercatorCoordinate(cameraMercator.x + x * dMercator, cameraMercator.y + y * dMercator);
    let step = Infinity;
    for (let pass = 1; pass < MAX_CENTER_PASSES; pass++) {
        const centerMetersPerMercUnit = worldCoordinateHelper.metersPerWorldUnit(centerMercator.x, centerMercator.y);
        const nextStep = Math.abs(centerMetersPerMercUnit - metersPerMercUnit);
        if (nextStep <= 1e-12 * metersPerMercUnit || nextStep >= step) break;
        step = nextStep;
        metersPerMercUnit = centerMetersPerMercUnit;
        dMercator = distanceToCenter / metersPerMercUnit;
        centerMercator = new MercatorCoordinate(cameraMercator.x + x * dMercator, cameraMercator.y + y * dMercator);
    }
    return {centerMercator, dMercator};
}

/**
 * The distance in meters from a camera at `alt` meters, looking down at `pitch`, to the plane at `elevation`, and the
 * elevation the center ends at: a camera that looks at or above the horizon, or that is below the plane, gets a
 * center 10 km away instead.
 */
function distanceToCenterFromAltElevationPitch(alt: number, elevation: number, pitch: number): {distanceToCenter: number; clampedElevation: number} {
    const dzNormalized = -Math.cos(degreesToRadians(pitch));
    const altitudeAGL = alt - elevation;
    let distanceToCenter: number;
    let clampedElevation = elevation;
    if (dzNormalized * altitudeAGL >= 0.0 || Math.abs(dzNormalized) < Math.cos(degreesToRadians(maxMercatorHorizonAngle))) {
        distanceToCenter = 10000;
        clampedElevation = alt + distanceToCenter * dzNormalized;
    } else {
        distanceToCenter = -altitudeAGL / dzNormalized;
    }
    return {distanceToCenter, clampedElevation};
}

/** Runs a change that moves the camera only to keep it within new limits, which does not count as moving it. */
function keepUnmodified(view: CameraViewState, changeCallback: (view: CameraViewState) => CameraViewState): CameraViewState {
    const next = changeCallback(view);
    return next.unmodified === view.unmodified ? next : {...next, unmodified: view.unmodified};
}

/**
 * @internal
 * If a path crossing the antimeridian would be shorter, extend the final coordinate so that
 * interpolating between the two endpoints will cross it. A world that does not wrap has no antimeridian to cross.
 * @param center - The LngLat object of the desired center. This object will be mutated.
 */
export function normalizeCenter(state: Pick<CameraViewState, 'renderWorldCopies' | 'lngRange' | 'center'>, worldCoordinateHelper: WorldCoordinateHelper, center: LngLat): void {
    if (!state.renderWorldCopies || !worldCoordinateHelper.wraps || state.lngRange) return;
    const delta = center.lng - state.center.lng;
    center.lng +=
        delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
}

/** @internal Warns that no camera fits the bounds, padding and offset asked for. */
export function warnBoundsCannotFit(): void {
    warnOnce(
        'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
    );
}

/**
 * @internal
 * Returns the camera with its rotation `k` of the way between two sets of Euler angles.
 * @param useSlerp - whether to interpolate the rotation spherically rather than each angle linearly
 */
export function interpolateRotation(view: CameraViewState, start: RollPitchBearing, end: RollPitchBearing, k: number, useSlerp: boolean): CameraViewState {
    let angles: RollPitchBearing;
    if (!useSlerp) {
        angles = {
            roll: interpolates.number(start.roll, end.roll, k),
            pitch: interpolates.number(start.pitch, end.pitch, k),
            bearing: interpolates.number(start.bearing, end.bearing, k),
        };
    } else if (k < 1) {
        const rotation: quat = new Float64Array(4);
        quat.slerp(rotation, rollPitchBearingToQuat(start.roll, start.pitch, start.bearing), rollPitchBearingToQuat(end.roll, end.pitch, end.bearing), k);
        angles = getRollPitchBearing(rotation);
    } else {
        // At pitch 0 the Euler angles are ambiguous, so the animation ends on the ones it was asked for.
        angles = end;
    }
    return setBearing(setPitch(setRoll(view, angles.roll), angles.pitch), angles.bearing);
}
