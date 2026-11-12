import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {clamp, degreesToRadians, MAX_VALID_LATITUDE, scaleZoom, warnOnce, wrap} from '../../util/util.ts';
import {cameraDirectionFromPitchBearing, maxMercatorHorizonAngle} from './mercator_utils.ts';
import {getBearing, getFov, getPitch, interpolatePadding as interpolatePaddingValues, isPaddingEqual} from '../camera_state.ts';
import {applyConstrain, type CameraContext} from './camera_constrain.ts';
import {getCameraMetrics} from './camera_math.ts';
import * as mercatorCameraUpdates from './mercator_camera_updates.ts';
import * as verticalPerspectiveCameraUpdates from './vertical_perspective_camera_updates.ts';
import {getRollPitchBearing, rollPitchBearingToQuat} from '../../util/util.ts';
import {quat} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {usesGlobeControls} from './camera_projection.ts';

import type {CameraState} from '../camera_state.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {PaddingOptions} from '../edge_insets.ts';
import type {NearFarZ, WorldCoordinateHelper} from '../camera_types.ts';
import type {CameraForBoundsOptions, PointLike} from '../../ui/camera.ts';
import type {CameraProjection} from './camera_projection.ts';
import type {ProjectedCamera} from '../projected_camera.ts';
import type {RollPitchBearing} from '../../util/util.ts';
import type Point from '@mapbox/point-geometry';

/** The most passes {@link centerAlongView} takes to agree on the mercator scale at the center it finds. */
const MAX_CENTER_PASSES = 10;

/**
 * @internal
 * Snaps the camera's center and zoom into the range its constrain allows, see {@link applyConstrain}. A camera
 * without a size is not constrained. Snapping into range does not count as moving the camera, so the state keeps
 * whether it was {@link CameraState.unmodified}.
 */
export function constrainState(state: CameraState, context: CameraContext): CameraState {
    if (!state.width || !state.height) return state;
    const {center, zoom} = applyConstrain(state, context, state.center, state.zoom);
    let next = state;
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
export function getConstrainedCamera(state: CameraState, context: CameraContext, center: LngLat, zoom: number): {center: LngLat; zoom: number} {
    if (!state.width || !state.height) return {center, zoom};
    const constrained = applyConstrain(state, context, center, zoom);
    return {center: constrained.center, zoom: applyConstrain(state, context, constrained.center, constrained.zoom).zoom};
}

/** @internal Takes another camera state, constrained to this camera's context where `constrain` is set. */
export function takeState(that: CameraState, context: CameraContext, constrain: boolean): CameraState {
    return constrain ? constrainState(that, context) : that;
}

/** @internal Sets the lowest zoom, and keeps the zoom at or above it. */
export function setMinZoom(state: CameraState, context: CameraContext, minZoom: number): CameraState {
    if (state.minZoom === minZoom) return state;
    return keepUnmodified(state, (s) => {
        const next = {...s, minZoom};
        return setZoom(next, context, applyConstrain(next, context, next.center, next.zoom).zoom);
    });
}

/** @internal Sets the highest zoom, and keeps the zoom at or below it. */
export function setMaxZoom(state: CameraState, context: CameraContext, maxZoom: number): CameraState {
    if (state.maxZoom === maxZoom) return state;
    return keepUnmodified(state, (s) => {
        const next = {...s, maxZoom};
        return setZoom(next, context, applyConstrain(next, context, next.center, next.zoom).zoom);
    });
}

/** @internal Sets the lowest pitch, in degrees, and keeps the pitch at or above it. */
export function setMinPitch(state: CameraState, minPitch: number): CameraState {
    if (state.minPitch === minPitch) return state;
    return keepUnmodified(state, (s) => {
        const next = {...s, minPitch};
        return setPitch(next, Math.max(getPitch(next), minPitch));
    });
}

/** @internal Sets the highest pitch, in degrees, and keeps the pitch at or below it. */
export function setMaxPitch(state: CameraState, maxPitch: number): CameraState {
    if (state.maxPitch === maxPitch) return state;
    return keepUnmodified(state, (s) => {
        const next = {...s, maxPitch};
        return setPitch(next, Math.min(getPitch(next), maxPitch));
    });
}

/**
 * @internal
 * Sets whether the world is drawn more than once, side by side, which a world that does not wrap ignores. Undefined
 * draws it more than once, null once.
 */
export function setRenderWorldCopies(state: CameraState, worldCoordinateHelper: WorldCoordinateHelper, renderWorldCopies: boolean | null | undefined): CameraState {
    if (renderWorldCopies === undefined) {
        renderWorldCopies = true;
    } else if (renderWorldCopies === null) {
        renderWorldCopies = false;
    }
    if (renderWorldCopies && !worldCoordinateHelper.wraps) {
        warnOnce('renderWorldCopies has no effect in a projection whose world does not wrap.');
    }
    return state.renderWorldCopies === renderWorldCopies ? state : {...state, renderWorldCopies};
}

/** @internal Sets the bearing, in degrees. */
export function setBearing(state: CameraState, bearing: number): CameraState {
    const b = wrap(bearing, -180, 180) * Math.PI / 180;
    if (state.bearingInRadians === b) return state;
    return {...state, unmodified: false, bearingInRadians: b};
}

/** @internal Sets the pitch, in degrees, within the camera's pitch limits. */
export function setPitch(state: CameraState, pitch: number): CameraState {
    const p = clamp(pitch, state.minPitch, state.maxPitch) / 180 * Math.PI;
    if (state.pitchInRadians === p) return state;
    return {...state, unmodified: false, pitchInRadians: p};
}

/** @internal Sets the roll, in degrees. */
export function setRoll(state: CameraState, roll: number): CameraState {
    const r = roll / 180 * Math.PI;
    if (state.rollInRadians === r) return state;
    return {...state, unmodified: false, rollInRadians: r};
}

/** @internal Sets the vertical field of view, in degrees, between 0.1 and 150. */
export function setFov(state: CameraState, fov: number): CameraState {
    fov = clamp(fov, 0.1, 150);
    if (getFov(state) === fov) return state;
    return {...state, unmodified: false, fovInRadians: degreesToRadians(fov)};
}

/** @internal Sets the zoom, as the constrain allows it at the current center, and constrains the camera. */
export function setZoom(state: CameraState, context: CameraContext, zoom: number): CameraState {
    const constrainedZoom = applyConstrain(state, context, state.center, zoom).zoom;
    if (state.zoom === constrainedZoom) return state;
    return constrainState({...state, unmodified: false, zoom: constrainedZoom}, context);
}

/** @internal Sets the center, and constrains the camera. */
export function setCenter(state: CameraState, context: CameraContext, center: LngLat): CameraState {
    if (center.lat === state.center.lat && center.lng === state.center.lng) return state;
    return constrainState({...state, unmodified: false, center}, context);
}

/** @internal Moves the center and the zoom in one change, to a camera that is already constrained. */
export function setCenterAndZoom(state: CameraState, center: LngLat, zoom: number): CameraState {
    return {...state, unmodified: false, center, zoom};
}

/** @internal Sets the elevation of the center, in meters above sea level, and constrains the camera. */
export function setElevation(state: CameraState, context: CameraContext, elevation: number): CameraState {
    if (elevation === state.elevation) return state;
    return constrainState({...state, elevation}, context);
}

/** @internal Sets the padding, and constrains the camera. */
export function setPadding(state: CameraState, context: CameraContext, padding: PaddingOptions): CameraState {
    if (isPaddingEqual(state.padding, padding)) return state;
    return constrainState({...state, unmodified: false, padding: interpolatePaddingValues(state.padding, padding, 1)}, context);
}

/** @internal Moves the padding `t` of the way from `start` to `target`, and constrains the camera. */
export function interpolatePadding(state: CameraState, context: CameraContext, start: PaddingOptions, target: PaddingOptions, t: number): CameraState {
    return constrainState({...state, unmodified: false, padding: interpolatePaddingValues(start, target, t)}, context);
}

/** @internal Sets the size of the viewport, in pixels, and constrains the camera where `constrain` is set. */
export function resize(state: CameraState, context: CameraContext, width: number, height: number, constrain: boolean = true): CameraState {
    const next = state.width === width && state.height === height ? state : {...state, width, height};
    return constrain ? constrainState(next, context) : next;
}

/** @internal Sets the lowest elevation of the terrain tile under the center. */
export function setMinElevationForCurrentTile(state: CameraState, minElevationForCurrentTile: number): CameraState {
    return minElevationForCurrentTile === state.minElevationForCurrentTile ? state : {...state, minElevationForCurrentTile};
}

/** @internal Sets the depth range to use instead of the one the projection computes, or null to let it compute one. */
export function setNearFarZOverride(state: CameraState, nearFarZOverride: NearFarZ | null): CameraState {
    return {...state, nearFarZOverride};
}

/**
 * @internal
 * Sets or clears the geographical bounds the camera keeps to, and constrains the camera to the new bounds.
 * @param bounds - The bounds, or null to clear them.
 */
export function setMaxBounds(state: CameraState, context: CameraContext, bounds?: LngLatBounds | null): CameraState {
    if (!bounds) {
        return {...state, lngRange: null, latRange: [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE]};
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
        ...state,
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
export function recalculateZoomAndCenter(state: CameraState, context: CameraContext, elevation: number): CameraState {
    if (state.elevation - elevation === 0) return state;
    const worldCoordinateHelper = context.projection.worldCoordinateHelper;
    const metrics = getCameraMetrics(state, worldCoordinateHelper);

    const {x, y, z} = cameraDirectionFromPitchBearing(metrics.pitch, metrics.bearing);
    const originalCenterMercator = worldCoordinateHelper.worldFromLngLat(metrics.center.lng, metrics.center.lat, metrics.elevation);
    const originalMetersPerMercUnit = 1 / worldCoordinateHelper.worldZFromAltitude(1, metrics.center);
    const dCamMercator = metrics.cameraToCenterDistance / metrics.worldSize;
    const camMercator = new MercatorCoordinate(originalCenterMercator.x - x * dCamMercator, originalCenterMercator.y - y * dCamMercator, originalCenterMercator.z + z * dCamMercator);

    const {distanceToCenter, clampedElevation} = distanceToCenterFromAltElevationPitch(camMercator.z * originalMetersPerMercUnit, elevation, metrics.pitch);
    const {centerMercator, dMercator} = centerAlongView(worldCoordinateHelper, camMercator, x, y, distanceToCenter, originalMetersPerMercUnit);
    const center = worldCoordinateHelper.lngLatFromWorld(centerMercator.x, centerMercator.y);
    const zoom = scaleZoom(metrics.cameraToCenterDistance / dMercator / metrics.tileSize);

    const moved = {...state, elevation: clampedElevation, center};
    const zoomed = setZoom(moved, context, zoom);
    if (zoomed.zoom !== moved.zoom) return zoomed;
    return constrainState({...zoomed, unmodified: false}, context);
}

/**
 * @internal
 * The center, elevation and zoom of the camera that sits at `lnglat`, `alt` meters above sea level, and looks with the
 * given bearing and pitch, by default the camera's own.
 */
export function calculateCenterFromCameraLngLatAlt(state: CameraState, worldCoordinateHelper: WorldCoordinateHelper, lnglat: LngLatLike, alt: number, bearing?: number, pitch?: number): {center: LngLat; elevation: number; zoom: number} {
    const cameraBearing = bearing !== undefined ? bearing : getBearing(state);
    const cameraPitch = pitch !== undefined ? pitch : getPitch(state);

    const {distanceToCenter, clampedElevation} = distanceToCenterFromAltElevationPitch(alt, state.elevation, cameraPitch);
    const {x, y} = cameraDirectionFromPitchBearing(cameraPitch, cameraBearing);

    const cameraLngLat = LngLat.convert(lnglat);
    const camMercator = worldCoordinateHelper.worldFromLngLat(cameraLngLat.lng, cameraLngLat.lat, alt);
    const {centerMercator, dMercator} = centerAlongView(worldCoordinateHelper, camMercator, x, y, distanceToCenter, worldCoordinateHelper.metersPerWorldUnit(camMercator.x, camMercator.y));
    const center = worldCoordinateHelper.lngLatFromWorld(centerMercator.x, centerMercator.y);
    const zoom = scaleZoom(state.height / 2 / Math.tan(state.fovInRadians / 2) / dMercator / state.tileSize);
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
function keepUnmodified(state: CameraState, change: (state: CameraState) => CameraState): CameraState {
    const next = change(state);
    return next.unmodified === state.unmodified ? next : {...next, unmodified: state.unmodified};
}

/**
 * @internal
 * If a path crossing the antimeridian would be shorter, extend the final coordinate so that
 * interpolating between the two endpoints will cross it. A world that does not wrap has no antimeridian to cross.
 * @param center - The LngLat object of the desired center. This object will be mutated.
 */
export function normalizeCenter(tr: Pick<CameraState, 'renderWorldCopies' | 'lngRange' | 'center'>, worldCoordinateHelper: WorldCoordinateHelper, center: LngLat): void {
    if (!tr.renderWorldCopies || !worldCoordinateHelper.wraps || tr.lngRange) return;
    const delta = center.lng - tr.center.lng;
    center.lng +=
        delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
}

/** @internal What a frame of a gesture changes, which {@link rollPitchBearingZoom} and {@link pan} apply. */
export type MapControlsDeltas = {
    panDelta: Point;
    zoomDelta: number;
    bearingDelta: number;
    pitchDelta: number;
    rollDelta: number;
    around: Point;
    /**
     * Elevation in meters of the terrain under `around` at gesture start; when set,
     * pan and zoom keep the terrain at this elevation under `around`.
     */
    aroundElevation?: number;
};

/** @internal The camera {@link cameraForBoxAndBearing} fits a box with. */
export type CameraForBoxAndBearingResult = {
    center: LngLat;
    zoom: number;
    bearing: number;
};

/** @internal What an `easeTo` animation eases to, see {@link easeTo}. */
export type EaseToMotionOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    around?: LngLat;
    aroundPoint?: Point;
    center?: LngLatLike;
    zoom?: number;
    offset?: PointLike;
};

/** @internal The frames of an `easeTo` animation, see {@link easeTo}. */
export type EaseToMotion = {
    /**
     * The camera `k` of the way through the animation, from the camera the frame starts with and the context it is in
     * then, which a globe's transition between its projections changes as it zooms.
     */
    easeFunc: (state: CameraState, context: CameraContext, k: number) => CameraState;
    /**
     * The map center when the animation ends.
     */
    elevationCenter: LngLat;
    isZooming: boolean;
};

/** @internal Where a `flyTo` flight goes, see {@link flyTo}. */
export type FlyToMotionOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    center?: LngLatLike;
    locationAtOffset: LngLat;
    zoom?: number;
    minZoom?: number;
};

/** @internal The frames of a `flyTo` flight, see {@link flyTo}. */
export type FlyToMotion = {
    /** The camera `k` of the way along the flight, from the camera the frame starts with and its context, see {@link EaseToMotion.easeFunc}. */
    easeFunc: (state: CameraState, context: CameraContext, k: number, scale: number, centerFactor: number, pointAtOffset: Point) => CameraState;
    scaleOfZoom: number;
    scaleOfMinZoom: number;
    /**
     * The map center when the animation ends.
     */
    targetCenter: LngLat;
    pixelPathLength: number;
};

/** @internal Warns that no camera fits the bounds, padding and offset asked for. */
export function cameraBoundsWarning(): void {
    warnOnce(
        'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
    );
}

/**
 * @internal
 * Returns the camera with its rotation `k` of the way between two sets of Euler angles.
 * @param useSlerp - whether to interpolate the rotation spherically rather than each angle linearly
 */
export function interpolateRotation(state: CameraState, start: RollPitchBearing, end: RollPitchBearing, k: number, useSlerp: boolean): CameraState {
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
    return setBearing(setPitch(setRoll(state, angles.roll), angles.pitch), angles.bearing);
}

/**
 * The camera updates of the projection a camera is drawn with: a globe is turned while it renders as a globe, and
 * moved like mercator once it has turned into mercator, see {@link usesGlobeControls}.
 */
function updatesFor(projection: CameraProjection): typeof mercatorCameraUpdates | typeof verticalPerspectiveCameraUpdates {
    return usesGlobeControls(projection) ? verticalPerspectiveCameraUpdates : mercatorCameraUpdates;
}

/**
 * @internal
 * Where pan inertia eases the camera to after a drag that ended moving by `pan` pixels: an offset from the center on a
 * plane, kept short of the horizon, and a new center on the globe.
 */
export function panInertia(projectedCamera: ProjectedCamera, projection: CameraProjection, pan: Point): {easingCenter: LngLat; easingOffset: Point} {
    return updatesFor(projection).panInertia(projectedCamera, pan);
}

/** @internal The camera turned and zoomed by a gesture frame's deltas, zooming around its `around` point on the globe. */
export function rollPitchBearingZoom(state: CameraState, context: CameraContext, deltas: MapControlsDeltas): CameraState {
    return updatesFor(context.projection).rollPitchBearingZoom(state, context, deltas);
}

/** @internal The camera panned by a gesture frame, keeping `preZoomAroundLoc` under the point it was grabbed at. */
export function pan(state: CameraState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraState {
    return updatesFor(context.projection).pan(state, context, deltas, preZoomAroundLoc);
}

/**
 * @internal
 * The camera that fits a box at a bearing, see `cameraForBounds`.
 * @param fitPadding - The `padding` option of `cameraForBounds`: the space wanted around the bounds.
 * @param mapPadding - The map's own padding, as in `map.getPadding()`, which the bounds must also stay clear of.
 */
export function cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, state: CameraState, context: CameraContext): CameraForBoxAndBearingResult {
    return updatesFor(context.projection).cameraForBoxAndBearing(options, fitPadding, mapPadding, bounds, bearing, state, context);
}

/** @internal The camera a `jumpTo` puts at its center and zoom. */
export function jumpToCenterZoom(state: CameraState, context: CameraContext, options: {zoom?: number; center?: LngLatLike}): CameraState {
    return updatesFor(context.projection).jumpToCenterZoom(state, context, options);
}

/** @internal The frames of an `easeTo` animation from the camera it starts with. */
export function easeTo(state: CameraState, context: CameraContext, options: EaseToMotionOptions): EaseToMotion {
    return updatesFor(context.projection).easeTo(state, context, options);
}

/** @internal The frames of a `flyTo` flight from the camera it starts with. */
export function flyTo(state: CameraState, context: CameraContext, options: FlyToMotionOptions): FlyToMotion {
    return updatesFor(context.projection).flyTo(state, context, options);
}
