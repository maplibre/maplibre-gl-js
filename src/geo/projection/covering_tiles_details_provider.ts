import {type Aabb} from '../../util/primitives/aabb';
import {type MercatorCoordinate} from '../mercator_coordinate';
import {type IReadonlyTransform} from '../transform_interface';
import {type CoveringTilesOptions} from './covering_tiles';

export interface CoveringTilesDetailsProvider {
    /**
     * Returns the distance from the point to the tile
     * @param pointX - point x.
     * @param pointY - point y.
     * @param tileID - Tile x, y and z for zoom.
     * @param aabb - tile AABB
     */
    distanceToTile2d: (pointX: number, pointY: number, tileID: {x: number; y: number; z: number}, aabb: Aabb) => number;

    /**
     * Returns the wrap value for a given tile.
     */
    getWrap: (centerCoord: MercatorCoordinate, tileID: {x:number; y: number; z: number}, parentWrap: number) => number;

    /**
     * Returns the AABB of the specified tile.
     * @param tileID - Tile x, y and z for zoom.
     * @param wrap - wrap number of the tile.
     * @param elevation - camera center point elevation.
     * @param options - CoveringTilesOptions.
     */
    getTileAABB: (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptions) => Aabb;

    /**
     * Whether to allow variable zoom, which is used at high pitch angle to avoid loading an excessive amount of tiles.
     */
    allowVariableZoom: (transform: IReadonlyTransform, options: CoveringTilesOptions) => boolean;

    /**
     * Whether to allow world copies to be rendered.
     */
    allowWorldCopies: () => boolean;

    /**
     * Prepare cache for the next frame.
     */
    recalculateCache(): void;
}
