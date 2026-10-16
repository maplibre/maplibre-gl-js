import {LngLatBounds, type LngLatBoundsLike} from '../geo/lng_lat_bounds.ts';
import {lngLatBoxToWorldBox} from '../geo/projection/mercator_utils.ts';

import type {WorldCoordinateHelper} from '../geo/transform_interface.ts';
import type {CanonicalTileID} from './tile_id.ts';

export class TileBounds {
    bounds: LngLatBounds;
    minzoom: number;
    maxzoom: number;
    /** `bounds` in the world square of the map's projection, projected once since the bounds never change. */
    private _worldBox: {minX: number; minY: number; maxX: number; maxY: number};

    constructor(bounds: [number, number, number, number], minzoom: number | null | undefined, maxzoom: number | null | undefined, worldCoordinateHelper: WorldCoordinateHelper) {
        this.bounds = LngLatBounds.convert(this.validateBounds(bounds));
        this.minzoom = minzoom || 0;
        this.maxzoom = maxzoom || 24;
        this._worldBox = lngLatBoxToWorldBox(worldCoordinateHelper, this.bounds.getWest(), this.bounds.getSouth(), this.bounds.getEast(), this.bounds.getNorth());
    }

    validateBounds(bounds: [number, number, number, number]): LngLatBoundsLike {
        // make sure the bounds property contains valid longitude and latitudes
        if (!Array.isArray(bounds) || bounds.length !== 4) return [-180, -90, 180, 90];
        return [Math.max(-180, bounds[0]), Math.max(-90, bounds[1]), Math.min(180, bounds[2]), Math.min(90, bounds[3])];
    }

    contains(tileID: CanonicalTileID): boolean {
        const worldSize = Math.pow(2, tileID.z);
        const level = {
            minX: Math.floor(this._worldBox.minX * worldSize),
            minY: Math.floor(this._worldBox.minY * worldSize),
            maxX: Math.ceil(this._worldBox.maxX * worldSize),
            maxY: Math.ceil(this._worldBox.maxY * worldSize)
        };
        return tileID.x >= level.minX && tileID.x < level.maxX && tileID.y >= level.minY && tileID.y < level.maxY;
    }
}
