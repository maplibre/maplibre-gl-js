import {LngLat} from './lng_lat';
import {LngLatBounds} from './lng_lat_bounds';
import {MercatorCoordinate} from './mercator_coordinate';
import Point from '@mapbox/point-geometry';
import {wrap, clamp} from '../util/util';
import {mat4, mat2, vec3} from 'gl-matrix';
import {EdgeInsets} from './edge_insets';
import {UnwrappedTileID, OverscaledTileID, CanonicalTileID} from '../source/tile_id';
import type {PaddingOptions} from './edge_insets';
import {Terrain} from '../render/terrain';
import {ProjectionData} from '../render/program/projection_program';
import {PointProjection} from '../symbol/projection';

export const MAX_VALID_LATITUDE = 85.051129;

/**
 * @internal
 * A single transform. TODO.
 */
export abstract class Transform {
    // This base class stores all data about a transform that is common across all projections.
    // This data is what actually defines the map's position, angles, etc.
    // This data should be transferable to a transform implementation for a different projection,
    // hence the implementation of `Transform.apply`, which works on any Transform and accepts any Transform.

    private _tileSize: number; // constant
    protected _tileZoom: number; // integer zoom level for tiles
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

    private _minElevationForCurrentTile: number;
    private _constraining: boolean;

    private _pixelsToClipSpaceMatrix: mat4;
    private _clipSpaceToPixelsMatrix: mat4;

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
        this._minElevationForCurrentTile = 0;
    }

    abstract clone(): Transform;

    public apply(that: Transform): void {
        this._tileSize = that._tileSize;
        this._latRange = that._latRange;
        this._width = that._width;
        this._height = that._height;
        this._center = that._center;
        this._elevation = that._elevation;
        this._minElevationForCurrentTile = that._minElevationForCurrentTile;
        this.zoom = that.zoom;
        this._angle = that._angle;
        this._fov = that._fov;
        this._pitch = that._pitch;
        this._unmodified = that._unmodified;
        this._edgeInsets = that._edgeInsets.clone();
        this._calcMatrices();
    }

    /**
     * Distance from camera origin to view plane, in pixels.
     * Calculated using vertical fov and viewport height.
     * Center is considered to be in the middle of the viewport.
     */
    public abstract get cameraToCenterDistance(): number;

    get pixelsToClipSpaceMatrix(): mat4 { return this._pixelsToClipSpaceMatrix; }
    get clipSpaceToPixelsMatrix(): mat4 { return this._clipSpaceToPixelsMatrix; }

    get minElevationForCurrentTile(): number { return this._minElevationForCurrentTile; }
    set minElevationForCurrentTile(ele: number) {
        this._minElevationForCurrentTile = ele;
    }

    get tileSize(): number { return this._tileSize; }
    get tileZoom(): number { return this._tileZoom; }
    get scale(): number { return this._scale; }

    /**
     * Gets the transform's width in pixels. Use {@link resize} to set the transform's size.
     */
    get width(): number { return this._width; }

    /**
     * Gets the transform's height in pixels. Use {@link resize} to set the transform's size.
     */
    get height(): number { return this._height; }

    /**
     * Gets the transform's bearing in radians.
     */
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

    /**
     * Gets the transform's width and height in pixels (viewport size). Use {@link resize} to set the transform's size.
     */
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

    get unmodified(): boolean { return this._unmodified; }

    /**
     * @internal
     * Returns the camera's position transformed to be in the same space as 3D features under this transform's projection. Mostly used for globe + fill-extrusion.
     */
    abstract get cameraPosition(): vec3;

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
     * @returns Array of OverscaledTileID. All OverscaledTileID instances are newly created.
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

    zoomScale(zoom: number) { return Math.pow(2, zoom); }
    scaleZoom(scale: number) { return Math.log(scale) / Math.LN2; }

    /**
     * Convert from LngLat to world coordinates (Mercator coordinates scaled by 512).
     * @param lnglat - the lngLat
     * @returns Point
     */
    abstract project(lnglat: LngLat): Point;

    /**
     * Convert from world coordinates ([0, 512],[0, 512]) to LngLat ([-180, 180], [-90, 90]).
     * @param point - world coordinate
     * @returns LngLat
     */
    abstract unproject(point: Point): LngLat;

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
     * Given a LngLat location, return the screen point that corresponds to it.
     * @param lnglat - location
     * @param terrain - optional terrain
     * @returns screen point
     */
    abstract locationPoint(lnglat: LngLat, terrain?: Terrain): Point;

    /**
     * Given a point on screen, return its lnglat.
     * @param p - screen point
     * @param terrain - optional terrain
     * @returns lnglat location
     */
    abstract pointLocation(p: Point, terrain?: Terrain): LngLat;

    /**
     * Given a Point, return its mercator coordinate.
     * @param p - the point
     * @param terrain - optional terrain
     * @returns lnglat
     */
    abstract pointCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate;

    /**
     * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
     * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
     * @returns Returns a {@link LngLatBounds} object describing the map's geographical bounds.
     */
    abstract getBounds(): LngLatBounds;

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
     * Returns whether the specified screen pixel lies on the map.
     * May return false if, for example, the point is above the map's horizon, or if doesn't lie on the planet's surface if globe is enabled.
     * @param p - The pixel's coordinates.
     * @param terrain - Optional terrain.
     */
    abstract isPointOnMapSurface(p: Point, terrain?: Terrain): boolean;

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

    abstract customLayerMatrix(): mat4;

    /**
     * Get center lngLat and zoom to ensure that
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    abstract getConstrained(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number};

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

    /**
     * Snaps the transform's center, zoom, etc. into the valid range.
     */
    protected _constrain(): void {
        if (!this.center || !this._width || !this._height || this._constraining) return;
        this._constraining = true;
        const unmodified = this._unmodified;
        const {center, zoom} = this.getConstrained(this.center, this.zoom);
        this.center = center;
        this.zoom = zoom;
        this._unmodified = unmodified;
        this._constraining = false;
    }

    /**
     * This function is called every time one of the transform's defining properties (center, pitch, etc.) changes.
     * This function should update the transform's internal data, such as matrices.
     * Any derived `_calcMatrices` function should also call the base function first.
     */
    protected _calcMatrices(): void {
        if (!this._width || !this._height) {
            return;
        }

        let m = mat4.identity(new Float64Array(16) as any);
        mat4.scale(m, m, [this._width / 2, -this._height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        this._clipSpaceToPixelsMatrix = m;

        m = mat4.identity(new Float64Array(16) as any);
        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [-1, -1, 0]);
        mat4.scale(m, m, [2 / this._width, 2 / this._height, 1]);
        this._pixelsToClipSpaceMatrix = m;
    }

    /**
     * @internal
     * True when an animation handled by the transform is in progress,
     * requiring MapLibre to keep rendering new frames.
     */
    abstract isRenderingDirty(): boolean;

    /**
     * Generates a `ProjectionData` instance to be used while rendering the supplied tile.
     * @param overscaledTileID - The ID of the current tile.
     * @param aligned - Set to true if a pixel-aligned matrix should be used, if possible (mostly used for raster tiles under mercator projection).
     */
    abstract getProjectionData(overscaledTileID: OverscaledTileID, aligned?: boolean): ProjectionData;

    /**
     * @internal
     * Returns whether the supplied location is occluded in this projection.
     * For example during globe rendering a location on the backfacing side of the globe is occluded.
     * @param x - Tile space coordinate in range 0..EXTENT.
     * @param y - Tile space coordinate in range 0..EXTENT.
     * @param unwrappedTileID - TileID of the tile the supplied coordinates belong to.
     */
    abstract isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean;

    /**
     * @internal
     */
    abstract getPixelScale(): number;

    /**
     * @internal
     * Allows the projection to adjust the radius of `circle-pitch-alignment: 'map'` circles and heatmap kernels based on the map's latitude.
     * Circle radius and heatmap kernel radius is multiplied by this value.
     */
    abstract getCircleRadiusCorrection(): number;

    /**
     * @internal
     * Allows the projection to adjust the scale of `text-pitch-alignment: 'map'` symbols's collision boxes based on the map's center and the text anchor.
     * Only affects the collision boxes (and click areas), scaling of the rendered text is mostly handled in shaders.
     * @param transform - The map's transform, with only the `center` property, describing the map's longitude and latitude.
     * @param textAnchor - Text anchor position inside the tile.
     * @param tileID - The tile coordinates.
     */
    abstract getPitchedTextCorrection(textAnchor: Point, tileID: UnwrappedTileID): number;

    /**
     * @internal
     * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
     */
    abstract translatePosition(tile: { tileID: OverscaledTileID; tileSize: number }, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];

    /**
     * Signals to the transform that a new frame is starting.
     * The transform might update some of its internal variables and animations based on this.
     */
    abstract updateProjection(): void;

    /**
     * @internal
     * Returns light direction transformed to be in the same space as 3D features under this projection. Mostly used for globe + fill-extrusion.
     * @param transform - Current map transform.
     * @param dir - The light direction.
     * @returns A new vector with the transformed light direction.
     */
    abstract transformLightDirection(dir: vec3): vec3;

    //
    // Projection and unprojection of points, LatLng coordinates, tile coordinates, etc.
    //

    /**
     * @internal
     * Projects a point in tile coordinates. Used in symbol rendering.
     */
    abstract projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number): PointProjection;

    /**
     * Called before rendering to allow the transform implementation
     * to precompute data needed to render the given tiles.
     * Used in mercator transform to precompute tile matrices (posMatrix).
     * @param coords - Array of tile IDs that will be rendered.
     */
    abstract precacheTiles(coords: Array<OverscaledTileID>): void;
}
