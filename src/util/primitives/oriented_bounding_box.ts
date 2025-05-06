import {vec3, type vec4} from 'gl-matrix';
import {type Frustum} from './frustum';
import {IntersectionResult, type IBoundingVolume} from './bounding_volume';

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

    public static fromAabb(min: vec3, max: vec3): OrientedBoundingBox {
        const obb = new OrientedBoundingBox();
        obb.min = min;
        obb.max = max;
        obb.center = vec3.scale([] as any, vec3.add([] as any, min, max), 0.5);
        const halfSize = vec3.sub([] as any, max, obb.center);
        obb.axisX = [halfSize[0], 0, 0];
        obb.axisY = [0, halfSize[1], 0];
        obb.axisZ = [0, 0, halfSize[2]];
        return obb;
    }

    /**
     * Performs a frustum-obb intersection test.
     */
    intersectsFrustum(frustum: Frustum): IntersectionResult {
        // Execute separating axis test between two convex objects to find intersections
        // Each frustum plane together with 3 major axes define the separating axes
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
        const dotX = this.axisX[0] * plane[0] + this.axisX[1] * plane[1] + this.axisX[2] * plane[2];
        const dotY = this.axisY[0] * plane[0] + this.axisY[1] * plane[1] + this.axisY[2] * plane[2];
        const dotZ = this.axisZ[0] * plane[0] + this.axisZ[1] * plane[1] + this.axisZ[2] * plane[2];
        const distanceToCenter = this.center[0] * plane[0] + this.center[1] * plane[1] + this.center[2] * plane[2] + plane[3];
        const diffX = Math.abs(dotX);
        const diffY = Math.abs(dotY);
        const diffZ = Math.abs(dotZ);
        const totalDiff = diffX + diffY + diffZ;
        const distMax = distanceToCenter + totalDiff;
        const distMin = distanceToCenter - totalDiff;

        if (distMin >= 0) {
            return IntersectionResult.Full;
        }
        if (distMax < 0) {
            return IntersectionResult.None;
        }
        return IntersectionResult.Partial;
    }
}
