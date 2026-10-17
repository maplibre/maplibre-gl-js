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
 * Every tile source of the map is taken to be cut in `tileMatrixSet`, and the tiles are used as they are,
 * without reprojecting their content. The map positions that grid on screen and maps lng/lat to and from it
 * through `projection`. CRS units are taken as meters wherever the map converts meters: altitudes, elevations,
 * and the camera distance.
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
 * How many times as much as at the center of its tile matrix set a projection may stretch distances along the meridian
 * before GeoJSON sources stop placing data there, see {@link CRSWorldCoordinateHelper.latitudeRange}.
 */
const MAX_MERIDIAN_STRETCH = 10;

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
     * The latitudes, `[south, north]`, from the center of the tile matrix set toward each pole, up to which the
     * projection stretches distances along the meridian less than {@link MAX_MERIDIAN_STRETCH} times as much as at the
     * center. GeoJSON sources move the positions past them onto them before projecting, so that what the projection
     * cannot place, like the opposite pole of a polar projection, which projects to infinity, never reaches the map.
     * `[-90, 90]` for a projection that stretches neither pole that much, like transverse mercator.
     */
    get latitudeRange(): [number, number] {
        this._latitudeRange ??= [this._findLatitudeLimit(-90), this._findLatitudeLimit(90)];
        return this._latitudeRange;
    }
    /**
     * Walks the meridian through the center of the tile matrix set toward the pole at `pole`, a degree at a time, and
     * returns the last latitude before the projection stretches distances along it more than
     * {@link MAX_MERIDIAN_STRETCH} times as much as at the center, or the pole when it never does.
     */
    private _findLatitudeLimit(pole: number): number {
        const center = this.lngLatFromWorld(0.5, 0.5);
        const maxStretch = MAX_MERIDIAN_STRETCH * this._meridianStretch(center.lng, center.lat);
        if (!(maxStretch > 0)) return pole;
        const step = Math.sign(pole - center.lat);
        for (let lat = center.lat; Math.abs(pole - lat) > 1; lat += step) {
            if (!(this._meridianStretch(center.lng, lat + step) <= maxStretch)) return lat;
        }
        return pole;
    }
    /**
     * The distance the projection puts between the position at `lng`, `lat` and the one a hundredth of a degree from
     * it toward the equator, in CRS units.
     */
    private _meridianStretch(lng: number, lat: number): number {
        const [x, y] = this._crs.projection.forward([lng, lat]);
        const [towardEquatorX, towardEquatorY] = this._crs.projection.forward([lng, lat >= 0 ? lat - 0.01 : lat + 0.01]);
        return Math.hypot(towardEquatorX - x, towardEquatorY - y);
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
