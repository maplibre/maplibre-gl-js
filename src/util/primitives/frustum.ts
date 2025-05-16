import {type mat4, vec3, vec4} from 'gl-matrix';
import {Aabb} from './aabb';
import {rayPlaneIntersection} from '../util';

export class Frustum {

    constructor(public points: vec4[], public planes: vec4[], public aabb: Aabb) { }

    public static fromInvProjectionMatrix(invProj: mat4, worldSize: number = 1, zoom: number = 0, plane?: vec4): Frustum {
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

        const scale = Math.pow(2, zoom);

        // Transform frustum corner points from clip space to tile space, Z to meters
        const frustumCoords = clipSpaceCorners.map(v => {
            v = vec4.transformMat4([] as any, v as any, invProj) as any;
            const s = 1.0 / v[3] / worldSize * scale;
            return vec4.mul(v as any, v as any, [s, s, 1.0 / v[3], s] as vec4);
        });

        if (plane) {
            // A horizon clipping plane was supplied.
            // For each of the 4 edges from near to far plane,
            // we find at which distance these edges intersect the given clipping plane,
            // select the maximal value from these distances and then we move
            // the frustum's far plane so that it is at most as far away from the near plane
            // as this maximal distance.
            let maxDist = 0;
            const lengths: number[] = [];
            const dirs: vec3[] = [];
            for (let i = 0; i < 4; i++) {
                const dir = vec3.sub([] as any, frustumCoords[i] as vec3, frustumCoords[i + 4] as vec3);
                const len = vec3.length(dir);
                vec3.scale(dir, dir, 1.0 / len);
                lengths.push(len);
                dirs.push(dir);
            }

            for (let i = 0; i < 4; i++) {
                const dist = rayPlaneIntersection(frustumCoords[i + 4] as vec3, dirs[i], plane);
                maxDist = Math.max(maxDist, dist);
            }

            for (let i = 0; i < 4; i++) {
                const targetLength = Math.min(maxDist, lengths[i]);
                const newPoint = [
                    frustumCoords[i + 4][0] + dirs[i][0] * targetLength,
                    frustumCoords[i + 4][1] + dirs[i][1] * targetLength,
                    frustumCoords[i + 4][2] + dirs[i][2] * targetLength,
                    1,
                ] as vec4;
                frustumCoords[i] = newPoint;
            }
        }

        const frustumPlanePointIndices = [
            [0, 1, 2],  // near
            [6, 5, 4],  // far
            [0, 3, 7],  // left
            [2, 1, 5],  // right
            [3, 2, 6],  // bottom
            [0, 4, 5]   // top
        ];

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
