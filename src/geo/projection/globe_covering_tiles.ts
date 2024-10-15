import {vec2, vec3, vec4} from 'gl-matrix';
import {Aabb, Frustum, IntersectionResult} from '../../util/primitives';
import {CoveringTilesOptions} from '../transform_interface';
import {OverscaledTileID} from '../../source/tile_id';
import {MercatorCoordinate} from '../mercator_coordinate';
import {EXTENT} from '../../data/extent';
import {projectTileCoordinatesToSphere} from './globe_utils';

type CoveringTilesResult = {
    tileID: OverscaledTileID;
    distanceSq: number;
    tileDistanceToCamera: number;
};

type CoveringTilesStackEntry = {
    x: number;
    y: number;
    zoom: number;
    fullyVisible: boolean;
};

/**
 * Computes distance of a point to a tile in an arbitrary axis.
 * World is assumed to have size 1, distance returned is to the nearer tile edge.
 * @param point - Point position.
 * @param tile - Tile position.
 * @param tileSize - Tile size.
 */
function distanceToTileSimple(point: number, tile: number, tileSize: number): number {
    const delta = point - tile;
    return (delta < 0) ? -delta : Math.max(0, delta - tileSize);
}

function distanceToTileWrapX(pointX: number, pointY: number, tileCornerX: number, tileCornerY: number, tileSize: number): number {
    const tileCornerToPointX = pointX - tileCornerX;

    let distanceX: number;
    if (tileCornerToPointX < 0) {
        // Point is left of tile
        distanceX = Math.min(-tileCornerToPointX, 1.0 + tileCornerToPointX - tileSize);
    } else if (tileCornerToPointX > 1) {
        // Point is right of tile
        distanceX = Math.min(Math.max(tileCornerToPointX - tileSize, 0), 1.0 - tileCornerToPointX);
    } else {
        // Point is inside tile in the X axis.
        distanceX = 0;
    }

    return Math.max(distanceX, distanceToTileSimple(pointY, tileCornerY, tileSize));
}

/**
 * Returns the distance of a point to a square tile. If the point is inside the tile, returns 0.
 * Assumes the world to be of size 1.
 * Handles distances on a sphere correctly: X is wrapped when crossing the antimeridian,
 * when crossing the poles Y is mirrored and X is shifted by half world size.
 */
function distanceToTile(pointX: number, pointY: number, tileCornerX: number, tileCornerY: number, tileSize: number): number {
    const worldSize = 1.0;
    const halfWorld = 0.5 * worldSize;
    let smallestDistance = 2.0 * worldSize;
    // Original tile
    smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX, tileCornerY, tileSize));
    // Up
    smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX + halfWorld, -tileCornerY - tileSize, tileSize));
    // Down
    smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX + halfWorld, worldSize + worldSize - tileCornerY - tileSize, tileSize));

    return smallestDistance;
}

function shouldSplitTile(centerCoord: MercatorCoordinate, cameraCoord: MercatorCoordinate, tileX: number, tileY: number, tileSize: number, radiusOfMaxLvlLodInTiles: number): boolean {
    // Determine whether the tile needs any further splitting.
    // At each level, we want at least `radiusOfMaxLvlLodInTiles` tiles loaded in each axis from the map center point.
    // For radiusOfMaxLvlLodInTiles=1, this would result in something like this:
    // z=4 |--------------||--------------||--------------|
    // z=5         |------||------||------|
    // z=6             |--||--||--|
    //                       ^map center
    // ...where "|--|" symbolizes a tile viewed sideways.
    // This logic might be slightly different from what mercator_transform.ts does, but should result in very similar (if not the same) set of tiles being loaded.
    const centerDist = distanceToTile(centerCoord.x, centerCoord.y, tileX, tileY, tileSize);
    const cameraDist = distanceToTile(cameraCoord.x, cameraCoord.y, tileX, tileY, tileSize);
    return Math.min(centerDist, cameraDist) * 2 <= radiusOfMaxLvlLodInTiles * tileSize; // Multiply distance by 2, because the subdivided tiles would be half the size
}

// Returns the wrap value for a given tile, computed so that tiles will remain loaded when crossing the antimeridian.
function getWrap(centerCoord: MercatorCoordinate, tileX: number, tileSize: number): number {
    const distanceCurrent = distanceToTileSimple(centerCoord.x, tileX, tileSize);
    const distanceLeft = distanceToTileSimple(centerCoord.x, tileX - 1.0, tileSize);
    const distanceRight = distanceToTileSimple(centerCoord.x, tileX + 1.0, tileSize);
    const distanceSmallest = Math.min(distanceCurrent, distanceLeft, distanceRight);
    if (distanceSmallest === distanceRight) {
        return 1;
    }
    if (distanceSmallest === distanceLeft) {
        return -1;
    }
    return 0;
}

/**
 * Returns the AABB of the specified tile. The AABB is in the coordinate space where the globe is a unit sphere.
 * @param tileID - Tile x, y and z for zoom.
 */
export function getTileAABB(tileID: {x: number; y: number; z: number}): Aabb {
    // We can get away with only checking the 4 tile corners for AABB construction, because for any tile of zoom level 2 or higher
    // it holds that the extremes (minimal or maximal value) of X, Y or Z coordinates must lie in one of the tile corners.
    //
    // To see why this holds, consider the formula for computing X,Y and Z from angular coordinates.
    // It goes something like this:
    //
    // X = sin(lng) * cos(lat)
    // Y = sin(lat)
    // Z = cos(lng) * cos(lat)
    //
    // Note that a tile always covers a continuous range of lng and lat values,
    // and that tiles that border the mercator north/south edge are assumed to extend all the way to the poles.
    //
    // We will consider each coordinate separately and show that an extreme must always lie in a tile corner for every axis, and must not lie inside the tile.
    //
    // For Y, it is clear that the only way for an extreme to not lie on an edge of the lat range is for the range to contain lat=90° or lat=-90° without either being the tile edge.
    // This cannot happen for any tile, these latitudes will always:
    // - either lie outside the tile entirely, thus Y will be monotonically increasing or decreasing across the entire tile, thus the extreme must lie at a corner/edge
    // - or be the tile edge itself, thus the extreme will lie at the tile edge
    //
    // For X, considering only longitude, the tile would also have to contain lng=90° or lng=-90° (with neither being the tile edge) for the extreme to not lie on a tile edge.
    // This can only happen at zoom levels 0 and 1, which are handled separately.
    // But X is also scaled by cos(lat)! However, this can only cause an extreme to lie inside the tile if the tile crosses lat=0°, which cannot happen for zoom levels other than 0.
    //
    // For Z, similarly to X, the extremes must lie at lng=0° or lng=180°, but for zoom levels other than 0 these cannot lie inside the tile. Scaling by cos(lat) has the same effect as with the X axis.
    //
    // So checking the 4 tile corners only fails for tiles with zoom level <2, and these are handled separately with hardcoded AABBs:
    // - zoom level 0 tile is the entire sphere
    // - zoom level 1 tiles are "quarters of a sphere"

    if (tileID.z <= 0) {
        // Tile covers the entire sphere.
        return new Aabb(
            [-1, -1, -1],
            [1, 1, 1]
        );
    } else if (tileID.z === 1) {
        // Tile covers a quarter of the sphere.
        // X is 1 at lng=E90°
        // Y is 1 at **north** pole
        // Z is 1 at null island
        return new Aabb(
            [tileID.x === 0 ? -1 : 0, tileID.y === 0 ? 0 : -1, -1],
            [tileID.x === 0 ? 0 : 1, tileID.y === 0 ? 1 : 0, 1]
        );
    } else {
        // Compute AABB using the 4 corners.

        const corners = [
            projectTileCoordinatesToSphere(0, 0, tileID.x, tileID.y, tileID.z),
            projectTileCoordinatesToSphere(EXTENT, 0, tileID.x, tileID.y, tileID.z),
            projectTileCoordinatesToSphere(EXTENT, EXTENT, tileID.x, tileID.y, tileID.z),
            projectTileCoordinatesToSphere(0, EXTENT, tileID.x, tileID.y, tileID.z),
        ];

        const min: vec3 = [1, 1, 1];
        const max: vec3 = [-1, -1, -1];

        for (const c of corners) {
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], c[i]);
                max[i] = Math.max(max[i], c[i]);
            }
        }

        // Special handling of poles - we need to extend the tile AABB
        // to include the pole for tiles that border mercator north/south edge.
        if (tileID.y === 0 || (tileID.y === (1 << tileID.z) - 1)) {
            const pole = [0, tileID.y === 0 ? 1 : -1, 0];
            for (let i = 0; i < 3; i++) {
                min[i] = Math.min(min[i], pole[i]);
                max[i] = Math.max(max[i], pole[i]);
            }
        }

        return new Aabb(
            min,
            max
        );
    }
}

/**
 * A simple/heuristic function that returns whether the tile is visible under the current transform.
 * @returns 0 is not visible, 1 if partially visible, 2 if fully visible.
 */
function isTileVisible(frustum: Frustum, plane: vec4, x: number, y: number, z: number): IntersectionResult {
    const tileID = {x, y, z};
    const aabb = getTileAABB(tileID);

    const frustumTest = aabb.intersectsFrustum(frustum);
    const planeTest = aabb.intersectsPlane(plane);

    if (frustumTest === IntersectionResult.None || planeTest === IntersectionResult.None) {
        return IntersectionResult.None;
    }

    if (frustumTest === IntersectionResult.Full && planeTest === IntersectionResult.Full) {
        return IntersectionResult.Full;
    }

    return IntersectionResult.Partial;
}

/**
 * Returns a list of tiles that optimally covers the screen. Adapted for globe projection.
 * Correctly handles LOD when moving over the antimeridian.
 * @param transform - The globe transform instance.
 * @param options - Additional coveringTiles options.
 * @returns A list of tile coordinates, ordered by ascending distance from camera.
 */
export function globeCoveringTiles(frustum: Frustum, plane: vec4, cameraCoord: MercatorCoordinate, centerCoord: MercatorCoordinate, coveringZoom: number, options: CoveringTilesOptions): OverscaledTileID[] {
    let z = coveringZoom;
    const actualZ = z;

    if (options.minzoom !== undefined && z < options.minzoom) {
        return [];
    }
    if (options.maxzoom !== undefined && z > options.maxzoom) {
        z = options.maxzoom;
    }

    const numTiles = Math.pow(2, z);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];

    const radiusOfMaxLvlLodInTiles = 3; // Matches the value in the mercator variant of coveringTiles

    // Do a depth-first traversal to find visible tiles and proper levels of detail
    const stack: Array<CoveringTilesStackEntry> = [];
    const result: Array<CoveringTilesResult> = [];
    const maxZoom = z;
    const overscaledZ = options.reparseOverscaled ? actualZ : z;
    stack.push({
        zoom: 0,
        x: 0,
        y: 0,
        fullyVisible: false
    });

    while (stack.length > 0) {
        const it = stack.pop();
        const x = it.x;
        const y = it.y;
        let fullyVisible = it.fullyVisible;

        // Visibility of a tile is not required if any of its ancestor if fully visible
        if (!fullyVisible) {
            const intersectResult = isTileVisible(frustum, plane, it.x, it.y, it.zoom);

            if (intersectResult === IntersectionResult.None)
                continue;

            fullyVisible = intersectResult === IntersectionResult.Full;
        }

        const scale = 1 << (Math.max(it.zoom, 0));
        const tileSize = 1.0 / scale;
        const tileX = x / scale; // In range 0..1
        const tileY = y / scale; // In range 0..1

        const split = shouldSplitTile(centerCoord, cameraCoord, tileX, tileY, tileSize, radiusOfMaxLvlLodInTiles);

        // Have we reached the target depth or is the tile too far away to be any split further?
        if (it.zoom === maxZoom || !split) {
            const dz = maxZoom - it.zoom;
            const dx = cameraPoint[0] - 0.5 - (x << dz);
            const dy = cameraPoint[1] - 0.5 - (y << dz);
            // We need to compute a valid wrap value for the tile to keep compatibility with mercator
            const wrap = getWrap(centerCoord, tileX, tileSize);
            result.push({
                tileID: new OverscaledTileID(it.zoom === maxZoom ? overscaledZ : it.zoom, wrap, it.zoom, x, y),
                distanceSq: vec2.sqrLen([centerPoint[0] - 0.5 - dx, centerPoint[1] - 0.5 - dy]),
                // this variable is currently not used, but may be important to reduce the amount of loaded tiles
                tileDistanceToCamera: Math.sqrt(dx * dx + dy * dy)
            });
            continue;
        }

        for (let i = 0; i < 4; i++) {
            const childX = (x << 1) + (i % 2);
            const childY = (y << 1) + (i >> 1);
            const childZ = it.zoom + 1;
            stack.push({zoom: childZ, x: childX, y: childY, fullyVisible});
        }
    }

    return result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
}
