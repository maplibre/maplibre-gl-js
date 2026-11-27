import {isBoundaryEdge} from '../extent_bounds.ts';
import {TransferableGridIndex} from '../../util/transferable_grid_index.ts';

import type Point from '@mapbox/point-geometry';

/**
 * The most corners that can cut into one triangle of a fill. Each takes its own set of vertex
 * attributes, so a triangle that more corners reach keeps the nearest and leaves the rest sharp.
 */
export const MAX_CORNERS_PER_TRIANGLE = 3;

/**
 * The share of each adjacent edge that a rounded corner may take up, which keeps the arcs at the two
 * ends of an edge from overlapping.
 */
const MAX_EDGE_FRACTION = 0.5;

/**
 * Sine of the smallest turn, 5 degrees, that is still rounded. A ring that runs on almost straight, or
 * doubles back almost onto itself, has no arc that fits the corner.
 */
const MIN_TURN_SINE = Math.sin(5 * Math.PI / 180);

/**
 * A vertex of a polygon that `fill-rounded-corner-distance` rounds, with the two vertices around it
 * that set the shape of its arc.
 */
export type FillCorner = {
    /** The vertex being rounded. */
    point: Point;
    /** The vertex before it in its ring. */
    prev: Point;
    /** The vertex after it in its ring. */
    next: Point;
    /**
     * Whether the polygon's interior lies inside the angle at the corner. Rounding a convex corner cuts
     * area away from the triangles of the fill; rounding a concave one adds area outside the polygon,
     * which needs a triangle of its own.
     */
    convex: boolean;
    /**
     * How far from `point` along each edge the arc can start, at any distance: half the shorter of the
     * two edges.
     */
    maxCutDistance: number;
};

/**
 * Returns the corners of a polygon that rounding applies to.
 *
 * A corner is left sharp where either of its edges lies on a tile clip line, because the neighbouring
 * tile cuts the same feature elsewhere and the two halves would no longer meet; and where the ring turns
 * by too little or too much for an arc to fit. Repeated vertices, including a closing vertex, are
 * ignored, so a corner's neighbours are always distinct points.
 * @param polygon - The exterior ring followed by its holes, as `classifyRings` groups them
 */
export function findRoundableCorners(polygon: Point[][]): FillCorner[] {
    const corners: FillCorner[] = [];
    for (let r = 0; r < polygon.length; r++) {
        addRingCorners(corners, polygon[r], r > 0);
    }
    return corners;
}

/**
 * Appends the roundable corners of one ring. Whether a corner is convex is judged against the polygon,
 * not the ring: the interior of a hole is outside the polygon, so a hole's corners turn the other way.
 * Comparing each turn with the ring's own winding makes this hold whichever way the source wound it.
 * @param corners - Corners found so far, the ring's are appended to it
 * @param ring - The ring, closed or open
 * @param isHole - Whether the ring is a hole in the polygon rather than its exterior
 */
function addRingCorners(corners: FillCorner[], ring: Point[], isHole: boolean): void {
    const vertices = distinctVertices(ring);
    const count = vertices.length;
    if (count < 3) return;

    const area = signedArea(vertices);
    if (area === 0) return;
    const interiorTurn = isHole ? -Math.sign(area) : Math.sign(area);

    for (let i = 0; i < count; i++) {
        const prev = vertices[(i + count - 1) % count];
        const point = vertices[i];
        const next = vertices[(i + 1) % count];
        if (isBoundaryEdge(prev, point) || isBoundaryEdge(point, next)) continue;

        const incoming = point.sub(prev);
        const outgoing = next.sub(point);
        const incomingLength = incoming.mag();
        const outgoingLength = outgoing.mag();
        const turn = incoming.x * outgoing.y - incoming.y * outgoing.x;
        if (Math.abs(turn) < MIN_TURN_SINE * incomingLength * outgoingLength) continue;

        corners.push({
            point,
            prev,
            next,
            convex: Math.sign(turn) === interiorTurn,
            maxCutDistance: MAX_EDGE_FRACTION * Math.min(incomingLength, outgoingLength)
        });
    }
}

/**
 * Returns the vertices of a ring with consecutive repeats removed, and without the closing vertex.
 * @param ring - The ring, closed or open
 */
function distinctVertices(ring: Point[]): Point[] {
    const vertices: Point[] = [];
    for (const point of ring) {
        if (vertices.length > 0 && vertices[vertices.length - 1].equals(point)) continue;
        vertices.push(point);
    }
    while (vertices.length > 1 && vertices[0].equals(vertices[vertices.length - 1])) {
        vertices.pop();
    }
    return vertices;
}

/**
 * Returns twice the signed area of an open ring. Its sign gives the direction the ring winds in.
 * @param vertices - The ring, without its closing vertex
 */
function signedArea(vertices: Point[]): number {
    let sum = 0;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        sum += vertices[j].x * vertices[i].y - vertices[i].x * vertices[j].y;
    }
    return sum;
}

/**
 * Returns, for each triangle of a fill's mesh, the convex corners whose arc can cut into it.
 *
 * A corner can reach a triangle that does not share its vertex: an earcut diagonal can pass close to a
 * corner it does not end at, and the grid that subdivision lays over a polygon on the globe cuts every
 * corner's surroundings into many small triangles. The area an arc can ever cut away lies within the
 * triangle spanned by the corner and the two points `maxCutDistance` along its edges, so a corner is
 * assigned to every triangle that overlaps that one, whatever distance the style later asks for.
 *
 * Concave corners are never assigned: their arcs add area outside the polygon rather than cutting into
 * the mesh.
 * @param corners - The polygon's corners, as {@link findRoundableCorners} returns them
 * @param vertices - The mesh's vertices, flattened as x, y pairs
 * @param triangleIndices - Indices into `vertices`, three per triangle
 * @returns {@link MAX_CORNERS_PER_TRIANGLE} indices into `corners` for each triangle, in the order of
 * the triangles, with -1 filling the slots a triangle does not use. When more corners reach a triangle,
 * the ones nearest its centroid are kept.
 */
export function cornersReachingTriangles(corners: FillCorner[], vertices: number[], triangleIndices: number[]): Int32Array {
    const triangleCount = triangleIndices.length / 3;
    const result = new Int32Array(triangleCount * MAX_CORNERS_PER_TRIANGLE).fill(-1);

    const cuts = corners.map(corner => corner.convex ? cutRegion(corner) : null);
    const index = indexCutRegions(cuts);
    if (!index) return result;

    const triangle: number[] = new Array(6);
    for (let t = 0; t < triangleCount; t++) {
        for (let k = 0; k < 3; k++) {
            const v = triangleIndices[t * 3 + k];
            triangle[k * 2] = vertices[v * 2];
            triangle[k * 2 + 1] = vertices[v * 2 + 1];
        }

        const [minX, minY, maxX, maxY] = triangleBounds(triangle);
        const reaching = index.grid
            .query(minX - index.originX, minY - index.originY, maxX - index.originX, maxY - index.originY)
            .filter(c => trianglesOverlap(triangle, cuts[c]));

        if (reaching.length > MAX_CORNERS_PER_TRIANGLE) {
            const centroidX = (triangle[0] + triangle[2] + triangle[4]) / 3;
            const centroidY = (triangle[1] + triangle[3] + triangle[5]) / 3;
            const distanceToCentroid = (c: number) => (corners[c].point.x - centroidX) ** 2 + (corners[c].point.y - centroidY) ** 2;
            reaching.sort((a, b) => distanceToCentroid(a) - distanceToCentroid(b));
        }

        const used = Math.min(reaching.length, MAX_CORNERS_PER_TRIANGLE);
        for (let s = 0; s < used; s++) {
            result[t * MAX_CORNERS_PER_TRIANGLE + s] = reaching[s];
        }
    }
    return result;
}

/**
 * The triangles that draw a polygon with rounded corners. No vertex is shared between them, because the
 * corners a triangle is rounded by are attributes of its own three vertices.
 */
export type RoundedFillTriangles = {
    /** Three vertices per triangle, flattened as x, y pairs. */
    vertices: number[];
    /**
     * {@link MAX_CORNERS_PER_TRIANGLE} indices into the polygon's corners for each triangle, with -1
     * filling the slots a triangle does not use.
     */
    corners: Int32Array;
    /**
     * Whether each triangle lies outside the polygon and draws only the area its concave corner's arc
     * adds, rather than drawing everything except what the arcs cut away.
     */
    addsArea: boolean[];
};

/**
 * Returns the triangles that draw a polygon with rounded corners: every triangle of its mesh, rounded
 * by the convex corners that reach it, followed by a triangle for each concave corner. That triangle
 * spans the corner and its two neighbours, so its edges lie exactly on the polygon's own and the arc
 * area it adds meets the mesh without a seam.
 * @param corners - The polygon's corners, as {@link findRoundableCorners} returns them
 * @param vertices - The mesh's vertices, flattened as x, y pairs
 * @param triangleIndices - Indices into `vertices`, three per triangle
 */
export function roundedFillTriangles(corners: FillCorner[], vertices: number[], triangleIndices: number[]): RoundedFillTriangles {
    const meshCorners = cornersReachingTriangles(corners, vertices, triangleIndices);
    const concave = corners.map((_, c) => c).filter(c => !corners[c].convex);
    const meshTriangleCount = triangleIndices.length / 3;

    const result: RoundedFillTriangles = {
        vertices: new Array((meshTriangleCount + concave.length) * 6),
        corners: new Int32Array((meshTriangleCount + concave.length) * MAX_CORNERS_PER_TRIANGLE).fill(-1),
        addsArea: new Array(meshTriangleCount + concave.length).fill(false)
    };

    for (let i = 0; i < triangleIndices.length; i++) {
        result.vertices[i * 2] = vertices[triangleIndices[i] * 2];
        result.vertices[i * 2 + 1] = vertices[triangleIndices[i] * 2 + 1];
    }
    result.corners.set(meshCorners);

    for (let k = 0; k < concave.length; k++) {
        const t = meshTriangleCount + k;
        const [first, second, third] = windLikeMesh(corners[concave[k]]);
        result.vertices[t * 6] = first.x;
        result.vertices[t * 6 + 1] = first.y;
        result.vertices[t * 6 + 2] = second.x;
        result.vertices[t * 6 + 3] = second.y;
        result.vertices[t * 6 + 4] = third.x;
        result.vertices[t * 6 + 5] = third.y;
        result.corners[t * MAX_CORNERS_PER_TRIANGLE] = concave[k];
        result.addsArea[t] = true;
    }
    return result;
}

/**
 * Returns a corner and its neighbours in the winding order that `subdividePolygon` gives every triangle
 * of a fill's mesh, which the fill draws with back faces culled.
 * @param corner - The corner whose triangle is wound
 */
function windLikeMesh({prev, point, next}: FillCorner): [Point, Point, Point] {
    const cross = (point.x - prev.x) * (next.y - prev.y) - (point.y - prev.y) * (next.x - prev.x);
    return cross > 0 ? [next, point, prev] : [prev, point, next];
}

/**
 * Returns the triangle, flattened as x, y pairs, that holds every area the corner's arc can cut away.
 * @param corner - A convex corner
 */
function cutRegion(corner: FillCorner): number[] {
    const {point, prev, next, maxCutDistance} = corner;
    const towardsPrev = prev.sub(point)._unit()._mult(maxCutDistance)._add(point);
    const towardsNext = next.sub(point)._unit()._mult(maxCutDistance)._add(point);
    return [point.x, point.y, towardsPrev.x, towardsPrev.y, towardsNext.x, towardsNext.y];
}

/**
 * A grid over the bounds of a polygon's cut regions, keyed by the index of each region's corner. The
 * grid only covers positive coordinates, so everything put into or looked up in it is shifted by the
 * origin first.
 */
type CutRegionIndex = {
    grid: TransferableGridIndex;
    originX: number;
    originY: number;
};

/**
 * Indexes the bounds of the cut regions, or returns `null` when there are none.
 * @param cuts - A cut region for each corner, `null` for corners that do not cut into the mesh
 */
function indexCutRegions(cuts: Array<number[] | null>): CutRegionIndex | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;
    for (const cut of cuts) {
        if (!cut) continue;
        const bounds = triangleBounds(cut);
        minX = Math.min(minX, bounds[0]);
        minY = Math.min(minY, bounds[1]);
        maxX = Math.max(maxX, bounds[2]);
        maxY = Math.max(maxY, bounds[3]);
        count++;
    }
    if (count === 0) return null;

    const extent = Math.max(maxX - minX, maxY - minY, 1);
    const cellsPerSide = Math.min(64, Math.ceil(Math.sqrt(count)));
    const grid = new TransferableGridIndex(extent, cellsPerSide, 0);
    for (let c = 0; c < cuts.length; c++) {
        if (!cuts[c]) continue;
        const bounds = triangleBounds(cuts[c]);
        grid.insert(c, bounds[0] - minX, bounds[1] - minY, bounds[2] - minX, bounds[3] - minY);
    }
    return {grid, originX: minX, originY: minY};
}

/**
 * Returns the bounds of a triangle as `[minX, minY, maxX, maxY]`.
 * @param triangle - The triangle, flattened as x, y pairs
 */
function triangleBounds(triangle: number[]): [number, number, number, number] {
    return [
        Math.min(triangle[0], triangle[2], triangle[4]),
        Math.min(triangle[1], triangle[3], triangle[5]),
        Math.max(triangle[0], triangle[2], triangle[4]),
        Math.max(triangle[1], triangle[3], triangle[5])
    ];
}

/**
 * Whether two triangles share some area. Triangles that only touch along an edge or at a vertex do not.
 * @param a - A triangle, flattened as x, y pairs
 * @param b - Another triangle, flattened the same way
 */
function trianglesOverlap(a: number[], b: number[]): boolean {
    return !hasSeparatingEdge(a, b) && !hasSeparatingEdge(b, a);
}

/**
 * Whether the line through one of the edges of `a` has all of `a` on one side and all of `b` on the
 * other, which by the separating axis theorem means the two do not overlap.
 * @param a - The triangle whose edges are tried
 * @param b - The other triangle
 */
function hasSeparatingEdge(a: number[], b: number[]): boolean {
    for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        const normalX = a[j * 2 + 1] - a[i * 2 + 1];
        const normalY = a[i * 2] - a[j * 2];

        let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
        for (let k = 0; k < 3; k++) {
            const projectedA = normalX * a[k * 2] + normalY * a[k * 2 + 1];
            const projectedB = normalX * b[k * 2] + normalY * b[k * 2 + 1];
            minA = Math.min(minA, projectedA);
            maxA = Math.max(maxA, projectedA);
            minB = Math.min(minB, projectedB);
            maxB = Math.max(maxB, projectedB);
        }
        if (maxA <= minB || maxB <= minA) return true;
    }
    return false;
}
