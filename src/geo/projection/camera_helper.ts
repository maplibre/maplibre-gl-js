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

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, pitch: number, tr: ITransform): CameraForBoxAndBearingHandlerResult;

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

export function cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, pitch: number, tr: ITransform): CameraForBoxAndBearingHandlerResult {
    const edgePadding = mapPadding;

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

    // Calculate zoom: consider the original bbox and padding.
    const size = upperRight.sub(lowerLeft);

    const availableWidth = (tr.width - (edgePadding.left + edgePadding.right + padding.left + padding.right));
    const availableHeight = (tr.height - (edgePadding.top + edgePadding.bottom + padding.top + padding.bottom));
    const scaleX = availableWidth / size.x;
    const scaleY = availableHeight / size.y;

    if (scaleY < 0 || scaleX < 0) {
        cameraBoundsWarning();
        return undefined;
    }

    let zoom = Math.min(scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);

    // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of padding.
    const offset = Point.convert(options.offset);
    const paddingOffsetX = (padding.left - padding.right) / 2;
    const paddingOffsetY = (padding.top - padding.bottom) / 2;
    const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
    const rotatedPaddingOffset = paddingOffset.rotate(degreesToRadians(bearing));
    const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
    const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / zoomScale(zoom));

    const boxCenter = unprojectFromWorldCoordinates(tr.worldSize, nwWorld.add(seWorld).div(2));
    let center = unprojectFromWorldCoordinates(
        tr.worldSize,
        // either world diagonal can be used (NW-SE or NE-SW)
        nwWorld.add(seWorld).div(2).sub(offsetAtFinalZoom)
    );

    if (pitch === 0) {
        return {center, zoom, bearing, pitch};
    }

    // The zoom and center above fit the box when looking straight down. When pitched, perspective shrinks the far
    // side of the box and widens the near side, so measure the box on screen from that camera and correct the zoom
    // and center to fit what is actually drawn. Same as MapLibre Native's cameraForLatLngs, this is a single pass.
    const fitted = tr.clone();
    fitted.setPadding(mapPadding);
    fitted.setBearing(bearing);
    fitted.setPitch(0);
    fitted.setRoll(0);
    fitted.setZoom(zoom);
    fitted.setCenter(center);
    // Where the box center lands on screen when looking straight down, which already accounts for the offset and the padding.
    const targetPoint = fitted.locationToScreenPoint(boxCenter);
    fitted.setPitch(pitch);

    const screenCorners = [
        fitted.locationToScreenPoint(bounds.getNorthWest()),
        fitted.locationToScreenPoint(bounds.getNorthEast()),
        fitted.locationToScreenPoint(bounds.getSouthEast()),
        fitted.locationToScreenPoint(bounds.getSouthWest())
    ];
    if (screenCorners.some(p => !fitted.isPointOnMapSurface(p))) {
        cameraBoundsWarning();
        return undefined;
    }
    const screenMin = new Point(Math.min(...screenCorners.map(p => p.x)), Math.min(...screenCorners.map(p => p.y)));
    const screenMax = new Point(Math.max(...screenCorners.map(p => p.x)), Math.max(...screenCorners.map(p => p.y)));
    const screenSize = screenMax.sub(screenMin);
    const screenCenter = fitted.screenPointToLocation(screenMin.add(screenMax).div(2));

    zoom = Math.min(zoom + scaleZoom(Math.min(availableWidth / screenSize.x, availableHeight / screenSize.y)), options.maxZoom);
    fitted.setZoom(zoom);
    fitted.setLocationAtPoint(screenCenter, targetPoint);
    center = fitted.center;

    return {center, zoom, bearing, pitch};
}
