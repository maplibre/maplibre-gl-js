import {mat4, vec3, vec4} from 'gl-matrix';
import {earthRadius} from '../geo/lng_lat.ts';
import {clamp, createIdentityMat4f32, createIdentityMat4f64, createMat4f64, createVec3f64, createVec4f64, differenceOfAnglesDegrees, MAX_VALID_LATITUDE, pointPlaneSignedDistance, warnOnce} from '../util/util.ts';
import {OverscaledTileID, UnwrappedTileID, type CanonicalTileID} from '../tile/tile_id.ts';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {getMercatorTileCoordinates, tileCoordinatesToMercatorCoordinates} from '../geo/projection/mercator_utils.ts';
import {angularCoordinatesToSurfaceVector, clampToSphere, getGlobeRadiusPixels, horizonPlaneToCenterAndRadius, mercatorCoordinatesToAngularCoordinatesRadians, planetScaleAtLatitude, projectTileCoordinatesToSphere, raySphereIntersection, sphereSurfacePointToCoordinates} from '../geo/projection/globe_utils.ts';
import {bisect, sampleAt, isBelowTerrainSample, TERRAIN_OCCLUSION_MARGIN, type TerrainCoverageIndex, type TerrainSample} from '../render/terrain_coverage.ts';
import {Frustum} from '../util/primitives/frustum.ts';
import {getCenterOffset} from './camera_view_state.ts';
import {cameraPointQueryGeometry} from './projected_camera.ts';

import type {LngLat} from '../geo/lng_lat.ts';
import type {CameraMetrics, VerticalPerspectiveProjectedCamera} from './projected_camera.ts';
import type {NearFarZ} from './camera_types.ts';
import type {CameraMath} from './camera_math.ts';
import type {PointProjection} from '../symbol/projection.ts';
import type {Terrain} from '../render/terrain.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from '../geo/projection/projection_data.ts';
import type {WorldCoordinateHelper} from '../geo/world_types.ts';

const GLOBE_SAMPLES = 256;
const GLOBE_BISECT_EPSILON_T = 1e-12;
/** Latitudes outside the mercator range project past the world edge; the globe mesh still covers them. */
const MAX_MERCATOR_Y = 1 - 1e-9;

/**
 * @internal
 * A ray to intersect with the terrain surface, in globe coordinates:
 * `origin` and the unit-length `direction` are on the unit sphere, and terrain elevations are in meters above sea level.
 */
type GlobeRay = {
    index: TerrainCoverageIndex;
    exaggeration: number;
    origin: vec3;
    direction: vec3;
};

/**
 * @internal
 * Derives the {@link VerticalPerspectiveProjectedCamera} of a camera: the matrices the vertical perspective draws it with.
 * The computed far plane only has to be far enough to take in the globe, since the vertex shader computes its own
 * depth. A camera without a size keeps identity matrices.
 * @param nearFarZ - the depth range to use instead of computing one, by default the camera view state's override
 */
export function createVerticalPerspectiveProjectedCamera(metrics: CameraMetrics, nearFarZ: NearFarZ | null = metrics.nearFarZOverride): VerticalPerspectiveProjectedCamera {
    const base = {...metrics, projection: 'vertical-perspective' as const};
    if (!metrics.width || !metrics.height) {
        return {
            ...base,
            nearZ: undefined,
            farZ: undefined,
            projectionMatrix: createIdentityMat4f64(),
            modelViewProjectionMatrix: createIdentityMat4f64(),
            modelViewProjectionMatrix32f: createIdentityMat4f32(),
            inverseModelViewProjectionMatrix: createIdentityMat4f64(),
            inverseProjectionMatrix: createIdentityMat4f64(),
            cameraPosition: createVec3f64(),
            clippingPlane: createVec4f64(),
            frustum: undefined,
        };
    }
    const globeRadiusPixels = getGlobeRadiusPixels(metrics.worldSize, metrics.center.lat);

    // Construct a completely separate matrix for globe view
    const globeMatrix = createMat4f64();
    const {nearZ, farZ} = nearFarZ ?? {nearZ: 0.5, farZ: metrics.cameraToCenterDistance + globeRadiusPixels * 2.0};
    mat4.perspective(globeMatrix, metrics.fovInRadians, metrics.width / metrics.height, nearZ, farZ);

    // Apply center of perspective offset
    const offset = getCenterOffset(metrics);
    globeMatrix[8] = -offset.x * 2 / metrics.width;
    globeMatrix[9] = offset.y * 2 / metrics.height;
    const projectionMatrix = mat4.clone(globeMatrix);

    const inverseProjectionMatrix = createMat4f64();
    mat4.invert(inverseProjectionMatrix, globeMatrix);
    mat4.translate(globeMatrix, globeMatrix, [0, 0, -metrics.cameraToCenterDistance]);
    mat4.rotateZ(globeMatrix, globeMatrix, metrics.rollInRadians);
    mat4.rotateX(globeMatrix, globeMatrix, -metrics.pitchInRadians);
    mat4.rotateZ(globeMatrix, globeMatrix, metrics.bearingInRadians);
    mat4.translate(globeMatrix, globeMatrix, [0.0, 0, -globeRadiusPixels]);
    // Rotate the sphere to center it on viewed coordinates

    const scaleVec = createVec3f64();
    scaleVec[0] = globeRadiusPixels;
    scaleVec[1] = globeRadiusPixels;
    scaleVec[2] = globeRadiusPixels;

    mat4.rotateX(globeMatrix, globeMatrix, metrics.center.lat * Math.PI / 180.0);
    mat4.rotateY(globeMatrix, globeMatrix, -metrics.center.lng * Math.PI / 180.0);
    mat4.scale(globeMatrix, globeMatrix, scaleVec); // Scale the unit sphere to a sphere with diameter of 1
    const modelViewProjectionMatrix = globeMatrix;
    const modelViewProjectionMatrix32f = new Float32Array(globeMatrix); // Must be 32 bit floats, otherwise WebGL calls in Chrome get very slow.

    const inverseModelViewProjectionMatrix = createMat4f64();
    mat4.invert(inverseModelViewProjectionMatrix, globeMatrix);

    const zero = createVec3f64();
    const cameraPosition = createVec3f64();
    cameraPosition[2] = metrics.cameraToCenterDistance / globeRadiusPixels;
    vec3.rotateZ(cameraPosition, cameraPosition, zero, -metrics.rollInRadians);
    vec3.rotateX(cameraPosition, cameraPosition, zero, metrics.pitchInRadians);
    vec3.rotateZ(cameraPosition, cameraPosition, zero, -metrics.bearingInRadians);
    vec3.add(cameraPosition, cameraPosition, [0, 0, 1]);
    vec3.rotateX(cameraPosition, cameraPosition, zero, -metrics.center.lat * Math.PI / 180.0);
    vec3.rotateY(cameraPosition, cameraPosition, zero, metrics.center.lng * Math.PI / 180.0);

    const clippingPlane = computeClippingPlane(metrics, globeRadiusPixels);

    const matrix = mat4.clone(inverseModelViewProjectionMatrix);
    mat4.scale(matrix, matrix, [1, 1, -1]);
    const frustum = Frustum.fromInvProjectionMatrix(matrix, 1, 0, clippingPlane, true);

    return {
        ...base,
        nearZ,
        farZ,
        projectionMatrix,
        modelViewProjectionMatrix,
        modelViewProjectionMatrix32f,
        inverseModelViewProjectionMatrix,
        inverseProjectionMatrix,
        cameraPosition,
        clippingPlane,
        frustum,
    };
}

/**
 * The plane equation that, applied to the unit sphere generated in the vertex shader, places all visible parts of the
 * sphere into the positive half-space and all the non-visible parts in the negative half-space, so that the shaders
 * can clip all non-visible geometry with it.
 *
 * ```
 * cam....------------A
 *        ....        |
 *            ....    |
 *                ....B
 *                ggggggggg
 *          gggggg    |   .gggggg
 *       ggg          |       ...ggg    ^
 *     gg             |                 |
 *    g               |                 y
 *    g               |                 |
 *   g                C                 #---x--->
 * ```
 *
 * "g" marks the globe edge, the dotted line is the camera center ray, "cam" is the camera, "C" the globe center and
 * "B" the point the camera looks at, where the center ray meets the globe. The pitch is the angle at B between cam, B
 * and A, and the camera is `cameraToCenterDistance` from B. "T" is any point where a tangent from the camera touches
 * the globe. The elevation is taken as zero: globe rendering is separate from terrain rendering.
 */
function computeClippingPlane(metrics: CameraMetrics, globeRadiusPixels: number): vec4 {
    const pitch = metrics.pitchInRadians;
    // scale things so that the globe radius is 1
    const distanceCameraToB = metrics.cameraToCenterDistance / globeRadiusPixels;
    const radius = 1;

    // Distance from camera to "A" - the point at the same elevation as camera, right above center point on globe
    const distanceCameraToA = Math.sin(pitch) * distanceCameraToB;
    // Distance from "A" to "C"
    const distanceAtoC = (Math.cos(pitch) * distanceCameraToB + radius);
    // Distance from camera to "C" - the globe center
    const distanceCameraToC = Math.sqrt(distanceCameraToA * distanceCameraToA + distanceAtoC * distanceAtoC);
    // cam - C - T angle cosine (at C)
    const camCTcosine = radius / distanceCameraToC;
    // Distance from globe center to the plane defined by all possible "T" points
    const tangentPlaneDistanceToC = camCTcosine * radius;

    let vectorCtoCamX = -distanceCameraToA;
    let vectorCtoCamY = distanceAtoC;
    // Normalize the vector
    const vectorCtoCamLength = Math.sqrt(vectorCtoCamX * vectorCtoCamX + vectorCtoCamY * vectorCtoCamY);
    vectorCtoCamX /= vectorCtoCamLength;
    vectorCtoCamY /= vectorCtoCamLength;

    // Note the swizzled components
    const planeVector: vec3 = [0, vectorCtoCamX, vectorCtoCamY];
    // Apply transforms - lat, lng and angle (NOT pitch - already accounted for, as it affects the tangent plane)
    vec3.rotateZ(planeVector, planeVector, [0, 0, 0], -metrics.bearingInRadians);
    vec3.rotateX(planeVector, planeVector, [0, 0, 0], -1 * metrics.center.lat * Math.PI / 180.0);
    vec3.rotateY(planeVector, planeVector, [0, 0, 0], metrics.center.lng * Math.PI / 180.0);
    // Normalize the plane vector
    const scale = 1 / vec3.length(planeVector);
    vec3.scale(planeVector, planeVector, scale);
    return [...planeVector, -tangentPlaneDistanceToC * scale];
}

/**
 * True when the segment from the camera to the given point, both in unit-globe coordinates, passes through the planet.
 */
function isLineOfSightBlocked(projectedCamera: VerticalPerspectiveProjectedCamera, x: number, y: number, z: number): boolean {
    const cam = projectedCamera.cameraPosition;
    const dx = x - cam[0];
    const dy = y - cam[1];
    const dz = z - cam[2];
    const lengthSq = dx * dx + dy * dy + dz * dz;
    if (lengthSq === 0) return false;
    const t = clamp(-(cam[0] * dx + cam[1] * dy + cam[2] * dz) / lengthSq, 0, 1);
    const cx = cam[0] + t * dx;
    const cy = cam[1] + t * dy;
    const cz = cam[2] + t * dz;
    return cx * cx + cy * cy + cz * cz < 1.0;
}

/** The number of segments a point query's path to the camera is sampled with to follow the curve of the globe. */
const CAMERA_QUERY_ARC_SEGMENTS = 8;

/**
 * Projects a given vector on the surface of a unit sphere (or possible above the surface)
 * and returns its coordinates on screen in pixels.
 */
function projectSurfacePointToScreen(projectedCamera: VerticalPerspectiveProjectedCamera, pos: vec3): Point {
    const projected = createVec4f64();
    vec4.transformMat4(projected, [...pos, 1] as vec4, projectedCamera.modelViewProjectionMatrix);
    projected[0] /= projected[3];
    projected[1] /= projected[3];
    return new Point(
        (projected[0] * 0.5 + 0.5) * projectedCamera.width,
        (-projected[1] * 0.5 + 0.5) * projectedCamera.height
    );
}

/** Whether the ray through a screen point meets the globe. */
function isRayOnGlobe(projectedCamera: VerticalPerspectiveProjectedCamera, p: Point): boolean {
    return !!raySphereIntersection(projectedCamera.cameraPosition, rayDirectionFromPixel(projectedCamera, p));
}

/**
 * Computes normalized direction of a ray from the camera to the given screen pixel.
 */
function rayDirectionFromPixel(projectedCamera: VerticalPerspectiveProjectedCamera, p: Point): vec3 {
    const pos = createVec4f64();
    pos[0] = (p.x / projectedCamera.width) * 2.0 - 1.0;
    pos[1] = ((p.y / projectedCamera.height) * 2.0 - 1.0) * -1.0;
    pos[2] = 1;
    pos[3] = 1;
    vec4.transformMat4(pos, pos, projectedCamera.inverseModelViewProjectionMatrix);
    pos[0] /= pos[3];
    pos[1] /= pos[3];
    pos[2] /= pos[3];
    const ray = createVec3f64();
    ray[0] = pos[0] - projectedCamera.cameraPosition[0];
    ray[1] = pos[1] - projectedCamera.cameraPosition[1];
    ray[2] = pos[2] - projectedCamera.cameraPosition[2];
    const rayNormalized: vec3 = createVec3f64();
    vec3.normalize(rayNormalized, ray);
    return rayNormalized;
}

/**
 * For a given point on the unit sphere of the planet, or raised above it, returns whether it lies on the camera's
 * side of the horizon plane, the plane the globe shaders clip with (not taking into account camera rotation at all).
 */
function isSurfacePointVisible(projectedCamera: VerticalPerspectiveProjectedCamera, p: vec3): boolean {
    const plane = projectedCamera.clippingPlane;
    // dot(position on sphere, occlusion plane equation)
    const dotResult = plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
    return dotResult >= 0.0;
}

/**
 * Returns whether surface point is visible on screen.
 * It must both project to a pixel in screen bounds and not be occluded by the planet.
 */
function isSurfacePointOnScreen(projectedCamera: VerticalPerspectiveProjectedCamera, vec: vec3): boolean {
    if (!isSurfacePointVisible(projectedCamera, vec)) {
        return false;
    }

    const projected = createVec4f64();
    vec4.transformMat4(projected, [...vec, 1] as vec4, projectedCamera.modelViewProjectionMatrix);
    projected[0] /= projected[3];
    projected[1] /= projected[3];
    projected[2] /= projected[3];
    return projected[0] > -1 && projected[0] < 1 &&
        projected[1] > -1 && projected[1] < 1 &&
        projected[2] > -1 && projected[2] < 1;
}

/**
 * Returns a {@link LngLat} representing geographical coordinates that correspond to the specified pixel coordinates.
 * Note: if the point does not lie on the globe, returns a location on the visible globe horizon (edge) that is
 * as close to the point as possible.
 * @param p - Screen point in pixels to unproject.
 */
export function unprojectScreenPoint(projectedCamera: VerticalPerspectiveProjectedCamera, p: Point): LngLat {
    // Here we compute the intersection of the ray towards the pixel at `p` and the planet sphere.
    // As always, we assume that the planet is centered at 0,0,0 and has radius 1.
    // Ray origin is the camera position and direction is `rayDirection`.
    const rayOrigin = projectedCamera.cameraPosition;
    const rayDirection = rayDirectionFromPixel(projectedCamera, p);
    const intersection = raySphereIntersection(rayOrigin, rayDirection);

    if (intersection) {
        // Ray intersects the sphere -> compute intersection LngLat.
        // Assume the ray origin is never inside the sphere - just use tMin
        const intersectionPoint = createVec3f64();
        vec3.add(intersectionPoint, rayOrigin, [
            rayDirection[0] * intersection.tMin,
            rayDirection[1] * intersection.tMin,
            rayDirection[2] * intersection.tMin
        ]);
        const sphereSurface = createVec3f64();
        vec3.normalize(sphereSurface, intersectionPoint);
        return sphereSurfacePointToCoordinates(sphereSurface);
    }

    // Ray does not intersect the sphere -> find the closest point on the horizon to the ray.
    // Intersect the ray with the clipping plane, since we know that the intersection of the clipping plane and the sphere is the horizon.
    const horizonPlane = projectedCamera.clippingPlane;
    const directionDotPlaneXyz = horizonPlane[0] * rayDirection[0] + horizonPlane[1] * rayDirection[1] + horizonPlane[2] * rayDirection[2];
    const originToPlaneDistance = pointPlaneSignedDistance(horizonPlane, rayOrigin);
    const distanceToIntersection = -originToPlaneDistance / directionDotPlaneXyz;

    const maxRayLength = 2.0; // One globe diameter
    const planeIntersection = createVec3f64();

    if (distanceToIntersection > 0) {
        vec3.add(planeIntersection, rayOrigin, [
            rayDirection[0] * distanceToIntersection,
            rayDirection[1] * distanceToIntersection,
            rayDirection[2] * distanceToIntersection
        ]);
    } else {
        // When the ray takes too long to hit the plane (>maxRayLength), or if the plane intersection is behind the camera, handle things differently.
        // Take a point along the ray at distance maxRayLength, project it to clipping plane, then continue as normal to find the horizon point.
        const distantPoint = createVec3f64();
        vec3.add(distantPoint, rayOrigin, [
            rayDirection[0] * maxRayLength,
            rayDirection[1] * maxRayLength,
            rayDirection[2] * maxRayLength
        ]);
        const distanceFromPlane = pointPlaneSignedDistance(horizonPlane, distantPoint);
        vec3.sub(planeIntersection, distantPoint, [
            horizonPlane[0] * distanceFromPlane,
            horizonPlane[1] * distanceFromPlane,
            horizonPlane[2] * distanceFromPlane
        ]);
    }

    const horizonDisk = horizonPlaneToCenterAndRadius(horizonPlane);
    const closestOnHorizon = clampToSphere(horizonDisk.center, horizonDisk.radius, planeIntersection);

    return sphereSurfacePointToCoordinates(closestOnHorizon);
}

function globeSampleAt(ray: GlobeRay, t: number): {sample: TerrainSample; radius: number; mercator: MercatorCoordinate} {
    const position = createVec3f64();
    vec3.scaleAndAdd(position, ray.origin, ray.direction, t);
    const radius = vec3.length(position);
    const surface = createVec3f64();
    vec3.scale(surface, position, 1 / radius);
    const lngLat = sphereSurfacePointToCoordinates(surface);
    const projected = MercatorCoordinate.fromLngLat(lngLat);
    const mercator = new MercatorCoordinate(projected.x, clamp(projected.y, 0, MAX_MERCATOR_Y));
    const sample = sampleAt(ray.index, ray.exaggeration, mercator.x, mercator.y, false);
    // The globe mesh caps the poles at elevation zero, matching the GLOBE branch of get_elevation.
    const elevation = Math.abs(lngLat.lat) > MAX_VALID_LATITUDE ? 0 : sample.elevation;
    return {sample: {...sample, elevation}, radius, mercator};
}

function globeIsBelowTerrain(ray: GlobeRay, t: number): boolean {
    const {sample, radius} = globeSampleAt(ray, t);
    return isBelowTerrainSample(sample, (radius - 1) * earthRadius);
}

/**
 * The location as a vector from the globe's center in globe radii, raised `elevation` meters above the surface.
 */
function raisedSurfaceVector(lngLat: LngLat, elevation: number): vec3 {
    const vector = angularCoordinatesToSurfaceVector(lngLat);
    return vec3.scale(vector, vector, 1 + elevation / earthRadius);
}

/**
 * Where the point of the ray closest to `point` lies along it, in units of `direction` from `origin`.
 */
function rayParameter(origin: vec3, direction: vec3, point: vec3): number {
    const offset = vec3.subtract(createVec3f64(), point, origin);
    return vec3.dot(offset, direction);
}

/** @internal The {@link CameraMath} of the vertical perspective projection, which draws the planet as a sphere. */
export class VerticalPerspectiveCameraMath implements CameraMath {
    getProjectionData(projectedCamera: VerticalPerspectiveProjectedCamera, params: ProjectionDataParams): RendererProjectionData {
        const {overscaledTileID, applyGlobeMatrix} = params;
        const mercatorTileCoordinates = getMercatorTileCoordinates(overscaledTileID);
        return {
            mainMatrix: projectedCamera.modelViewProjectionMatrix32f,
            tileMercatorCoords: mercatorTileCoordinates,
            clippingPlane: projectedCamera.clippingPlane as [number, number, number, number],
            projectionTransition: applyGlobeMatrix ? 1 : 0,
            fallbackMatrix: projectedCamera.modelViewProjectionMatrix32f,
            clipAntimeridian: overscaledTileID?.canonical.z === 0,
        };
    }

    /** See {@link CameraMath.isLocationOccluded}. */
    isLocationOccluded(projectedCamera: VerticalPerspectiveProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        const coverage = terrain?.getCoverageIndex();
        elevation ??= coverage ? terrain.getElevationForLngLat(lngLat, projectedCamera.tileZoom) : 0;
        const location = raisedSurfaceVector(lngLat, elevation);
        if (!isSurfacePointVisible(projectedCamera, location)) return true;
        if (!coverage) return false;

        const p = projectSurfacePointToScreen(projectedCamera, location);
        const origin = projectedCamera.cameraPosition;
        const direction = rayDirectionFromPixel(projectedCamera, p);
        const tLocation = rayParameter(origin, direction, location);
        if (tLocation <= 0) return true;

        const hit = this.screenTerrainPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain);
        return hit != null && rayParameter(origin, direction, raisedSurfaceVector(hit.toLngLat(), hit.z)) < tLocation * (1 - TERRAIN_OCCLUSION_MARGIN);
    }

    transformLightDirection(projectedCamera: VerticalPerspectiveProjectedCamera, dir: vec3): vec3 {
        const sphereX = projectedCamera.center.lng * Math.PI / 180.0;
        const sphereY = projectedCamera.center.lat * Math.PI / 180.0;

        const len = Math.cos(sphereY);
        const spherePos: vec3 = [
            Math.sin(sphereX) * len,
            Math.sin(sphereY),
            Math.cos(sphereX) * len
        ];

        const axisRight: vec3 = [spherePos[2], 0.0, -spherePos[0]]; // Equivalent to cross(vec3(0.0, 1.0, 0.0), vec)
        const axisDown: vec3 = [0, 0, 0];
        vec3.cross(axisDown, axisRight, spherePos);
        vec3.normalize(axisRight, axisRight);
        vec3.normalize(axisDown, axisDown);

        const transformed: vec3 = [
            axisRight[0] * dir[0] + axisDown[0] * dir[1] + spherePos[0] * dir[2],
            axisRight[1] * dir[0] + axisDown[1] * dir[1] + spherePos[1] * dir[2],
            axisRight[2] * dir[0] + axisDown[2] * dir[1] + spherePos[2] * dir[2]
        ];

        const normalized: vec3 = [0, 0, 0];
        vec3.normalize(normalized, transformed);
        return normalized;
    }

    getPixelScale(projectedCamera: VerticalPerspectiveProjectedCamera): number {
        return 1.0 / planetScaleAtLatitude(projectedCamera.center.lat);
    }

    getCircleRadiusCorrection(projectedCamera: VerticalPerspectiveProjectedCamera): number {
        return planetScaleAtLatitude(projectedCamera.center.lat);
    }

    getPitchedTextCorrection(projectedCamera: VerticalPerspectiveProjectedCamera, textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        const mercator = tileCoordinatesToMercatorCoordinates(textAnchorX, textAnchorY, tileID.canonical);
        const angular = mercatorCoordinatesToAngularCoordinatesRadians(mercator.x, mercator.y);
        return this.getCircleRadiusCorrection(projectedCamera) / Math.cos(angular[1]);
    }

    projectTileCoordinates(projectedCamera: VerticalPerspectiveProjectedCamera, x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        const canonical = unwrappedTileID.canonical;
        const spherePos = projectTileCoordinatesToSphere(x, y, canonical.x, canonical.y, canonical.z);
        const vectorMultiplier = 1.0 + (elevation ?? 0.0) / earthRadius;
        const elevatedX = spherePos[0] * vectorMultiplier;
        const elevatedY = spherePos[1] * vectorMultiplier;
        const elevatedZ = spherePos[2] * vectorMultiplier;
        const pos: vec4 = [elevatedX, elevatedY, elevatedZ, 1];
        vec4.transformMat4(pos, pos, projectedCamera.modelViewProjectionMatrix);

        let isOccluded: boolean;
        if (vectorMultiplier <= 1.0) {
            const plane = projectedCamera.clippingPlane;
            isOccluded = plane[0] * spherePos[0] + plane[1] * spherePos[1] + plane[2] * spherePos[2] + plane[3] < 0.0;
        } else {
            isOccluded = isLineOfSightBlocked(projectedCamera, elevatedX, elevatedY, elevatedZ);
        }

        return {
            point: new Point(pos[0] / pos[3], pos[1] / pos[3]),
            signedDistanceFromCamera: pos[3],
            isOccluded
        };
    }

    calculateFogMatrix(_data: VerticalPerspectiveProjectedCamera, _unwrappedTileID: UnwrappedTileID): mat4 {
        warnOnce('calculateFogMatrix is not supported on globe projection.');
        const m = createMat4f64();
        mat4.identity(m);
        return m;
    }

    /** Globe has no wrap. */
    getVisibleUnwrappedCoordinates(_projectedCamera: VerticalPerspectiveProjectedCamera, _worldCoordinateHelper: WorldCoordinateHelper, tileID: CanonicalTileID): UnwrappedTileID[] {
        return [new UnwrappedTileID(0, tileID)];
    }

    getCameraFrustum(projectedCamera: VerticalPerspectiveProjectedCamera): Frustum {
        return projectedCamera.frustum;
    }

    /** The mercator version reads the pixel matrix, which the vertical perspective does not have. */
    maxPitchScaleFactor(_data: VerticalPerspectiveProjectedCamera): number {
        return 1;
    }

    /**
     * The altitude of the rendered camera above sea level. The sphere keeps the center point at sea level whatever its
     * elevation ({@link createVerticalPerspectiveProjectedCamera} does not apply it), so unlike on mercator the center
     * elevation does not lift the camera. `calculateCameraOptionsFromTo` of `VerticalPerspectiveTransform` is the inverse.
     */
    getCameraAltitude(projectedCamera: VerticalPerspectiveProjectedCamera): number {
        // The camera position is in unit-globe coordinates, with the sea-level surface at radius 1.
        return (vec3.length(projectedCamera.cameraPosition) - 1) * earthRadius;
    }

    getCameraLngLat(projectedCamera: VerticalPerspectiveProjectedCamera, _worldCoordinateHelper: WorldCoordinateHelper): LngLat {
        const surface = createVec3f64();
        vec3.normalize(surface, projectedCamera.cameraPosition);
        return sphereSurfacePointToCoordinates(surface);
    }

    getBounds(projectedCamera: VerticalPerspectiveProjectedCamera, _worldCoordinateHelper: WorldCoordinateHelper): LngLatBounds {
        const xMid = projectedCamera.width * 0.5;
        const yMid = projectedCamera.height * 0.5;

        // LngLat extremes will probably tend to be in screen corners or in middle of screen edges.
        // These test points should result in a pretty good approximation.
        const testPoints = [
            new Point(0, 0),
            new Point(xMid, 0),
            new Point(projectedCamera.width, 0),
            new Point(projectedCamera.width, yMid),
            new Point(projectedCamera.width, projectedCamera.height),
            new Point(xMid, projectedCamera.height),
            new Point(0, projectedCamera.height),
            new Point(0, yMid),
        ];

        const projectedPoints = [];
        for (const p of testPoints) {
            projectedPoints.push(unprojectScreenPoint(projectedCamera, p));
        }

        // We can't construct a simple min/max aabb, since points might lie on either side of the antimeridian.
        // We will instead compute the furthest points relative to map center.
        // We also take advantage of the fact that `unprojectScreenPoint` will snap pixels
        // outside the planet to the closest point on the planet's horizon.
        let mostEast = 0, mostWest = 0, mostNorth = 0, mostSouth = 0; // We will store these values signed.
        const center = projectedCamera.center;
        for (const p of projectedPoints) {
            const dLng = differenceOfAnglesDegrees(center.lng, p.lng);
            const dLat = differenceOfAnglesDegrees(center.lat, p.lat);
            if (dLng < mostWest) {
                mostWest = dLng;
            }
            if (dLng > mostEast) {
                mostEast = dLng;
            }
            if (dLat < mostSouth) {
                mostSouth = dLat;
            }
            if (dLat > mostNorth) {
                mostNorth = dLat;
            }
        }

        const boundsArray: [number, number, number, number] = [
            center.lng + mostWest,  // west
            center.lat + mostSouth, // south
            center.lng + mostEast,  // east
            center.lat + mostNorth  // north
        ];

        // Sometimes the poles might end up not being on the horizon,
        // thus not being detected as the northernmost/southernmost points.
        // We fix that here.
        if (isSurfacePointOnScreen(projectedCamera, [0, 1, 0])) {
            // North pole is visible
            // This also means that the entire longitude range must be visible
            boundsArray[3] = 90;
            boundsArray[0] = -180;
            boundsArray[2] = 180;
        }
        if (isSurfacePointOnScreen(projectedCamera, [0, -1, 0])) {
            // South pole is visible
            boundsArray[1] = -90;
            boundsArray[0] = -180;
            boundsArray[2] = 180;
        }

        return new LngLatBounds(boundsArray);
    }

    locationToScreenPoint(projectedCamera: VerticalPerspectiveProjectedCamera, _worldCoordinateHelper: WorldCoordinateHelper, lnglat: LngLat, terrain?: Terrain): Point {
        const pos = angularCoordinatesToSurfaceVector(lnglat);

        if (terrain) {
            const elevation = terrain.getElevationForLngLat(lnglat, projectedCamera.tileZoom);
            vec3.scale(pos, pos, 1.0 + elevation / earthRadius);
        }

        return projectSurfacePointToScreen(projectedCamera, pos);
    }

    /**
     * For a point query on the globe, the path from the query point to the point on the globe below the camera, sampled
     * along the arc it follows on the sphere. An extrusion visible at the query point stands on that path. Box queries
     * and points off the globe get the geometry every projection uses, see `cameraPointQueryGeometry` in
     * `projected_camera.ts`.
     */
    getCameraQueryGeometry(projectedCamera: VerticalPerspectiveProjectedCamera, queryGeometry: Point[]): Point[] {
        if (queryGeometry.length !== 1 || !isRayOnGlobe(projectedCamera, queryGeometry[0])) return cameraPointQueryGeometry(projectedCamera, queryGeometry);
        const query = angularCoordinatesToSurfaceVector(unprojectScreenPoint(projectedCamera, queryGeometry[0]));
        const nadir = vec3.normalize(createVec3f64(), projectedCamera.cameraPosition);
        const geometry = [queryGeometry[0]];
        for (let i = 1; i <= CAMERA_QUERY_ARC_SEGMENTS; i++) {
            const point = vec3.lerp(createVec3f64(), query, nadir, i / CAMERA_QUERY_ARC_SEGMENTS);
            geometry.push(projectSurfacePointToScreen(projectedCamera, vec3.normalize(point, point)));
        }
        return geometry;
    }

    screenPointToMercatorCoordinate(projectedCamera: VerticalPerspectiveProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): MercatorCoordinate {
        if (terrain) {
            const coordinate = this.screenTerrainPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain);
            if (coordinate) {
                return coordinate;
            }
        }
        return MercatorCoordinate.fromLngLat(unprojectScreenPoint(projectedCamera, p));
    }

    /** See {@link CameraMath.screenTerrainPointToMercatorCoordinate}. */
    screenTerrainPointToMercatorCoordinate(projectedCamera: VerticalPerspectiveProjectedCamera, _worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain: Terrain): MercatorCoordinate | null {
        const index = terrain.getCoverageIndex();
        if (!index) return null;

        const origin = projectedCamera.cameraPosition;
        const direction = rayDirectionFromPixel(projectedCamera, p);
        const outer = raySphereIntersection(origin, direction, 1 + index.maxElevation / earthRadius);
        if (!outer) return null;
        const inner = raySphereIntersection(origin, direction, 1 + index.minElevation / earthRadius);

        const tStart = Math.max(outer.tMin, 0);
        const tEnd = inner ? inner.tMin : outer.tMax;
        if (tEnd <= tStart) return null;

        const ray: GlobeRay = {index, exaggeration: terrain.exaggeration, origin, direction};

        let previousT = 0;
        for (let i = 0; i <= GLOBE_SAMPLES; i++) {
            const t = tStart + (tEnd - tStart) * i / GLOBE_SAMPLES;
            if (globeIsBelowTerrain(ray, t)) {
                const {hi} = bisect(ray, globeIsBelowTerrain, previousT, t, GLOBE_BISECT_EPSILON_T);
                const {sample, mercator} = globeSampleAt(ray, hi);
                return new MercatorCoordinate(mercator.x, mercator.y, sample.elevation);
            }
            previousT = t;
        }

        return null;
    }

    screenPointToLocation(projectedCamera: VerticalPerspectiveProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, terrain?: Terrain): LngLat {
        return this.screenPointToMercatorCoordinate(projectedCamera, worldCoordinateHelper, p, terrain)?.toLngLat();
    }

    /** No flat ground plane to intersect at an elevation: uses the planet surface. */
    screenPointToLocationAtElevation(projectedCamera: VerticalPerspectiveProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper, p: Point, _elevation: number): LngLat {
        return this.screenPointToLocation(projectedCamera, worldCoordinateHelper, p);
    }

    isPointOnMapSurface(projectedCamera: VerticalPerspectiveProjectedCamera, _worldCoordinateHelper: WorldCoordinateHelper, p: Point, _terrain?: Terrain): boolean {
        return isRayOnGlobe(projectedCamera, p);
    }

    getProjectionDataForCustomLayer(projectedCamera: VerticalPerspectiveProjectedCamera, applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        const globeData = this.getProjectionData(projectedCamera, {overscaledTileID: new OverscaledTileID(0, 0, 0, 0, 0), applyGlobeMatrix});
        globeData.tileMercatorCoords = [0, 0, 1, 1];
        return globeData;
    }

    getFastPathSimpleProjectionMatrix(_data: VerticalPerspectiveProjectedCamera, _tileID: OverscaledTileID): mat4 {
        return undefined;
    }

    getClippingPlane(projectedCamera: VerticalPerspectiveProjectedCamera): vec4 {
        return projectedCamera.clippingPlane;
    }

    getRayDirectionFromPixel(projectedCamera: VerticalPerspectiveProjectedCamera, p: Point): vec3 {
        return rayDirectionFromPixel(projectedCamera, p);
    }
}
