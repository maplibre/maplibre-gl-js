import Point from '@mapbox/point-geometry';
import {LngLat} from './lng_lat.ts';
import {EdgeInsets} from './edge_insets.ts';
import {MAX_VALID_LATITUDE, radiansToDegrees} from '../util/util.ts';

import type {mat2, mat4} from 'gl-matrix';
import type {TransformOptions} from './transform.ts';
import type {NearFarZ, TransformConstrainFunction} from './transform_interface.ts';

/**
 * @internal
 * The camera of a {@link Transform}, which is its position, its size and limits, and the values that follow from
 * them in every projection. It is plain data. The transform is the only one to change it, and its projection part
 * reads it.
 */
export type CameraState = {
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

    // Derived the same way in every projection
    /**
     * The integer zoom level for tiles.
     */
    tileZoom: number;
    /**
     * Computed based on zoom.
     */
    scale: number;
    pixelsPerMeter: number;
    cameraToCenterDistance: number;
    rotationMatrix: mat2;
    pixelsToGLUnits: [number, number];
    pixelsToClipSpaceMatrix: mat4;
    clipSpaceToPixelsMatrix: mat4;
};

/**
 * @internal
 * The camera state of a new transform, which has no size yet and no bounds. The matrices and the values computed
 * with them start out `undefined` until the transform computes them.
 */
export function createCameraState(options?: TransformOptions): CameraState {
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
        tileZoom: 0,
        scale: 1,
        pixelsPerMeter: undefined,
        cameraToCenterDistance: undefined,
        rotationMatrix: undefined,
        pixelsToGLUnits: undefined,
        pixelsToClipSpaceMatrix: undefined,
        clipSpaceToPixelsMatrix: undefined,
    };
}

/**
 * @internal
 * The center of the screen in pixels with the top-left corner being (0,0) and +y axis pointing downwards.
 * This accounts for padding.
 */
export function getCenterPoint(cameraState: Readonly<CameraState>): Point {
    return cameraState.edgeInsets.getCenter(cameraState.width, cameraState.height);
}

/**
 * @internal
 * How far the padding moves the center point away from the middle of the screen, in pixels.
 */
export function getCenterOffset(cameraState: Readonly<CameraState>): Point {
    return getCenterPoint(cameraState)._sub(new Point(cameraState.width, cameraState.height)._div(2));
}

/**
 * @internal
 * The size of the world in pixels at the zoom.
 */
export function getWorldSize(cameraState: Readonly<CameraState>): number {
    return cameraState.tileSize * cameraState.scale;
}

/**
 * @internal
 * The bearing in degrees.
 */
export function getBearing(cameraState: Readonly<CameraState>): number {
    return cameraState.bearingInRadians / Math.PI * 180;
}

/**
 * @internal
 * The pitch in degrees.
 */
export function getPitch(cameraState: Readonly<CameraState>): number {
    return cameraState.pitchInRadians / Math.PI * 180;
}

/**
 * @internal
 * The roll in degrees.
 */
export function getRoll(cameraState: Readonly<CameraState>): number {
    return cameraState.rollInRadians / Math.PI * 180;
}

/**
 * @internal
 * The vertical field of view in degrees.
 */
export function getFov(cameraState: Readonly<CameraState>): number {
    return radiansToDegrees(cameraState.fovInRadians);
}

/**
 * @internal
 * Where `constrain` puts a camera moved to `center` and `zoom`, the way a {@link Transform} constrains its own camera,
 * which is once and then the zoom again at the constrained center. A camera without a size is not constrained, so it
 * keeps the two as they are.
 */
export function getConstrainedCamera(cameraState: Readonly<CameraState>, constrain: TransformConstrainFunction, center: LngLat, zoom: number): {center: LngLat; zoom: number} {
    if (!cameraState.width || !cameraState.height) return {center, zoom};
    const constrained = constrain(center, zoom);
    return {center: constrained.center, zoom: constrain(constrained.center, constrained.zoom).zoom};
}
