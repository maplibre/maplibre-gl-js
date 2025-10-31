import {EXTENT} from '../../data/extent';
import {projectTileCoordinatesToSphere} from './globe_utils';
import {BoundingVolumeCache} from '../../util/primitives/bounding_volume_cache';
import {coveringZoomLevel, type CoveringTilesOptionsInternal} from './covering_tiles';
import {vec3, type vec4} from 'gl-matrix';
import type {IReadonlyTransform} from '../transform_interface';
import type {MercatorCoordinate} from '../mercator_coordinate';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider';
import {OverscaledTileID} from '../../tile/tile_id';
import {earthRadius} from '../lng_lat';
import {ConvexVolume} from '../../util/primitives/convex_volume';
import {threePlaneIntersection} from '../../util/util';

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

export class GlobeCoveringTilesDetailsProvider implements CoveringTilesDetailsProvider {
    private _boundingVolumeCache: BoundingVolumeCache<ConvexVolume> = new BoundingVolumeCache(this._computeTileBoundingVolume);

    /**
     * Prepares the internal bounding volume cache for the next frame.
     */
    prepareNextFrame() {
        this._boundingVolumeCache.swapBuffers();
    }

    /**
     * Returns the distance of a point to a square tile. If the point is inside the tile, returns 0.
     * Assumes the world to be of size 1.
     * Handles distances on a sphere correctly: X is wrapped when crossing the antimeridian,
     * when crossing the poles Y is mirrored and X is shifted by half world size.
     */
    distanceToTile2d(pointX: number, pointY: number, tileID: {x: number; y: number; z: number}, _bv: ConvexVolume): number {
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
    
    allowVariableZoom(transform: IReadonlyTransform, options: CoveringTilesOptionsInternal): boolean {
        return coveringZoomLevel(transform, options) > 4;
    }

    allowWorldCopies(): boolean {
        return false;
    }

    getTileBoundingVolume(tileID: { x: number; y: number; z: number }, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) {
        return this._boundingVolumeCache.getTileBoundingVolume(tileID, wrap, elevation, options);
    }

    private _computeTileBoundingVolume(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): ConvexVolume {
        let minElevation = 0;
        let maxElevation = 0;
        if (options?.terrain) {
            const overscaledTileID = new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y);
            const minMax = options.terrain.getMinMaxElevation(overscaledTileID);
            minElevation = minMax.minElevation ?? Math.min(0, elevation);
            maxElevation = minMax.maxElevation ?? Math.max(0, elevation);
        }
        // Convert elevation to distances from center of a unit sphere planet (so that 1 is surface)
        minElevation /= earthRadius;
        maxElevation /= earthRadius;
        minElevation += 1;
        maxElevation += 1;

        if (tileID.z <= 0) {
            // Tile covers the entire sphere.
            return ConvexVolume.fromAabb( // We return an AABB in this case.
                [-maxElevation, -maxElevation, -maxElevation],
                [maxElevation, maxElevation, maxElevation]
            );
        } else if (tileID.z === 1) {
            // Tile covers a quarter of the sphere.
            // X is 1 at lng=E90°
            // Y is 1 at **north** pole
            // Z is 1 at null island
            return ConvexVolume.fromAabb( // We also just use AABBs for this zoom level.
                [tileID.x === 0 ? -maxElevation : 0, tileID.y === 0 ? 0 : -maxElevation, -maxElevation],
                [tileID.x === 0 ? 0 : maxElevation, tileID.y === 0 ? maxElevation : 0, maxElevation]
            );
        } else {
            const corners = [
                projectTileCoordinatesToSphere(0, 0, tileID.x, tileID.y, tileID.z),
                projectTileCoordinatesToSphere(EXTENT, 0, tileID.x, tileID.y, tileID.z),
                projectTileCoordinatesToSphere(EXTENT, EXTENT, tileID.x, tileID.y, tileID.z),
                projectTileCoordinatesToSphere(0, EXTENT, tileID.x, tileID.y, tileID.z),
            ];

            const extremesPoints = [];

            for (const c of corners) {
                extremesPoints.push(vec3.scale([] as any, c, maxElevation));
            }

            if (maxElevation !== minElevation) {
                // Only add additional points if terrain is enabled and is not flat.
                for (const c of corners) {
                    extremesPoints.push(vec3.scale([] as any, c, minElevation));
                }
            }

            // Special handling of poles - we need to extend the tile AABB
            // to include the pole for tiles that border mercator north/south edge.
            if (tileID.y === 0) {
                extremesPoints.push([0, 1, 0]); // North pole
            }
            if (tileID.y === (1 << tileID.z) - 1) {
                extremesPoints.push([0, -1, 0]); // South pole
            }

            // Compute a best-fit AABB for the frustum rejection test
            const aabbMin: vec3 = [1, 1, 1];
            const aabbMax: vec3 = [-1, -1, -1];

            for (const c of extremesPoints) {
                for (let i = 0; i < 3; i++) {
                    aabbMin[i] = Math.min(aabbMin[i], c[i]);
                    aabbMax[i] = Math.max(aabbMax[i], c[i]);
                }
            }

            // Now we compute the actual bounding volume.
            // The up/down plane will be normal to the tile's center.
            // The north/south plane will be used for the tile's north and south edge and will be orthogonal to the up/down plane.
            // The left and right planes will be determined by the tile's east/west edges and will differ slightly - we are not creating a box!
            // We will find the min and max extents for the up/down and north/south planes using the set of points
            // where the extremes are likely to lie.

            // Vector "center" (from planet center to tile center) will be our up/down axis.
            const center = projectTileCoordinatesToSphere(EXTENT / 2, EXTENT / 2, tileID.x, tileID.y, tileID.z);
            // Vector to the east of "center".
            const centerEast = vec3.cross([] as any, [0, 1, 0], center);
            vec3.normalize(centerEast, centerEast);
            // Vector to the north of "center" will be our north/south axis.
            const north = vec3.cross([] as any, center, centerEast);
            vec3.normalize(north, north);

            // Axes for the east and west edge of our bounding volume.
            // These axes are NOT opposites of each other, they differ!
            // They are also not orthogonal to the up/down and north/south axes.
            const axisEast = vec3.cross([] as any, corners[2], corners[1]);
            vec3.normalize(axisEast, axisEast);
            const axisWest = vec3.cross([] as any, corners[0], corners[3]);
            vec3.normalize(axisWest, axisWest);

            // Now we will expand the extremes point set for bounding volume creation.
            // We will also include the tile center point, since it will always be an extreme for the "center" axis.
            extremesPoints.push(vec3.scale([] as any, center, maxElevation));
            // No need to include a minElevation-scaled center, since we already have minElevation corners in the set and these will always lie lower than the center.

            // The extremes might also lie on the midpoint of the north or south edge.
            // For tiles in the north hemisphere, only the south edge can contain an extreme,
            // since when we imagine the tile's actual shape projected onto the plane normal to "center" vector,
            // the tile's north edge will curve towards the tile center, thus its extremes are accounted for by the
            // corners, however the south edge will curve away from the center point, extending beyond the tile's edges,
            // thus it must be included.
            // The poles are an exception - they must always be included in the extremes, if the tile touches the north/south mercator range edge.
            //
            // A tile's exaggerated shape on the northern hemisphere, projected onto the normal plane of "center".
            // The "c" is the tile's center point. The "m" is the edge mid point we are looking for.
            //
            //      /--       --\
            //     /   -------   \
            //    /               \
            //   /        c        \
            //  /                   \
            // /--                 --\
            //    -----       -----
            //         ---m---
            
            if (tileID.y >= (1 << tileID.z) / 2) {
                // South hemisphere - include the tile's north edge midpoint
                extremesPoints.push(vec3.scale([] as any, projectTileCoordinatesToSphere(EXTENT / 2, 0, tileID.x, tileID.y, tileID.z), maxElevation));
                // No need to include minElevation variant of this point, for the same reason why we don't include minElevation center.
            }
            if (tileID.y < (1 << tileID.z) / 2) {
                // North hemisphere - include the tile's south edge midpoint
                extremesPoints.push(vec3.scale([] as any, projectTileCoordinatesToSphere(EXTENT / 2, EXTENT, tileID.x, tileID.y, tileID.z), maxElevation));
                // No need to include minElevation variant of this point, for the same reason why we don't include minElevation center.
            }

            // Find the min and max extends and the midpoints along each axis,
            // using the set of extreme points.
            const upDownMinMax = findAxisMinMax(center, extremesPoints);
            const northSouthMinMax = findAxisMinMax(north, extremesPoints);

            const planeUp = [-center[0], -center[1], -center[2], upDownMinMax.max] as vec4;
            const planeDown = [center[0], center[1], center[2], -upDownMinMax.min] as vec4;
            const planeNorth = [-north[0], -north[1], -north[2], northSouthMinMax.max] as vec4;
            const planeSouth = [north[0], north[1], north[2], -northSouthMinMax.min] as vec4;
            const planeEast = [...axisEast, 0] as vec4;
            const planeWest = [...axisWest, 0] as vec4;

            const points: vec3[] = [];

            // North points
            if (tileID.y === 0) {
                // If the tile borders a pole, then 
                points.push(
                    threePlaneIntersection(planeWest, planeEast, planeUp),
                    threePlaneIntersection(planeWest, planeEast, planeDown),
                );
            } else {
                points.push(
                    threePlaneIntersection(planeNorth, planeEast, planeUp),
                    threePlaneIntersection(planeNorth, planeEast, planeDown),
                    threePlaneIntersection(planeNorth, planeWest, planeUp),
                    threePlaneIntersection(planeNorth, planeWest, planeDown)
                );
            }

            // South points
            if (tileID.y === (1 << tileID.z) - 1) {
                points.push(
                    threePlaneIntersection(planeWest, planeEast, planeUp),
                    threePlaneIntersection(planeWest, planeEast, planeDown),
                );
            } else {
                points.push(
                    threePlaneIntersection(planeSouth, planeEast, planeUp),
                    threePlaneIntersection(planeSouth, planeEast, planeDown),
                    threePlaneIntersection(planeSouth, planeWest, planeUp),
                    threePlaneIntersection(planeSouth, planeWest, planeDown)
                );
            }

            return new ConvexVolume(points, [
                planeUp,
                planeDown,
                planeNorth,
                planeSouth,
                planeEast,
                planeWest
            ], aabbMin, aabbMax);
        }
    }
}

function findAxisMinMax(axis: vec3, points: vec3[]) {
    let min = +Infinity;
    let max = -Infinity;
    for (const c of points) {
        const dot = vec3.dot(axis, c);
        min = Math.min(min, dot);
        max = Math.max(max, dot);
    }
    return {
        min,
        max
    };
}