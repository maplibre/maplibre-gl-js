import {quat, vec3, type vec4} from 'gl-matrix';
import {type Frustum} from './frustum';
import {IntersectionResult, type IBoundingVolume} from './bounding_volume';

/**
 * A general convex bounding volume, defined by a set of points.
 */
export class ConvexVolume implements IBoundingVolume {
    // Precomputed AABB for rejecting frustum intersection.
    min: vec3;
    max: vec3;

    points: vec3[];
    planes: vec4[];

    /**
     * Creates an instance of a general convex bounding volume.
     * Note that the provided points array is used *as is*, its contents are not copied!
     *
     * Additionally, an AABB must be provided for rejecting frustum intersections.
     * This AABB does not need to bound this convex volume (it may be smaller),
     * but it *must* accurately bound the actual shape this volume is approximating.
     * @param points - Points forming the convex shape. Note that this array reference is used *as is*, its contents are not copied!
     * @param min - The bounding AABB's min point.
     * @param max - The bounding AABB's min point.
     */
    constructor(points: vec3[], planes: vec4[], min: vec3, max: vec3) {
        this.min = min;
        this.max = max;
        this.points = points;
        this.planes = planes;
    }

    /**
     * Creates a convex BV equivalent to the specified AABB.
     * @param min - The AABB's min point.
     * @param max - The AABB's max point.
     */
    public static fromAabb(min: vec3, max: vec3): ConvexVolume {
        const points = [];
        for (let i = 0; i < 8; i++) {
            points.push([
                ((i >> 0) & 1) === 1 ? max[0] : min[0],
                ((i >> 1) & 1) === 1 ? max[1] : min[1],
                ((i >> 2) & 1) === 1 ? max[2] : min[2]
            ]);
        }
        return new ConvexVolume(points, [
            [-1, 0, 0, max[0]],
            [1, 0, 0, -min[0]],
            [0, -1, 0, max[1]],
            [0, 1, 0, -min[1]],
            [0, 0, -1, max[2]],
            [0, 0, 1, -min[2]]
        ], min, max);
    }

    /**
     * Creates a convex bounding volume that is actually an oriented bounding box created from the specified center, half-size and rotation angles.
     * @param center - Center of the OBB.
     * @param halfSize - The half-size of the OBB in each axis. The box will extend by this value in each direction for the given axis.
     * @param angles - The rotation of the box. Euler angles, in degrees.
     */
    public static fromCenterSizeAngles(center: vec3, halfSize: vec3, angles: vec3): ConvexVolume {
        const q = quat.fromEuler([] as any, angles[0], angles[1], angles[2]);
        const axisX = vec3.transformQuat([] as any, [halfSize[0], 0, 0], q);
        const axisY = vec3.transformQuat([] as any, [0, halfSize[1], 0], q);
        const axisZ = vec3.transformQuat([] as any, [0, 0, halfSize[2]], q);
        // Find the AABB min/max
        const min = [...center] as vec3;
        const max = [...center] as vec3;
        for (let i = 0; i < 8; i++) {
            for (let axis = 0; axis < 3; axis++) {
                const point = center[axis]
                    + axisX[axis] * ((((i >> 0) & 1) === 1) ? 1 : -1)
                    + axisY[axis] * ((((i >> 1) & 1) === 1) ? 1 : -1)
                    + axisZ[axis] * ((((i >> 2) & 1) === 1) ? 1 : -1);
                min[axis] = Math.min(min[axis], point);
                max[axis] = Math.max(max[axis], point);
            }
        }
        const points = [];
        for (let i = 0; i < 8; i++) {
            const p = [...center] as vec3;
            vec3.add(p, p, vec3.scale([] as any, axisX, ((i >> 0) & 1) === 1 ? 1 : -1));
            vec3.add(p, p, vec3.scale([] as any, axisY, ((i >> 1) & 1) === 1 ? 1 : -1));
            vec3.add(p, p, vec3.scale([] as any, axisZ, ((i >> 2) & 1) === 1 ? 1 : -1));
            points.push(p);
        }
        return new ConvexVolume(points, [
            [...axisX, -vec3.dot(axisX, points[0])] as vec4,
            [...axisY, -vec3.dot(axisY, points[0])] as vec4,
            [...axisZ, -vec3.dot(axisZ, points[0])] as vec4,
            [-axisX[0], -axisX[1], -axisX[2], -vec3.dot(axisX, points[7])] as vec4,
            [-axisY[0], -axisY[1], -axisY[2], -vec3.dot(axisY, points[7])] as vec4,
            [-axisZ[0], -axisZ[1], -axisZ[2], -vec3.dot(axisZ, points[7])] as vec4,
        ], min, max);
    }

    /**
     * Performs an approximate frustum-obb intersection test.
     */
    intersectsFrustum(frustum: Frustum): IntersectionResult {
        // Performance-critical
        let fullyInside = true;

        const boxPointCount = this.points.length;
        const boxPlaneCount = this.planes.length;
        const frustumPlaneCount = frustum.planes.length;
        const frustumPointCount = frustum.points.length;

        // Test whether this volume's points are inside the frustum
        for (let i = 0; i < frustumPlaneCount; i++) {
            const plane = frustum.planes[i];
            let boxPointsPassed = 0;
            for(let j = 0; j < boxPointCount; j++) {
                const point = this.points[j];
                // Get point-plane distance sign
                if (plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] >= 0) {
                    boxPointsPassed++;
                }
            }

            if (boxPointsPassed === 0) {
                return IntersectionResult.None;
            }
            if (boxPointsPassed < boxPointCount) {
                fullyInside = false;
            }
        }

        if (fullyInside) {
            return IntersectionResult.Full;
        }

        // Test whether the frustum's points are inside this volume.
        for (let i = 0; i < boxPlaneCount; i++) {
            const plane = this.planes[i];
            let frustumPointsPassed = 0;
            for (let j = 0; j < frustumPointCount; j++) {
                const point = frustum.points[j];
                if (plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] >= 0) {
                    frustumPointsPassed++;
                }
            }
            if (frustumPointsPassed === 0) {
                return IntersectionResult.None;
            }
        }

        return IntersectionResult.Partial;
    }

    /**
     * Performs an intersection test with a halfspace.
     */
    intersectsPlane(plane: vec4): IntersectionResult {
        const pointCount = this.points.length;
        let positivePoints = 0;
        for (let i = 0; i < pointCount; i++) {
            const point = this.points[i];
            if (plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] >= 0) {
                positivePoints++;
            }
        }

        if (positivePoints === pointCount) {
            return IntersectionResult.Full;
        }
        if (positivePoints === 0) {
            return IntersectionResult.None;
        }
        return IntersectionResult.Partial;
    }
}
