import {mat2, mat4} from 'gl-matrix';
import {zoomScale} from '../util/util.ts';
import {getBearing, getCenterPoint, getFov, getPitch, getRoll, type CameraViewState} from './camera_view_state.ts';

import type Point from '@mapbox/point-geometry';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

/**
 * @internal
 * A {@link CameraViewState} together with the values that follow from it the same way in every projection: the scale
 * and size of the world at its zoom, its angles in degrees, the screen point it looks at, and the matrices between
 * screen pixels and clip space; see {@link createCameraMetrics}.
 */
export type CameraMetrics = CameraViewState & {
    /** The zoom level of the tiles drawn at this zoom: the zoom rounded down, and never below 0. */
    readonly tileZoom: number;
    /** How many times larger the world is than at zoom 0: `2 ^ zoom`. */
    readonly scale: number;
    /** The width of the world in pixels at this zoom: `tileSize * scale`. */
    readonly worldSize: number;
    /** How many world pixels a meter of altitude is at the center. */
    readonly pixelsPerMeter: number;
    /** The distance from the camera to the center, in pixels; undefined while the camera has no size. */
    readonly cameraToCenterDistance: number;
    /** Turns a screen offset by the bearing. */
    readonly rotationMatrix: mat2;
    /** How much of clip space one pixel is, in x and y; undefined while the camera has no size. */
    readonly pixelsToGLUnits: [number, number];
    /** From screen pixels to clip space; undefined while the camera has no size. */
    readonly pixelsToClipSpaceMatrix: mat4;
    /** From clip space to screen pixels; undefined while the camera has no size. */
    readonly clipSpaceToPixelsMatrix: mat4;
    /** The pitch in degrees, see {@link CameraViewState.pitchInRadians}. */
    readonly pitch: number;
    /** The bearing in degrees, see {@link CameraViewState.bearingInRadians}. */
    readonly bearing: number;
    /** The roll in degrees, see {@link CameraViewState.rollInRadians}. */
    readonly roll: number;
    /** The vertical field of view in degrees, see {@link CameraViewState.fovInRadians}. */
    readonly fov: number;
    /** The screen point the camera looks at: the middle of the area inside the padding. */
    readonly centerPoint: Point;
};

/**
 * @internal
 * Derives the {@link CameraMetrics} of a camera view state. The world mapping gives the number of world pixels in a meter
 * at the center. The pixel matrices and the distance to the center need a size, so they are left undefined while the
 * camera has none.
 */
export function createCameraMetrics(view: CameraViewState, worldCoordinateHelper: WorldCoordinateHelper): CameraMetrics {
    const scale = zoomScale(view.zoom);
    const worldSize = view.tileSize * scale;
    const sized = !!view.width && !!view.height;
    return {
        ...view,
        tileZoom: Math.max(0, Math.floor(view.zoom)),
        scale,
        worldSize,
        pixelsPerMeter: worldCoordinateHelper.worldZFromAltitude(1, view.center) * worldSize,
        cameraToCenterDistance: sized ? 0.5 / Math.tan(view.fovInRadians / 2) * view.height : undefined,
        rotationMatrix: mat2.rotate(mat2.create(), mat2.create(), -view.bearingInRadians),
        pixelsToGLUnits: sized ? [2 / view.width, -2 / view.height] : undefined,
        pixelsToClipSpaceMatrix: sized ? pixelsToClipSpaceMatrix(view) : undefined,
        clipSpaceToPixelsMatrix: sized ? clipSpaceToPixelsMatrix(view) : undefined,
        pitch: getPitch(view),
        bearing: getBearing(view),
        roll: getRoll(view),
        fov: getFov(view),
        centerPoint: getCenterPoint(view),
    };
}

function clipSpaceToPixelsMatrix(view: CameraViewState): mat4 {
    const m = mat4.identity(new Float64Array(16));
    mat4.scale(m, m, [view.width / 2, -view.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    return m;
}

function pixelsToClipSpaceMatrix(view: CameraViewState): mat4 {
    const m = mat4.identity(new Float64Array(16));
    mat4.scale(m, m, [1, -1, 1]);
    mat4.translate(m, m, [-1, -1, 0]);
    mat4.scale(m, m, [2 / view.width, 2 / view.height, 1]);
    return m;
}
