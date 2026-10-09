import {LngLat} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {clamp} from '../../util/util.ts';

import type {WorldCoordinateHelper} from '../transform_interface.ts';
import type {TileMatrixSet} from './tile_matrix_set.ts';

/**
 * @experimental
 * Describes a planar coordinate reference system (CRS) together with the square, power-of-two
 * quad tile grid laid over it, so a map can render tiles that were pre-projected in that CRS.
 * Register a definition with {@link addProjection} and select it with the style's `projection.type`
 * or `map.setProjection({type: name})`.
 *
 * Tiles are used as-is: the map never reprojects tile content, it only positions the CRS's own
 * tile grid on screen and maps lng/lat to and from it through `projection`. CRS units are
 * taken as meters wherever the map converts meters: altitudes, elevations, and the camera distance.
 */
export type CrsDefinition = {
    /**
     * Name used in `projection.type`, e.g. `'EPSG:2193'`.
     * `'identity'` is pre-registered; `'mercator'`, `'globe'` and `'vertical-perspective'` are reserved.
     */
    name: string;
    /**
     * Converts between lng/lat (degrees) and CRS coordinates (e.g. meters easting/northing): `forward([lng, lat])`
     * returns `[x, y]` and `inverse([x, y])` returns `[lng, lat]`. This is the shape of a proj4 converter such as
     * `proj4('EPSG:4326', 'EPSG:2193')`, which deck.gl's custom projection view takes as well.
     */
    projection: {
        forward(position: number[]): number[];
        inverse(position: number[]): number[];
    };
    /**
     * The quad tile matrix set over the CRS plane.
     */
    tileMatrixSet: TileMatrixSet;
};

/**
 * @internal
 * The world coordinate mapping for a CRS definition: world x/y are the CRS coordinates relative
 * to the tile matrix set origin, scaled so tile 0/0/0 is the 0..1 square, with y growing down.
 * One world unit is the zoom 0 extent, so meters per world unit is constant across the plane.
 */
export class CrsWorldCoordinateHelper implements WorldCoordinateHelper {
    private readonly _definition: CrsDefinition;
    private readonly _originX: number;
    private readonly _originY: number;
    private readonly _extent: number;
    /** A CRS is a bounded plane: no world copies, no wrapping, and no latitude clamp. */
    readonly wraps = false;

    constructor(definition: CrsDefinition) {
        this._definition = definition;
        this._originX = definition.tileMatrixSet.origin[0];
        this._originY = definition.tileMatrixSet.origin[1];
        this._extent = definition.tileMatrixSet.extentAtZoom0;
    }

    get name(): string {
        return this._definition.name;
    }
    get tileMatrixSet(): TileMatrixSet {
        return this._definition.tileMatrixSet;
    }
    worldFromLngLat(lng: number, lat: number, altitude?: number): MercatorCoordinate {
        const [crsX, crsY] = this._definition.projection.forward([lng, lat]);
        return new MercatorCoordinate((crsX - this._originX) / this._extent, (this._originY - crsY) / this._extent, altitude === undefined ? 0 : altitude / this._extent);
    }
    /**
     * World square coordinates to lng/lat. The definition's inverse has a finite domain, and a position
     * outside the world square (the far edge of a pitched view, the buffer of a tile at the square's edge) can
     * come back with a latitude past the poles; it is clamped to the range {@link LngLat} accepts, so the
     * mapping is total the way the mercator inverse is.
     */
    lngLatFromWorld(x: number, y: number): LngLat {
        const [lng, lat] = this._definition.projection.inverse([this._originX + x * this._extent, this._originY - y * this._extent]);
        return new LngLat(lng, clamp(lat, -90, 90));
    }
    metersPerWorldUnit(_x: number, _y: number): number {
        return this._extent;
    }
    worldZFromAltitude(altitude: number, _lngLat: LngLat): number {
        return altitude / this._extent;
    }
}

/**
 * The identity conversion of the built-in `'identity'` projection, whose CRS coordinates are lng/lat degrees.
 */
class IdentityConversion {
    forward(position: number[]): number[] {
        return [position[0], position[1]];
    }

    inverse(position: number[]): number[] {
        return [position[0], position[1]];
    }
}

/**
 * The CRS behind the built-in `'identity'` projection: CRS coordinates are lng/lat degrees unchanged and
 * tile 0/0/0 spans -90..90 on both axes. It exists for image-space maps, where a square root tile keeps
 * the quad tree uniform in both directions; image coordinates are scaled into -90..90.
 */
class IdentityCrs implements CrsDefinition {
    readonly name = 'identity';
    readonly projection = new IdentityConversion();
    readonly tileMatrixSet: TileMatrixSet = {origin: [-90, 90], extentAtZoom0: 180};
}

/**
 * @internal
 * The one identity CRS: it holds no state, so the registry and every test share this instance.
 */
export const identityCrs: CrsDefinition = new IdentityCrs();
