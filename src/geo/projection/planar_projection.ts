import {LngLat} from '../lng_lat.ts';
import {MercatorCoordinate} from '../mercator_coordinate.ts';
import {MercatorProjection} from './mercator_projection.ts';
import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {WorldCoordinateHelper} from '../transform_interface.ts';

/**
 * Describes a planar coordinate reference system (CRS) together with the square, power-of-two
 * quad tile grid laid over it, so a map can render tiles that were pre-projected in that CRS.
 * Register a definition with {@link addProjection} and select it with `map.setProjection({type: name})`
 * or the style's `projection.type`.
 *
 * Tiles are used as-is: the map never reprojects tile content, it only positions the CRS's own
 * tile grid on screen and maps lng/lat to and from it through `project`/`unproject`. CRS units are
 * taken as meters wherever the map converts meters: altitudes, elevations, and the camera distance.
 *
 * @group Geography and Geometry
 */
export type CrsDefinition = {
    /**
     * Name used in `projection.type`, e.g. `'EPSG:2193'`.
     * `'simple'` is pre-registered; `'mercator'`, `'globe'` and `'vertical-perspective'` are reserved.
     */
    name: string;
    /**
     * lng/lat (degrees) to CRS coordinates (e.g. meters easting/northing).
     */
    project(lng: number, lat: number): [number, number];
    /**
     * CRS coordinates to `[lng, lat]`.
     */
    unproject(x: number, y: number): [number, number];
    /**
     * The quad tile matrix set over the CRS plane.
     */
    tileMatrix: {
        /**
         * CRS coordinates of the top-left corner of tile 0/0/0 (min x, max y).
         */
        origin: [number, number];
        /**
         * Width (= height) of tile 0/0/0 in CRS units.
         */
        extentAtZoom0: number;
    };
};

/**
 * @internal
 * The world coordinate mapping for a CRS definition: world x/y are the CRS coordinates relative
 * to the tile matrix origin, scaled so tile 0/0/0 is the 0..1 square, with y growing down.
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
        this._originX = definition.tileMatrix.origin[0];
        this._originY = definition.tileMatrix.origin[1];
        this._extent = definition.tileMatrix.extentAtZoom0;
    }

    worldFromLngLat(lng: number, lat: number, altitude?: number): MercatorCoordinate {
        const [crsX, crsY] = this._definition.project(lng, lat);
        return new MercatorCoordinate((crsX - this._originX) / this._extent, (this._originY - crsY) / this._extent, altitude === undefined ? 0 : altitude / this._extent);
    }
    lngLatFromWorld(x: number, y: number): LngLat {
        const [lng, lat] = this._definition.unproject(this._originX + x * this._extent, this._originY - y * this._extent);
        return new LngLat(lng, lat);
    }
    metersPerWorldUnit(_x: number, _y: number): number {
        return this._extent;
    }
    worldZFromAltitude(altitude: number, _lngLat: LngLat): number {
        return altitude / this._extent;
    }
}

/**
 * @internal
 * The identity CRS behind the built-in `'simple'` projection: CRS coordinates are lng/lat degrees and
 * tile 0/0/0 spans -90..90 on both axes. It exists for image-space maps (the analogue of Leaflet's
 * `CRS.Simple`), where a square root tile keeps the quad tree uniform in both directions.
 */
export const simpleCrs: CrsDefinition = {
    name: 'simple',
    project(lng: number, lat: number): [number, number] {
        return [lng, lat];
    },
    unproject(x: number, y: number): [number, number] {
        return [x, y];
    },
    tileMatrix: {
        origin: [-90, 90],
        extentAtZoom0: 180,
    },
};

/**
 * @internal
 * A flat projection over a registered planar CRS. Rendering is identical to mercator, since the
 * tiles are already in the CRS's own quad grid and only the lng/lat mapping differs; that mapping
 * is built by {@link CrsWorldCoordinateHelper} and lives on the transform. Shares the mercator
 * shader variant so programs are cached once for every planar projection.
 */
export class PlanarProjection extends MercatorProjection {
    private readonly _name: string;

    constructor(definition: CrsDefinition) {
        super();
        this._name = definition.name;
    }

    override get name(): ProjectionSpecification['type'] {
        return this._name;
    }
}
