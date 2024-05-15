import {LngLat} from '../lng_lat';
import {LngLatBounds} from '../lng_lat_bounds';
import {MercatorCoordinate} from '../mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {wrap, clamp} from '../../util/util';
import {mat4, mat2} from 'gl-matrix';
import {EdgeInsets} from '../edge_insets';

import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../../source/tile_id';
import type {PaddingOptions} from '../edge_insets';
import {Terrain} from '../../render/terrain';

export const MAX_VALID_LATITUDE = 85.051129;

/**
 * @internal
 * A single transform. TODO.
 */
abstract class TransformBase {
    private _tileSize: number; // constant
    protected _tileZoom: number; // integer zoom level for tiles?
    protected _lngRange: [number, number];
    protected _latRange: [number, number];
    protected _scale: number;
    protected _width: number;
    protected _height: number;

    /**
     * This transform's bearing in radians.
     */
    protected _angle: number;
    private _rotationMatrix: mat2;
    private _pixelsToGLUnits: [number, number];

    /**
     * Distance from camera origin to view plane, in pixels.
     * Calculated using vertical fov and viewport height.
     * Center is considered to be in the middle of the viewport.
     */
    public abstract get cameraToCenterDistance(): number;
    // mercatorMatrix: mat4;
    // projMatrix: mat4;
    // invProjMatrix: mat4;
    // alignedProjMatrix: mat4;
    // pixelMatrix: mat4;
    // pixelMatrix3D: mat4;
    // pixelMatrixInverse: mat4;
    // glCoordMatrix: mat4;
    // labelPlaneMatrix: mat4;
    protected minElevationForCurrentTile: number;

    /**
     * Vertical field of view in radians.
     */
    protected _fov: number;

    protected _pitch: number;
    protected _zoom: number;
    protected _unmodified: boolean;
    protected _renderWorldCopies: boolean;
    protected _minZoom: number;
    protected _maxZoom: number;
    protected _minPitch: number;
    protected _maxPitch: number;
    protected _center: LngLat;
    protected _elevation: number;
    protected _pixelPerMeter: number;
    protected _edgeInsets: EdgeInsets;
    // private _constraining: boolean;
    // private _posMatrixCache: {[_: string]: mat4};
    // private _alignedPosMatrixCache: {[_: string]: mat4};

    constructor(minZoom?: number, maxZoom?: number, minPitch?: number, maxPitch?: number, renderWorldCopies?: boolean) {
        this._tileSize = 512; // constant

        this._renderWorldCopies = renderWorldCopies === undefined ? true : !!renderWorldCopies;
        this._minZoom = minZoom || 0;
        this._maxZoom = maxZoom || 22;

        this._minPitch = (minPitch === undefined || minPitch === null) ? 0 : minPitch;
        this._maxPitch = (maxPitch === undefined || maxPitch === null) ? 60 : maxPitch;

        this.setMaxBounds();

        this._width = 0;
        this._height = 0;
        this._center = new LngLat(0, 0);
        this._elevation = 0;
        this.zoom = 0;
        this._angle = 0;
        this._fov = 0.6435011087932844;
        this._pitch = 0;
        this._unmodified = true;
        this._edgeInsets = new EdgeInsets();
        this.minElevationForCurrentTile = 0;
    }

    abstract clone(): TransformBase;

    abstract apply(that: TransformBase);

    get tileSize(): number { return this._tileSize; }
    get tileZoom(): number { return this._tileZoom; }
    get scale(): number { return this._scale; }
    get width(): number { return this._width; }
    get height(): number { return this._height; }
    get angle(): number { return this._angle; }

    get lngRange(): [number, number] { return this._lngRange; }
    get latRange(): [number, number] { return this._latRange; }

    get pixelsToGLUnits(): [number, number] { return this._pixelsToGLUnits; }

    get minZoom(): number { return this._minZoom; }
    set minZoom(zoom: number) {
        if (this._minZoom === zoom) return;
        this._minZoom = zoom;
        this.zoom = Math.max(this.zoom, zoom);
    }

    get maxZoom(): number { return this._maxZoom; }
    set maxZoom(zoom: number) {
        if (this._maxZoom === zoom) return;
        this._maxZoom = zoom;
        this.zoom = Math.min(this.zoom, zoom);
    }

    get minPitch(): number { return this._minPitch; }
    set minPitch(pitch: number) {
        if (this._minPitch === pitch) return;
        this._minPitch = pitch;
        this.pitch = Math.max(this.pitch, pitch);
    }

    get maxPitch(): number { return this._maxPitch; }
    set maxPitch(pitch: number) {
        if (this._maxPitch === pitch) return;
        this._maxPitch = pitch;
        this.pitch = Math.min(this.pitch, pitch);
    }

    get renderWorldCopies(): boolean { return this._renderWorldCopies; }
    set renderWorldCopies(renderWorldCopies: boolean) {
        if (renderWorldCopies === undefined) {
            renderWorldCopies = true;
        } else if (renderWorldCopies === null) {
            renderWorldCopies = false;
        }

        this._renderWorldCopies = renderWorldCopies;
    }

    get worldSize(): number {
        return this._tileSize * this._scale;
    }

    get centerOffset(): Point {
        return this.centerPoint._sub(this.size._div(2));
    }

    get size(): Point {
        return new Point(this._width, this._height);
    }

    get bearing(): number {
        return -this._angle / Math.PI * 180;
    }
    set bearing(bearing: number) {
        const b = -wrap(bearing, -180, 180) * Math.PI / 180;
        if (this._angle === b) return;
        this._unmodified = false;
        this._angle = b;
        this._calcMatrices();

        // 2x2 matrix for rotating points
        this._rotationMatrix = mat2.create();
        mat2.rotate(this._rotationMatrix, this._rotationMatrix, this._angle);
    }

    get rotationMatrix(): mat2 { return this._rotationMatrix; }

    get pitch(): number {
        return this._pitch / Math.PI * 180;
    }
    set pitch(pitch: number) {
        const p = clamp(pitch, this.minPitch, this.maxPitch) / 180 * Math.PI;
        if (this._pitch === p) return;
        this._unmodified = false;
        this._pitch = p;
        this._calcMatrices();
    }

    get fov(): number {
        return this._fov / Math.PI * 180;
    }
    set fov(fov: number) {
        fov = Math.max(0.01, Math.min(60, fov));
        if (this._fov === fov) return;
        this._unmodified = false;
        this._fov = fov / 180 * Math.PI;
        this._calcMatrices();
    }

    get zoom(): number { return this._zoom; }
    set zoom(zoom: number) {
        const constrainedZoom = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
        if (this._zoom === constrainedZoom) return;
        this._unmodified = false;
        this._zoom = constrainedZoom;
        this._tileZoom = Math.max(0, Math.floor(constrainedZoom));
        this._scale = this.zoomScale(constrainedZoom);
        this._constrain();
        this._calcMatrices();
    }

    get center(): LngLat { return this._center; }
    set center(center: LngLat) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;
        this._unmodified = false;
        this._center = center;
        this._constrain();
        this._calcMatrices();
    }

    /**
     * Elevation at current center point, meters above sea level
     */
    get elevation(): number { return this._elevation; }
    set elevation(elevation: number) {
        if (elevation === this._elevation) return;
        this._elevation = elevation;
        this._constrain();
        this._calcMatrices();
    }

    get padding(): PaddingOptions { return this._edgeInsets.toJSON(); }
    set padding(padding: PaddingOptions) {
        if (this._edgeInsets.equals(padding)) return;
        this._unmodified = false;
        // Update edge-insets in-place
        this._edgeInsets.interpolate(this._edgeInsets, padding, 1);
        this._calcMatrices();
    }

    /**
     * The center of the screen in pixels with the top-left corner being (0,0)
     * and +y axis pointing downwards. This accounts for padding.
     */
    get centerPoint(): Point {
        return this._edgeInsets.getCenter(this._width, this._height);
    }

    /**
     * @internal
     */
    get pixelsPerMeter(): number { return this._pixelPerMeter; }

    /**
     * Returns if the padding params match
     *
     * @param padding - the padding to check against
     * @returns true if they are equal, false otherwise
     */
    isPaddingEqual(padding: PaddingOptions): boolean {
        return this._edgeInsets.equals(padding);
    }

    /**
     * Helper method to update edge-insets in place
     *
     * @param start - the starting padding
     * @param target - the target padding
     * @param t - the step/weight
     */
    interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number): void {
        this._unmodified = false;
        this._edgeInsets.interpolate(start, target, t);
        this._constrain();
        this._calcMatrices();
    }

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
    }): number {
        const z = (options.roundZoom ? Math.round : Math.floor)(
            this.zoom + this.scaleZoom(this._tileSize / options.tileSize)
        );
        // At negative zoom levels load tiles from z0 because negative tile zoom levels don't exist.
        return Math.max(0, z);
    }

    /**
     * Return any "wrapped" copies of a given tile coordinate that are visible
     * in the current view.
     */
    abstract getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): Array<UnwrappedTileID>;

    /**
     * Return all coordinates that could cover this transform for a covering
     * zoom level.
     * @param options - the options
     * @returns OverscaledTileIDs
     */
    abstract coveringTiles(
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

    resize(width: number, height: number) {
        this._width = width;
        this._height = height;

        this._pixelsToGLUnits = [2 / width, -2 / height];
        this._constrain();
        this._calcMatrices();
    }

    get unmodified(): boolean { return this._unmodified; }

    zoomScale(zoom: number) { return Math.pow(2, zoom); }
    scaleZoom(scale: number) { return Math.log(scale) / Math.LN2; }

    /**
     * Convert from LngLat to world coordinates (Mercator coordinates scaled by 512)
     * @param lnglat - the lngLat
     * @returns Point
     */
    abstract project(lnglat: LngLat): Point;

    /**
     * Convert from world coordinates ([0, 512],[0, 512]) to LngLat ([-180, 180], [-90, 90])
     * @param point - world coordinate
     * @returns LngLat
     */
    abstract unproject(point: Point): LngLat;

    /**
     * The transform's center in world coordinates (Mercator coordinates scaled by 512)
     */
    abstract get point(): Point;

    /**
     * get the camera position in LngLat and altitudes in meter
     * @returns An object with lngLat & altitude.
     */
    abstract getCameraPosition(): {
        lngLat: LngLat;
        altitude: number;
    };

    /**
     * This method works in combination with freezeElevation activated.
     * freezeElevation is enabled during map-panning because during this the camera should sit in constant height.
     * After panning finished, call this method to recalculate the zoom level for the current camera-height in current terrain.
     * @param terrain - the terrain
     */
    abstract recalculateZoom(terrain: Terrain): void;

    /**
     * Set's the transform's center so that the given point on screen is at the given world coordinates.
     * @param lnglat - Desired world coordinates of the point.
     * @param point - The screen point that should lie at the given coordinates.
     */
    abstract setLocationAtPoint(lnglat: LngLat, point: Point): void;

    /**
     * Given a LngLat location, return the screen point that corresponds to it
     * @param lnglat - location
     * @param terrain - optional terrain
     * @returns screen point
     */
    abstract locationPoint(lnglat: LngLat, terrain?: Terrain): Point;

    /**
     * Given a point on screen, return its lnglat
     * @param p - screen point
     * @param terrain - optional terrain
     * @returns lnglat location
     */
    abstract pointLocation(p: Point, terrain?: Terrain): LngLat;

    /**
     * Given a geographical lnglat, return an unrounded
     * coordinate that represents it at low zoom level.
     * @param lnglat - the location
     * @returns The mercator coordinate
     */
    abstract locationCoordinate(lnglat: LngLat): MercatorCoordinate;

    /**
     * Given a Coordinate, return its geographical position.
     * @param coord - mercator coordinates
     * @returns lng and lat
     */
    abstract coordinateLocation(coord: MercatorCoordinate): LngLat;

    /**
     * Given a Point, return its mercator coordinate.
     * @param p - the point
     * @param terrain - optional terrain
     * @returns lnglat
     */
    abstract pointCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate;

    /**
     * Given a coordinate, return the screen point that corresponds to it
     * @param coord - the coordinates
     * @param elevation - the elevation
     * @param pixelMatrix - the pixel matrix
     * @returns screen point
     */
    abstract coordinatePoint(coord: MercatorCoordinate, elevation?: number, pixelMatrix?: mat4): Point;

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * @returns Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    getBounds(): LngLatBounds {
        const top = Math.max(0, this._height / 2 - this.getHorizon());
        return new LngLatBounds()
            .extend(this.pointLocation(new Point(0, top)))
            .extend(this.pointLocation(new Point(this._width, top)))
            .extend(this.pointLocation(new Point(this._width, this._height)))
            .extend(this.pointLocation(new Point(0, this._height)));
    }

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns max bounds
     */
    getMaxBounds(): LngLatBounds | null {
        if (!this._latRange || this._latRange.length !== 2 ||
            !this._lngRange || this._lngRange.length !== 2) return null;

        return new LngLatBounds([this._lngRange[0], this._latRange[0]], [this._lngRange[1], this._latRange[1]]);
    }

    /**
     * Calculate pixel height of the visible horizon in relation to map-center (e.g. height/2),
     * multiplied by a static factor to simulate the earth-radius.
     * The calculated value is the horizontal line from the camera-height to sea-level.
     * @returns Horizon above center in pixels.
     */
    abstract getHorizon(): number;

    /**
     * Sets or clears the map's geographical constraints.
     * @param bounds - A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds?: LngLatBounds | null): void {
        if (bounds) {
            this._lngRange = [bounds.getWest(), bounds.getEast()];
            this._latRange = [bounds.getSouth(), bounds.getNorth()];
            this._constrain();
        } else {
            this._lngRange = null;
            this._latRange = [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE];
        }
    }

    /**
     * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
     * @param unwrappedTileID - the tile ID
     */
    abstract calculatePosMatrix(unwrappedTileID: UnwrappedTileID, aligned?: boolean): mat4;

    abstract customLayerMatrix(): mat4;

    /**
     * Get center lngLat and zoom to ensure that
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    abstract getConstrained(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number};

    protected abstract _constrain(): void;

    protected abstract _calcMatrices(): void;

    abstract maxPitchScaleFactor(): number;

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
    abstract getCameraPoint(): Point;

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
    getCameraQueryGeometry(queryGeometry: Array<Point>): Array<Point> {
        const c = this.getCameraPoint();

        if (queryGeometry.length === 1) {
            return [queryGeometry[0], c];
        } else {
            let minX = c.x;
            let minY = c.y;
            let maxX = c.x;
            let maxY = c.y;
            for (const p of queryGeometry) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
            return [
                new Point(minX, minY),
                new Point(maxX, minY),
                new Point(maxX, maxY),
                new Point(minX, maxY),
                new Point(minX, minY)
            ];
        }
    }

    /**
     * Return the distance to the camera in clip space from a LngLat.
     * This can be compared to the value from the depth buffer (terrain.depthAtPoint)
     * to determine whether a point is occluded.
     * @param lngLat - the point
     * @param elevation - the point's elevation
     * @returns depth value in clip space (between 0 and 1)
     */
    abstract lngLatToCameraDepth(lngLat: LngLat, elevation: number): number;
}
