import {EXTENT} from '../../data/extent';
import {projectTileCoordinatesToSphere} from './globe_utils';
import {BoundingVolumeCache} from '../../util/primitives/bounding_volume_cache';
import {coveringZoomLevel, type CoveringTilesOptions} from './covering_tiles';
import type {vec3} from 'gl-matrix';
import type {IReadonlyTransform} from '../transform_interface';
import type {MercatorCoordinate} from '../mercator_coordinate';
import type {CoveringTilesDetailsProviderImplementation} from './covering_tiles_details_provider';
import {OrientedBoundingBox} from '../../util/primitives/oriented_bounding_box';

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

export class GlobeCoveringTilesDetailsProvider implements CoveringTilesDetailsProviderImplementation<OrientedBoundingBox> {
    private _boundingVolumeCache: BoundingVolumeCache<OrientedBoundingBox> = new BoundingVolumeCache(this._computeTileOBB);

    /**
     * Prepares the internal AABB cache for the next frame.
     */
    recalculateCache() {
        this._boundingVolumeCache.recalculateCache();
    }

    /**
     * Returns the distance of a point to a square tile. If the point is inside the tile, returns 0.
     * Assumes the world to be of size 1.
     * Handles distances on a sphere correctly: X is wrapped when crossing the antimeridian,
     * when crossing the poles Y is mirrored and X is shifted by half world size.
     */
    distanceToTile2d(pointX: number, pointY: number, tileID: {x: number; y: number; z: number}, _aabb: OrientedBoundingBox): number {
        const scale = 1 << tileID.z;
        const tileMercatorSize = 1.0 / scale;
        const tileCornerX = tileID.x / scale; // In range 0..1
        const tileCornerY = tileID.y / scale; // In range 0..1

        const worldSize = 1.0;
        const halfWorld = 0.5 * worldSize;
        let smallestDistance = 2.0 * worldSize;
        // Original tile
        smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX, tileCornerY, tileMercatorSize));
        // Up
        smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX + halfWorld, -tileCornerY - tileMercatorSize, tileMercatorSize));
        // Down
        smallestDistance = Math.min(smallestDistance, distanceToTileWrapX(pointX, pointY, tileCornerX + halfWorld, worldSize + worldSize - tileCornerY - tileMercatorSize, tileMercatorSize));

        return smallestDistance;
    }

    /**
     * Returns the wrap value for a given tile, computed so that tiles will remain loaded when crossing the antimeridian.
     */
    getWrap(centerCoord: MercatorCoordinate, tileID: {x: number; y: number; z: number}, _parentWrap: number): number {
        const scale = 1 << tileID.z;
        const tileMercatorSize = 1.0 / scale;
        const tileX = tileID.x / scale; // In range 0..1
        const distanceCurrent = distanceToTileSimple(centerCoord.x, tileX, tileMercatorSize);
        const distanceLeft = distanceToTileSimple(centerCoord.x, tileX - 1.0, tileMercatorSize);
        const distanceRight = distanceToTileSimple(centerCoord.x, tileX + 1.0, tileMercatorSize);
        const distanceSmallest = Math.min(distanceCurrent, distanceLeft, distanceRight);
        if (distanceSmallest === distanceRight) {
            return 1;
        }
        if (distanceSmallest === distanceLeft) {
            return -1;
        }
        return 0;
    }
    
    allowVariableZoom(transform: IReadonlyTransform, options: CoveringTilesOptions): boolean {
        return coveringZoomLevel(transform, options) > 4;
    }

    allowWorldCopies(): boolean {
        return false;
    }

    getTileBoundingVolume(tileID: { x: number; y: number; z: number }, wrap: number, elevation: number, options: CoveringTilesOptions) {
        return this._boundingVolumeCache.getTileBoundingVolume(tileID, wrap, elevation, options);
    }

    private _computeTileOBB(tileID: {x: number; y: number; z: number}, _wrap: number, _elevation: number, _options: CoveringTilesOptions): OrientedBoundingBox {
        // Just returns AABBs for now.
        if (tileID.z <= 0) {
            // Tile covers the entire sphere.
            return OrientedBoundingBox.fromAabb(
                [-1, -1, -1],
                [1, 1, 1]
            );
        } else if (tileID.z === 1) {
            // Tile covers a quarter of the sphere.
            // X is 1 at lng=E90°
            // Y is 1 at **north** pole
            // Z is 1 at null island
            return OrientedBoundingBox.fromAabb(
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

            return OrientedBoundingBox.fromAabb(
                min,
                max
            );
        }
    }
}