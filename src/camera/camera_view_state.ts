import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat.ts';
import {EdgeInsets} from '../geo/edge_insets.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {MAX_VALID_LATITUDE, radiansToDegrees} from '../util/util.ts';

import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {NearFarZ, TransformConstrainFunction} from './camera_types.ts';

/** @internal The limits a new camera view state starts with, see {@link createCameraViewState}. */
export type CameraViewStateOptions = {
    /**
     * The minimum zoom level of the map. Users cannot zoom out beyond this level. (0–24)
     * @defaultValue 0
     */
    minZoom?: number;
    /**
     * The maximum zoom level of the map. Users cannot zoom in beyond this level. (0–24)
     * @defaultValue 22
     */
    maxZoom?: number;
    /**
     * The minimum pitch of the map.
     */
    minPitch?: number;
    /**
     * The maximum pitch of the map.
     */
    maxPitch?: number;
    /**
     * Whether to render multiple copies of the world side by side in the map.
     */
    renderWorldCopies?: boolean;
};

/**
 * @internal
 * The state of a camera: where it is, how it looks, the viewport and the limits it keeps to, as immutable plain data.
 * A change to a camera replaces its state instead of writing into it, so a state that was handed out keeps describing
 * the camera it was taken from, and can be kept, compared by reference and handed to another camera as it is.
 *
 * It holds only what a change sets. What follows from it is {@link ProjectedCamera}: the values every projection derives
 * from it the same way, see {@link CameraMetrics}, and the projection's own matrices.
 */
export type CameraViewState = {
    readonly tileSize: number;
    readonly width: number;
    readonly height: number;
    readonly center: LngLat;
    /**
     * Elevation at the center, in meters above sea level.
     */
    readonly elevation: number;
    readonly zoom: number;
    readonly bearingInRadians: number;
    readonly pitchInRadians: number;
    readonly rollInRadians: number;
    /**
     * Vertical field of view in radians.
     */
    readonly fovInRadians: number;
    readonly padding: Readonly<Required<PaddingOptions>>;
    readonly minZoom: number;
    readonly maxZoom: number;
    readonly minPitch: number;
    readonly maxPitch: number;
    readonly lngRange: [number, number] | null;
    readonly latRange: [number, number];
    readonly renderWorldCopies: boolean;
    /**
     * The lowest elevation of the terrain tile under the center, which the near and far planes take in.
     */
    readonly minElevationForCurrentTile: number;
    /**
     * The depth range to use instead of the one each projection computes, or null.
     */
    readonly nearFarZOverride: NearFarZ | null;
    /**
     * Whether the camera was never deliberately positioned, in which case a loading style may apply its own camera.
     * Cleared by the changes that move the camera, but not by ones that only snap it into a valid range.
     */
    readonly unmodified: boolean;
};

/**
 * @internal
 * The state of a new camera, which has no size yet and no bounds.
 */
export function createCameraViewState(options?: CameraViewStateOptions): CameraViewState {
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
        padding: {top: 0, bottom: 0, left: 0, right: 0},
        minZoom: options?.minZoom || 0,
        maxZoom: options?.maxZoom || 22,
        minPitch: (options?.minPitch === undefined || options?.minPitch === null) ? 0 : options?.minPitch,
        maxPitch: (options?.maxPitch === undefined || options?.maxPitch === null) ? 60 : options?.maxPitch,
        lngRange: null,
        latRange: [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE],
        renderWorldCopies: options?.renderWorldCopies === undefined ? true : !!options?.renderWorldCopies,
        minElevationForCurrentTile: 0,
        nearFarZOverride: null,
        unmodified: true,
    };
}

/**
 * @internal
 * The padding a camera interpolates to, `t` of the way from `start` to `target`.
 */
export function interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number): Required<PaddingOptions> {
    const {top = 0, bottom = 0, left = 0, right = 0} = start;
    return new EdgeInsets(top, bottom, left, right).interpolate(start, target, t).toJSON();
}

/**
 * @internal
 * Whether a camera's padding is the given one.
 */
export function isPaddingEqual(padding: Readonly<Required<PaddingOptions>>, other: PaddingOptions): boolean {
    return new EdgeInsets(padding.top, padding.bottom, padding.left, padding.right).equals(other);
}

/**
 * @internal
 * The center of the screen in pixels with the top-left corner being (0,0) and +y axis pointing downwards.
 * This accounts for padding.
 */
export function getCenterPoint(camera: Pick<CameraViewState, 'padding' | 'width' | 'height'>): Point {
    const {top, bottom, left, right} = camera.padding;
    return new EdgeInsets(top, bottom, left, right).getCenter(camera.width, camera.height);
}

/**
 * @internal
 * How far the padding moves the center point away from the middle of the screen, in pixels.
 */
export function getCenterOffset(camera: Pick<CameraViewState, 'padding' | 'width' | 'height'>): Point {
    return getCenterPoint(camera)._sub(new Point(camera.width, camera.height)._div(2));
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
export function getBearing(camera: Pick<CameraViewState, 'bearingInRadians'>): number {
    return camera.bearingInRadians / Math.PI * 180;
}

/**
 * @internal
 * The pitch in degrees.
 */
export function getPitch(camera: Pick<CameraViewState, 'pitchInRadians'>): number {
    return camera.pitchInRadians / Math.PI * 180;
}

/**
 * @internal
 * The roll in degrees.
 */
export function getRoll(camera: Pick<CameraViewState, 'rollInRadians'>): number {
    return camera.rollInRadians / Math.PI * 180;
}

/**
 * @internal
 * The bounds the camera's center is kept in, or null where it is kept in neither longitude nor latitude. A longitude
 * left unbounded spans from -Infinity to Infinity.
 */
export function getMaxBounds(camera: Pick<CameraViewState, 'lngRange' | 'latRange'>): LngLatBounds | null {
    const {lngRange, latRange} = camera;
    if (!lngRange && latRange[0] === -MAX_VALID_LATITUDE && latRange[1] === MAX_VALID_LATITUDE) return null;
    return new LngLatBounds([lngRange?.[0] ?? -Infinity, latRange[0], lngRange?.[1] ?? Infinity, latRange[1]]);
}

/**
 * @internal
 * The vertical field of view in degrees.
 */
export function getFov(camera: Pick<CameraViewState, 'fovInRadians'>): number {
    return radiansToDegrees(camera.fovInRadians);
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
