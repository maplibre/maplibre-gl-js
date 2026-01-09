import {LngLat, type LngLatLike} from './lng_lat';
import {LngLatBounds} from './lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, degreesToRadians, radiansToDegrees, zoomScale, MAX_VALID_LATITUDE, scaleZoom} from '../util/util';
import {mat4, mat2} from 'gl-matrix';
import {EdgeInsets} from './edge_insets';
import {altitudeFromMercatorZ, MercatorCoordinate, mercatorZfromAltitude} from './mercator_coordinate';
import {cameraMercatorCoordinateFromCenterAndRotation, cameraDirectionFromPitchBearing} from './projection/mercator_utils';
import {EXTENT} from '../data/extent';

import type {PaddingOptions} from './edge_insets';
import type {IReadonlyTransform, ITransformGetters, TransformConstrainFunction} from './transform_interface';
import type {OverscaledTileID} from '../tile/tile_id';
import {Bounds} from './bounds';
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
     * The transform's default getter of center lngLat and zoom to ensure that
     * 1) everything beyond the bounds is excluded
     * 2) a given lngLat is as near the center as possible
     * Bounds are those set by maxBounds or North & South "Poles" and, if only 1 globe is displayed, antimeridian.
     */
    defaultConstrain: TransformConstrainFunction;

    /**
     * Updates the underlying transform's internal matrices.
     */
    calcMatrices: () => void;
};

export type TransformOptions = {
    /**
     * The minimum zoom level of the map.
     */
    minZoom?: number;
    /**
     * The maximum zoom level of the map.
     */
    maxZoom?: number;
    /**
     * The minimum pitch of the map.
     */
    minPitch?: number;
    /**
     * The maximum pitch of the map.
     */
    maxPitch?: number;
    /**
     * Whether to render multiple copies of the world side by side in the map.
     */
    renderWorldCopies?: boolean;
    /**
     * An override of the transform's default constraining function for respecting its longitude and latitude bounds.
     */
    constrainOverride?: TransformConstrainFunction | null;
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
    _fovInRadians: number;
    /**
     * This transform's bearing in radians.
     */
    _bearingInRadians: number;
    /**
     * Pitch in radians.
     */
    _pitchInRadians: number;
    /**
     * Roll in radians.
     */
    _rollInRadians: number;
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
    _cameraToCenterDistance: number;

    _nearZ: number;
    _farZ: number;
    _autoCalculateNearFarZ: boolean;

    _constrainOverride: TransformConstrainFunction;

    constructor(callbacks: TransformHelperCallbacks, options?: TransformOptions) {
        this._callbacks = callbacks;
        this._tileSize = 512; // constant

        this._renderWorldCopies = options?.renderWorldCopies === undefined ? true : !!options?.renderWorldCopies;
        this._minZoom = options?.minZoom || 0;
        this._maxZoom = options?.maxZoom || 22;

        this._minPitch = (options?.minPitch === undefined || options?.minPitch === null) ? 0 : options?.minPitch;
        this._maxPitch = (options?.maxPitch === undefined || options?.maxPitch === null) ? 60 : options?.maxPitch;

        this._constrainOverride = options?.constrainOverride ?? null;

        this.setMaxBounds();

        this._width = 0;
        this._height = 0;
        this._center = new LngLat(0, 0);
        this._elevation = 0;
        this._zoom = 0;
        this._tileZoom = getTileZoom(this._zoom);
        this._scale = zoomScale(this._zoom);
        this._bearingInRadians = 0;
        this._fovInRadians = 0.6435011087932844;
        this._pitchInRadians = 0;
        this._rollInRadians = 0;
        this._unmodified = true;
        this._edgeInsets = new EdgeInsets();
        this._minElevationForCurrentTile = 0;
        this._autoCalculateNearFarZ = true;
    }

    public apply(thatI: ITransformGetters, constrain: boolean, forceOverrideZ?: boolean): void {
        this._constrainOverride = thatI.constrainOverride;
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
        this._bearingInRadians = thatI.bearingInRadians;
        this._fovInRadians = thatI.fovInRadians;
        this._pitchInRadians = thatI.pitchInRadians;
        this._rollInRadians = thatI.rollInRadians;
        this._unmodified = thatI.unmodified;
        this._edgeInsets = new EdgeInsets(thatI.padding.top, thatI.padding.bottom, thatI.padding.left, thatI.padding.right);
        this._minZoom = thatI.minZoom;
        this._maxZoom = thatI.maxZoom;
        this._minPitch = thatI.minPitch;
        this._maxPitch = thatI.maxPitch;
        this._renderWorldCopies = thatI.renderWorldCopies;
        this._cameraToCenterDistance = thatI.cameraToCenterDistance;
        this._nearZ = thatI.nearZ;
        this._farZ = thatI.farZ;
        this._autoCalculateNearFarZ = !forceOverrideZ && thatI.autoCalculateNearFarZ;
        if (constrain) {
            this.constrainInternal();
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
    get bearingInRadians(): number { return this._bearingInRadians; }

    get lngRange(): [number, number] { return this._lngRange; }
    get latRange(): [number, number] { return this._latRange; }

    get pixelsToGLUnits(): [number, number] { return this._pixelsToGLUnits; }

    get minZoom(): number { return this._minZoom; }
    setMinZoom(zoom: number) {
        if (this._minZoom === zoom) return;
        this._minZoom = zoom;
        this.setZoom(this.applyConstrain(this._center, this.zoom).zoom);
    }

    get maxZoom(): number { return this._maxZoom; }
    setMaxZoom(zoom: number) {
        if (this._maxZoom === zoom) return;
        this._maxZoom = zoom;
        this.setZoom(this.applyConstrain(this._center, this.zoom).zoom);
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

    get constrainOverride(): TransformConstrainFunction { return this._constrainOverride; }
    setConstrainOverride(constrain?: TransformConstrainFunction | null) {
        if (constrain === undefined) constrain = null;
        if (this._constrainOverride === constrain) return;
        this._constrainOverride = constrain;
        this.constrainInternal();
        this._calcMatrices();
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
        return this._bearingInRadians / Math.PI * 180;
    }
    setBearing(bearing: number) {
        const b = wrap(bearing, -180, 180) * Math.PI / 180;
        if (this._bearingInRadians === b) return;
        this._unmodified = false;
        this._bearingInRadians = b;
        this._calcMatrices();

        // 2x2 matrix for rotating points
        this._rotationMatrix = mat2.create();
        mat2.rotate(this._rotationMatrix, this._rotationMatrix, -this._bearingInRadians);
    }

    get rotationMatrix(): mat2 { return this._rotationMatrix; }

    get pitchInRadians(): number {
        return this._pitchInRadians;
    }
    get pitch(): number {
        return this._pitchInRadians / Math.PI * 180;
    }
    setPitch(pitch: number) {
        const p = clamp(pitch, this.minPitch, this.maxPitch) / 180 * Math.PI;
        if (this._pitchInRadians === p) return;
        this._unmodified = false;
        this._pitchInRadians = p;
        this._calcMatrices();
    }

    get rollInRadians(): number {
        return this._rollInRadians;
    }
    get roll(): number {
        return this._rollInRadians / Math.PI * 180;
    }
    setRoll(roll: number) {
        const r = roll / 180 * Math.PI;
        if (this._rollInRadians === r) return;
        this._unmodified = false;
        this._rollInRadians = r;
        this._calcMatrices();
    }

    get fovInRadians(): number {
        return this._fovInRadians;
    }
    get fov(): number {
        return radiansToDegrees(this._fovInRadians);
    }
    setFov(fov: number) {
        fov = clamp(fov, 0.1, 150);
        if (this.fov === fov) return;
        this._unmodified = false;
        this._fovInRadians = degreesToRadians(fov);
        this._calcMatrices();
    }

    get zoom(): number { return this._zoom; }
    setZoom(zoom: number) {
        const constrainedZoom = this.applyConstrain(this._center, zoom).zoom;
        if (this._zoom === constrainedZoom) return;
        this._unmodified = false;
        this._zoom = constrainedZoom;
        this._tileZoom = Math.max(0, Math.floor(constrainedZoom));
        this._scale = zoomScale(constrainedZoom);
        this.constrainInternal();
        this._calcMatrices();
    }

    get center(): LngLat { return this._center; }
    setCenter(center: LngLat) {
        if (center.lat === this._center.lat && center.lng === this._center.lng) return;
        this._unmodified = false;
        this._center = center;
        this.constrainInternal();
        this._calcMatrices();
    }

    /**
     * Elevation at current center point, meters above sea level
     */
    get elevation(): number { return this._elevation; }
    setElevation(elevation: number) {
        if (elevation === this._elevation) return;
        this._elevation = elevation;
        this.constrainInternal();
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

    get cameraToCenterDistance(): number { return this._cameraToCenterDistance; }

    get nearZ(): number { return this._nearZ; }
    get farZ(): number { return this._farZ; }
    get autoCalculateNearFarZ(): boolean { return this._autoCalculateNearFarZ; }
    overrideNearFarZ(nearZ: number, farZ: number): void {
        this._autoCalculateNearFarZ = false;
        this._nearZ = nearZ;
        this._farZ = farZ;
        this._calcMatrices();
    }
    clearNearFarZOverride(): void {
        this._autoCalculateNearFarZ = true;
        this._calcMatrices();
    }

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
        this.constrainInternal();
        this._calcMatrices();
    }

    resize(width: number, height: number, constrain: boolean = true): void {
        this._width = width;
        this._height = height;
        if (constrain) this.constrainInternal();
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
            this.constrainInternal();
        } else {
            this._lngRange = null;
            this._latRange = [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE];
        }
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
            const {minX, minY, maxX, maxY} = Bounds.fromPoints(queryGeometry).extend(cameraPoint);
            return [
                new Point(minX, minY),
                new Point(maxX, minY),
                new Point(maxX, maxY),
                new Point(minX, maxY),
                new Point(minX, minY)
            ];
        }
    }

    applyConstrain: TransformConstrainFunction = (lngLat, zoom) => {
        if (this._constrainOverride !== null) {
            return this._constrainOverride(lngLat, zoom);
        } else {
            return this._callbacks.defaultConstrain(lngLat, zoom);
        }
    };

    /**
     * @internal
     * Snaps the transform's center, zoom, etc. into the valid range.
     */
    private constrainInternal(): void {
        if (!this.center || !this._width || !this._height || this._constraining) return;
        this._constraining = true;
        const unmodified = this._unmodified;
        const {center, zoom} = this.applyConstrain(this.center, this.zoom);
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
            const halfFov = this.fovInRadians / 2;
            this._cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this._height;
        }
        this._callbacks.calcMatrices();
    }

    calculateCenterFromCameraLngLatAlt(lnglat: LngLatLike, alt: number, bearing?: number, pitch?: number): {center: LngLat; elevation: number; zoom: number} {
        const cameraBearing = bearing !== undefined ? bearing : this.bearing;
        const cameraPitch = pitch = pitch !== undefined ? pitch : this.pitch;

        const {distanceToCenter, clampedElevation} = this._distanceToCenterFromAltElevationPitch(alt, this.elevation, cameraPitch);
        const {x, y} = cameraDirectionFromPitchBearing(cameraPitch, cameraBearing);
        
        // The mercator transform scale changes with latitude. At high latitudes, there are more "Merc units" per meter
        // than at the equator. We treat the center point as our fundamental quantity. This means we want to convert
        // elevation to Mercator Z using the scale factor at the center point (not the camera point). Since the center point is
        // initially unknown, we compute it using the scale factor at the camera point. This gives us a better estimate of the
        // center point scale factor, which we use to recompute the center point. We repeat until the error is very small.
        // This typically takes about 5 iterations.
        const camMercator = MercatorCoordinate.fromLngLat(lnglat, alt);
        let metersPerMercUnit = altitudeFromMercatorZ(1, camMercator.y);
        let centerMercator: MercatorCoordinate;
        let dMercator: number;
        let iter = 0;
        const maxIter = 10;
        do {
            iter += 1;
            if (iter > maxIter) {
                break;
            }
            dMercator = distanceToCenter / metersPerMercUnit;
            const dx = x * dMercator;
            const dy = y * dMercator;
            centerMercator = new MercatorCoordinate(camMercator.x + dx, camMercator.y + dy);
            metersPerMercUnit = 1 / centerMercator.meterInMercatorCoordinateUnits();
        } while (Math.abs(distanceToCenter - dMercator * metersPerMercUnit) > 1.0e-12);

        const center = centerMercator.toLngLat();
        const zoom = scaleZoom(this.height / 2 / Math.tan(this.fovInRadians / 2) / dMercator / this.tileSize);
        return {center, elevation: clampedElevation, zoom};
    }

    recalculateZoomAndCenter(elevation: number): void {
        if (this.elevation - elevation === 0) return;

        // Critical: Stay in pixels and use original center to avoid instability at extreme latitudes when using Mercator-LngLat
        const mercUnitsPerPixel = 1 / this.worldSize;
        const originalMercUnitsPerMeter = mercatorZfromAltitude(1, this.center.lat);
        const originalPixelsPerMeter = originalMercUnitsPerMeter * this.worldSize;

        // Determine camera
        const originalCenterMercator = MercatorCoordinate.fromLngLat(this.center, this.elevation);
        const originalCenterPixelX = originalCenterMercator.x / mercUnitsPerPixel;
        const originalCenterPixelY = originalCenterMercator.y / mercUnitsPerPixel;
        const originalCenterPixelZ = originalCenterMercator.z / mercUnitsPerPixel;
        
        const cameraPitch = this.pitch;
        const cameraBearing = this.bearing;
        const {x, y, z} = cameraDirectionFromPitchBearing(cameraPitch, cameraBearing);
        const dCamPixel = this.cameraToCenterDistance;
        const camPixelX = originalCenterPixelX + dCamPixel * -x;
        const camPixelY = originalCenterPixelY + dCamPixel * -y;
        const camPixelZ = originalCenterPixelZ + dCamPixel * z;

        // Determine corresponding center
        const {distanceToCenter, clampedElevation} = this._distanceToCenterFromAltElevationPitch(camPixelZ / originalPixelsPerMeter, elevation, cameraPitch);
        const distanceToCenterPixels = distanceToCenter * originalPixelsPerMeter;
        const centerPixelX = camPixelX + x * distanceToCenterPixels;
        const centerPixelY = camPixelY + y * distanceToCenterPixels;
        const center = new MercatorCoordinate(centerPixelX * mercUnitsPerPixel, centerPixelY * mercUnitsPerPixel, 0).toLngLat();

        const mercUnitsPerMeter = mercatorZfromAltitude(1, center.lat);
        const zoom = scaleZoom(this.height / 2 / Math.tan(this.fovInRadians / 2) / distanceToCenter / mercUnitsPerMeter / this.tileSize);

        // Update matrices
        this._elevation = clampedElevation;
        this._center = center;
        this.setZoom(zoom);
    }

    _distanceToCenterFromAltElevationPitch(alt: number, elevation: number, pitch: number): {distanceToCenter: number; clampedElevation: number} {
        const dzNormalized = -Math.cos(degreesToRadians(pitch));
        const altitudeAGL = alt - elevation;
        let distanceToCenter: number;
        let clampedElevation = elevation;
        if (dzNormalized * altitudeAGL >= 0.0 || Math.abs(dzNormalized) < 0.1) {
            distanceToCenter = 10000;
            clampedElevation = alt + distanceToCenter * dzNormalized;
        } else {
            distanceToCenter = -altitudeAGL / dzNormalized;
        }
        return {distanceToCenter, clampedElevation};
    }

    getCameraPoint(): Point {
        const pitch = this.pitchInRadians;
        const offset = Math.tan(pitch) * (this.cameraToCenterDistance || 1);
        return this.centerPoint.add(new Point(offset * Math.sin(this.rollInRadians), offset * Math.cos(this.rollInRadians)));
    }

    getCameraAltitude(): number {
        const altitude = Math.cos(this.pitchInRadians) * this._cameraToCenterDistance / this._pixelPerMeter;
        return altitude + this.elevation;
    }

    getCameraLngLat(): LngLat {
        const pixelPerMeter = mercatorZfromAltitude(1, this.center.lat) * this.worldSize;
        const cameraToCenterDistanceMeters = this.cameraToCenterDistance / pixelPerMeter;
        const camMercator = cameraMercatorCoordinateFromCenterAndRotation(this.center, this.elevation, this.pitch, this.bearing, cameraToCenterDistanceMeters);
        return camMercator.toLngLat();
    }

    getMercatorTileCoordinates(overscaledTileID: OverscaledTileID): [number, number, number, number] {
        if (!overscaledTileID) {
            return [0, 0, 1, 1];
        }
        const scale = (overscaledTileID.canonical.z >= 0) ? (1 << overscaledTileID.canonical.z) : Math.pow(2.0, overscaledTileID.canonical.z);
        return [
            overscaledTileID.canonical.x / scale,
            overscaledTileID.canonical.y / scale,
            1.0 / scale / EXTENT,
            1.0 / scale / EXTENT
        ];
    }
}
