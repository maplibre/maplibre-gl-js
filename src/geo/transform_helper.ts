import {LngLat} from './lng_lat';
import {LngLatBounds} from './lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {wrap, clamp} from '../util/util';
import {mat4, mat2} from 'gl-matrix';
import {EdgeInsets} from './edge_insets';
import type {PaddingOptions} from './edge_insets';
import {CoveringZoomOptions, IReadonlyTransform, ITransformGetters} from './transform_interface';

export const MAX_VALID_LATITUDE = 85.051129;

/**
 * If a path crossing the antimeridian would be shorter, extend the final coordinate so that
 * interpolating between the two endpoints will cross it.
 * @param center - The LngLat object of the desired center. This object will be mutated.
 */
export function normalizeCenter(tr: IReadonlyTransform, center: LngLat): void {
    if (!tr.renderWorldCopies || tr.lngRange) return;
    const delta = center.lng - tr.center.lng;
    center.lng +=
        delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
}

/**
 * Computes scaling from zoom level.
 */
export function zoomScale(zoom: number) { return Math.pow(2, zoom); }

/**
 * Computes zoom level from scaling.
 */
export function scaleZoom(scale: number) { return Math.log(scale) / Math.LN2; }

export type UnwrappedTileIDType = {
    /**
     * Tile wrap: 0 for the "main" world,
     * negative values for worlds left of the main,
     * positive values for worlds right of the main.
     */
    wrap?: number;
    canonical: {
        /**
         * Tile X coordinate, in range 0..(z^2)-1
         */
        x: number;
        /**
         * Tile Y coordinate, in range 0..(z^2)-1
         */
        y: number;
        /**
         * Tile zoom level.
         */
        z: number;
    };
};

export type TransformHelperCallbacks = {
    /**
     * Get center lngLat and zoom to ensure that
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    getConstrained: (center: LngLat, zoom: number) => { center: LngLat; zoom: number };

    /**
     * Updates the underlying transform's internal matrices.
     */
    calcMatrices: () => void;
};

function getTileZoom(zoom: number): number {
    return Math.max(0, Math.floor(zoom));
}

/**
 * @internal
 * This class stores all values that define a transform's state,
 * such as center, zoom, minZoom, etc.
 * This can be used as a helper for implementing the ITransform interface.
 */
export class TransformHelper implements ITransformGetters {
    private _callbacks: TransformHelperCallbacks;

    _tileSize: number; // constant
    _tileZoom: number; // integer zoom level for tiles
    _lngRange: [number, number];
    _latRange: [number, number];
    _scale: number; // computed based on zoom
    _width: number;
    _height: number;
    /**
     * Vertical field of view in radians.
     */
    _fov: number;
    /**
     * This transform's bearing in radians.
     * Note that the sign of this variable is *opposite* to the sign of {@link bearing}
     */
    _angle: number;
    /**
     * Pitch in radians.
     */
    _pitch: number;
    _zoom: number;
    _renderWorldCopies: boolean;
    _minZoom: number;
    _maxZoom: number;
    _minPitch: number;
    _maxPitch: number;
    _center: LngLat;
    _elevation: number;
    _minElevationForCurrentTile: number;
    _pixelPerMeter: number;
    _edgeInsets: EdgeInsets;
    _unmodified: boolean;

    _constraining: boolean;
    _rotationMatrix: mat2;
    _pixelsToGLUnits: [number, number];
    _pixelsToClipSpaceMatrix: mat4;
    _clipSpaceToPixelsMatrix: mat4;

    constructor(callbacks: TransformHelperCallbacks, minZoom?: number, maxZoom?: number, minPitch?: number, maxPitch?: number, renderWorldCopies?: boolean) {
        this._callbacks = callbacks;
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
        this._zoom = 0;
        this._tileZoom = getTileZoom(this._zoom);
        this._scale = zoomScale(this._zoom);
        this._angle = 0;
        this._fov = 0.6435011087932844;
        this._pitch = 0;
        this._unmodified = true;
        this._edgeInsets = new EdgeInsets();
        this._minElevationForCurrentTile = 0;
    }

    public apply(thatI: ITransformGetters, constrain?: boolean): void {
        this._latRange = thatI.latRange;
        this._lngRange = thatI.lngRange;
        this._width = thatI.width;
        this._height = thatI.height;
        this._center = thatI.center;
        this._elevation = thatI.elevation;
        this._minElevationForCurrentTile = thatI.minElevationForCurrentTile;
        this._zoom = thatI.zoom;
        this._tileZoom = getTileZoom(this._zoom);
        this._scale = zoomScale(this._zoom);
        this._angle = -thatI.bearing * Math.PI / 180;
        this._fov = thatI.fov * Math.PI / 180;
        this._pitch = thatI.pitch * Math.PI / 180;
        this._unmodified = thatI.unmodified;
        this._edgeInsets = new EdgeInsets(thatI.padding.top, thatI.padding.bottom, thatI.padding.left, thatI.padding.right);
        this._minZoom = thatI.minZoom;
        this._maxZoom = thatI.maxZoom;
        this._minPitch = thatI.minPitch;
        this._maxPitch = thatI.maxPitch;
        this._renderWorldCopies = thatI.renderWorldCopies;
        if (constrain) {
            this._constrain();
        }
        this._calcMatrices();
    }

    get pixelsToClipSpaceMatrix(): mat4 { return this._pixelsToClipSpaceMatrix; }
    get clipSpaceToPixelsMatrix(): mat4 { return this._clipSpaceToPixelsMatrix; }

    get minElevationForCurrentTile(): number { return this._minElevationForCurrentTile; }
    setMinElevationForCurrentTile(ele: number) {
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
    setMinZoom(zoom: number) {
        if (this._minZoom === zoom) return;
        this._minZoom = zoom;
        this.setZoom(this.getConstrained(this._center, this.zoom).zoom);
    }

    get maxZoom(): number { return this._maxZoom; }
    setMaxZoom(zoom: number) {
        if (this._maxZoom === zoom) return;
        this._maxZoom = zoom;
        this.setZoom(this.getConstrained(this._center, this.zoom).zoom);
    }

    get minPitch(): number { return this._minPitch; }
    setMinPitch(pitch: number) {
        if (this._minPitch === pitch) return;
        this._minPitch = pitch;
        this.setPitch(Math.max(this.pitch, pitch));
    }

    get maxPitch(): number { return this._maxPitch; }
    setMaxPitch(pitch: number) {
        if (this._maxPitch === pitch) return;
        this._maxPitch = pitch;
        this.setPitch(Math.min(this.pitch, pitch));
    }

    get renderWorldCopies(): boolean { return this._renderWorldCopies; }
    setRenderWorldCopies(renderWorldCopies: boolean) {
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
     * Gets the transform's dimensions packed into a Point object.
     */
    get size(): Point {
        return new Point(this._width, this._height);
    }

    get bearing(): number {
        return -this._angle / Math.PI * 180;
    }
    setBearing(bearing: number) {
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
    setPitch(pitch: number) {
        const p = clamp(pitch, this.minPitch, this.maxPitch) / 180 * Math.PI;
        if (this._pitch === p) return;
        this._unmodified = false;
        this._pitch = p;
        this._calcMatrices();
    }

    get fov(): number {
        return this._fov / Math.PI * 180;
    }
    setFov(fov: number) {
        fov = Math.max(0.01, Math.min(60, fov));
        if (this._fov === fov) return;
        this._unmodified = false;
        this._fov = fov / 180 * Math.PI;
        this._calcMatrices();
    }

    get zoom(): number { return this._zoom; }
    setZoom(zoom: number) {
        const constrainedZoom = this.getConstrained(this._center, zoom).zoom;
        if (this._zoom === constrainedZoom) return;
        this._unmodified = false;
        this._zoom = constrainedZoom;
        this._tileZoom = Math.max(0, Math.floor(constrainedZoom));
        this._scale = zoomScale(constrainedZoom);
        this._constrain();
        this._calcMatrices();
    }

    get center(): LngLat { return this._center; }
    setCenter(center: LngLat) {
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
    setElevation(elevation: number) {
        if (elevation === this._elevation) return;
        this._elevation = elevation;
        this._constrain();
        this._calcMatrices();
    }

    get padding(): PaddingOptions { return this._edgeInsets.toJSON(); }
    setPadding(padding: PaddingOptions) {
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
     * Return what zoom level of a tile source would most closely cover the tiles displayed by this transform.
     * @param options - The options, most importantly the source's tile size.
     * @returns An integer zoom level at which all tiles will be visible.
     */
    coveringZoomLevel(options: CoveringZoomOptions): number {
        const z = (options.roundZoom ? Math.round : Math.floor)(
            this.zoom + scaleZoom(this._tileSize / options.tileSize)
        );
        // At negative zoom levels load tiles from z0 because negative tile zoom levels don't exist.
        return Math.max(0, z);
    }

    resize(width: number, height: number) {
        this._width = width;
        this._height = height;
        this._constrain();
        this._calcMatrices();
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

    private getConstrained(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
        return this._callbacks.getConstrained(lngLat, zoom);
    }

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
    getCameraQueryGeometry(cameraPoint: Point, queryGeometry: Array<Point>): Array<Point> {
        if (queryGeometry.length === 1) {
            return [queryGeometry[0], cameraPoint];
        } else {
            let minX = cameraPoint.x;
            let minY = cameraPoint.y;
            let maxX = cameraPoint.x;
            let maxY = cameraPoint.y;
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
     * @internal
     * Snaps the transform's center, zoom, etc. into the valid range.
     */
    private _constrain(): void {
        if (!this.center || !this._width || !this._height || this._constraining) return;
        this._constraining = true;
        const unmodified = this._unmodified;
        const {center, zoom} = this.getConstrained(this.center, this.zoom);
        this.setCenter(center);
        this.setZoom(zoom);
        this._unmodified = unmodified;
        this._constraining = false;
    }

    /**
     * This function is called every time one of the transform's defining properties (center, pitch, etc.) changes.
     * This function should update the transform's internal data, such as matrices.
     * Any derived `_calcMatrices` function should also call the base function first. The base function only depends on the `_width` and `_height` fields.
     */
    private _calcMatrices(): void {
        if (this._width && this._height) {
            this._pixelsToGLUnits = [2 / this._width, -2 / this._height];

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
        this._callbacks.calcMatrices();
    }
}
