import type {IBoundingVolume} from '../../util/primitives/bounding_volume.ts';
import type {LngLat} from '../lng_lat.ts';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {CoveringTilesOptionsInternal} from './covering_tiles.ts';
import type {ProjectedCamera} from '../../camera/projected_camera.ts';

/**
 * @internal
 * How tiles are selected in a projection, see `getCoveringTilesDetailsProvider` in
 * `covering_tiles_details_provider_factory.ts`.
 */
export interface CoveringTilesDetailsProvider {
    /**
     * Returns the center that the tiles are selected around.
     */
    getCenter: (projectedCamera: ProjectedCamera) => LngLat;

    /**
     * Returns the distance from the point to the tile
     * @param pointX - point x.
     * @param pointY - point y.
     * @param tileID - Tile x, y and z for zoom.
     * @param boundingVolume - tile bounding volume
     */
    distanceToTile2d: (pointX: number, pointY: number, tileID: {x: number; y: number; z: number}, boundingVolume: IBoundingVolume) => number;

    /**
     * Returns the wrap value for a given tile.
     */
    getWrap: (centerCoord: MercatorCoordinate, tileID: {x:number; y: number; z: number}, parentWrap: number) => number;

    /**
     * Returns the bounding volume of the specified tile.
     * @param tileID - Tile x, y and z for zoom.
     * @param wrap - wrap number of the tile.
     * @param elevation - camera center point elevation.
     * @param options - CoveringTilesOptions.
     */
    getTileBoundingVolume: (tileID: {x: number; y: number; z: number}, wrap: number, elevation: number, options: CoveringTilesOptionsInternal) => IBoundingVolume;

    /**
     * Whether to allow variable zoom, which is used at high pitch angle to avoid loading an excessive amount of tiles.
     */
    allowVariableZoom: (projectedCamera: ProjectedCamera, options: CoveringTilesOptionsInternal) => boolean;

    /**
     * Whether to allow world copies to be rendered.
     */
    allowWorldCopies: () => boolean;
}
