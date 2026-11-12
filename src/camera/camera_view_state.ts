import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {EdgeInsets} from '../geo/edge_insets.ts';
import {MAX_VALID_LATITUDE, radiansToDegrees} from '../util/util.ts';

import type {TransformOptions} from '../geo/transform.ts';
import type {NearFarZ, TransformConstrainFunction} from './camera_types.ts';

/**
 * @internal
 * The camera of a {@link Transform}: its position, its size and its limits, as plain data. What follows from it the
 * same way in every projection is its {@link CameraMetrics}. The transform is the only one to change it, and its
 * projection part reads it.
 */
export type CameraViewState = {
    readonly tileSize: number;
    width: number;
    height: number;
    center: LngLat;
    /**
     * Elevation at the center, in meters above sea level.
     */
    elevation: number;
    zoom: number;
    bearingInRadians: number;
    pitchInRadians: number;
    rollInRadians: number;
    /**
     * Vertical field of view in radians.
     */
    fovInRadians: number;
    edgeInsets: EdgeInsets;
    minZoom: number;
    maxZoom: number;
    minPitch: number;
    maxPitch: number;
    lngRange: [number, number];
    latRange: [number, number];
    renderWorldCopies: boolean;
    minElevationForCurrentTile: number;
    /**
     * The depth range to use instead of the one each projection computes, or null.
     */
    nearFarZOverride: NearFarZ | null;
};

/**
 * @internal
 * The camera state of a new transform, which has no size yet and no bounds.
 */
export function createCameraViewState(options?: TransformOptions): CameraViewState {
    return {
        tileSize: 512,
        width: 0,
        height: 0,
        center: new LngLat(0, 0),
        elevation: 0,
        zoom: 0,
        bearingInRadians: 0,
        pitchInRadians: 0,
        rollInRadians: 0,
        fovInRadians: 0.6435011087932844,
        edgeInsets: new EdgeInsets(),
        minZoom: options?.minZoom || 0,
        maxZoom: options?.maxZoom || 22,
        minPitch: (options?.minPitch === undefined || options?.minPitch === null) ? 0 : options?.minPitch,
        maxPitch: (options?.maxPitch === undefined || options?.maxPitch === null) ? 60 : options?.maxPitch,
        lngRange: null,
        latRange: [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE],
        renderWorldCopies: options?.renderWorldCopies === undefined ? true : !!options?.renderWorldCopies,
        minElevationForCurrentTile: 0,
        nearFarZOverride: null,
    };
}

/**
 * @internal
 * The center of the screen in pixels with the top-left corner being (0,0) and +y axis pointing downwards.
 * This accounts for padding.
 */
export function getCenterPoint(view: Readonly<CameraViewState>): Point {
    return view.edgeInsets.getCenter(view.width, view.height);
}

/**
 * @internal
 * How far the padding moves the center point away from the middle of the screen, in pixels.
 */
export function getCenterOffset(view: Readonly<CameraViewState>): Point {
    return getCenterPoint(view)._sub(new Point(view.width, view.height)._div(2));
}

/**
 * @internal
 * The size of the world in pixels at the zoom.
 */
export function getWorldSize(camera: {readonly tileSize: number; readonly scale: number}): number {
    return camera.tileSize * camera.scale;
}

/**
 * @internal
 * The bearing in degrees.
 */
export function getBearing(view: Readonly<CameraViewState>): number {
    return view.bearingInRadians / Math.PI * 180;
}

/**
 * @internal
 * The pitch in degrees.
 */
export function getPitch(view: Readonly<CameraViewState>): number {
    return view.pitchInRadians / Math.PI * 180;
}

/**
 * @internal
 * The roll in degrees.
 */
export function getRoll(view: Readonly<CameraViewState>): number {
    return view.rollInRadians / Math.PI * 180;
}

/**
 * @internal
 * The vertical field of view in degrees.
 */
export function getFov(view: Readonly<CameraViewState>): number {
    return radiansToDegrees(view.fovInRadians);
}

/**
 * @internal
 * Where `constrain` puts a camera moved to `center` and `zoom`, the way a {@link Transform} constrains its own camera,
 * which is once and then the zoom again at the constrained center. A camera without a size is not constrained, so it
 * keeps the two as they are.
 */
export function getConstrainedCamera(view: Readonly<CameraViewState>, constrain: TransformConstrainFunction, center: LngLat, zoom: number): {center: LngLat; zoom: number} {
    if (!view.width || !view.height) return {center, zoom};
    const constrained = constrain(center, zoom);
    return {center: constrained.center, zoom: constrain(constrained.center, constrained.zoom).zoom};
}
