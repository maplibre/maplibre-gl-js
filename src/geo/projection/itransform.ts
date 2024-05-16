import {LngLat} from '../lng_lat';
import {LngLatBounds} from '../lng_lat_bounds';
import {MercatorCoordinate} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';

import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../../source/tile_id';
import type {EdgeInsets, PaddingOptions} from '../edge_insets';
import {Terrain} from '../../render/terrain';
import type {mat2, mat4} from 'gl-matrix';

// JP: TODO: remove this file!

/*
Transform setup:

Original state: there is a single large transform class, which:
- stores the map's transform state (center, pitch, bearing, zoom)
- applies basic constraints to this state (maxzoom, max bounds)
- does more complex transformations and projections

The first two are mostly projection-independent, the last is extremely dependent.

We want different projections to have different implementations of the transform's functions.
We want to be able to swap projections on the fly without resetting the transform.

=> the *data* of the transform must be a separate object
    - which data should survive projection change?
- all the other fields are seldom used outside transform.ts anyway
- transform must be cloneable (because of symbol placement and other async processes)
- globe transform must be able to create an instance of mercator transform and use it

How to split stuff?

Abstract class TransformBase
    - has all the common data + getters/setters
    - each projection creates its own implementation
    - globe can inherit mercator
    - this mostly keeps the current transform's API
        - matrices API will have to be projection-specific
    - transform implementations will effectively replace the projection class / will do the same thing, more or less

Slim transform
    - Transform as it is now is reduced to only hold the data
    - all projecting and matrices are moved to Projection class
    - likely many code changes

Facade transform
    - each function call internally calls the projection's implementation

*/

export class TransformDataBase {
    private _lngRange: [number, number];
    private _latRange: [number, number];
    private _width: number;
    private _height: number;

    /**
     * This transform's bearing in radians.
     */
    private _angle: number;

    minElevationForCurrentTile: number;

    /**
     * Vertical field of view in radians.
     */
    private _fov: number;

    private _pitch: number;
    private _zoom: number;
    private _renderWorldCopies: boolean;
    private _minZoom: number;
    private _maxZoom: number;
    private _minPitch: number;
    private _maxPitch: number;
    private _center: LngLat;
    private _elevation: number;
    private _edgeInsets: EdgeInsets;
}

/**
 * @internal
 * A single transform, generally used for a single tile to be
 * scaled, rotated, and zoomed.
 */
export interface ITransform {
    /**
     * Distance from camera origin to view plane, in pixels.
     * Calculated using vertical fov and viewport height.
     * Center is considered to be in the middle of the viewport.
     */
    cameraToCenterDistance: number;
    mercatorMatrix: mat4;
    projMatrix: mat4;
    invProjMatrix: mat4;
    alignedProjMatrix: mat4;
    pixelMatrix: mat4;
    pixelMatrix3D: mat4;
    pixelMatrixInverse: mat4;
    glCoordMatrix: mat4;
    labelPlaneMatrix: mat4;
    minElevationForCurrentTile: number;

    constructor(minZoom?: number, maxZoom?: number, minPitch?: number, maxPitch?: number, renderWorldCopies?: boolean);

    clone(): ITransform;

    apply(that: ITransform);

    get tileSize(): number;
    get tileZoom(): number;
    get scale(): number;
    get width(): number;
    get height(): number;
    get angle(): number;

    get rotationMatrix(): mat2;

    get lngRange(): [number, number];
    get latRange(): [number, number];

    get pixelsToGLUnits(): [number, number];

    get minZoom(): number;
    set minZoom(zoom: number);

    get maxZoom(): number;
    set maxZoom(zoom: number);

    get minPitch(): number;
    set minPitch(pitch: number);

    get maxPitch(): number;
    set maxPitch(pitch: number);

    get renderWorldCopies(): boolean;
    set renderWorldCopies(renderWorldCopies: boolean);

    get worldSize(): number;

    get centerOffset(): Point;

    get size(): Point;

    get bearing(): number;
    set bearing(bearing: number);

    get pitch(): number;
    set pitch(pitch: number);

    get fov(): number;
    set fov(fov: number);

    get zoom(): number;
    set zoom(zoom: number);

    get center(): LngLat;
    set center(center: LngLat);

    /**
     * Elevation at current center point, meters above sea level
     */
    get elevation(): number;
    set elevation(elevation: number);

    get padding(): PaddingOptions;
    set padding(padding: PaddingOptions);

    /**
     * The center of the screen in pixels with the top-left corner being (0,0)
     * and +y axis pointing downwards. This accounts for padding.
     */
    get centerPoint(): Point;

    /**
     * @internal
     */
    get pixelsPerMeter(): number;

    /**
     * Returns if the padding params match
     *
     * @param padding - the padding to check against
     * @returns true if they are equal, false otherwise
     */
    isPaddingEqual(padding: PaddingOptions): boolean;

    /**
     * Helper method to update edge-insets in place
     *
     * @param start - the starting padding
     * @param target - the target padding
     * @param t - the step/weight
     */
    interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number): void;

    /**
     * Return a zoom level that will cover all tiles the transform
     * @param options - the options
     * @returns zoom level An integer zoom level at which all tiles will be visible.
     */
    coveringZoomLevel(options: {
        /**
         * Target zoom level. If true, the value will be rounded to the closest integer. Otherwise the value will be floored.
         */
        roundZoom?: boolean;
        /**
         * Tile size, expressed in screen pixels.
         */
        tileSize: number;
    }): number;

    /**
     * Return any "wrapped" copies of a given tile coordinate that are visible
     * in the current view.
     */
    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): Array<UnwrappedTileID>;

    /**
     * Return all coordinates that could cover this transform for a covering
     * zoom level.
     * @param options - the options
     * @returns OverscaledTileIDs
     */
    coveringTiles(
        options: {
            tileSize: number;
            minzoom?: number;
            maxzoom?: number;
            roundZoom?: boolean;
            reparseOverscaled?: boolean;
            renderWorldCopies?: boolean;
            terrain?: Terrain;
        }
    ): Array<OverscaledTileID>;

    resize(width: number, height: number);

    get unmodified(): boolean;

    zoomScale(zoom: number);
    scaleZoom(scale: number);

    /**
     * Convert from LngLat to world coordinates (Mercator coordinates scaled by 512)
     * @param lnglat - the lngLat
     * @returns Point
     */
    project(lnglat: LngLat);

    /**
     * Convert from world coordinates ([0, 512],[0, 512]) to LngLat ([-180, 180], [-90, 90])
     * @param point - world coordinate
     * @returns LngLat
     */
    unproject(point: Point): LngLat;

    get point(): Point;

    /**
     * get the camera position in LngLat and altitudes in meter
     * @returns An object with lngLat & altitude.
     */
    getCameraPosition(): {
        lngLat: LngLat;
        altitude: number;
    };

    /**
     * This method works in combination with freezeElevation activated.
     * freezeElevation is enabled during map-panning because during this the camera should sit in constant height.
     * After panning finished, call this method to recalculate the zoom level for the current camera-height in current terrain.
     * @param terrain - the terrain
     */
    recalculateZoom(terrain: Terrain): void;

    /**
     * Set's the transform's center so that the given point on screen is at the given world coordinates.
     * @param lnglat - Desired world coordinates of the point.
     * @param point - The screen point that should lie at the given coordinates.
     */
    setLocationAtPoint(lnglat: LngLat, point: Point);

    /**
     * Given a LngLat location, return the screen point that corresponds to it
     * @param lnglat - location
     * @param terrain - optional terrain
     * @returns screen point
     */
    locationPoint(lnglat: LngLat, terrain?: Terrain): Point;

    /**
     * Given a point on screen, return its lnglat
     * @param p - screen point
     * @param terrain - optional terrain
     * @returns lnglat location
     */
    pointLocation(p: Point, terrain?: Terrain): LngLat;

    /**
     * Given a geographical lnglat, return an unrounded
     * coordinate that represents it at low zoom level.
     * @param lnglat - the location
     * @returns The mercator coordinate
     */
    locationCoordinate(lnglat: LngLat): MercatorCoordinate;

    /**
     * Given a Coordinate, return its geographical position.
     * @param coord - mercator coordinates
     * @returns lng and lat
     */
    coordinateLocation(coord: MercatorCoordinate): LngLat;

    /**
     * Given a Point, return its mercator coordinate.
     * @param p - the point
     * @param terrain - optional terrain
     * @returns lnglat
     */
    pointCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate;

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param coord - the coordinates
     * @param elevation - the elevation
     * @param pixelMatrix - the pixel matrix
     * @returns screen point
     */
    coordinatePoint(coord: MercatorCoordinate, elevation: number, pixelMatrix: mat4): Point;

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * @returns Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    getBounds(): LngLatBounds;

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns max bounds
     */
    getMaxBounds(): LngLatBounds | null;

    /**
     * Calculate pixel height of the visible horizon in relation to map-center (e.g. height/2),
     * multiplied by a static factor to simulate the earth-radius.
     * The calculated value is the horizontal line from the camera-height to sea-level.
     * @returns Horizon above center in pixels.
     */
    getHorizon(): number;

    /**
     * Sets or clears the map's geographical constraints.
     * @param bounds - A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds?: LngLatBounds | null): void;

    /**
     * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
     * @param unwrappedTileID - the tile ID
     */
    calculatePosMatrix(unwrappedTileID: UnwrappedTileID, aligned: boolean): mat4;

    customLayerMatrix(): mat4;

    /**
     * Get center lngLat and zoom to ensure that
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    getConstrained(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number};

    maxPitchScaleFactor(): number;

    /**
     * The camera looks at the map from a 3D (lng, lat, altitude) location. Let's use `cameraLocation`
     * as the name for the location under the camera and on the surface of the earth (lng, lat, 0).
     * `cameraPoint` is the projected position of the `cameraLocation`.
     *
     * This point is useful to us because only fill-extrusions that are between `cameraPoint` and
     * the query point on the surface of the earth can extend and intersect the query.
     *
     * When the map is not pitched the `cameraPoint` is equivalent to the center of the map because
     * the camera is right above the center of the map.
     */
    getCameraPoint(): Point;

    /**
     * When the map is pitched, some of the 3D features that intersect a query will not intersect
     * the query at the surface of the earth. Instead the feature may be closer and only intersect
     * the query because it extrudes into the air.
     * @param queryGeometry - For point queries, the line from the query point to the "camera point",
     * for other geometries, the envelope of the query geometry and the "camera point"
     * @returns a geometry that includes all of the original query as well as all possible ares of the
     * screen where the *base* of a visible extrusion could be.
     *
     */
    getCameraQueryGeometry(queryGeometry: Array<Point>): Array<Point>;

    /**
     * Return the distance to the camera in clip space from a LngLat.
     * This can be compared to the value from the depth buffer (terrain.depthAtPoint)
     * to determine whether a point is occluded.
     * @param lngLat - the point
     * @param elevation - the point's elevation
     * @returns depth value in clip space (between 0 and 1)
     */
    lngLatToCameraDepth(lngLat: LngLat, elevation: number);
}
