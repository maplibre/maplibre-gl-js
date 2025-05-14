import {quat, vec3, type vec4} from 'gl-matrix';
import {type Frustum} from './frustum';
import {IntersectionResult, type IBoundingVolume} from './bounding_volume';
import {pointPlaneSignedDistance} from '../util';

export class OrientedBoundingBox implements IBoundingVolume {
    axisX: vec3; // Scaled according to the OBB's half-length in the given axis.
    axisY: vec3;
    axisZ: vec3;
    center: vec3;
    // Precomputed AABB for rejecting frustum intersection.
    // This AABB does not need to bound this oriented bounding box (it may be smaller),
    // but it *must* accurately bound the actual shape this OBB is approximating.
    min: vec3;
    max: vec3;

    points: vec3[];

    /**
     * Creates an oriented bounding box equivalent to the specified AABB.
     * @param min - The AABB's min point.
     * @param max - The AABB's max point.
     */
    public static fromAabb(min: vec3, max: vec3): OrientedBoundingBox {
        const obb = new OrientedBoundingBox();
        obb.min = min;
        obb.max = max;
        obb.center = vec3.scale([] as any, vec3.add([] as any, min, max), 0.5);
        const halfSize = vec3.sub([] as any, max, obb.center);
        obb.axisX = [halfSize[0], 0, 0];
        obb.axisY = [0, halfSize[1], 0];
        obb.axisZ = [0, 0, halfSize[2]];
        obb.precomputePoints();
        return obb;
    }

    /**
     * Creates an oriented bounding box from the specified center, half-size and rotation angles.
     * @param center - Center of the OBB.
     * @param halfSize - The half-size of the OBB in each axis. The box will extend by this value in each direction for the given axis.
     * @param angles - The rotation of the box. Euler angles, in degrees.
     */
    public static fromCenterSizeAngles(center: vec3, halfSize: vec3, angles: vec3): OrientedBoundingBox {
        const q = quat.fromEuler([] as any, angles[0], angles[1], angles[2]);
        const axisX = vec3.transformQuat([] as any, [halfSize[0], 0, 0], q);
        const axisY = vec3.transformQuat([] as any, [0, halfSize[1], 0], q);
        const axisZ = vec3.transformQuat([] as any, [0, 0, halfSize[2]], q);
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
        const obb = new OrientedBoundingBox();
        obb.center = [...center] as vec3;
        obb.axisX = axisX;
        obb.axisY = axisY;
        obb.axisZ = axisZ;
        obb.min = min;
        obb.max = max;
        obb.precomputePoints();
        return obb;
    }

    public precomputePoints(): void {
        this.points = [];
        for (let i = 0; i < 8; i++) {
            const p = [...this.center] as vec3;
            vec3.add(p, p, vec3.scale([] as any, this.axisX, ((i >> 0) & 1) === 1 ? 1 : -1));
            vec3.add(p, p, vec3.scale([] as any, this.axisY, ((i >> 1) & 1) === 1 ? 1 : -1));
            vec3.add(p, p, vec3.scale([] as any, this.axisZ, ((i >> 2) & 1) === 1 ? 1 : -1));
            this.points.push(p);
        }
    }

    /**
     * Performs an approximate frustum-obb intersection test.
     */
    intersectsFrustum(frustum: Frustum): IntersectionResult {
        let fullyInside = true;

        for (let p = 0; p < frustum.planes.length; p++) {
            const planeIntersection = this.intersectsPlane(frustum.planes[p]);

            if (planeIntersection === IntersectionResult.None) {
                return IntersectionResult.None;
            }
            if (planeIntersection === IntersectionResult.Partial) {
                fullyInside = false;
            }
        }

        if (fullyInside) {
            return IntersectionResult.Full;
        }

        // Frustum rejection using an AABB.
        if (frustum.aabb.min[0] > this.max[0] || frustum.aabb.min[1] > this.max[1] || frustum.aabb.min[2] > this.max[2] ||
            frustum.aabb.max[0] < this.min[0] || frustum.aabb.max[1] < this.min[1] || frustum.aabb.max[2] < this.min[2]) {
            return IntersectionResult.None;
        }

        return IntersectionResult.Partial;
    }

    /**
     * Performs a halfspace-obb intersection test.
     */
    intersectsPlane(plane: vec4): IntersectionResult {
        let positivePoints = 0;
        for (let i = 0; i < 8; i++) {
            const dist = pointPlaneSignedDistance(plane, this.points[i]);
            if (dist >= 0) {
                positivePoints++;
            }
        }

        if (positivePoints === 8) {
            return IntersectionResult.Full;
        }
        if (positivePoints === 0) {
            return IntersectionResult.None;
        }
        return IntersectionResult.Partial;
    }
}
