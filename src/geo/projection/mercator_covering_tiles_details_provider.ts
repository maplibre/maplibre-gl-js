import {OverscaledTileID} from '../../tile/tile_id.ts';
import {Aabb} from '../../util/primitives/aabb.ts';
import {clamp} from '../../util/util.ts';

import type {LngLat} from '../lng_lat.ts';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {CoveringTilesOptionsInternal} from './covering_tiles.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';
import type {IBoundingVolume} from '../../util/primitives/bounding_volume.ts';
import type {ProjectedCamera} from '../projected_camera.ts';

export class MercatorCoveringTilesDetailsProvider implements CoveringTilesDetailsProvider {

    getCenter(projectedCamera: ProjectedCamera): LngLat {
        return projectedCamera.center;
    }

    distanceToTile2d(pointX: number, pointY: number, _tileID: {x: number; y: number; z: number}, boundingVolume: IBoundingVolume): number {
        const aabb = boundingVolume as Aabb;
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
        let minElevation = Math.min(0, elevation);
        let maxElevation = Math.max(0, elevation);
        if (options?.terrain) {
            const overscaledTileID = new OverscaledTileID(tileID.z, wrap, tileID.z, tileID.x, tileID.y);
            const minMax = options.terrain.getMinMaxElevation(overscaledTileID);
            minElevation = minMax.minElevation ?? minElevation;
            maxElevation = minMax.maxElevation ?? maxElevation;
        }
        const numTiles = 1 << tileID.z;
        return new Aabb([wrap + tileID.x / numTiles, tileID.y / numTiles, minElevation],
            [wrap + (tileID.x + 1) / numTiles, (tileID.y + 1) / numTiles, maxElevation]);
    }
    
    allowVariableZoom(projectedCamera: ProjectedCamera, options: CoveringTilesOptionsInternal): boolean {
        const zfov = projectedCamera.fov * (Math.abs(Math.cos(projectedCamera.rollInRadians)) * projectedCamera.height + Math.abs(Math.sin(projectedCamera.rollInRadians)) * projectedCamera.width) / projectedCamera.height;
        const maxConstantZoomPitch = clamp(78.5 - zfov / 2, 0.0, 60.0);
        return (!!options.terrain || projectedCamera.pitch > maxConstantZoomPitch);
    }

    allowWorldCopies(): boolean {
        return true;
    }
}