import {LngLat} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {clamp} from '../../util/util.ts';

import type {WorldCoordinateHelper} from '../transform_interface.ts';
import type {TileMatrixSet} from './tile_matrix_set.ts';

/**
 * @experimental
 * Describes a planar coordinate reference system (CRS) together with the square, power-of-two
 * quad tile grid laid over it, so a map can render tiles that were pre-projected in that CRS.
 * Register one with {@link addProjection} and select it with the style's `projection.type`
 * or `map.setProjection({type: name})`.
 *
 * Tiles are used as-is: the map never reprojects tile content, it only positions the CRS's own
 * tile grid on screen and maps lng/lat to and from it through `projection`. CRS units are
 * taken as meters wherever the map converts meters: altitudes, elevations, and the camera distance.
 */
export type CRS = {
    /**
     * Name used in `projection.type`, e.g. `'EPSG:2193'` or `'custom:floor-plan'`. It must contain a colon: names
     * without one, like `'mercator'`, `'globe'`, `'vertical-perspective'` and the pre-registered `'identity'`, are
     * reserved for built-in projections.
     */
    name: string;
    /**
     * Converts between lng/lat (degrees) and CRS coordinates (e.g. meters easting/northing): `forward([lng, lat])`
     * returns `[x, y]` and `inverse([x, y])` returns `[lng, lat]`. This is the shape of a proj4 converter such as
     * `proj4('EPSG:4326', 'EPSG:2193')`, which deck.gl's custom projection view takes as well.
     * Outside the tile matrix set `inverse` may have no answer, `null` or a value that is not finite, and the map
     * then uses the nearest position inside it; inside the tile matrix set it must answer.
     */
    projection: {
        forward(position: number[]): number[];
        inverse(position: number[]): number[] | null;
    };
    /**
     * The quad tile matrix set over the CRS plane.
     */
    tileMatrixSet: TileMatrixSet;
    /**
     * The CRS as a string the workers' projection handler accepts, such as WKT or a PROJ string.
     * GeoJSON sources need it: their data is parsed and tiled in the workers, where `projection` cannot go,
     * so a handler set there builds the same converter from this string, see the custom CRS guide.
     * Without it, GeoJSON sources warn and draw in the wrong place.
     */
    definition?: string;
};

/**
 * @internal
 * The world coordinate mapping for a CRS: world x/y are the CRS coordinates relative
 * to the tile matrix set origin, scaled so tile 0/0/0 is the 0..1 square, with y growing down.
 * One world unit is the zoom 0 extent, so meters per world unit is constant across the plane.
 */
export class CRSWorldCoordinateHelper implements WorldCoordinateHelper {
    private readonly _crs: CRS;
    private readonly _originX: number;
    private readonly _originY: number;
    private readonly _extent: number;
    private _latitudeRange: [number, number] | undefined;
    /** A CRS is a bounded plane: no world copies, no wrapping, and no latitude clamp. */
    readonly wraps = false;

    constructor(crs: CRS) {
        this._crs = crs;
        this._originX = crs.tileMatrixSet.origin[0];
        this._originY = crs.tileMatrixSet.origin[1];
        this._extent = crs.tileMatrixSet.extentAtZoom0;
    }

    get name(): string {
        return this._crs.name;
    }
    get tileMatrixSet(): TileMatrixSet {
        return this._crs.tileMatrixSet;
    }
    worldFromLngLat(lng: number, lat: number, altitude?: number): MercatorCoordinate {
        const [crsX, crsY] = this._crs.projection.forward([lng, lat]);
        return new MercatorCoordinate((crsX - this._originX) / this._extent, (this._originY - crsY) / this._extent, altitude === undefined ? 0 : altitude / this._extent);
    }
    /**
     * World square coordinates to lng/lat. The CRS's inverse is relied on only inside the tile matrix set:
     * a position outside it (the far edge of a pitched view, a drag past the edge, the buffer of a tile at the
     * square's edge) may have no answer, and then the nearest position inside the world square is used instead.
     * A latitude past the poles is clamped to the range {@link LngLat} accepts, so the mapping is total the way
     * the mercator inverse is.
     */
    lngLatFromWorld(x: number, y: number): LngLat {
        const position = this._inverse(x, y) ?? this._inverse(clamp(x, 0, 1), clamp(y, 0, 1));
        if (!position) {
            throw new Error(`The inverse of the projection "${this._crs.name}" has no answer inside its tile matrix set.`);
        }
        return new LngLat(position[0], clamp(position[1], -90, 90));
    }
    /**
     * The CRS's inverse at a world position, or `null` where it has no answer: `null`, or a value that
     * is not finite, as proj4 gives far outside some projections.
     */
    private _inverse(x: number, y: number): number[] | null {
        const position = this._crs.projection.inverse([this._originX + x * this._extent, this._originY - y * this._extent]);
        return position && Number.isFinite(position[0]) && Number.isFinite(position[1]) ? position : null;
    }
    metersPerWorldUnit(_x: number, _y: number): number {
        return this._extent;
    }
    worldZFromAltitude(altitude: number, _lngLat: LngLat): number {
        return altitude / this._extent;
    }
    /**
     * The latitudes, `[south, north]`, of the positions the projection puts within one world width of the world
     * square. GeoJSON sources move the positions past them onto them before projecting, so that what lies further
     * out, like the opposite pole of a polar projection, which projects to infinity, never reaches the map.
     * `[-90, 90]` when the inverse has no answer that far out, or an answer that does not map back.
     */
    get latitudeRange(): [number, number] {
        this._latitudeRange ??= this._findLatitudeRange();
        return this._latitudeRange;
    }
    /**
     * Walks the edge of the world square grown by one world width on each side, world -1 to 2 on both axes, taking
     * the lowest and highest latitude the inverse gives there; a pole the projection puts inside it widens the
     * range to that pole.
     */
    private _findLatitudeRange(): [number, number] {
        const stepsPerSide = 64;
        let south = 90;
        let north = -90;
        for (let step = 0; step <= stepsPerSide; step++) {
            const along = -1 + 3 * step / stepsPerSide;
            for (const [x, y] of [[along, -1], [along, 2], [-1, along], [2, along]]) {
                const position = this._inverse(x, y);
                const back = position && this.worldFromLngLat(position[0], position[1]);
                if (!back || Math.hypot(back.x - x, back.y - y) > 1e-6) return [-90, 90];
                south = Math.min(south, position[1]);
                north = Math.max(north, position[1]);
            }
        }
        if (this._isNearWorldSquare(-90)) south = -90;
        if (this._isNearWorldSquare(90)) north = 90;
        return [south, north];
    }
    /**
     * Whether the projection puts the pole at `latitude` within one world width of the world square.
     */
    private _isNearWorldSquare(latitude: number): boolean {
        const {x, y} = this.worldFromLngLat(0, latitude);
        return x >= -1 && x <= 2 && y >= -1 && y <= 2;
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
class IdentityCRS implements CRS {
    readonly name = 'identity';
    readonly projection = new IdentityConversion();
    readonly tileMatrixSet: TileMatrixSet = {origin: [-90, 90], extentAtZoom0: 180};
}

/**
 * @internal
 * The one identity CRS: it holds no state, so the registry and every test share this instance.
 */
export const identityCrs: CRS = new IdentityCRS();
