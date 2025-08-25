import {OverscaledTileID} from '../../source/tile_id';
import {Aabb} from '../../util/primitives/aabb';
import {clamp} from '../../util/util';
import {type MercatorCoordinate} from '../mercator_coordinate';
import {type IReadonlyTransform} from '../transform_interface';
import {type CoveringTilesOptionsInternal} from './covering_tiles';
import {type CoveringTilesDetailsProvider} from './covering_tiles_details_provider';

export class MercatorCoveringTilesDetailsProvider implements CoveringTilesDetailsProvider {

    distanceToTile2d(pointX: number, pointY: number, _tileID: {x: number; y: number; z: number}, aabb: Aabb): number {
        const distanceX = aabb.distanceX([pointX, pointY]);
        const distanceY = aabb.distanceY([pointX, pointY]);
        return Math.hypot(distanceX, distanceY);
    }

    /**
     * Returns the wrap value for a given tile, computed so that tiles will remain loaded when crossing the antimeridian.
     */
    getWrap(centerCoord: MercatorCoordinate, tileID: {x:number; y: number; z: number}, parentWrap: number): number {
        return parentWrap;
    }

    /**
     * Returns the AABB of the specified tile.
     * @param tileID - Tile x, y and z for zoom.
     */
    getTileBoundingVolume(tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal): Aabb {
        let minElevation = 0;
        let maxElevation = 0;
        if (options?.terrain) {
            const overscaledTileID = new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y);
            const minMax = options.terrain.getMinMaxElevation(overscaledTileID);
            minElevation = minMax.minElevation ?? Math.min(0, elevation);
            maxElevation = minMax.maxElevation ?? Math.max(0, elevation);
        }
        const numTiles = 1 << tileID.z;
        return new Aabb([wrap + tileID.x / numTiles, tileID.y / numTiles, minElevation],
            [wrap + (tileID.x + 1) / numTiles, (tileID.y + 1) / numTiles, maxElevation]);
    }
    
    allowVariableZoom(transform: IReadonlyTransform, options: CoveringTilesOptionsInternal): boolean {
        const zfov = transform.fov * (Math.abs(Math.cos(transform.rollInRadians)) * transform.height + Math.abs(Math.sin(transform.rollInRadians)) * transform.width) / transform.height;
        const maxConstantZoomPitch = clamp(78.5 - zfov / 2, 0.0, 60.0);
        return (!!options.terrain || transform.pitch > maxConstantZoomPitch);
    }

    allowWorldCopies(): boolean {
        return true;
    }

    prepareNextFrame(): void { 
        // Do nothing
    }
}