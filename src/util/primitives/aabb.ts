import {vec3, type vec4} from 'gl-matrix';
import {type Frustum} from './frustum';

export const enum IntersectionResult {
    None = 0,
    Partial = 1,
    Full = 2,
}

export class Aabb {
    min: vec3;
    max: vec3;
    center: vec3;

    constructor(min_: vec3, max_: vec3) {
        this.min = min_;
        this.max = max_;
        this.center = vec3.scale([] as any, vec3.add([] as any, this.min, this.max), 0.5);
    }

    quadrant(index: number): Aabb {
        const split = [(index % 2) === 0, index < 2];
        const qMin = vec3.clone(this.min);
        const qMax = vec3.clone(this.max);
        for (let axis = 0; axis < split.length; axis++) {
            qMin[axis] = split[axis] ? this.min[axis] : this.center[axis];
            qMax[axis] = split[axis] ? this.center[axis] : this.max[axis];
        }
        // Elevation is always constant, hence quadrant.max.z = this.max.z
        qMax[2] = this.max[2];
        return new Aabb(qMin, qMax);
    }

    distanceX(point: Array<number>): number {
        const pointOnAabb = Math.max(Math.min(this.max[0], point[0]), this.min[0]);
        return pointOnAabb - point[0];
    }

    distanceY(point: Array<number>): number {
        const pointOnAabb = Math.max(Math.min(this.max[1], point[1]), this.min[1]);
        return pointOnAabb - point[1];
    }

    /**
     * Performs a frustum-aabb intersection test.
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

        if (frustum.aabb.min[0] > this.max[0] || frustum.aabb.min[1] > this.max[1] || frustum.aabb.min[2] > this.max[2] ||
            frustum.aabb.max[0] < this.min[0] || frustum.aabb.max[1] < this.min[1] || frustum.aabb.max[2] < this.min[2]) {
            return IntersectionResult.None;
        }

        return IntersectionResult.Partial;
    }

    /**
     * Performs a halfspace-aabb intersection test.
     */
    intersectsPlane(plane: vec4): IntersectionResult {
        let distMin = plane[3];
        let distMax = plane[3];
        for (let i = 0; i < 3; i++) {
            if (plane[i] > 0) {
                distMin += plane[i] * this.min[i];
                distMax += plane[i] * this.max[i];
            } else {
                distMax += plane[i] * this.min[i];
                distMin += plane[i] * this.max[i];
            }
        }

        if (distMin >= 0) {
            return IntersectionResult.Full;
        }
        if (distMax < 0) {
            return IntersectionResult.None;
        }
        return IntersectionResult.Partial;
    }
}
