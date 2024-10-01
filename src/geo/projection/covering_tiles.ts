import {OverscaledTileID} from '../../source/tile_id';
import {Aabb, Frustum, IntersectionResult} from '../../util/primitives';
import {vec4} from 'gl-matrix';

export type CoveringTilesResult = {
    tileID: OverscaledTileID;
    distanceSq: number;
    tileDistanceToCamera: number;
};

export type CoveringTilesStackEntry = {
    zoom: number;
    x: number;
    y: number;
    wrap: number;
    fullyVisible: boolean;
};

/**
 * A simple/heuristic function that returns whether the tile is visible under the current transform.
 * @returns 0 is not visible, 1 if partially visible, 2 if fully visible.
 */
export function isTileVisible(frustum: Frustum, plane: vec4, aabb: Aabb): IntersectionResult {

    const frustumTest = aabb.intersectsFrustum(frustum);
    if (!plane) {
        return frustumTest;
    }
    const planeTest = aabb.intersectsPlane(plane);

    if (frustumTest === IntersectionResult.None || planeTest === IntersectionResult.None) {
        return IntersectionResult.None;
    }

    if (frustumTest === IntersectionResult.Full && planeTest === IntersectionResult.Full) {
        return IntersectionResult.Full;
    }

    return IntersectionResult.Partial;
}