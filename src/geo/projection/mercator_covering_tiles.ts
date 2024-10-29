import {vec4} from 'gl-matrix';
import {OverscaledTileID} from '../../source/tile_id';
import {Aabb, Frustum} from '../../util/primitives';
import {MercatorCoordinate} from '../mercator_coordinate';
import {IReadonlyTransform} from '../transform_interface';
import {coveringTiles, CoveringTilesDetails, CoveringTilesOptions} from './covering_tiles';

function distanceToTile2d(pointX: number, pointY: number, tileID: {x: number; y: number; z: number}, aabb: Aabb): number {
    const distanceX = aabb.distanceX([pointX, pointY]);
    const distanceY = aabb.distanceY([pointX, pointY]);
    return Math.hypot(distanceX, distanceY);
}

// Returns the wrap value for a given tile, computed so that tiles will remain loaded when crossing the antimeridian.
function getWrap(centerCoord: MercatorCoordinate, tileID: {x:number; y: number; z: number}, parentWrap: number): number {
    return parentWrap;
}

/**
 * Returns the AABB of the specified tile.
 * @param tileID - Tile x, y and z for zoom.
 */
export function getTileAABB(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptions): Aabb {
    let minElevation = elevation;
    let maxElevation = elevation;
    if (options.terrain) {
        const overscaledTileID = new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y);
        const minMax = options.terrain.getMinMaxElevation(overscaledTileID);
        minElevation = minMax.minElevation ?? elevation;
        maxElevation = minMax.maxElevation ?? elevation;
    }
    const numTiles = 1 << tileID.z;
    return new Aabb([wrap + tileID.x / numTiles, tileID.y / numTiles, minElevation],
        [wrap + (tileID.x + 1) / numTiles, (tileID.y + 1) / numTiles, maxElevation]);
}

/**
 * Returns a list of tiles that optimally covers the screen.
 * Correctly handles LOD when moving over the antimeridian.
 * @param transform - The mercator transform instance.
 * @param options - Additional coveringTiles options.
 * @returns A list of tile coordinates, ordered by ascending distance from camera.
 */
export function mercatorCoveringTiles(transform: IReadonlyTransform, frustum: Frustum, plane: vec4, cameraCoord: MercatorCoordinate, centerCoord: MercatorCoordinate, options: CoveringTilesOptions): Array<OverscaledTileID> {
    // No change of LOD behavior for pitch lower than 60 and when there is no top padding: return only tile ids from the requested zoom level
    // Use 0.1 as an epsilon to avoid for explicit == 0.0 floating point checks
    const allowVariableZoom = !!options.terrain || transform.pitch > 60.0 || transform.padding.top >= 0.1;
    const details: CoveringTilesDetails = {
        distanceToTile2d,
        getWrap,
        getTileAABB,
        allowVariableZoom
    };
    return coveringTiles(transform, frustum, plane, cameraCoord, centerCoord, options, details);
}
