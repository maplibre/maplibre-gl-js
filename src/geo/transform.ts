import Point from '@mapbox/point-geometry';
import {type MercatorCoordinate, mercatorWorldCoordinateHelper} from './mercator_coordinate.ts';
import {createCameraViewState, getBearing, getCenterPoint, getFov, getMaxBounds, getPitch, getRoll, interpolatePadding as interpolatePaddingValues, isPaddingEqual, type CameraViewState} from '../camera/camera_view_state.ts';
import {projectCamera} from '../camera/project_camera.ts';
import {getCameraMath} from '../camera/camera_math_factory.ts';
import {getCameraPoint} from '../camera/projected_camera.ts';
import {calculateCenterFromCameraLngLatAlt, constrainState, interpolatePadding, resize, setBearing, setCenter, setCenterAndZoom, setElevation, setFov, setMaxBounds, setMaxPitch, setMaxZoom, setMinElevationForCurrentTile, setMinPitch, setMinZoom, setNearFarZOverride, setPadding, setPitch, setRenderWorldCopies, setRoll, setZoom} from '../camera/camera_updates.ts';
import {createCameraContext, type CameraContext, type CameraProjectionKind} from '../camera/camera_context.ts';
import {applyConstrain, defaultConstrain} from '../camera/camera_constrain.ts';
import {getCameraSolver} from '../camera/camera_solver_factory.ts';

import type {LngLatBounds} from './lng_lat_bounds.ts';
import type {LngLat, LngLatLike} from './lng_lat.ts';
import type {ProjectedCamera} from '../camera/projected_camera.ts';
import type {mat4, mat2, vec3, vec4} from 'gl-matrix';
import type {PaddingOptions} from './edge_insets.ts';
import type {IReadonlyTransform, ITransform, ITransformGetters} from './transform_interface.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../tile/tile_id.ts';
import type {Terrain} from '../render/terrain.ts';
import type {PointProjection} from '../symbol/projection.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection/projection_data.ts';
import type {Frustum} from '../util/primitives/frustum.ts';
import type {WorldCoordinateHelper} from './world_types.ts';
import type {CameraOptionsFromTo, NearFarZ, TransformConstrainFunction} from '../camera/camera_types.ts';
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

/**
 * @internal
 * This class stores all values that define a transform's state, such as center, zoom, minZoom, etc.,
 * projects its camera with {@link projectCamera}, and computes matrices and projected positions from the projected
 * camera with its projection's {@link CameraMath}.
 */
export class Transform implements ITransform {
    /** The projection the transform projects its camera with, see {@link CameraContext.projection}. */
    private readonly _projection: CameraProjectionKind;
    /** How far a globe is between mercator and the vertical perspective, see {@link CameraContext.projectionTransition}. */
    private _projectionTransition: number = 1;

    private _cameraState: CameraViewState;
    /** {@link Transform._cameraState} projected in {@link Transform.context}. */
    private _projectedCamera: ProjectedCamera;

    _constrainOverride: TransformConstrainFunction;

    private readonly _worldCoordinateHelper: WorldCoordinateHelper;

    /**
     * @param projection - The projection the transform projects its camera with.
     * @param options - Initial state.
     */
    constructor(projection: CameraProjectionKind, options?: TransformOptions) {
        this._projection = projection;
        this._cameraState = createCameraViewState(options);
        this._worldCoordinateHelper = options?.worldCoordinateHelper ?? mercatorWorldCoordinateHelper;

        this._constrainOverride = options?.constrainOverride ?? null;

        this._projectCamera();
    }

    /** A transform of the same projection and globe transition, with this one's state. */
    clone(): ITransform {
        const clone = new Transform(this._projection, {worldCoordinateHelper: this._worldCoordinateHelper});
        clone.setTransitionState(this._projectionTransition);
        clone.apply(this, false);
        return clone;
    }

    public apply(thatI: ITransformGetters, constrain: boolean): void {
        this._constrainOverride = thatI.constrainOverride;
        const view: CameraViewState = {
            ...this._cameraState,
            latRange: thatI.latRange,
            lngRange: thatI.lngRange,
            width: thatI.width,
            height: thatI.height,
            center: thatI.center,
            elevation: thatI.elevation,
            minElevationForCurrentTile: thatI.minElevationForCurrentTile,
            zoom: thatI.zoom,
            bearingInRadians: thatI.bearingInRadians,
            fovInRadians: thatI.fovInRadians,
            pitchInRadians: thatI.pitchInRadians,
            rollInRadians: thatI.rollInRadians,
            unmodified: thatI.unmodified,
            padding: interpolatePaddingValues(thatI.padding, thatI.padding, 1),
            minZoom: thatI.minZoom,
            maxZoom: thatI.maxZoom,
            minPitch: thatI.minPitch,
            maxPitch: thatI.maxPitch,
            renderWorldCopies: thatI.renderWorldCopies,
            nearFarZOverride: thatI.nearFarZOverride,
        };
        this._setState(constrain ? constrainState(view, this.context) : view);
    }

    /** Replaces the camera state, and projects the new one. */
    private _setState(view: CameraViewState): void {
        if (view === this._cameraState) return;
        this._cameraState = view;
        this._projectCamera();
    }

    /** Projects the camera state in the context as they are now, see {@link Transform.projectedCamera}. */
    private _projectCamera(): void {
        this._projectedCamera = projectCamera(this._cameraState, this.context);
    }

    /**
     * The camera state projected in {@link Transform.context}: what the transform's matrices and projected positions are
     * computed from. A camera with no size has metrics but no matrices of its own.
     */
    get projectedCamera(): ProjectedCamera { return this._projectedCamera; }

    get pixelsToClipSpaceMatrix(): mat4 { return this._projectedCamera.pixelsToClipSpaceMatrix; }
    get clipSpaceToPixelsMatrix(): mat4 { return this._projectedCamera.clipSpaceToPixelsMatrix; }

    get minElevationForCurrentTile(): number { return this._cameraState.minElevationForCurrentTile; }
    setMinElevationForCurrentTile(ele: number): void {
        this._setState(setMinElevationForCurrentTile(this._cameraState, ele));
    }

    get tileSize(): number { return this._cameraState.tileSize; }
    get tileZoom(): number { return this._projectedCamera.tileZoom; }
    get scale(): number { return this._projectedCamera.scale; }

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

    get pixelsToGLUnits(): [number, number] { return this._projectedCamera.pixelsToGLUnits; }

    get minZoom(): number { return this._cameraState.minZoom; }
    setMinZoom(zoom: number): void {
        this._setState(setMinZoom(this._cameraState, this.context, zoom));
    }

    get maxZoom(): number { return this._cameraState.maxZoom; }
    setMaxZoom(zoom: number): void {
        this._setState(setMaxZoom(this._cameraState, this.context, zoom));
    }

    get minPitch(): number { return this._cameraState.minPitch; }
    setMinPitch(pitch: number): void {
        this._setState(setMinPitch(this._cameraState, pitch));
    }

    get maxPitch(): number { return this._cameraState.maxPitch; }
    setMaxPitch(pitch: number): void {
        this._setState(setMaxPitch(this._cameraState, pitch));
    }

    get renderWorldCopies(): boolean { return this._cameraState.renderWorldCopies; }
    setRenderWorldCopies(renderWorldCopies: boolean): void {
        this._setState(setRenderWorldCopies(this._cameraState, this._worldCoordinateHelper, renderWorldCopies));
    }

    get constrainOverride(): TransformConstrainFunction { return this._constrainOverride; }
    setConstrainOverride(constrain?: TransformConstrainFunction | null): void {
        if (constrain === undefined) constrain = null;
        if (this._constrainOverride === constrain) return;
        this._constrainOverride = constrain;
        this._setState(constrainState(this._cameraState, this.context));
    }

    get worldSize(): number {
        return this._projectedCamera.worldSize;
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
        this._setState(setBearing(this._cameraState, bearing));
    }

    get rotationMatrix(): mat2 { return this._projectedCamera.rotationMatrix; }

    get pitchInRadians(): number {
        return this._cameraState.pitchInRadians;
    }
    get pitch(): number {
        return getPitch(this._cameraState);
    }
    setPitch(pitch: number): void {
        this._setState(setPitch(this._cameraState, pitch));
    }

    get rollInRadians(): number {
        return this._cameraState.rollInRadians;
    }
    get roll(): number {
        return getRoll(this._cameraState);
    }
    setRoll(roll: number): void {
        this._setState(setRoll(this._cameraState, roll));
    }

    get fovInRadians(): number {
        return this._cameraState.fovInRadians;
    }
    get fov(): number {
        return getFov(this._cameraState);
    }
    setFov(fov: number): void {
        this._setState(setFov(this._cameraState, fov));
    }

    get zoom(): number { return this._cameraState.zoom; }
    setZoom(zoom: number): void {
        this._setState(setZoom(this._cameraState, this.context, zoom));
    }

    get center(): LngLat { return this._cameraState.center; }
    setCenter(center: LngLat): void {
        this._setState(setCenter(this._cameraState, this.context, center));
    }

    /**
     * Moves the center and the zoom in one write, to a camera that is already constrained.
     */
    setCenterAndZoom(center: LngLat, zoom: number): void {
        this._setState(setCenterAndZoom(this._cameraState, center, zoom));
    }

    /**
     * Elevation at current center point, meters above sea level
     */
    get elevation(): number { return this._cameraState.elevation; }
    setElevation(elevation: number): void {
        this._setState(setElevation(this._cameraState, this.context, elevation));
    }

    get padding(): PaddingOptions { return {...this._cameraState.padding}; }
    setPadding(padding: PaddingOptions): void {
        this._setState(setPadding(this._cameraState, this.context, padding));
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
    get pixelsPerMeter(): number { return this._projectedCamera.pixelsPerMeter; }

    get unmodified(): boolean { return this._cameraState.unmodified; }

    get cameraToCenterDistance(): number { return this._projectedCamera.cameraToCenterDistance; }

    get autoCalculateNearFarZ(): boolean { return this._cameraState.nearFarZOverride === null; }
    /**
     * The depth range set with {@link overrideNearFarZ}, which the projection part uses instead of its own, or null.
     */
    get nearFarZOverride(): NearFarZ | null { return this._cameraState.nearFarZOverride; }
    overrideNearFarZ(nearZ: number, farZ: number): void {
        this._setState(setNearFarZOverride(this._cameraState, {nearZ, farZ}));
    }
    clearNearFarZOverride(): void {
        this._setState(setNearFarZOverride(this._cameraState, null));
    }

    /**
     * Returns if the padding params match
     *
     * @param padding - the padding to check against
     * @returns true if they are equal, false otherwise
     */
    isPaddingEqual(padding: PaddingOptions): boolean {
        return isPaddingEqual(this._cameraState.padding, padding);
    }

    /**
     * Helper method to update edge-insets in place
     *
     * @param start - the starting padding
     * @param target - the target padding
     * @param t - the step/weight
     */
    interpolatePadding(start: PaddingOptions, target: PaddingOptions, t: number): void {
        this._setState(interpolatePadding(this._cameraState, this.context, start, target, t));
    }

    resize(width: number, height: number, constrain: boolean = true): void {
        this._setState(resize(this._cameraState, this.context, width, height, constrain));
    }

    /**
     * Returns the maximum geographical bounds the map is constrained to, or `null` if none set.
     * @returns max bounds
     */
    getMaxBounds(): LngLatBounds | null {
        return getMaxBounds(this._cameraState);
    }

    /**
     * Sets or clears the map's geographical constraints.
     * @param bounds - A {@link LngLatBounds} object describing the new geographic boundaries of the map.
     */
    setMaxBounds(bounds?: LngLatBounds | null): void {
        this._setState(setMaxBounds(this._cameraState, this.context, bounds));
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
    getCameraQueryGeometry(queryGeometry: Point[]): Point[] {
        return getCameraMath(this._projectedCamera).getCameraQueryGeometry(this._projectedCamera, queryGeometry);
    }

    /**
     * What the camera state is constrained and projected with: the projection and the globe's transition, the world
     * mapping and the constrain override.
     */
    get context(): CameraContext {
        return createCameraContext({
            projection: this._projection,
            projectionTransition: this._projectionTransition,
            worldCoordinateHelper: this._worldCoordinateHelper,
            constrainOverride: this._constrainOverride,
        });
    }

    defaultConstrain: TransformConstrainFunction = (lngLat, zoom) => {
        return defaultConstrain(this._cameraState, this.context, lngLat, zoom);
    };

    applyConstrain: TransformConstrainFunction = (lngLat, zoom) => {
        return applyConstrain(this._cameraState, this.context, lngLat, zoom);
    };

    calculateCenterFromCameraLngLatAlt(lnglat: LngLatLike, alt: number, bearing?: number, pitch?: number): {center: LngLat; elevation: number; zoom: number} {
        return calculateCenterFromCameraLngLatAlt(this._cameraState, this._worldCoordinateHelper, lnglat, alt, bearing, pitch);
    }

    getCameraPoint(): Point {
        return getCameraPoint(this._projectedCamera);
    }

    get modelViewProjectionMatrix(): mat4 {
        return this._projectedCamera.modelViewProjectionMatrix;
    }
    get projectionMatrix(): mat4 {
        return this._projectedCamera.projectionMatrix;
    }
    get inverseProjectionMatrix(): mat4 {
        return this._projectedCamera.inverseProjectionMatrix;
    }
    get cameraPosition(): vec3 {
        return this._projectedCamera.cameraPosition;
    }
    get nearZ(): number {
        return this._projectedCamera.nearZ;
    }
    get farZ(): number {
        return this._projectedCamera.farZ;
    }
    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        return getCameraMath(this._projectedCamera).getVisibleUnwrappedCoordinates(this._projectedCamera, this._worldCoordinateHelper, tileID);
    }
    getCameraFrustum(): Frustum {
        return getCameraMath(this._projectedCamera).getCameraFrustum(this._projectedCamera);
    }
    getClippingPlane(): vec4 | null {
        return getCameraMath(this._projectedCamera).getClippingPlane(this._projectedCamera);
    }
    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        return getCameraMath(this._projectedCamera).locationToScreenPoint(this._projectedCamera, this._worldCoordinateHelper, lnglat, terrain);
    }
    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return getCameraMath(this._projectedCamera).screenPointToLocation(this._projectedCamera, this._worldCoordinateHelper, p, terrain);
    }
    screenPointToLocationAtElevation(p: Point, elevation: number): LngLat {
        return getCameraMath(this._projectedCamera).screenPointToLocationAtElevation(this._projectedCamera, this._worldCoordinateHelper, p, elevation);
    }
    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        return getCameraMath(this._projectedCamera).screenPointToMercatorCoordinate(this._projectedCamera, this._worldCoordinateHelper, p, terrain);
    }
    screenTerrainPointToMercatorCoordinate(p: Point, terrain: Terrain): MercatorCoordinate | null {
        return getCameraMath(this._projectedCamera).screenTerrainPointToMercatorCoordinate(this._projectedCamera, this._worldCoordinateHelper, p, terrain);
    }
    getBounds(): LngLatBounds {
        return getCameraMath(this._projectedCamera).getBounds(this._projectedCamera, this._worldCoordinateHelper);
    }
    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        return getCameraMath(this._projectedCamera).isPointOnMapSurface(this._projectedCamera, this._worldCoordinateHelper, p, terrain);
    }
    maxPitchScaleFactor(): number {
        return getCameraMath(this._projectedCamera).maxPitchScaleFactor(this._projectedCamera);
    }
    getCameraAltitude(): number {
        return getCameraMath(this._projectedCamera).getCameraAltitude(this._projectedCamera);
    }
    getCameraLngLat(): LngLat {
        return getCameraMath(this._projectedCamera).getCameraLngLat(this._projectedCamera, this._worldCoordinateHelper);
    }
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const context = this.context;
        return getCameraSolver(context).calculateCameraOptionsFromTo(this._cameraState, context, from, altitudeFrom, to, altitudeTo);
    }
    getRayDirectionFromPixel(p: Point): vec3 {
        return getCameraMath(this._projectedCamera).getRayDirectionFromPixel(this._projectedCamera, p);
    }
    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4 {
        return getCameraMath(this._projectedCamera).calculateFogMatrix(this._projectedCamera, unwrappedTileID);
    }
    getProjectionData(params: ProjectionDataParams): RendererProjectionData {
        return getCameraMath(this._projectedCamera).getProjectionData(this._projectedCamera, params);
    }
    isLocationOccluded(lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        return getCameraMath(this._projectedCamera).isLocationOccluded(this._projectedCamera, this._worldCoordinateHelper, lngLat, terrain, elevation);
    }
    getPixelScale(): number {
        return getCameraMath(this._projectedCamera).getPixelScale(this._projectedCamera);
    }
    getCircleRadiusCorrection(): number {
        return getCameraMath(this._projectedCamera).getCircleRadiusCorrection(this._projectedCamera);
    }
    getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        return getCameraMath(this._projectedCamera).getPitchedTextCorrection(this._projectedCamera, textAnchorX, textAnchorY, tileID);
    }
    transformLightDirection(dir: vec3): vec3 {
        return getCameraMath(this._projectedCamera).transformLightDirection(this._projectedCamera, dir);
    }
    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        return getCameraMath(this._projectedCamera).projectTileCoordinates(this._projectedCamera, x, y, unwrappedTileID, elevation);
    }
    getProjectionDataForCustomLayer(applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        return getCameraMath(this._projectedCamera).getProjectionDataForCustomLayer(this._projectedCamera, applyGlobeMatrix);
    }
    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        return getCameraMath(this._projectedCamera).getFastPathSimpleProjectionMatrix(this._projectedCamera, tileID);
    }
    /** Sets how far a globe is between mercator and the vertical perspective; other projections ignore it. */
    setTransitionState(value: number): void {
        this._projectionTransition = value;
        this._projectCamera();
    }
    recalculateZoomAndCenter(terrain?: Terrain): void {
        const context = this.context;
        this._setState(getCameraSolver(context).recenterOnTerrain(this._cameraState, context, terrain));
    }
    setLocationAtPoint(lnglat: LngLat, point: Point, elevation?: number): void {
        const context = this.context;
        this._setState(getCameraSolver(context).setLocationAtPoint(this._cameraState, context, lnglat, point, elevation));
    }
    getCameraForLocationAtPoint(lnglat: LngLat, point: Point, elevation?: number): {center: LngLat; zoom: number} | null {
        const context = this.context;
        return getCameraSolver(context).getCameraForLocationAtPoint(this._cameraState, context, lnglat, point, elevation);
    }
}
