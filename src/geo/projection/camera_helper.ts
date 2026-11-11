import Point from '@mapbox/point-geometry';
import {clamp, degreesToRadians, getRollPitchBearing, MAX_VALID_LATITUDE, type RollPitchBearing, rollPitchBearingToQuat, scaleZoom, warnOnce, zoomScale} from '../../util/util.ts';
import {quat} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {lngLatBoxToWorldSamples, projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils.ts';
import {setBearing, setPitch, setRoll} from './camera_updates.ts';

import type {LngLat, LngLatLike} from '../lng_lat.ts';
import type {CameraForBoundsOptions, PointLike} from '../../ui/camera.ts';
import type {PaddingOptions} from '../edge_insets.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {CameraState} from '../camera_state.ts';
import type {CameraMetrics, ProjectedCamera} from '../projected_camera.ts';
import type {CameraContext} from './camera_constrain.ts';
import type {WorldCoordinateHelper} from '../camera_types.ts';

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

export type CameraForBoxAndBearingHandlerResult = {
    center: LngLat;
    zoom: number;
    bearing: number;
};

export type EaseToHandlerOptions = {
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

export type EaseToHandlerResult = {
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

export type FlyToHandlerOptions = {
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

export type FlyToHandlerResult = {
    /** The camera `k` of the way along the flight, from the camera the frame starts with and its context, see {@link EaseToHandlerResult.easeFunc}. */
    easeFunc: (state: CameraState, context: CameraContext, k: number, scale: number, centerFactor: number, pointAtOffset: Point) => CameraState;
    scaleOfZoom: number;
    scaleOfMinZoom: number;
    /**
     * The map center when the animation ends.
     */
    targetCenter: LngLat;
    pixelPathLength: number;
};

/**
 * @internal
 */
export function cameraBoundsWarning(): void {
    warnOnce(
        'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
    );
}

/**
 * @internal
 * The projection-specific camera controls, easeTo, flyTo, inertia, etc. Each takes the camera it starts from and
 * returns the camera it ends on.
 */
export interface ICameraHelper {
    /** Whether the controls turn a globe rather than move a plane. */
    get useGlobeControls(): boolean;

    handlePanInertia(pan: Point, data: ProjectedCamera): {
        easingCenter: LngLat;
        easingOffset: Point;
    };

    handleMapControlsRollPitchBearingZoom(state: CameraState, context: CameraContext, deltas: MapControlsDeltas): CameraState;

    handleMapControlsPan(state: CameraState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraState;

    /**
     * @param fitPadding - The `padding` option of `cameraForBounds`: the space wanted around the bounds.
     * @param mapPadding - The map's own padding, as in `map.getPadding()`, which the bounds must also stay clear of.
     */
    cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, state: CameraState, context: CameraContext): CameraForBoxAndBearingHandlerResult;

    handleJumpToCenterZoom(state: CameraState, context: CameraContext, options: { zoom?: number; center?: LngLatLike }): CameraState;

    handleEaseTo(state: CameraState, context: CameraContext, options: EaseToHandlerOptions): EaseToHandlerResult;

    handleFlyTo(state: CameraState, context: CameraContext, options: FlyToHandlerOptions): FlyToHandlerResult;
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

export function cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: CameraMetrics, worldCoordinateHelper: WorldCoordinateHelper): CameraForBoxAndBearingHandlerResult {
    // Fit the whole box, not only its corners: rotate the points sampled over it by the bearing and take
    // the rectangle around them in the rotated frame, grown by how far the edges bulge past the points.

    const nwWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthWest(), worldCoordinateHelper);
    const neWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthEast(), worldCoordinateHelper);
    const seWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthEast(), worldCoordinateHelper);
    const swWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthWest(), worldCoordinateHelper);
    const [south, north] = worldCoordinateHelper.wraps ?
        [clamp(bounds.getSouth(), -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE), clamp(bounds.getNorth(), -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)] :
        [bounds.getSouth(), bounds.getNorth()];
    const {points, bulge} = lngLatBoxToWorldSamples(worldCoordinateHelper, bounds.getWest(), south, bounds.getEast(), north);

    const bearingRadians = degreesToRadians(-bearing);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        const {x, y} = point.mult(tr.worldSize).rotate(bearingRadians);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    const worldBulge = bulge * tr.worldSize;
    const upperRight = new Point(maxX + worldBulge, maxY + worldBulge);
    const lowerLeft = new Point(minX - worldBulge, minY - worldBulge);

    // Calculate zoom: consider the original bbox and both paddings.
    const size = upperRight.sub(lowerLeft);

    const availableWidth = (tr.width - (mapPadding.left + mapPadding.right + fitPadding.left + fitPadding.right));
    const availableHeight = (tr.height - (mapPadding.top + mapPadding.bottom + fitPadding.top + fitPadding.bottom));
    const scaleX = availableWidth / size.x;
    const scaleY = availableHeight / size.y;

    // A box reaching a point the projection sends to infinity has no finite size to fit.
    if (scaleY < 0 || scaleX < 0 || !Number.isFinite(size.x) || !Number.isFinite(size.y)) {
        cameraBoundsWarning();
        return undefined;
    }

    const zoom = Math.min(scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);

    // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of the fit padding.
    const offset = Point.convert(options.offset);
    const paddingOffsetX = (fitPadding.left - fitPadding.right) / 2;
    const paddingOffsetY = (fitPadding.top - fitPadding.bottom) / 2;
    const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
    const rotatedPaddingOffset = paddingOffset.rotate(degreesToRadians(bearing));
    const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
    const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / zoomScale(zoom));

    // The middle of the fitted rectangle, rotated back. For a box that projects to a parallelogram, as every box
    // does in mercator, that is the midpoint of its diagonal, taken directly to keep rotation rounding out of it.
    const projectsToParallelogram = bulge === 0 && nwWorld.add(seWorld).equals(neWorld.add(swWorld));
    const middle = projectsToParallelogram ? nwWorld.add(seWorld).div(2) : upperRight.add(lowerLeft).div(2).rotate(-bearingRadians);
    const center = unprojectFromWorldCoordinates(
        tr.worldSize,
        middle.sub(offsetAtFinalZoom),
        worldCoordinateHelper
    );

    return {
        center,
        zoom,
        bearing
    };
}
