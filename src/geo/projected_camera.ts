import {mat2, mat4} from 'gl-matrix';
import {zoomScale} from '../util/util.ts';
import {getBearing, getCenterPoint, getFov, getPitch, getRoll, type CameraState} from './camera_state.ts';

import type Point from '@mapbox/point-geometry';
import type {vec3, vec4} from 'gl-matrix';
import type {WorldCoordinateHelper} from './camera_types.ts';
import type {Frustum} from '../util/primitives/frustum.ts';
import type {Mat4f32, Mat4f64} from '../util/util.ts';

/**
 * @internal
 * A camera seen through a projection: its {@link CameraMetrics} and the matrices that take world coordinates to the
 * screen and back. Drawing, symbol placement, tile selection and feature queries read it, through the functions in
 * `camera_math.ts`, which take the {@link CameraProjection} alongside it wherever they turn lng/lat into world
 * coordinates.
 *
 * It holds values only, and nothing writes them: {@link projectCamera} computes a new one for each new camera state,
 * so one taken for a frame keeps describing that frame. `projection` tells the three kinds apart.
 */
export type ProjectedCamera = MercatorProjectedCamera | VerticalPerspectiveProjectedCamera | GlobeProjectedCamera;

/**
 * @internal
 * A {@link CameraState} together with the values that follow from it the same way in every projection: the scale
 * and size of the world at its zoom, its angles in degrees, the screen point it looks at, and the matrices between
 * screen pixels and clip space. Reading these needs no projection matrices, so it is cheaper than a
 * {@link ProjectedCamera}, which includes them; see {@link createCameraMetrics}.
 */
export type CameraMetrics = CameraState & {
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
    /** The pitch in degrees, see {@link CameraState.pitchInRadians}. */
    readonly pitch: number;
    /** The bearing in degrees, see {@link CameraState.bearingInRadians}. */
    readonly bearing: number;
    /** The roll in degrees, see {@link CameraState.rollInRadians}. */
    readonly roll: number;
    /** The vertical field of view in degrees, see {@link CameraState.fovInRadians}. */
    readonly fov: number;
    /** The screen point the camera looks at: the middle of the area inside the padding. */
    readonly centerPoint: Point;
};

/** The values every kind of {@link ProjectedCamera} has. */
type ProjectedCameraFields = CameraMetrics & {
    /** The distance from the camera to its near clipping plane, in the projection's units. */
    readonly nearZ: number;
    /** The distance from the camera to its far clipping plane, in the projection's units. */
    readonly farZ: number;
    /** From camera space to clip space. */
    readonly projectionMatrix: mat4;
    /** From the projection's world space to clip space: world pixels on mercator, the unit sphere on the globe. */
    readonly modelViewProjectionMatrix: mat4;
    /** From clip space to camera space. */
    readonly inverseProjectionMatrix: mat4;
    /** The camera's position in the projection's world space. */
    readonly cameraPosition: vec3;
    /** The plane that clips the far side of the globe, or null on mercator. */
    readonly clippingPlane: vec4 | null;
};

/** @internal A {@link ProjectedCamera} on mercator, or on a registered planar CRS. */
export type MercatorProjectedCamera = ProjectedCameraFields & {
    readonly projection: 'mercator';
    /** From mercator coordinates, 0..1 from the northwest corner, to clip space. */
    readonly mercatorMatrix: mat4;
    /** From clip space to world pixels. */
    readonly inverseModelViewProjectionMatrix: mat4;
    /** The model view projection matrix moved onto the pixel grid, so raster tiles draw sharp. */
    readonly alignedModelViewProjectionMatrix: mat4;
    /** From world pixels on the ground to screen pixels. */
    readonly pixelMatrix: mat4;
    /** From world pixels at an elevation to screen pixels. */
    readonly pixelMatrix3D: mat4;
    /** From screen pixels to world pixels on the ground. */
    readonly pixelMatrixInverse: mat4;
    /** The model view projection matrix with its near plane at the center, for the depth of the fog. */
    readonly fogMatrix: mat4;
};

/** @internal A {@link ProjectedCamera} on the vertical perspective: a globe seen from a point in space. */
export type VerticalPerspectiveProjectedCamera = ProjectedCameraFields & {
    readonly projection: 'vertical-perspective';
    /** The model view projection matrix as 32 bit floats, which the shaders take. */
    readonly modelViewProjectionMatrix32f: Mat4f32;
    /** From clip space to the unit sphere's space. */
    readonly inverseModelViewProjectionMatrix: mat4;
    readonly clippingPlane: vec4;
    /** The camera's view volume in the unit sphere's space, which tile selection tests tiles against. */
    readonly frustum: Frustum;
};

/**
 * @internal
 * A {@link ProjectedCamera} on the globe, which draws with the vertical perspective at low zoom and turns into
 * mercator as it zooms in. It holds the camera projected both ways; its own matrices are those of the one it draws
 * with, the vertical perspective while `globeness` is above 0.
 */
export type GlobeProjectedCamera = ProjectedCameraFields & {
    readonly projection: 'globe';
    /** How far the globe has turned from mercator, at 0, into the vertical perspective, at 1. */
    readonly globeness: number;
    readonly mercator: MercatorProjectedCamera;
    readonly verticalPerspective: VerticalPerspectiveProjectedCamera;
};

/** The tile matrices a mercator camera's math computed, by tile key, kept for as long as its data. */
export type MercatorMatrixCache = {
    readonly posMatrices: Map<string, {f64: Mat4f64; f32: Mat4f32}>;
    readonly alignedPosMatrices: Map<string, {f64: Mat4f64; f32: Mat4f32}>;
    readonly fogMatrices: Map<string, mat4>;
};

/**
 * @internal
 * Derives the {@link CameraMetrics} of a camera state. The world mapping gives the number of world pixels in a meter
 * at the center. The pixel matrices and the distance to the center need a size, so they are left undefined while the
 * camera has none.
 */
export function createCameraMetrics(state: CameraState, worldCoordinateHelper: WorldCoordinateHelper): CameraMetrics {
    const scale = zoomScale(state.zoom);
    const worldSize = state.tileSize * scale;
    const sized = !!state.width && !!state.height;
    return {
        ...state,
        tileZoom: Math.max(0, Math.floor(state.zoom)),
        scale,
        worldSize,
        pixelsPerMeter: worldCoordinateHelper.worldZFromAltitude(1, state.center) * worldSize,
        cameraToCenterDistance: sized ? 0.5 / Math.tan(state.fovInRadians / 2) * state.height : undefined,
        rotationMatrix: mat2.rotate(mat2.create(), mat2.create(), -state.bearingInRadians),
        pixelsToGLUnits: sized ? [2 / state.width, -2 / state.height] : undefined,
        pixelsToClipSpaceMatrix: sized ? pixelsToClipSpaceMatrix(state) : undefined,
        clipSpaceToPixelsMatrix: sized ? clipSpaceToPixelsMatrix(state) : undefined,
        pitch: getPitch(state),
        bearing: getBearing(state),
        roll: getRoll(state),
        fov: getFov(state),
        centerPoint: getCenterPoint(state),
    };
}

function clipSpaceToPixelsMatrix(state: CameraState): mat4 {
    const m = mat4.identity(new Float64Array(16));
    mat4.scale(m, m, [state.width / 2, -state.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    return m;
}

function pixelsToClipSpaceMatrix(state: CameraState): mat4 {
    const m = mat4.identity(new Float64Array(16));
    mat4.scale(m, m, [1, -1, 1]);
    mat4.translate(m, m, [-1, -1, 0]);
    mat4.scale(m, m, [2 / state.width, 2 / state.height, 1]);
    return m;
}
