import {Transform} from '../transform.ts';
import {MercatorTransform} from './mercator_transform.ts';
import {VerticalPerspectiveTransform} from './vertical_perspective_transform.ts';
import {lerp} from '../../util/util.ts';

import type {LngLat, LngLatLike} from '../lng_lat.ts';
import type {mat4, vec3, vec4} from 'gl-matrix';
import type {OverscaledTileID, UnwrappedTileID, CanonicalTileID} from '../../tile/tile_id.ts';
import type Point from '@mapbox/point-geometry';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {Frustum} from '../../util/primitives/frustum.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {PointProjection} from '../../symbol/projection.ts';
import type {CameraOptionsFromTo, TransformConstrainFunction} from '../transform_interface.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';

/**
 * @internal
 * The part of a globe transform, which moves between the vertical perspective and mercator projections.
 * Both child parts belong to the same {@link Transform}, and this part drives their `calcMatrices`.
 */
export class GlobeTransform implements IProjectionTransform {
    private _transform: Transform;

    /**
     * True when globe render path should be used instead of the old but simpler mercator rendering.
     * Globe automatically transitions to mercator at high zoom levels, which causes a switch from
     * globe to mercator render path.
     */
    get isGlobeRendering(): boolean {
        return this._globeness > 0;
    }

    setTransitionState(globeness: number): void {
        this._globeness = globeness;
        this.calcMatrices();
        this._verticalPerspectiveTransform.getCoveringTilesDetailsProvider().prepareNextFrame();
        this._mercatorTransform.getCoveringTilesDetailsProvider().prepareNextFrame();
    }

    private get currentTransform(): IProjectionTransform {
        return this.isGlobeRendering ? this._verticalPerspectiveTransform : this._mercatorTransform;
    }

    /**
     * Globe projection can smoothly interpolate between globe view and mercator. This variable controls this interpolation.
     * Value 0 is mercator, value 1 is globe, anything between is an interpolation between the two projections.
     */
    private _globeness: number = 1.0;
    private _mercatorTransform: MercatorTransform;
    private _verticalPerspectiveTransform: VerticalPerspectiveTransform;

    /**
     * @param transform - The transform whose camera state this part's children derive their matrices from.
     */
    public constructor(transform: Transform) {
        this._transform = transform;
        this._globeness = 1; // When transform is cloned for use in symbols, `_updateAnimation` function which usually sets this value never gets called.
        this._mercatorTransform = new MercatorTransform(transform);
        this._verticalPerspectiveTransform = new VerticalPerspectiveTransform(transform);
    }

    clone(transform: Transform): GlobeTransform {
        const clone = new GlobeTransform(transform);
        clone._globeness = this._globeness;
        return clone;
    }

    public get projectionMatrix(): mat4 { return this.currentTransform.projectionMatrix; }

    public get modelViewProjectionMatrix(): mat4 { return this.currentTransform.modelViewProjectionMatrix; }

    public get inverseProjectionMatrix(): mat4 { return this.currentTransform.inverseProjectionMatrix; }

    public get cameraPosition(): vec3 { return this.currentTransform.cameraPosition; }

    getProjectionData(params: ProjectionDataParams): RendererProjectionData {
        const mercatorProjectionData = this._mercatorTransform.getProjectionData(params);
        const verticalPerspectiveProjectionData = this._verticalPerspectiveTransform.getProjectionData(params);

        return {
            mainMatrix: this.isGlobeRendering ? verticalPerspectiveProjectionData.mainMatrix : mercatorProjectionData.mainMatrix,
            clippingPlane: verticalPerspectiveProjectionData.clippingPlane,
            tileMercatorCoords: verticalPerspectiveProjectionData.tileMercatorCoords,
            projectionTransition: params.applyGlobeMatrix ? this._globeness : 0,
            fallbackMatrix: mercatorProjectionData.fallbackMatrix,
            clipAntimeridian: verticalPerspectiveProjectionData.clipAntimeridian,
        };
    }

    /** {@inheritDoc ITransform.isLocationOccluded} */
    public isLocationOccluded(lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        return this.currentTransform.isLocationOccluded(lngLat, terrain, elevation);
    }

    public transformLightDirection(dir: vec3): vec3 {
        return this.currentTransform.transformLightDirection(dir);
    }

    public getPixelScale(): number {
        return lerp(this._mercatorTransform.getPixelScale(), this._verticalPerspectiveTransform.getPixelScale(), this._globeness);
    }

    public getCircleRadiusCorrection(): number {
        return this.currentTransform.getCircleRadiusCorrection();
    }

    public getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        const mercatorCorrection = this._mercatorTransform.getPitchedTextCorrection(textAnchorX, textAnchorY, tileID);
        const verticalCorrection = this._verticalPerspectiveTransform.getPitchedTextCorrection(textAnchorX, textAnchorY, tileID);
        return lerp(mercatorCorrection, verticalCorrection, this._globeness);
    }

    public projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        return this.currentTransform.projectTileCoordinates(x, y, unwrappedTileID, elevation);
    }

    /**
     * Both children write their near/far Z into the transform, so the order here is what keeps the two render
     * paths at the same depth across the globe-to-mercator transition: vertical perspective computes the globe's Z
     * first, and while the globe is rendering mercator is made to reuse that result instead of computing its own.
     */
    calcMatrices(): void {
        if (!this._transform.width || !this._transform.height) {
            return;
        }
        this._verticalPerspectiveTransform.calcMatrices();
        this._mercatorTransform.calcMatrices(this._transform.autoCalculateNearFarZ && !this.isGlobeRendering);
    }

    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4 {
        return this.currentTransform.calculateFogMatrix(unwrappedTileID);
    }

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        return this.currentTransform.getVisibleUnwrappedCoordinates(tileID);
    }

    getCameraFrustum(): Frustum {
        return this.currentTransform.getCameraFrustum();
    }
    getClippingPlane(): vec4 | null {
        return this.currentTransform.getClippingPlane();
    }
    getCoveringTilesDetailsProvider(): CoveringTilesDetailsProvider {
        return this.currentTransform.getCoveringTilesDetailsProvider();
    }

    recalculateZoomAndCenter(terrain?: Terrain): void {
        this.currentTransform.recalculateZoomAndCenter(terrain);
    }

    maxPitchScaleFactor(): number {
        // Using mercator version of this should be good enough approximation for globe.
        return this._mercatorTransform.maxPitchScaleFactor();
    }

    /** The camera of the child that renders the current frame. */
    getCameraAltitude(): number {
        return this.currentTransform.getCameraAltitude();
    }

    /** See {@link getCameraAltitude}. */
    getCameraLngLat(): LngLat {
        return this.currentTransform.getCameraLngLat();
    }

    populateCache(coords: OverscaledTileID[]): void {
        this._mercatorTransform.populateCache(coords);
        this._verticalPerspectiveTransform.populateCache(coords);
    }

    getBounds(): LngLatBounds {
        return this.currentTransform.getBounds();
    }

    defaultConstrain: TransformConstrainFunction = (lngLat, zoom) => {
        return this.currentTransform.defaultConstrain(lngLat, zoom);
    };

    /** See {@link getCameraAltitude}. */
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        return this.currentTransform.calculateCameraOptionsFromTo(from, altitudeFrom, to, altitudeTo);
    }

    /**
     * Note: automatically adjusts zoom to keep planet size consistent
     * (same size before and after a {@link setLocationAtPoint} call).
     */
    setLocationAtPoint(lnglat: LngLat, point: Point, elevation?: number): void {
        this.currentTransform.setLocationAtPoint(lnglat, point, elevation);
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        return this.currentTransform.locationToScreenPoint(lnglat, terrain);
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        return this.currentTransform.screenPointToMercatorCoordinate(p, terrain);
    }

    /** {@inheritDoc ITransform.screenTerrainPointToMercatorCoordinate} */
    screenTerrainPointToMercatorCoordinate(p: Point, terrain: Terrain): MercatorCoordinate | null {
        return this.currentTransform.screenTerrainPointToMercatorCoordinate(p, terrain);
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return this.currentTransform.screenPointToLocation(p, terrain);
    }

    screenPointToLocationAtElevation(p: Point, elevation: number): LngLat {
        return this.currentTransform.screenPointToLocationAtElevation(p, elevation);
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        return this.currentTransform.isPointOnMapSurface(p, terrain);
    }

    /**
     * Computes normalized direction of a ray from the camera to the given screen pixel.
     *
     * Always answered by the vertical perspective child: the ray is in unit-sphere space, so it is only meaningful
     * to the globe camera controls that ask for it, and the mercator transform does not implement it at all.
     */
    getRayDirectionFromPixel(p: Point): vec3 {
        return this._verticalPerspectiveTransform.getRayDirectionFromPixel(p);
    }

    getProjectionDataForCustomLayer(applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        const mercatorData = this._mercatorTransform.getProjectionDataForCustomLayer(applyGlobeMatrix);

        if (!this.isGlobeRendering) {
            return mercatorData;
        }

        const globeData = this._verticalPerspectiveTransform.getProjectionDataForCustomLayer(applyGlobeMatrix);
        globeData.fallbackMatrix = mercatorData.mainMatrix;
        globeData.projectionTransition = this._globeness;
        return globeData;
    }

    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        return this.currentTransform.getFastPathSimpleProjectionMatrix(tileID);
    }
}

/**
 * Creates a transform for the globe projection.
 */
export function createGlobeTransform(options?: TransformOptions): Transform {
    return new Transform((transform) => new GlobeTransform(transform), options);
}
