import {type mat4, vec3, vec4} from 'gl-matrix';
import {Aabb} from './aabb';
import {pointPlaneSignedDistance, rayPlaneIntersection} from '../util';

export class Frustum {

    constructor(public points: vec4[], public planes: vec4[], public aabb: Aabb) { }

    public static fromInvProjectionMatrix(invProj: mat4, worldSize: number = 1, zoom: number = 0, horizonPlane?: vec4, flippedNearFar?: boolean): Frustum {
        const clipSpaceCorners = [
            [-1, 1, -1, 1],
            [1, 1, -1, 1],
            [1, -1, -1, 1],
            [-1, -1, -1, 1],
            [-1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, -1, 1, 1],
            [-1, -1, 1, 1]
        ];

        // Globe and mercator projection matrices have different Y directions, hence we need different sets of indices.
        // This should be fixed in the future.
        const frustumPlanePointIndices = flippedNearFar ? [
            [6, 5, 4],  // near
            [0, 1, 2],  // far
            [0, 3, 7],  // left
            [2, 1, 5],  // right
            [3, 2, 6],  // bottom
            [0, 4, 5]   // top
        ] : [
            [0, 1, 2],  // near
            [6, 5, 4],  // far
            [0, 3, 7],  // left
            [2, 1, 5],  // right
            [3, 2, 6],  // bottom
            [0, 4, 5]   // top
        ];

        const scale = Math.pow(2, zoom);

        // Transform frustum corner points from clip space to tile space, Z to meters
        const frustumCoords = clipSpaceCorners.map(v => unprojectClipSpacePoint(v, invProj, worldSize, scale));

        if (horizonPlane) {
            // A horizon clipping plane was supplied.
            adjustFarPlaneByHorizonPlane(frustumCoords, frustumPlanePointIndices[0], horizonPlane, flippedNearFar);
        }

        const frustumPlanes = frustumPlanePointIndices.map((p: number[]) => {
            const a = vec3.sub([] as any, frustumCoords[p[0]] as vec3, frustumCoords[p[1]] as vec3);
            const b = vec3.sub([] as any, frustumCoords[p[2]] as vec3, frustumCoords[p[1]] as vec3);
            const n = vec3.normalize([] as any, vec3.cross([] as any, a, b)) as any;
            const d = -vec3.dot(n, frustumCoords[p[1]] as vec3);
            return n.concat(d);
        });

        const min: vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
        const max: vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

        for (const p of frustumCoords) {
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], p[i]);
                max[i] = Math.max(max[i], p[i]);
            }
        }

        return new Frustum(frustumCoords, frustumPlanes, new Aabb(min, max));
    }
}

function unprojectClipSpacePoint(point: vec4 | number[], invProj: mat4, worldSize: number, scale: number): vec4 {
    const v = vec4.transformMat4([] as any, point as any, invProj) as any;
    const s = 1.0 / v[3] / worldSize * scale;
    return vec4.mul(v as any, v as any, [s, s, 1.0 / v[3], s] as vec4);
}

/**
 * Modifies points in the supplied `frustumCoords` array so that the frustum's far plane only lies as far as the horizon,
 * which improves frustum culling effectiveness.
 * @param frustumCoords - Points of the frustum.
 * @param nearPlanePointsIndices - Which indices in the `frustumCoords` form the near plane.
 * @param horizonPlane - The horizon plane.
 */
function adjustFarPlaneByHorizonPlane(frustumCoords: vec4[], nearPlanePointsIndices: number[], horizonPlane: vec4, flippedNearFar: boolean): void {
    // For each of the 4 edges from near to far plane,
    // we find at which distance these edges intersect the given clipping plane,
    // select the maximal value from these distances and then we move
    // the frustum's far plane so that it is at most as far away from the near plane
    // as this maximal distance.

    const nearPlanePointsOffset = flippedNearFar ? 4 : 0;
    const farPlanePointsOffset = flippedNearFar ? 0 : 4;

    let maxDist = 0;
    const cornerRayLengths: number[] = [];
    const cornerRayNormalizedDirections: vec3[] = [];
    for (let i = 0; i < 4; i++) {
        const dir = vec3.sub([] as any, frustumCoords[i + farPlanePointsOffset] as vec3, frustumCoords[i + nearPlanePointsOffset] as vec3);
        const len = vec3.length(dir);
        vec3.scale(dir, dir, 1.0 / len); // normalize
        cornerRayLengths.push(len);
        cornerRayNormalizedDirections.push(dir);
    }

    for (let i = 0; i < 4; i++) {
        const dist = rayPlaneIntersection(frustumCoords[i + nearPlanePointsOffset] as vec3, cornerRayNormalizedDirections[i], horizonPlane);
        if (dist !== null && dist >= 0) {
            maxDist = Math.max(maxDist, dist);
        } else {
            // Use the original ray length for rays parallel to the horizon plane, or for rays pointing away from it.
            maxDist = Math.max(maxDist, cornerRayLengths[i]);
        }
    }

    // Compute the near plane.
    // We use its normal as the "view vector" - direction in which the camera is looking.
    const nearPlaneNormalized = getNormalizedNearPlane(frustumCoords, nearPlanePointsIndices);

    // We also try to adjust the far plane position so that it exactly intersects the point on the horizon
    // that is most distant from the near plane.
    const idealFarPlaneDistanceFromNearPlane = getIdealNearFarPlaneDistance(horizonPlane, nearPlaneNormalized);
    if (idealFarPlaneDistanceFromNearPlane !== null) {
        const idealCornerRayLength = idealFarPlaneDistanceFromNearPlane / vec3.dot(cornerRayNormalizedDirections[0], nearPlaneNormalized as vec3); // dot(near plane, ray dir) is the same for all 4 corners
        maxDist = Math.min(maxDist, idealCornerRayLength);
    }

    for (let i = 0; i < 4; i++) {
        const targetLength = Math.min(maxDist, cornerRayLengths[i]);
        const newPoint = [
            frustumCoords[i + nearPlanePointsOffset][0] + cornerRayNormalizedDirections[i][0] * targetLength,
            frustumCoords[i + nearPlanePointsOffset][1] + cornerRayNormalizedDirections[i][1] * targetLength,
            frustumCoords[i + nearPlanePointsOffset][2] + cornerRayNormalizedDirections[i][2] * targetLength,
            1,
        ] as vec4;
        frustumCoords[i + farPlanePointsOffset] = newPoint;
    }
}

/**
 * Returns the near plane equation with unit length direction.
 * @param frustumCoords - Points of the frustum.
 * @param nearPlanePointsIndices - Which indices in the `frustumCoords` form the near plane.
 */
function getNormalizedNearPlane(frustumCoords: vec4[], nearPlanePointsIndices: number[]): vec4 {
    const nearPlaneA = vec3.sub([] as any, frustumCoords[nearPlanePointsIndices[0]] as vec3, frustumCoords[nearPlanePointsIndices[1]] as vec3);
    const nearPlaneB = vec3.sub([] as any, frustumCoords[nearPlanePointsIndices[2]] as vec3, frustumCoords[nearPlanePointsIndices[1]] as vec3);
    const nearPlaneNormalized = [0, 0, 0, 0] as vec4;
    vec3.normalize(nearPlaneNormalized as vec3, vec3.cross([] as any, nearPlaneA, nearPlaneB)) as any;
    nearPlaneNormalized[3] = -vec3.dot(nearPlaneNormalized as vec3, frustumCoords[nearPlanePointsIndices[0]] as vec3);
    return nearPlaneNormalized;
}

/**
 * Returns the ideal distance between the frustum's near and far plane so that the far plane only lies as far as the horizon.
 */
function getIdealNearFarPlaneDistance(horizonPlane: vec4, nearPlaneNormalized: vec4): number | null {
    // Normalize the horizon plane to unit direction
    const horizonPlaneLen = vec3.len(horizonPlane as vec3);
    const normalizedHorizonPlane = vec4.scale([] as any, horizonPlane, 1 / horizonPlaneLen);

    // Project the view vector onto the horizon plane
    const projectedViewDirection = vec3.sub([] as any, nearPlaneNormalized as vec3, vec3.scale([] as any, normalizedHorizonPlane as vec3, vec3.dot(nearPlaneNormalized as vec3, normalizedHorizonPlane as vec3)));
    const projectedViewLength = vec3.len(projectedViewDirection);
    
    // projectedViewLength will be 0 if the camera is looking straight down
    if (projectedViewLength > 0) {
        // Find the radius and center of the horizon circle (the horizon circle is the intersection of the planet's sphere and the horizon plane).
        const horizonCircleRadius = Math.sqrt(1 - normalizedHorizonPlane[3] * normalizedHorizonPlane[3]);
        const horizonCircleCenter = vec3.scale([] as any, normalizedHorizonPlane as vec3, -normalizedHorizonPlane[3]); // The horizon plane normal always points towards the camera.
        // Find the furthest point on the horizon circle from the near plane.
        const pointFurthestOnHorizonCircle = vec3.add([] as any, horizonCircleCenter, vec3.scale([] as any, projectedViewDirection, horizonCircleRadius / projectedViewLength));
        // Compute this point's distance from the near plane.
        return pointPlaneSignedDistance(nearPlaneNormalized, pointFurthestOnHorizonCircle);
    } else {
        return null;
    }
}
