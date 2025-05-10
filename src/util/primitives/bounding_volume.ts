import {type vec4} from 'gl-matrix';
import {type Frustum} from './frustum';

export const enum IntersectionResult {
    None = 0,
    Partial = 1,
    Full = 2,
}

export interface IBoundingVolume {
    /**
     * Performs an intersection test with a frustum.
     */
    intersectsFrustum(frustum: Frustum): IntersectionResult;

    /**
     * Performs an intersection test with a half-space defined by a plane equation.
     * The half-space is assumed to lie on the positive side of the plane.
     */
    intersectsPlane(plane: vec4): IntersectionResult;
}
