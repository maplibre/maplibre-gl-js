import {LngLat, type LngLatLike} from './lng_lat.ts';
import {LngLatBounds} from './lng_lat_bounds.ts';
import Point from '@mapbox/point-geometry';
import {wrap, clamp, degreesToRadians, zoomScale, MAX_VALID_LATITUDE, scaleZoom, warnOnce} from '../util/util.ts';
import {mat4, mat2} from 'gl-matrix';
import {EdgeInsets} from './edge_insets.ts';
import {MercatorCoordinate, mercatorWorldCoordinateHelper} from './mercator_coordinate.ts';
import {cameraDirectionFromPitchBearing, maxMercatorHorizonAngle} from './projection/mercator_utils.ts';
import {EXTENT} from '../data/extent.ts';
import {Bounds} from './bounds.ts';
import {createCameraState, getBearing, getCenterPoint, getFov, getPitch, getRoll, getWorldSize, type CameraState} from './camera_state.ts';

import type {WorldCoordinateHelper} from './transform_interface.ts';
import type {PaddingOptions} from './edge_insets.ts';
import type {IReadonlyTransform, ITransformGetters, NearFarZ, TransformConstrainFunction} from './transform_interface.ts';
/**
 * If a path crossing the antimeridian would be shorter, extend the final coordinate so that
 * interpolating between the two endpoints will cross it. A world that does not wrap has no antimeridian to cross.
 * @param center - The LngLat object of the desired center. This object will be mutated.
 */
export function normalizeCenter(tr: IReadonlyTransform, center: LngLat): void {
    if (!tr.renderWorldCopies || !tr.worldCoordinateHelper.wraps || tr.lngRange) return;
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
     * The minimum zoom level of the map. Users cannot zoom out beyond this level. (0–24)
     * @defaultValue 0
     */
    minZoom?: number;
    /**
     * The maximum zoom level of the map. Users cannot zoom in beyond this level. (0–24)
     * @defaultValue 22
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
    /**
     * The camera's lng/lat to world coordinate mapping, fixed for the transform's lifetime. Defaults to mercator.
     */
    worldCoordinateHelper?: WorldCoordinateHelper;
};

function getTileZoom(zoom: number): number {
    return Math.max(0, Math.floor(zoom));
}

/** The most passes {@link TransformHelper._centerAlongView} takes to agree on the mercator scale at the center it finds. */
const MAX_CENTER_PASSES = 10;

/**
 * @internal
 * This class stores all values that define a transform's state,
 * such as center, zoom, minZoom, etc.
 * This can be used as a helper for implementing the ITransform interface.
 */
export class TransformHelper implements ITransformGetters {
    private _callbacks: TransformHelperCallbacks;

    private readonly _cameraState: CameraState;
    /**
     * Whether the camera was never deliberately positioned, in which case a loading style may apply its own camera.
     * Cleared by the setters that move the camera, but not by ones that only snap it into a valid range.
     */
    _unmodified: boolean;

    _constraining: boolean;

    _constrainOverride: TransformConstrainFunction;

    private readonly _worldCoordinateHelper: WorldCoordinateHelper;

    constructor(callbacks: TransformHelperCallbacks, options?: TransformOptions) {
        this._callbacks = callbacks;
        this._cameraState = createCameraState(options);
        this._worldCoordinateHelper = options?.worldCoordinateHelper ?? mercatorWorldCoordinateHelper;

        this._constrainOverride = options?.constrainOverride ?? null;

        this._unmodified = true;
    }

    public apply(thatI: ITransformGetters, constrain: boolean): void {
        this._constrainOverride = thatI.constrainOverride;
        this._cameraState.latRange = thatI.latRange;
        this._cameraState.lngRange = thatI.lngRange;
        this._cameraState.width = thatI.width;
        this._cameraState.height = thatI.height;
        this._cameraState.center = thatI.center;
        this._cameraState.elevation = thatI.elevation;
        this._cameraState.minElevationForCurrentTile = thatI.minElevationForCurrentTile;
        this._cameraState.zoom = thatI.zoom;
        this._cameraState.tileZoom = getTileZoom(this._cameraState.zoom);
        this._cameraState.scale = zoomScale(this._cameraState.zoom);
        this._cameraState.bearingInRadians = thatI.bearingInRadians;
        this._cameraState.fovInRadians = thatI.fovInRadians;
        this._cameraState.pitchInRadians = thatI.pitchInRadians;
        this._cameraState.rollInRadians = thatI.rollInRadians;
        this._unmodified = thatI.unmodified;
        this._cameraState.edgeInsets = new EdgeInsets(thatI.padding.top, thatI.padding.bottom, thatI.padding.left, thatI.padding.right);
        this._cameraState.minZoom = thatI.minZoom;
        this._cameraState.maxZoom = thatI.maxZoom;
        this._cameraState.minPitch = thatI.minPitch;
        this._cameraState.maxPitch = thatI.maxPitch;
        this._cameraState.renderWorldCopies = thatI.renderWorldCopies;
        this._cameraState.cameraToCenterDistance = thatI.cameraToCenterDistance;
        this._cameraState.nearFarZOverride = thatI.nearFarZOverride;
        if (constrain) {
            this.constrainInternal();
        }
        this._calcMatrices();
    }

    get pixelsToClipSpaceMatrix(): mat4 { return this._cameraState.pixelsToClipSpaceMatrix; }
    get clipSpaceToPixelsMatrix(): mat4 { return this._cameraState.clipSpaceToPixelsMatrix; }

    get minElevationForCurrentTile(): number { return this._cameraState.minElevationForCurrentTile; }
    setMinElevationForCurrentTile(ele: number): void {
        if (ele === this._cameraState.minElevationForCurrentTile) return;
        this._cameraState.minElevationForCurrentTile = ele;
        this._calcMatrices();
    }

    get tileSize(): number { return this._cameraState.tileSize; }
    get tileZoom(): number { return this._cameraState.tileZoom; }
    get scale(): number { return this._cameraState.scale; }

    /**
     * Gets the transform's width in pixels. Use {@link resize} to set the transform's size.
     */
    get width(): number { return this._cameraState.width; }

    /**
     * Gets the transform's height in pixels. Use {@link resize} to set the transform's size.
     */
    get height(): number { return this._cameraState.height; }

    /**
     * Gets the transform's bearing in radians.
     */
    get bearingInRadians(): number { return this._cameraState.bearingInRadians; }

    get lngRange(): [number, number] { return this._cameraState.lngRange; }
    get latRange(): [number, number] { return this._cameraState.latRange; }
    get worldCoordinateHelper(): WorldCoordinateHelper { return this._worldCoordinateHelper; }

    get pixelsToGLUnits(): [number, number] { return this._cameraState.pixelsToGLUnits; }

    get minZoom(): number { return this._cameraState.minZoom; }
    setMinZoom(zoom: number): void {
        if (this._cameraState.minZoom === zoom) return;
        this._cameraState.minZoom = zoom;
        const unmodified = this._unmodified;
        this.setZoom(this.applyConstrain(this._cameraState.center, this.zoom).zoom);
        this._unmodified = unmodified;
    }

    get maxZoom(): number { return this._cameraState.maxZoom; }
    setMaxZoom(zoom: number): void {
        if (this._cameraState.maxZoom === zoom) return;
        this._cameraState.maxZoom = zoom;
        const unmodified = this._unmodified;
        this.setZoom(this.applyConstrain(this._cameraState.center, this.zoom).zoom);
        this._unmodified = unmodified;
    }

    get minPitch(): number { return this._cameraState.minPitch; }
    setMinPitch(pitch: number): void {
        if (this._cameraState.minPitch === pitch) return;
        this._cameraState.minPitch = pitch;
        const unmodified = this._unmodified;
        this.setPitch(Math.max(this.pitch, pitch));
        this._unmodified = unmodified;
    }

    get maxPitch(): number { return this._cameraState.maxPitch; }
    setMaxPitch(pitch: number): void {
        if (this._cameraState.maxPitch === pitch) return;
        this._cameraState.maxPitch = pitch;
        const unmodified = this._unmodified;
        this.setPitch(Math.min(this.pitch, pitch));
        this._unmodified = unmodified;
    }

    get renderWorldCopies(): boolean { return this._cameraState.renderWorldCopies; }
    setRenderWorldCopies(renderWorldCopies: boolean): void {
        if (renderWorldCopies === undefined) {
            renderWorldCopies = true;
        } else if (renderWorldCopies === null) {
            renderWorldCopies = false;
        }

        if (renderWorldCopies && !this._worldCoordinateHelper.wraps) {
            warnOnce('renderWorldCopies has no effect in a projection whose world does not wrap.');
        }
        this._cameraState.renderWorldCopies = renderWorldCopies;
    }

    get constrainOverride(): TransformConstrainFunction { return this._constrainOverride; }
    setConstrainOverride(constrain?: TransformConstrainFunction | null): void {
        if (constrain === undefined) constrain = null;
        if (this._constrainOverride === constrain) return;
        this._constrainOverride = constrain;
        this.constrainInternal();
        this._calcMatrices();
    }

    get worldSize(): number {
        return getWorldSize(this._cameraState);
    }

    /**
     * Gets the transform's dimensions packed into a Point object.
     */
    get size(): Point {
        return new Point(this._cameraState.width, this._cameraState.height);
    }

    get bearing(): number {
        return getBearing(this._cameraState);
    }
    setBearing(bearing: number): void {
        const b = wrap(bearing, -180, 180) * Math.PI / 180;
        if (this._cameraState.bearingInRadians === b) return;
        this._unmodified = false;
        this._cameraState.bearingInRadians = b;
        this._calcMatrices();

        // 2x2 matrix for rotating points
        this._cameraState.rotationMatrix = mat2.create();
        mat2.rotate(this._cameraState.rotationMatrix, this._cameraState.rotationMatrix, -this._cameraState.bearingInRadians);
    }

    get rotationMatrix(): mat2 { return this._cameraState.rotationMatrix; }

    get pitchInRadians(): number {
        return this._cameraState.pitchInRadians;
    }
    get pitch(): number {
        return getPitch(this._cameraState);
    }
    setPitch(pitch: number): void {
        const p = clamp(pitch, this.minPitch, this.maxPitch) / 180 * Math.PI;
        if (this._cameraState.pitchInRadians === p) return;
        this._unmodified = false;
        this._cameraState.pitchInRadians = p;
        this._calcMatrices();
    }

    get rollInRadians(): number {
        return this._cameraState.rollInRadians;
    }
    get roll(): number {
        return getRoll(this._cameraState);
    }
    setRoll(roll: number): void {
        const r = roll / 180 * Math.PI;
        if (this._cameraState.rollInRadians === r) return;
        this._unmodified = false;
        this._cameraState.rollInRadians = r;
        this._calcMatrices();
    }

    get fovInRadians(): number {
        return this._cameraState.fovInRadians;
    }
    get fov(): number {
        return getFov(this._cameraState);
    }
    setFov(fov: number): void {
        fov = clamp(fov, 0.1, 150);
        if (this.fov === fov) return;
        this._unmodified = false;
        this._cameraState.fovInRadians = degreesToRadians(fov);
        this._calcMatrices();
    }

    get zoom(): number { return this._cameraState.zoom; }
    setZoom(zoom: number): void {
        const constrainedZoom = this.applyConstrain(this._cameraState.center, zoom).zoom;
        if (this._cameraState.zoom === constrainedZoom) return;
        this._unmodified = false;
        this._cameraState.zoom = constrainedZoom;
        this._cameraState.tileZoom = Math.max(0, Math.floor(constrainedZoom));
        this._cameraState.scale = zoomScale(constrainedZoom);
        this.constrainInternal();
        this._calcMatrices();
    }

    get center(): LngLat { return this._cameraState.center; }
    setCenter(center: LngLat): void {
        if (center.lat === this._cameraState.center.lat && center.lng === this._cameraState.center.lng) return;
        this._unmodified = false;
        this._cameraState.center = center;
        this.constrainInternal();
        this._calcMatrices();
    }

    /**
     * Moves the center and the zoom in one write, to a camera that is already constrained.
     */
    setCenterAndZoom(center: LngLat, zoom: number): void {
        const state = this._cameraState;
        this._unmodified = false;
        state.center = center;
        state.zoom = zoom;
        state.tileZoom = Math.max(0, Math.floor(zoom));
        state.scale = zoomScale(zoom);
        this._calcMatrices();
    }

    /**
     * Elevation at current center point, meters above sea level
     */
    get elevation(): number { return this._cameraState.elevation; }
    setElevation(elevation: number): void {
        if (elevation === this._cameraState.elevation) return;
        this._cameraState.elevation = elevation;
        this.constrainInternal();
        this._calcMatrices();
    }

    get padding(): PaddingOptions { return this._cameraState.edgeInsets.toJSON(); }
    setPadding(padding: PaddingOptions): void {
        if (this._cameraState.edgeInsets.equals(padding)) return;
        this._unmodified = false;
        // Update edge-insets in-place
        this._cameraState.edgeInsets.interpolate(this._cameraState.edgeInsets, padding, 1);
        this.constrainInternal();
        this._calcMatrices();
    }

    /**
     * The center of the screen in pixels with the top-left corner being (0,0)
     * and +y axis pointing downwards. This accounts for padding.
     */
    get centerPoint(): Point {
        return getCenterPoint(this._cameraState);
    }

    /**
     * @internal
     */
    get pixelsPerMeter(): number { return this._cameraState.pixelsPerMeter; }

    get unmodified(): boolean { return this._unmodified; }

    /**
     * The camera state, which only the helper changes and the projection classes read their camera values from.
     */
    get cameraState(): Readonly<CameraState> { return this._cameraState; }

    get cameraToCenterDistance(): number { return this._cameraState.cameraToCenterDistance; }

    get nearFarZOverride(): NearFarZ | null { return this._cameraState.nearFarZOverride; }
    get autoCalculateNearFarZ(): boolean { return this._cameraState.nearFarZOverride === null; }
    overrideNearFarZ(nearZ: number, farZ: number): void {
        this._cameraState.nearFarZOverride = {nearZ, farZ};
        this._calcMatrices();
    }
    clearNearFarZOverride(): void {
        this._cameraState.nearFarZOverride = null;
        this._calcMatrices();
    }

    /**
     * Returns if the padding params match
     *
     * @param padding - the padding to check against
     * @returns true if they are equal, false otherwise
     */
    isPaddingEqual(padding: PaddingOptions): boolean {
        return this._cameraState.edgeInsets.equals(padding);
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
        this._cameraState.edgeInsets.interpolate(start, target, t);
        this.constrainInternal();
        this._calcMatrices();
    }

    resize(width: number, height: number, constrain: boolean = true): void {
        this._cameraState.width = width;
        this._cameraState.height = height;
        if (constrain) this.constrainInternal();
        this._calcMatrices();
    }

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns max bounds
     */
    getMaxBounds(): LngLatBounds | null {
        if (!this._cameraState.lngRange &&
            this._cameraState.latRange[0] === -MAX_VALID_LATITUDE &&
            this._cameraState.latRange[1] === MAX_VALID_LATITUDE) return null;

        return new LngLatBounds([
            this._cameraState.lngRange?.[0] ?? -Infinity,
            this._cameraState.latRange[0],
            this._cameraState.lngRange?.[1] ?? Infinity,
            this._cameraState.latRange[1]
        ]);
    }

    /**
     * Sets or clears the map's geographical constraints.
     * @param bounds - A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds?: LngLatBounds | null): void {
        if (!bounds) {
            this._cameraState.lngRange = null;
            this._cameraState.latRange = [-MAX_VALID_LATITUDE, MAX_VALID_LATITUDE];
            return;
        }

        const west = bounds.getWest();
        const east = bounds.getEast();
        const south = bounds.getSouth();
        const north = bounds.getNorth();

        const longitudeUnconstrained = west === -Infinity && east === Infinity;
        if ((!Number.isFinite(west) || !Number.isFinite(east)) && !longitudeUnconstrained) {
            throw new Error('Longitude maxBounds values must either be finite or span from -Infinity to Infinity');
        }

        this._cameraState.lngRange = longitudeUnconstrained ? null : [west, east];
        this._cameraState.latRange = [
            clamp(south, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE),
            clamp(north, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
        ];
        this.constrainInternal();
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
    getCameraQueryGeometry(cameraPoint: Point, queryGeometry: Point[]): Point[] {
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
     * Where the constrain puts a camera moved to `center` and `zoom`. A transform without a size is not constrained,
     * so it keeps the two as they are.
     */
    getConstrainedCamera(center: LngLat, zoom: number): {center: LngLat; zoom: number} {
        if (!this._cameraState.width || !this._cameraState.height) return {center, zoom};
        const constrained = this.applyConstrain(center, zoom);
        return {center: constrained.center, zoom: this.applyConstrain(constrained.center, constrained.zoom).zoom};
    }

    /**
     * @internal
     * Snaps the transform's center, zoom, etc. into the valid range.
     */
    private constrainInternal(): void {
        if (!this.center || !this._cameraState.width || !this._cameraState.height || this._constraining) return;
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
     * While either dimension is zero there is no view to build, so the derived function is not called at all.
     */
    private _calcMatrices(): void {
        this._cameraState.pixelsPerMeter = this.worldCoordinateHelper.worldZFromAltitude(1, this.center) * this.worldSize;
        if (!this._cameraState.width || !this._cameraState.height) {
            return;
        }
        this._cameraState.pixelsToGLUnits = [2 / this._cameraState.width, -2 / this._cameraState.height];

        let m = mat4.identity(new Float64Array(16));
        mat4.scale(m, m, [this._cameraState.width / 2, -this._cameraState.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        this._cameraState.clipSpaceToPixelsMatrix = m;

        m = mat4.identity(new Float64Array(16));
        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [-1, -1, 0]);
        mat4.scale(m, m, [2 / this._cameraState.width, 2 / this._cameraState.height, 1]);
        this._cameraState.pixelsToClipSpaceMatrix = m;
        const halfFov = this.fovInRadians / 2;
        this._cameraState.cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this._cameraState.height;
        this._callbacks.calcMatrices();
    }

    calculateCenterFromCameraLngLatAlt(lnglat: LngLatLike, alt: number, bearing?: number, pitch?: number): {center: LngLat; elevation: number; zoom: number} {
        const cameraBearing = bearing !== undefined ? bearing : this.bearing;
        const cameraPitch = pitch = pitch !== undefined ? pitch : this.pitch;

        const {distanceToCenter, clampedElevation} = this._distanceToCenterFromAltElevationPitch(alt, this.elevation, cameraPitch);
        const {x, y} = cameraDirectionFromPitchBearing(cameraPitch, cameraBearing);
        
        const worldCoordinateHelper = this.worldCoordinateHelper;
        const cameraLngLat = LngLat.convert(lnglat);
        const camMercator = worldCoordinateHelper.worldFromLngLat(cameraLngLat.lng, cameraLngLat.lat, alt);
        const {centerMercator, dMercator} = this._centerAlongView(camMercator, x, y, distanceToCenter, worldCoordinateHelper.metersPerWorldUnit(camMercator.x, camMercator.y));
        const center = worldCoordinateHelper.lngLatFromWorld(centerMercator.x, centerMercator.y);
        const zoom = scaleZoom(this.height / 2 / Math.tan(this.fovInRadians / 2) / dMercator / this.tileSize);
        return {center, elevation: clampedElevation, zoom};
    }

    /**
     * Moves the center along the view to the given elevation with the camera where it is, and sets the zoom to match.
     * The center is found along the view from the camera's position, which is kept, by {@link _centerAlongView},
     * starting from the old center's mercator scale. The matrices are recomputed even where `setZoom` leaves the zoom
     * as it was, as at a zoom bound, since the center and its elevation have moved.
     * @param elevation - the elevation in meters for the center
     */
    recalculateZoomAndCenter(elevation: number): void {
        if (this.elevation - elevation === 0) return;

        const cameraPitch = this.pitch;
        const cameraBearing = this.bearing;
        const {x, y, z} = cameraDirectionFromPitchBearing(cameraPitch, cameraBearing);
        const worldCoordinateHelper = this.worldCoordinateHelper;
        const originalCenterMercator = worldCoordinateHelper.worldFromLngLat(this.center.lng, this.center.lat, this.elevation);
        const originalMetersPerMercUnit = 1 / worldCoordinateHelper.worldZFromAltitude(1, this.center);
        const dCamMercator = this.cameraToCenterDistance / this.worldSize;
        const camMercator = new MercatorCoordinate(originalCenterMercator.x - x * dCamMercator, originalCenterMercator.y - y * dCamMercator, originalCenterMercator.z + z * dCamMercator);

        const {distanceToCenter, clampedElevation} = this._distanceToCenterFromAltElevationPitch(camMercator.z * originalMetersPerMercUnit, elevation, cameraPitch);
        const {centerMercator, dMercator} = this._centerAlongView(camMercator, x, y, distanceToCenter, originalMetersPerMercUnit);
        const center = worldCoordinateHelper.lngLatFromWorld(centerMercator.x, centerMercator.y);
        const zoom = scaleZoom(this.cameraToCenterDistance / dMercator / this.tileSize);

        // Update matrices
        this._cameraState.elevation = clampedElevation;
        this._cameraState.center = center;
        const previousZoom = this._cameraState.zoom;
        this.setZoom(zoom);
        if (this._cameraState.zoom === previousZoom) {
            this._unmodified = false;
            this.constrainInternal();
            this._calcMatrices();
        }
    }

    /**
     * The center `distanceToCenter` meters from the camera along the view, in world units, and that distance in
     * world units. The mercator scale changes with latitude and the center's latitude is unknown until the center
     * is: each pass places the center with the scale at the center the last pass found, from `metersPerMercUnit`,
     * and stops once two passes agree. Zoomed far out at a high latitude the scale changes faster along the view than
     * a pass follows; a pass that would move the center further than the last one did ends the search at the last
     * stable center instead of oscillating (#6775).
     * @param cameraMercator - the camera's position
     * @param x - the view direction's x component, see {@link cameraDirectionFromPitchBearing}
     * @param y - the view direction's y component
     * @param distanceToCenter - the camera's distance to the center in meters
     * @param metersPerMercUnit - the mercator scale to start from
     */
    private _centerAlongView(cameraMercator: MercatorCoordinate, x: number, y: number, distanceToCenter: number, metersPerMercUnit: number): {centerMercator: MercatorCoordinate; dMercator: number} {
        let dMercator = distanceToCenter / metersPerMercUnit;
        let centerMercator = new MercatorCoordinate(cameraMercator.x + x * dMercator, cameraMercator.y + y * dMercator);
        let step = Infinity;
        for (let pass = 1; pass < MAX_CENTER_PASSES; pass++) {
            const centerMetersPerMercUnit = this.worldCoordinateHelper.metersPerWorldUnit(centerMercator.x, centerMercator.y);
            const nextStep = Math.abs(centerMetersPerMercUnit - metersPerMercUnit);
            if (nextStep <= 1e-12 * metersPerMercUnit || nextStep >= step) break;
            step = nextStep;
            metersPerMercUnit = centerMetersPerMercUnit;
            dMercator = distanceToCenter / metersPerMercUnit;
            centerMercator = new MercatorCoordinate(cameraMercator.x + x * dMercator, cameraMercator.y + y * dMercator);
        }
        return {centerMercator, dMercator};
    }

    _distanceToCenterFromAltElevationPitch(alt: number, elevation: number, pitch: number): {distanceToCenter: number; clampedElevation: number} {
        const dzNormalized = -Math.cos(degreesToRadians(pitch));
        const altitudeAGL = alt - elevation;
        let distanceToCenter: number;
        let clampedElevation = elevation;
        if (dzNormalized * altitudeAGL >= 0.0 || Math.abs(dzNormalized) < Math.cos(degreesToRadians(maxMercatorHorizonAngle))) {
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

    getMercatorTileCoordinates(overscaledTileID?: { canonical: {x: number; y: number; z: number}} | null): [number, number, number, number] {
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
