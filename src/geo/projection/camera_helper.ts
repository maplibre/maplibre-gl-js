import Point from '@mapbox/point-geometry';
import {degreesToRadians, getRollPitchBearing, type RollPitchBearing, rollPitchBearingToQuat, scaleZoom, warnOnce, zoomScale} from '../../util/util.ts';
import {quat} from 'gl-matrix';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {projectToWorldCoordinates, unprojectFromWorldCoordinates} from './mercator_utils.ts';

import type {IReadonlyTransform, ITransform} from '../transform_interface.ts';
import type {LngLat, LngLatLike} from '../lng_lat.ts';
import type {CameraForBoundsOptions, PointLike} from '../../ui/camera.ts';
import type {PaddingOptions} from '../edge_insets.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';

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
    pitch: number;
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
    easeFunc: (k: number) => void;
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
    easeFunc: (k: number, scale: number, centerFactor: number, pointAtOffset: Point) => void;
    scaleOfZoom: number;
    scaleOfMinZoom: number;
    /**
     * The map center when the animation ends.
     */
    targetCenter: LngLat;
    pixelPathLength: number;
};

export type UpdateRotationArgs = {
    /**
     * The starting Euler angles.
     */
    startEulerAngles: RollPitchBearing;

    /**
     * The end Euler angles.
     */
    endEulerAngles: RollPitchBearing;

    /**
     * The transform to be updated
     */
    tr: ITransform;

    /**
     * The interpolation fraction, between 0 and 1.
     */
    k: number;

    /**
     * If true, use spherical linear interpolation. If false, use linear interpolation of Euler angles.
     */
    useSlerp: boolean;
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
 * Contains projection-specific functions related to camera controls, easeTo, flyTo, inertia, etc.
 */
export interface ICameraHelper {
    get useGlobeControls(): boolean;

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };

    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void;

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void;

    /**
     * @param fitPadding - The `padding` option of `cameraForBounds`: the space wanted around the bounds.
     * @param mapPadding - The map's own padding, as in `map.getPadding()`, which the bounds must also stay clear of.
     */
    cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, pitch: number, tr: ITransform): CameraForBoxAndBearingHandlerResult;

    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void;

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult;

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult;
}

/**
 * @internal
 * Set a transform's rotation to a value interpolated between startEulerAngles and endEulerAngles
 */
export function updateRotation(args: UpdateRotationArgs): void {
    if (args.useSlerp) {
        // At pitch ==0, the Euler angle representation is ambiguous. In this case, set the Euler angles
        // to the representation requested by the caller
        if (args.k < 1) {
            const startRotation = rollPitchBearingToQuat(args.startEulerAngles.roll, args.startEulerAngles.pitch, args.startEulerAngles.bearing);
            const endRotation = rollPitchBearingToQuat(args.endEulerAngles.roll, args.endEulerAngles.pitch, args.endEulerAngles.bearing);
            const rotation: quat = new Float64Array(4);
            quat.slerp(rotation, startRotation, endRotation, args.k);
            const eulerAngles = getRollPitchBearing(rotation);
            args.tr.setRoll(eulerAngles.roll);
            args.tr.setPitch(eulerAngles.pitch);
            args.tr.setBearing(eulerAngles.bearing);
        } else {
            args.tr.setRoll(args.endEulerAngles.roll);
            args.tr.setPitch(args.endEulerAngles.pitch);
            args.tr.setBearing(args.endEulerAngles.bearing);
        }
    } else {
        args.tr.setRoll(interpolates.number(args.startEulerAngles.roll, args.endEulerAngles.roll, args.k));
        args.tr.setPitch(interpolates.number(args.startEulerAngles.pitch, args.endEulerAngles.pitch, args.k));
        args.tr.setBearing(interpolates.number(args.startEulerAngles.bearing, args.endEulerAngles.bearing, args.k));
    }
}

export function cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, pitch: number, tr: ITransform): CameraForBoxAndBearingHandlerResult {
    // Consider all corners of the rotated bounding box derived from the given points
    // when find the camera position that fits the given points.

    const nwWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthWest());
    const neWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthEast());
    const seWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthEast());
    const swWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthWest());

    const bearingRadians = degreesToRadians(-bearing);

    const nwRotatedWorld = nwWorld.rotate(bearingRadians);
    const neRotatedWorld = neWorld.rotate(bearingRadians);
    const seRotatedWorld = seWorld.rotate(bearingRadians);
    const swRotatedWorld = swWorld.rotate(bearingRadians);

    const upperRight = new Point(
        Math.max(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x),
        Math.max(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y)
    );

    const lowerLeft = new Point(
        Math.min(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x),
        Math.min(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y)
    );

    // Calculate zoom: consider the original bbox and both paddings.
    const size = upperRight.sub(lowerLeft);

    const availableWidth = (tr.width - (mapPadding.left + mapPadding.right + fitPadding.left + fitPadding.right));
    const availableHeight = (tr.height - (mapPadding.top + mapPadding.bottom + fitPadding.top + fitPadding.bottom));
    const scaleX = availableWidth / size.x;
    const scaleY = availableHeight / size.y;

    if (scaleY < 0 || scaleX < 0) {
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

    const center = unprojectFromWorldCoordinates(
        tr.worldSize,
        // either world diagonal can be used (NW-SE or NE-SW)
        nwWorld.add(seWorld).div(2).sub(offsetAtFinalZoom)
    );

    const flat = {center, zoom, bearing, pitch: 0};
    if (pitch === 0) return flat;

    const corners = [bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthEast(), bounds.getSouthWest()];
    return tiltCameraForBox(flat, corners, mercatorBoxCenter(bounds, tr), pitch, fitPadding, mapPadding, options.maxZoom, tr);
}

/**
 * Returns the midpoint of `bounds` in Mercator world coordinates, which a fit looking straight down places where the
 * paddings and the offset put the center of the box.
 */
export function mercatorBoxCenter(bounds: LngLatBounds, tr: IReadonlyTransform): LngLat {
    const nwWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthWest());
    const seWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthEast());
    return unprojectFromWorldCoordinates(tr.worldSize, nwWorld.add(seWorld).div(2));
}

/**
 * Tilts a camera that fits a box looking straight down to `pitch`, and corrects its zoom and center so that the box
 * fits as drawn at that pitch.
 *
 * Perspective shrinks the far side of the box and widens the near side. This measures the box on screen from the tilted
 * camera, scales the zoom by how far the box's screen bounding box over- or under-fills the space the paddings leave,
 * and moves the center so that bounding box lands where the box's center did when looking straight down, which keeps
 * the offset and the padding. Like MapLibre Native's `cameraForLatLngs`, it is a single pass, so a tall box on a steeply
 * pitched camera, whose far edge nears the horizon, can still overflow.
 *
 * @param flat - The camera that fits the box at pitch 0.
 * @param outline - Points whose screen bounding box is the box's: its corners, and points along its edges where the
 * projection curves them.
 * @param boxCenter - The point of the box that `flat` places where the paddings and the offset put the box's center.
 * @returns The tilted camera, or `undefined` if part of the outline is off the map surface once tilted.
 */
export function tiltCameraForBox(flat: CameraForBoxAndBearingHandlerResult, outline: LngLat[], boxCenter: LngLat, pitch: number, fitPadding: PaddingOptions, mapPadding: PaddingOptions, maxZoom: number, tr: ITransform): CameraForBoxAndBearingHandlerResult | undefined {
    const fitted = tr.clone();
    fitted.setPadding(mapPadding);
    fitted.setBearing(flat.bearing);
    fitted.setPitch(0);
    fitted.setRoll(0);
    fitted.setZoom(flat.zoom);
    fitted.setCenter(flat.center);
    const targetPoint = fitted.locationToScreenPoint(boxCenter);
    fitted.setPitch(pitch);

    const screenPoints = outline.map(p => fitted.locationToScreenPoint(p));
    if (screenPoints.some(p => !fitted.isPointOnMapSurface(p))) {
        cameraBoundsWarning();
        return undefined;
    }
    const screenMin = new Point(Math.min(...screenPoints.map(p => p.x)), Math.min(...screenPoints.map(p => p.y)));
    const screenMax = new Point(Math.max(...screenPoints.map(p => p.x)), Math.max(...screenPoints.map(p => p.y)));
    const screenSize = screenMax.sub(screenMin);
    const screenCenter = fitted.screenPointToLocation(screenMin.add(screenMax).div(2));

    const availableWidth = tr.width - (mapPadding.left + mapPadding.right + fitPadding.left + fitPadding.right);
    const availableHeight = tr.height - (mapPadding.top + mapPadding.bottom + fitPadding.top + fitPadding.bottom);
    const zoom = Math.min(flat.zoom + scaleZoom(Math.min(availableWidth / screenSize.x, availableHeight / screenSize.y)), maxZoom);
    fitted.setZoom(zoom);
    fitted.setLocationAtPoint(screenCenter, targetPoint);

    return {center: fitted.center, zoom, bearing: flat.bearing, pitch};
}
