import {MercatorCoordinate} from '../mercator_coordinate.ts';
import Point from '@mapbox/point-geometry';
import {clamp, createMat4f64, createIdentityMat4f32, degreesToRadians, zoomScale, type Mat4f32, type Mat4f64} from '../../util/util.ts';
import {mat4, vec3, vec4} from 'gl-matrix';
import {UnwrappedTileID, OverscaledTileID, type CanonicalTileID, calculateTileKey} from '../../tile/tile_id.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {type PointProjection, xyTransformMat4} from '../../symbol/projection.ts';
import {LngLatBounds} from '../lng_lat_bounds.ts';
import {getMercatorHorizon, getMercatorTileCoordinates, calculateTileMatrix, cameraMercatorCoordinateFromCenterAndRotation, projectToWorldCoordinates, maxMercatorHorizonAngle} from './mercator_utils.ts';
import {fastInvertProjMat4} from '../../util/fast_maths.ts';
import {getCenterOffset} from '../camera_state.ts';
import {EXTENT} from '../../data/extent.ts';
import {createFrustum, type Frustum} from '../../util/primitives/frustum.ts';
import {bisect, sampleAt, isBelowTerrainSample, TERRAIN_OCCLUSION_MARGIN, type TerrainCoverageIndex, type TerrainSample} from '../../render/terrain_coverage.ts';

import type {LngLat} from '../lng_lat.ts';
import type {CameraMetrics, MercatorProjectedCamera, MercatorMatrixCache} from '../projected_camera.ts';
import type {MercatorCameraProjection} from './camera_projection.ts';
import type {NearFarZ, WorldCoordinateHelper} from '../camera_types.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';

/**
 * @internal
 * The portion of a ray through a screen pixel that lies inside the view frustum.
 * Both endpoints use world pixels for x and y, and meters above sea level for z.
 */
type RaySegment = {
    near: vec3;
    far: vec3;
};

/**
 * @internal
 * A ray to intersect with the terrain surface, in world pixels:
 * `near` is the segment start, `dx`/`dy`/`dz` span to the segment end, and z values are meters above sea level.
 */
type MercatorRay = {
    index: TerrainCoverageIndex;
    exaggeration: number;
    near: vec3;
    dx: number;
    dy: number;
    dz: number;
    worldSize: number;
    wraps: boolean;
};

/**
 * The tile matrices computed for each projected camera, kept for as long as it is. Nothing writes into a projected
 * camera, and every change of the camera projects a new one, so they never go stale.
 */
const matrixCaches = new WeakMap<MercatorProjectedCamera, MercatorMatrixCache>();

/** @internal The tile matrices computed for a projected camera, see {@link matrixCaches}. */
export function getMatrixCache(projectedCamera: MercatorProjectedCamera): MercatorMatrixCache {
    let cache = matrixCaches.get(projectedCamera);
    if (!cache) {
        cache = {posMatrices: new Map(), alignedPosMatrices: new Map(), fogMatrices: new Map()};
        matrixCaches.set(projectedCamera, cache);
    }
    return cache;
}

const TARGET_WORLD_STEP_PX = 4;
const MAX_SAMPLES = 512;
const MERCATOR_BISECT_EPSILON_WORLD_PX = 1e-3;
/**
 * The clip-space depth of the near clipping plane, where the ray segment through a screen pixel starts for a terrain
 * pick so that it holds all the view shows; see {@link getRaySegmentFromPixel}.
 */
const NEAR_PLANE_CLIP_Z = -1;

/**
 * @internal
 * Derives the {@link MercatorProjectedCamera} of a camera: the matrices the mercator projection draws it with. A camera
 * without a size has none.
 * @param nearFarZ - the depth range to use instead of computing one, by default the camera state's override; a globe
 * passes its vertical perspective's, so both draw at the same depths
 */
export function createMercatorProjectedCamera(metrics: CameraMetrics, projection: MercatorCameraProjection, nearFarZ: NearFarZ | null = metrics.nearFarZOverride): MercatorProjectedCamera {
    const base = {...metrics, projection: 'mercator' as const, clippingPlane: null};
    if (!metrics.width || !metrics.height) return base as MercatorProjectedCamera;

    const offset = getCenterOffset(metrics);
    const point = projectToWorldCoordinates(metrics.worldSize, metrics.center, projection.worldCoordinateHelper);
    const x = point.x, y = point.y;

    // Calculate the camera to sea-level distance in pixel in respect of terrain
    const limitedPitchRadians = degreesToRadians(Math.min(metrics.pitch, maxMercatorHorizonAngle));
    const cameraToSeaLevelDistance = Math.max(metrics.cameraToCenterDistance / 2, metrics.cameraToCenterDistance + metrics.elevation * metrics.pixelsPerMeter / Math.cos(limitedPitchRadians));

    const {nearZ, farZ} = nearFarZ ?? calculateNearFarZ(metrics, cameraToSeaLevelDistance, limitedPitchRadians, offset);

    const m: mat4 = new Float64Array(16);
    mat4.perspective(m, metrics.fovInRadians, metrics.width / metrics.height, nearZ, farZ);
    const inverseProjectionMatrix = new Float64Array(16);
    fastInvertProjMat4(inverseProjectionMatrix, m);

    // Apply center of perspective offset
    m[8] = -offset.x * 2 / metrics.width;
    m[9] = offset.y * 2 / metrics.height;
    const projectionMatrix = mat4.clone(m);

    mat4.scale(m, m, [1, -1, 1]);
    mat4.translate(m, m, [0, 0, -metrics.cameraToCenterDistance]);
    mat4.rotateZ(m, m, -metrics.rollInRadians);
    mat4.rotateX(m, m, metrics.pitchInRadians);
    mat4.rotateZ(m, m, -metrics.bearingInRadians);
    mat4.translate(m, m, [-x, -y, 0]);

    // The mercatorMatrix can be used to transform points from mercator coordinates
    // ([0, 0] nw, [1, 1] se) to clip space.
    const mercatorMatrix = mat4.scale([], m, [metrics.worldSize, metrics.worldSize, metrics.worldSize]);

    // scale vertically to meters per pixel (inverse of ground resolution):
    mat4.scale(m, m, [1, 1, metrics.pixelsPerMeter]);

    // matrix for conversion from world space to screen coordinates in 2D
    const pixelMatrix = mat4.multiply(new Float64Array(16), metrics.clipSpaceToPixelsMatrix, m);

    // matrix for conversion from world space to clip space (-1 .. 1)
    mat4.translate(m, m, [0, 0, -metrics.elevation]); // elevate camera over terrain
    const modelViewProjectionMatrix = m;
    const inverseModelViewProjectionMatrix = mat4.invert([], m);

    const cameraPos: vec4 = [0, 0, -1, 1];
    vec4.transformMat4(cameraPos, cameraPos, inverseModelViewProjectionMatrix);
    const cameraPosition: vec3 = [
        cameraPos[0] / cameraPos[3],
        cameraPos[1] / cameraPos[3],
        cameraPos[2] / cameraPos[3]
    ];

    // create a fog matrix, same es proj-matrix but with near clipping-plane in mapcenter
    // needed to calculate a correct z-value for fog calculation, because projMatrix z value is not
    const fogMatrix = new Float64Array(16);
    mat4.perspective(fogMatrix, metrics.fovInRadians, metrics.width / metrics.height, cameraToSeaLevelDistance, farZ);
    fogMatrix[8] = -offset.x * 2 / metrics.width;
    fogMatrix[9] = offset.y * 2 / metrics.height;
    mat4.scale(fogMatrix, fogMatrix, [1, -1, 1]);
    mat4.translate(fogMatrix, fogMatrix, [0, 0, -metrics.cameraToCenterDistance]);
    mat4.rotateZ(fogMatrix, fogMatrix, -metrics.rollInRadians);
    mat4.rotateX(fogMatrix, fogMatrix, metrics.pitchInRadians);
    mat4.rotateZ(fogMatrix, fogMatrix, -metrics.bearingInRadians);
    mat4.translate(fogMatrix, fogMatrix, [-x, -y, 0]);
    mat4.scale(fogMatrix, fogMatrix, [1, 1, metrics.pixelsPerMeter]);
    mat4.translate(fogMatrix, fogMatrix, [0, 0, -metrics.elevation]); // elevate camera over terrain

    // matrix for conversion from world space to screen coordinates in 3D
    const pixelMatrix3D = mat4.multiply(new Float64Array(16), metrics.clipSpaceToPixelsMatrix, m);

    // Make a second projection matrix that is aligned to a pixel grid for rendering raster tiles.
    // We're rounding the (floating point) x/y values to achieve to avoid rendering raster images to fractional
    // coordinates. Additionally, we adjust by half a pixel in either direction in case that viewport dimension
    // is an odd integer to preserve rendering to the pixel grid. We're rotating this shift based on the angle
    // of the transformation so that 0°, 90°, 180°, and 270° rasters are crisp, and adjust the shift so that
    // it is always <= 0.5 pixels.
    const xShift = (metrics.width % 2) / 2, yShift = (metrics.height % 2) / 2,
        angleCos = Math.cos(metrics.bearingInRadians), angleSin = Math.sin(-metrics.bearingInRadians),
        dx = x - Math.round(x) + angleCos * xShift + angleSin * yShift,
        dy = y - Math.round(y) + angleCos * yShift + angleSin * xShift;
    const alignedModelViewProjectionMatrix = new Float64Array(m) as any as mat4;
    mat4.translate(alignedModelViewProjectionMatrix, alignedModelViewProjectionMatrix, [dx > 0.5 ? dx - 1 : dx, dy > 0.5 ? dy - 1 : dy, 0]);

    // inverse matrix for conversion from screen coordinates to location
    const pixelMatrixInverse = mat4.invert(new Float64Array(16), pixelMatrix);
    if (!pixelMatrixInverse) throw new Error('failed to invert matrix');

    return {
        ...base,
        nearZ,
        farZ,
        projectionMatrix,
        modelViewProjectionMatrix,
        inverseProjectionMatrix,
        cameraPosition,
        mercatorMatrix,
        inverseModelViewProjectionMatrix,
        alignedModelViewProjectionMatrix,
        pixelMatrix,
        pixelMatrix3D,
        pixelMatrixInverse,
        fogMatrix,
    };
}

/** The depth range the mercator projection draws a camera with, from the lowest point it may show to its horizon. */
function calculateNearFarZ(metrics: CameraMetrics, cameraToSeaLevelDistance: number, limitedPitchRadians: number, offset: Point): NearFarZ {
    // In case of negative minimum elevation (e.g. the dead see, under the sea maps) use a lower plane for calculation
    const minRenderDistanceBelowCameraInMeters = 100;
    const cameraAltitude = Math.cos(metrics.pitchInRadians) * metrics.cameraToCenterDistance / metrics.pixelsPerMeter + metrics.elevation;
    const minElevation = Math.min(metrics.elevation, metrics.minElevationForCurrentTile, cameraAltitude - minRenderDistanceBelowCameraInMeters);
    const cameraToLowestPointDistance = cameraToSeaLevelDistance - minElevation * metrics.pixelsPerMeter / Math.cos(limitedPitchRadians);
    const lowestPlane = minElevation < 0 ? cameraToLowestPointDistance : cameraToSeaLevelDistance;

    // Find the distance from the center point [width/2 + offset.x, height/2 + offset.y] to the
    // center top point [width/2 + offset.x, 0] in Z units, using the law of sines.
    // 1 Z unit is equivalent to 1 horizontal px at the center of the map
    // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
    const groundAngle = Math.PI / 2 + metrics.pitchInRadians;
    const zfov = degreesToRadians(metrics.fov) * (Math.abs(Math.cos(degreesToRadians(metrics.roll))) * metrics.height + Math.abs(Math.sin(degreesToRadians(metrics.roll))) * metrics.width) / metrics.height;
    const fovAboveCenter = zfov * (0.5 + offset.y / metrics.height);
    const topHalfSurfaceDistance = Math.sin(fovAboveCenter) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovAboveCenter, 0.01, Math.PI - 0.01));

    // Find the distance from the center point to the horizon
    const horizon = getMercatorHorizon(metrics);
    const horizonAngle = Math.atan(horizon / metrics.cameraToCenterDistance);
    const minFovCenterToHorizonRadians = degreesToRadians(90 - maxMercatorHorizonAngle);
    const fovCenterToHorizon = horizonAngle > minFovCenterToHorizonRadians ? 2 * horizonAngle * (0.5 + offset.y / (horizon * 2)) : minFovCenterToHorizonRadians;
    const topHalfSurfaceDistanceHorizon = Math.sin(fovCenterToHorizon) * lowestPlane / Math.sin(clamp(Math.PI - groundAngle - fovCenterToHorizon, 0.01, Math.PI - 0.01));

    // Calculate z distance of the farthest fragment that should be rendered.
    // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
    const topHalfMinDistance = Math.min(topHalfSurfaceDistance, topHalfSurfaceDistanceHorizon);

    const farZ = (Math.cos(Math.PI / 2 - limitedPitchRadians) * topHalfMinDistance + lowestPlane) * 1.01;

    // The larger the value of nearZ is
    // - the more depth precision is available for features (good)
    // - clipping starts appearing sooner when the camera is close to 3d features (bad)
    //
    // Other values work for mapbox-gl-js but deck.gl was encountering precision issues
    // when rendering custom layers. This value was experimentally chosen and
    // seems to solve z-fighting issues in deck.gl while not clipping buildings too close to the camera.
    const nearZ = metrics.height / 50;
    return {nearZ, farZ};
}

/** The {@link getMercatorHorizon} of the camera. */
export function getHorizon(projectedCamera: MercatorProjectedCamera): number {
    return getMercatorHorizon(projectedCamera);
}

/** The copies of the world a tile is drawn in, which a world that wraps repeats across the screen. */
export function getVisibleUnwrappedCoordinates(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, tileID: CanonicalTileID): UnwrappedTileID[] {
    const result = [new UnwrappedTileID(0, tileID)];
    if (projectedCamera.renderWorldCopies && worldCoordinateHelper.wraps) {
        const utl = screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(0, 0));
        const utr = screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(projectedCamera.width, 0));
        const ubl = screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(projectedCamera.width, projectedCamera.height));
        const ubr = screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(0, projectedCamera.height));
        const w0 = Math.floor(Math.min(utl.x, utr.x, ubl.x, ubr.x));
        const w1 = Math.floor(Math.max(utl.x, utr.x, ubl.x, ubr.x));

        // Add an extra copy of the world on each side to properly render ImageSources and CanvasSources.
        // Both sources draw outside the tile boundaries of the tile that "contains them" so we need
        // to add extra copies on both sides in case offscreen tiles need to draw into on-screen ones.
        const extraWorldCopy = 1;

        for (let w = w0 - extraWorldCopy; w <= w1 + extraWorldCopy; w++) {
            if (w === 0) continue;
            result.push(new UnwrappedTileID(w, tileID));
        }
    }
    return result;
}

export function getCameraFrustum(projectedCamera: MercatorProjectedCamera): Frustum {
    return createFrustum(projectedCamera.inverseModelViewProjectionMatrix, projectedCamera.worldSize);
}

export function locationToScreenPoint(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lnglat: LngLat, terrain?: Terrain): Point {
    const coord = worldCoordinateHelper.worldFromLngLat(lnglat.lng, lnglat.lat);
    return terrain ?
        coordinatePoint(projectedCamera, coord, terrain.getElevationForLngLat(lnglat, projectedCamera.tileZoom), projectedCamera.pixelMatrix3D) :
        coordinatePoint(projectedCamera, coord);
}

export function screenPointToLocation(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): LngLat {
    return worldToLngLat(worldCoordinateHelper, screenPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain));
}

export function screenPointToLocationAtElevation(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, elevation: number): LngLat {
    return worldToLngLat(worldCoordinateHelper, screenPointToMercatorCoordinateAtZ(projectedCamera, p, elevation - projectedCamera.elevation));
}

/**
 * Maps a world position back to lng/lat through the projection, or `undefined` when the point missed
 * the world (a screen point above the horizon or off the terrain).
 */
function worldToLngLat(worldCoordinateHelper: WorldCoordinateHelper, coord: MercatorCoordinate | null | undefined): LngLat | undefined {
    return coord ? worldCoordinateHelper.lngLatFromWorld(coord.x, coord.y) : undefined;
}

export function screenPointToMercatorCoordinate(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): MercatorCoordinate {
    if (terrain) {
        const coordinate = screenTerrainPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain);
        if (coordinate != null) {
            return coordinate;
        }
    }
    return screenPointToMercatorCoordinateAtZ(projectedCamera, p);
}

/**
 * Where the center ray meets the terrain beyond the distance at which the center sits from the camera at maxZoom,
 * if the ray is above the terrain there; null otherwise. A center on nearer terrain needs a zoom past maxZoom, which
 * `setZoom` clamps by moving the camera back, so once the ray has cleared a bump nearer than that, the center goes
 * to the terrain behind it. Where maxZoom lets the camera nearer than the near clipping plane, the ray is followed
 * from that plane, like every terrain pick.
 */
export function terrainPointPastMaxZoom(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, terrain: Terrain): LngLat | null {
    const index = terrain.getCoverageIndex();
    if (!index) return null;
    const {near, far} = getRaySegmentFromPixel(projectedCamera, projectedCamera.centerPoint, NEAR_PLANE_CLIP_Z);
    const distanceAtMaxZoom = projectedCamera.cameraToCenterDistance * zoomScale(projectedCamera.zoom - projectedCamera.maxZoom);
    const start = vec3.lerp([], near, far, Math.max(0, (distanceAtMaxZoom - projectedCamera.nearZ) / (projectedCamera.farZ - projectedCamera.nearZ)));
    if (isBelowTerrainSample(sampleAt(index, terrain.exaggeration, start[0] / projectedCamera.worldSize, start[1] / projectedCamera.worldSize, worldCoordinateHelper.wraps), start[2])) return null;
    return worldToLngLat(worldCoordinateHelper, raycastTerrain(projectedCamera, worldCoordinateHelper, start, far, terrain)) ?? null;
}

/** The mercator version of `screenTerrainPointToMercatorCoordinate` in `camera_math.ts`. */
export function screenTerrainPointToMercatorCoordinate(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain: Terrain): MercatorCoordinate | null {
    const {near, far} = getRaySegmentFromPixel(projectedCamera, p, NEAR_PLANE_CLIP_Z);
    return raycastTerrain(projectedCamera, worldCoordinateHelper, near, far, terrain);
}

/** The first point where the segment from `near` to `far` enters the terrain from above, or null. */
export function raycastTerrain(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, near: vec3, far: vec3, terrain: Terrain): MercatorCoordinate | null {
    const index = terrain.getCoverageIndex();
    if (!index) return null;

    const worldSize = projectedCamera.worldSize;
    const dx = far[0] - near[0];
    const dy = far[1] - near[1];
    const dz = far[2] - near[2];
    const ray: MercatorRay = {index, exaggeration: terrain.exaggeration, near, dx, dy, dz, worldSize, wraps: worldCoordinateHelper.wraps};

    let tStart = 0;
    let tEnd = 1;
    if (dz === 0) {
        if (near[2] > index.maxElevation || near[2] < index.minElevation) return null;
    } else {
        const tHigh = (index.maxElevation - near[2]) / dz;
        const tLow = (index.minElevation - near[2]) / dz;
        tStart = Math.max(tStart, Math.min(tHigh, tLow));
        tEnd = Math.min(tEnd, Math.max(tHigh, tLow));
        if (tStart > tEnd) return null;
    }

    const horizontalLength = Math.hypot(dx, dy);
    const samples = clamp(Math.ceil(horizontalLength * (tEnd - tStart) / TARGET_WORLD_STEP_PX), 1, MAX_SAMPLES);

    let previousT = 0;
    let aboveTerrain = !mercatorIsBelowTerrain(ray, 0);

    for (let i = 0; i <= samples; i++) {
        const t = tStart + (tEnd - tStart) * i / samples;

        if (!aboveTerrain) {
            aboveTerrain = !mercatorIsBelowTerrain(ray, t);
        } else if (mercatorIsBelowTerrain(ray, t)) {
            const {lo, hi} = bisect(ray, mercatorIsBelowTerrain, previousT, t, MERCATOR_BISECT_EPSILON_WORLD_PX / horizontalLength);
            const sampleLo = mercatorSampleAt(ray, lo);
            const sampleHi = mercatorSampleAt(ray, hi);
            const fLo = near[2] + lo * dz - sampleLo.elevation;
            const fHi = near[2] + hi * dz - sampleHi.elevation;
            const hit = sampleLo.covered && fLo > fHi ? clamp(lo + fLo * (hi - lo) / (fLo - fHi), lo, hi) : hi;
            return new MercatorCoordinate(
                (near[0] + hit * dx) / worldSize,
                (near[1] + hit * dy) / worldSize,
                mercatorSampleAt(ray, hit).elevation);
        }

        previousT = t;
    }

    return null;
}

/**
 * Returns the segment of the ray through the given screen pixel from its point at depth `clipZ` in clip space to the
 * far clipping plane. The default of 0 lies at about twice the near clipping plane's distance from the camera, which
 * is all a plane intersection needs; `NEAR_PLANE_CLIP_Z` starts the segment at the near clipping plane, so it holds
 * all the view shows, as terrain picks need.
 */
function getRaySegmentFromPixel(projectedCamera: MercatorProjectedCamera, p: Point, clipZ: number = 0): RaySegment {
    const coord0 = [p.x, p.y, clipZ, 1] as vec4;
    const coord1 = [p.x, p.y, 1, 1] as vec4;

    vec4.transformMat4(coord0, coord0, projectedCamera.pixelMatrixInverse);
    vec4.transformMat4(coord1, coord1, projectedCamera.pixelMatrixInverse);

    const w0 = coord0[3];
    const w1 = coord1[3];
    // The pixel matrix is built before the elevation translate, so unprojected z is relative to the center's elevation.
    const elevation = projectedCamera.elevation;

    return {
        near: [coord0[0] / w0, coord0[1] / w0, coord0[2] / w0 + elevation],
        far: [coord1[0] / w1, coord1[1] / w1, coord1[2] / w1 + elevation]
    };
}

/**
 * Intersects the ray through a screen point with the horizontal plane at `z`,
 * given in meters relative to the plane at the center's elevation (not mercator units).
 */
export function screenPointToMercatorCoordinateAtZ(projectedCamera: MercatorProjectedCamera, p: Point, z?: number): MercatorCoordinate {
    const targetZ = z ? z : 0;
    const {near, far} = getRaySegmentFromPixel(projectedCamera, p);

    const t = near[2] === far[2] ? 0 : (targetZ + projectedCamera.elevation - near[2]) / (far[2] - near[2]);

    return new MercatorCoordinate(
        interpolates.number(near[0], far[0], t) / projectedCamera.worldSize,
        interpolates.number(near[1], far[1], t) / projectedCamera.worldSize,
        targetZ);
}

/**
 * Given a coordinate, return the screen point that corresponds to it
 * @param coord - the coordinates
 * @param elevation - the elevation
 * @param pixelMatrix - the pixel matrix
 * @returns screen point. Point will be outside the viewport if the coordinate is behind the camera.
 */
export function coordinatePoint(projectedCamera: MercatorProjectedCamera, coord: MercatorCoordinate, elevation: number = 0, pixelMatrix: mat4 = projectedCamera.pixelMatrix): Point {
    const p = coordinateClipPoint(projectedCamera, coord, elevation, pixelMatrix);
    const w = p[3];
    if (w > 0) {
        return new Point(p[0] / w, p[1] / w);
    }
    return offScreenPointBehindCamera(projectedCamera, p[0], p[1], w);
}

/**
 * The coordinate in the clip space of `pixelMatrix`: pixel x and y and NDC depth, each times `w`, which is positive
 * in front of the camera.
 */
function coordinateClipPoint(projectedCamera: MercatorProjectedCamera, coord: MercatorCoordinate, elevation: number, pixelMatrix: mat4): vec4 {
    const p = [coord.x * projectedCamera.worldSize, coord.y * projectedCamera.worldSize, elevation, 1] as vec4;
    return vec4.transformMat4(p, p, pixelMatrix);
}

/**
 * Returns a screen point outside the viewport for a coordinate that is behind the camera.
 * The point lies on the boundary of the viewport enlarged by one viewport size on each side,
 * on whichever edge the ray from the screen centre in the coordinate's direction reaches first.
 * A coordinate exactly behind the camera has no direction to leave through, so it is placed straight down.
 * @param x - the x component of the clip space position, before the division by w
 * @param y - the y component of the clip space position, before the division by w
 * @param w - the w component of the clip space position, zero or negative
 * @returns screen point outside the viewport
 */
function offScreenPointBehindCamera(projectedCamera: MercatorProjectedCamera, x: number, y: number, w: number): Point {
    const cx = projectedCamera.width / 2;
    const cy = projectedCamera.height / 2;
    const dx = x - cx * w;
    let dy = y - cy * w;
    if (dx === 0 && dy === 0) {
        dy = 1;
    }
    const halfExtentX = cx + projectedCamera.width;
    const halfExtentY = cy + projectedCamera.height;
    const scale = Math.min(
        dx !== 0 ? halfExtentX / Math.abs(dx) : Infinity,
        dy !== 0 ? halfExtentY / Math.abs(dy) : Infinity);
    return new Point(cx + dx * scale, cy + dy * scale);
}

export function getBounds(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper): LngLatBounds {
    const top = Math.max(0, projectedCamera.height / 2 - getHorizon(projectedCamera));
    return new LngLatBounds()
        .extend(screenPointToLocation(projectedCamera, worldCoordinateHelper, new Point(0, top)))
        .extend(screenPointToLocation(projectedCamera, worldCoordinateHelper, new Point(projectedCamera.width, top)))
        .extend(screenPointToLocation(projectedCamera, worldCoordinateHelper, new Point(projectedCamera.width, projectedCamera.height)))
        .extend(screenPointToLocation(projectedCamera, worldCoordinateHelper, new Point(0, projectedCamera.height)));
}

export function isPointOnMapSurface(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): boolean {
    if (terrain) {
        return screenTerrainPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain) != null;
    }
    const belowHorizon = p.y > projectedCamera.centerPoint.y - getHorizon(projectedCamera);
    if (!belowHorizon || worldCoordinateHelper.wraps) {
        return belowHorizon;
    }
    const coordinate = screenPointToMercatorCoordinateAtZ(projectedCamera, p);
    return worldCoordinateHelper.hasLngLat(coordinate.x, coordinate.y);
}

/**
 * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
 * This function is specific to the mercator projection.
 * @param tileID - the tile ID
 * @param aligned - whether to use a pixel-aligned matrix variant, intended for rendering raster tiles
 * @param useFloat32 - when true, returns a float32 matrix instead of float64. Use float32 for matrices that are passed to shaders, use float64 for everything else.
 */
export function calculatePosMatrix(projectedCamera: MercatorProjectedCamera, tileID: UnwrappedTileID | OverscaledTileID, aligned: boolean | undefined, useFloat32: true): Mat4f32;
export function calculatePosMatrix(projectedCamera: MercatorProjectedCamera, tileID: UnwrappedTileID | OverscaledTileID, aligned?: boolean, useFloat32?: false): Mat4f64;
export function calculatePosMatrix(projectedCamera: MercatorProjectedCamera, tileID: UnwrappedTileID | OverscaledTileID, aligned: boolean = false, useFloat32: boolean = false): Mat4f32 | Mat4f64 {
    const posMatrixKey = tileID.key ?? calculateTileKey(tileID.wrap, tileID.canonical.z, tileID.canonical.z, tileID.canonical.x, tileID.canonical.y);
    const cache = aligned ? getMatrixCache(projectedCamera).alignedPosMatrices : getMatrixCache(projectedCamera).posMatrices;
    if (cache.has(posMatrixKey)) {
        const matrices = cache.get(posMatrixKey);
        return useFloat32 ? matrices.f32 : matrices.f64;
    }

    const tileMatrix = calculateTileMatrix(tileID, projectedCamera.worldSize);
    mat4.multiply(tileMatrix, aligned ? projectedCamera.alignedModelViewProjectionMatrix : projectedCamera.modelViewProjectionMatrix, tileMatrix);
    const matrices: {f64: Mat4f64; f32: Mat4f32} = {
        f64: tileMatrix,
        f32: new Float32Array(tileMatrix), // Must have a 32 bit float version for WebGL, otherwise WebGL calls in Chrome get very slow.
    };
    cache.set(posMatrixKey, matrices);
    // Make sure to return the correct precision
    return useFloat32 ? matrices.f32 : matrices.f64;
}

export function calculateFogMatrix(projectedCamera: MercatorProjectedCamera, unwrappedTileID: UnwrappedTileID): mat4 {
    const posMatrixKey = unwrappedTileID.key;
    const cache = getMatrixCache(projectedCamera).fogMatrices;
    if (cache.has(posMatrixKey)) {
        return cache.get(posMatrixKey);
    }

    const fogMatrix = calculateTileMatrix(unwrappedTileID, projectedCamera.worldSize);
    mat4.multiply(fogMatrix, projectedCamera.fogMatrix, fogMatrix);

    cache.set(posMatrixKey, new Float32Array(fogMatrix)); // Must be 32 bit floats, otherwise WebGL calls in Chrome get very slow.
    return cache.get(posMatrixKey);
}

export function maxPitchScaleFactor(projectedCamera: MercatorProjectedCamera): number {
    // calcMatrices hasn't run yet
    if (!projectedCamera.pixelMatrixInverse) return 1;

    const coord = screenPointToMercatorCoordinateAtZ(projectedCamera, new Point(0, 0));
    const p = [coord.x * projectedCamera.worldSize, coord.y * projectedCamera.worldSize, 0, 1] as vec4;
    const topPoint = vec4.transformMat4(p, p, projectedCamera.pixelMatrix);
    return topPoint[3] / projectedCamera.cameraToCenterDistance;
}

export function getCameraAltitude(projectedCamera: MercatorProjectedCamera): number {
    return Math.cos(projectedCamera.pitchInRadians) * projectedCamera.cameraToCenterDistance / projectedCamera.pixelsPerMeter + projectedCamera.elevation;
}

export function getCameraLngLat(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper): LngLat {
    const center = projectedCamera.center;
    const mercUnitsPerMeter = worldCoordinateHelper.worldZFromAltitude(1, center);
    const pixelPerMeter = mercUnitsPerMeter * projectedCamera.worldSize;
    const cameraToCenterDistanceMeters = projectedCamera.cameraToCenterDistance / pixelPerMeter;
    const centerMercator = worldCoordinateHelper.worldFromLngLat(center.lng, center.lat, projectedCamera.elevation);
    const camMercator = cameraMercatorCoordinateFromCenterAndRotation(centerMercator, projectedCamera.pitch, projectedCamera.bearing, cameraToCenterDistanceMeters * mercUnitsPerMeter);
    return worldCoordinateHelper.lngLatFromWorld(camMercator.x, camMercator.y);
}

export function getProjectionData(projectedCamera: MercatorProjectedCamera, params: ProjectionDataParams): RendererProjectionData {
    const {overscaledTileID, aligned, applyTerrainMatrix} = params;
    const mercatorTileCoordinates = getMercatorTileCoordinates(overscaledTileID);
    const tilePosMatrix = overscaledTileID ? calculatePosMatrix(projectedCamera, overscaledTileID, aligned, true) : null;

    let mainMatrix: Mat4f32;
    if (overscaledTileID?.terrainRttPosMatrix32f && applyTerrainMatrix) {
        mainMatrix = overscaledTileID.terrainRttPosMatrix32f;
    } else if (tilePosMatrix) {
        mainMatrix = tilePosMatrix; // This matrix should be float32
    } else {
        mainMatrix = createIdentityMat4f32();
    }
    return {
        mainMatrix, // Might be set to a custom matrix by different projections.
        tileMercatorCoords: mercatorTileCoordinates,
        clippingPlane: [0, 0, 0, 0],
        projectionTransition: 0.0, // Range 0..1, where 0 is mercator, 1 is another projection, mostly globe.
        fallbackMatrix: mainMatrix,
        clipAntimeridian: false,
    };
}

/** The mercator version of `isLocationOccluded` in `camera_math.ts`. */
export function isLocationOccluded(projectedCamera: MercatorProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
    if (!terrain?.getCoverageIndex()) return false;

    const location = worldCoordinateHelper.worldFromLngLat(lngLat.lng, lngLat.lat);
    elevation ??= terrain.getElevationForLngLat(lngLat, projectedCamera.tileZoom);
    const clip = coordinateClipPoint(projectedCamera, location, elevation, projectedCamera.pixelMatrix3D);
    const w = clip[3];
    if (w <= 0 || clip[2] > w) return true;
    const p = new Point(clip[0] / w, clip[1] / w);

    const hit = screenTerrainPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain);
    if (hit == null) return false;
    const segment = getRaySegmentFromPixel(projectedCamera, p, NEAR_PLANE_CLIP_Z);
    const tLocation = raySegmentParameter(segment, location.x * projectedCamera.worldSize, location.y * projectedCamera.worldSize, elevation);
    return raySegmentParameter(segment, hit.x * projectedCamera.worldSize, hit.y * projectedCamera.worldSize, hit.z) < tLocation * (1 - TERRAIN_OCCLUSION_MARGIN);
}

/** Mercator draws everything at the scale it projects it, so it corrects nothing. */
export function getPixelScale(_data: MercatorProjectedCamera): number {
    return 1.0;
}

/** See {@link getPixelScale}. */
export function getCircleRadiusCorrection(_data: MercatorProjectedCamera): number {
    return 1.0;
}

/** See {@link getPixelScale}. */
export function getPitchedTextCorrection(_data: MercatorProjectedCamera, _textAnchorX: number, _textAnchorY: number, _tileID: UnwrappedTileID): number {
    return 1.0;
}

/** The light direction, in the same space as mercator's 3D features. */
export function transformLightDirection(_data: MercatorProjectedCamera, dir: vec3): vec3 {
    return vec3.clone(dir);
}

export function projectTileCoordinates(projectedCamera: MercatorProjectedCamera, x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
    const matrix = calculatePosMatrix(projectedCamera, unwrappedTileID);
    let pos;
    if (elevation != null) { // slow because of handle z-index
        pos = [x, y, elevation, 1] as vec4;
        vec4.transformMat4(pos, pos, matrix);
    } else { // fast because of ignore z-index
        pos = [x, y, 0, 1] as vec4;
        xyTransformMat4(pos, pos, matrix);
    }
    const w = pos[3];
    return {
        point: new Point(pos[0] / w, pos[1] / w),
        signedDistanceFromCamera: w,
        isOccluded: false
    };
}

export function getProjectionDataForCustomLayer(projectedCamera: MercatorProjectedCamera, applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const rendererProjectionData = getProjectionData(projectedCamera, {overscaledTileID: tileID, applyGlobeMatrix});
    const tileMatrix = calculateTileMatrix(tileID, projectedCamera.worldSize);
    mat4.multiply(tileMatrix, projectedCamera.modelViewProjectionMatrix, tileMatrix);

    // Even though we requested projection data for the mercator base tile which covers the entire mercator range,
    // the shader projection machinery still expects inputs to be in tile units range [0..EXTENT].
    // Since custom layers are expected to supply mercator coordinates [0..1], we need to rescale
    // both matrices by EXTENT. We also need to rescale Z.

    const scale: vec3 = [EXTENT, EXTENT, projectedCamera.worldSize / projectedCamera.pixelsPerMeter];

    // We pass full-precision 64bit float matrices to custom layers to prevent precision loss in case the user wants to do further transformations.
    // Otherwise we get very visible precision-artifacts and twitching for objects that are bulding-scale.
    const projectionMatrixScaled = createMat4f64();
    mat4.scale(projectionMatrixScaled, tileMatrix, scale);

    return {
        ...rendererProjectionData,
        tileMercatorCoords: [0, 0, 1, 1],
        fallbackMatrix: projectionMatrixScaled,
        mainMatrix: projectionMatrixScaled,
    };
}

export function getFastPathSimpleProjectionMatrix(projectedCamera: MercatorProjectedCamera, tileID: OverscaledTileID): mat4 {
    return calculatePosMatrix(projectedCamera, tileID);
}

function mercatorSampleAt(ray: MercatorRay, t: number): TerrainSample {
    return sampleAt(ray.index, ray.exaggeration, (ray.near[0] + t * ray.dx) / ray.worldSize, (ray.near[1] + t * ray.dy) / ray.worldSize, ray.wraps);
}

function mercatorIsBelowTerrain(ray: MercatorRay, t: number): boolean {
    return isBelowTerrainSample(mercatorSampleAt(ray, t), ray.near[2] + t * ray.dz);
}

/**
 * Where the point of `segment` closest to the given world pixel position and elevation lies along it,
 * as the fraction from `near` (0) to `far` (1).
 */
function raySegmentParameter({near, far}: RaySegment, worldX: number, worldY: number, elevation: number): number {
    const dx = far[0] - near[0];
    const dy = far[1] - near[1];
    const dz = far[2] - near[2];
    return ((worldX - near[0]) * dx + (worldY - near[1]) * dy + (elevation - near[2]) * dz) / (dx * dx + dy * dy + dz * dz);
}
