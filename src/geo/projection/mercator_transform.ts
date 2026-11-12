import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';
import {radiansToDegrees, scaleZoom} from '../../util/util.ts';
import {Transform} from '../transform.ts';
import {MercatorCoveringTilesDetailsProvider} from './mercator_covering_tiles_details_provider.ts';
import {getCenterPoint, getConstrainedCamera, getPitch} from '../../camera/camera_view_state.ts';
import {MercatorCameraMath, createMercatorProjectedCamera, screenPointToMercatorCoordinateAtZ, terrainPointPastMaxZoom} from '../../camera/mercator_camera_math.ts';

import type Point from '@mapbox/point-geometry';
import type {mat4, vec3, vec4} from 'gl-matrix';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import type {Frustum} from '../../util/primitives/frustum.ts';
import type {CameraMetrics, MercatorProjectedCamera} from '../../camera/projected_camera.ts';
import type {CameraProjectionKind} from '../../camera/camera_context.ts';
import type {PointProjection} from '../../symbol/projection.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';
import type {WorldCoordinateHelper} from '../world_types.ts';
import type {CameraOptionsFromTo, NearFarZ, TransformConstrainFunction} from '../../camera/camera_types.ts';

/** The math of every mercator part, which holds nothing, so they all share one. */
const mercatorCameraMath = new MercatorCameraMath();

/**
 * @internal
 * The mercator part of a {@link Transform}. It projects the camera into a {@link MercatorProjectedCamera} and hands it
 * to {@link MercatorCameraMath}.
 */
export class MercatorTransform implements IProjectionTransform {
    /** The {@link CameraMetrics} of the camera state as it is now. */
    private readonly _getMetrics: () => CameraMetrics;

    readonly cameraProjection: CameraProjectionKind = 'mercator';
    readonly projectionTransition: number = 0;
    /** The lng/lat to world coordinate mapping, mercator's unless the part is built for a registered CRS. */
    private readonly _worldCoordinateHelper: WorldCoordinateHelper;

    /** The camera as {@link MercatorTransform.calcMatrices} last projected it. */
    private _projectedCamera: MercatorProjectedCamera;
    /** The metrics {@link MercatorTransform._projectedCamera} was projected from. */
    private _projectedMetrics: CameraMetrics;

    private _coveringTilesDetailsProvider;

    /**
     * @param getMetrics - Returns the {@link CameraMetrics} of the camera state as it is now.
     * @param worldCoordinateHelper - The lng/lat to world coordinate mapping, mercator's by default.
     */
    constructor(getMetrics: () => CameraMetrics, worldCoordinateHelper: WorldCoordinateHelper = mercatorWorldCoordinateHelper) {
        this._getMetrics = getMetrics;
        this._worldCoordinateHelper = worldCoordinateHelper;
        this._coveringTilesDetailsProvider = new MercatorCoveringTilesDetailsProvider();
    }

    /**
     * The camera the math reads: the one {@link MercatorTransform.calcMatrices} last projected. The transform does not
     * call `calcMatrices` while the camera has no size, so until it has one again the camera's metrics follow the
     * camera state while its matrices stay those of the last projection, and there are none before the first.
     */
    private get _camera(): MercatorProjectedCamera {
        const metrics = this._getMetrics();
        if (metrics === this._projectedMetrics) return this._projectedCamera;
        return {...this._projectedCamera, ...metrics, projection: 'mercator', clippingPlane: null};
    }

    clone(getMetrics: () => CameraMetrics): MercatorTransform {
        return new MercatorTransform(getMetrics, this._worldCoordinateHelper);
    }

    getCameraQueryGeometry(queryGeometry: Point[]): Point[] {
        return mercatorCameraMath.getCameraQueryGeometry(this._camera, queryGeometry);
    }

    setTransitionState(_value: number): void {
        // Do nothing
    }

    public get cameraPosition(): vec3 { return this._camera.cameraPosition; }
    public get nearZ(): number { return this._camera.nearZ; }
    public get farZ(): number { return this._camera.farZ; }
    public get projectionMatrix(): mat4 { return this._camera.projectionMatrix; }
    public get modelViewProjectionMatrix(): mat4 { return this._camera.modelViewProjectionMatrix; }
    public get inverseProjectionMatrix(): mat4 { return this._camera.inverseProjectionMatrix; }
    public get mercatorMatrix(): mat4 { return this._camera.mercatorMatrix; } // Not part of ITransform interface

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        return mercatorCameraMath.getVisibleUnwrappedCoordinates(this._camera, this._worldCoordinateHelper, tileID);
    }

    getCameraFrustum(): Frustum {
        return mercatorCameraMath.getCameraFrustum(this._camera);
    }
    getClippingPlane(): vec4 | null {
        return mercatorCameraMath.getClippingPlane(this._camera);
    }
    getCoveringTilesDetailsProvider(): CoveringTilesDetailsProvider {
        return this._coveringTilesDetailsProvider;
    }

    /**
     * The elevation of the ground the camera looks at, which {@link Transform.recalculateZoomAndCenter} moves the
     * center to, or null where the camera would end up below that ground.
     */
    getGroundElevationAtCenter(terrain?: Terrain): number | null {
        const center = (terrain && terrainPointPastMaxZoom(this._camera, this._worldCoordinateHelper, terrain)) || this.screenPointToLocation(getCenterPoint(this._getMetrics()), terrain);
        const elevation = terrain ? terrain.getElevationForLngLat(center, this._getMetrics().tileZoom) : 0;
        if (getPitch(this._getMetrics()) < 90 && elevation >= this.getCameraAltitude()) return null;
        return elevation;
    }

    /**
     * The center and zoom that {@link Transform.setLocationAtPoint} moves the camera to, so that `lnglat`, on the
     * ground at `elevation` meters, renders at the screen `point`, or null where the camera stays where it is. Both rays
     * are cast through the same inverse pixel matrix so its inversion error cancels out of their difference; the
     * current-center ray must be intersected at the center's own elevation (z=0), since intersecting it with the
     * elevated plane would land `(elevation - centerElevation)·tan(pitch)` away from the center and make repeated
     * calls drift. In a world that wraps, a center outside the main world is then wrapped into it and constrained
     * again.
     */
    getCameraForLocationAtPoint(lnglat: LngLat, point: Point, elevation: number | undefined, constrain: TransformConstrainFunction): {center: LngLat; zoom: number} | null {
        const z = (elevation ?? this._getMetrics().elevation) - this._getMetrics().elevation;
        const a = screenPointToMercatorCoordinateAtZ(this._camera, point, z);
        const b = screenPointToMercatorCoordinateAtZ(this._camera, getCenterPoint(this._getMetrics()), 0);
        const worldCoordinateHelper = this._worldCoordinateHelper;
        const loc = worldCoordinateHelper.worldFromLngLat(lnglat.lng, lnglat.lat);
        const center = worldCoordinateHelper.lngLatFromWorld(
            loc.x - (a.x - b.x),
            loc.y - (a.y - b.y));
        const moved = center.lng !== this._getMetrics().center.lng || center.lat !== this._getMetrics().center.lat;
        let camera = moved ? getConstrainedCamera(this._getMetrics(), constrain, center, this._getMetrics().zoom) : null;
        if (this._getMetrics().renderWorldCopies && worldCoordinateHelper.wraps) {
            const unwrapped = camera ?? {center: this._getMetrics().center, zoom: this._getMetrics().zoom};
            const wrapped = unwrapped.center.wrap();
            if (wrapped.lng !== unwrapped.center.lng) camera = getConstrainedCamera(this._getMetrics(), constrain, wrapped, unwrapped.zoom);
        }
        return camera;
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        return mercatorCameraMath.locationToScreenPoint(this._camera, this._worldCoordinateHelper, lnglat, terrain);
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return mercatorCameraMath.screenPointToLocation(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    screenPointToLocationAtElevation(p: Point, elevation: number): LngLat {
        return mercatorCameraMath.screenPointToLocationAtElevation(this._camera, this._worldCoordinateHelper, p, elevation);
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        return mercatorCameraMath.screenPointToMercatorCoordinate(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    /** {@inheritDoc ITransform.screenTerrainPointToMercatorCoordinate} */
    screenTerrainPointToMercatorCoordinate(p: Point, terrain: Terrain): MercatorCoordinate | null {
        return mercatorCameraMath.screenTerrainPointToMercatorCoordinate(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    getBounds(): LngLatBounds {
        return mercatorCameraMath.getBounds(this._camera, this._worldCoordinateHelper);
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        return mercatorCameraMath.isPointOnMapSurface(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4 {
        return mercatorCameraMath.calculateFogMatrix(this._camera, unwrappedTileID);
    }

    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const worldCoordinateHelper = this._worldCoordinateHelper;
        const fromLngLat = LngLat.convert(from);
        const toLngLat = LngLat.convert(to);
        const fromWorld = worldCoordinateHelper.worldFromLngLat(fromLngLat.lng, fromLngLat.lat, altitudeFrom);
        const toWorld = worldCoordinateHelper.worldFromLngLat(toLngLat.lng, toLngLat.lat, altitudeTo);
        const dx = toWorld.x - fromWorld.x;
        const dy = toWorld.y - fromWorld.y;
        const dz = toWorld.z - fromWorld.z;

        const distance3D = Math.hypot(dx, dy, dz);
        if (distance3D === 0) throw new Error('Can\'t calculate camera options with same From and To');

        const groundDistance = Math.hypot(dx, dy);

        const zoom = scaleZoom(this._getMetrics().cameraToCenterDistance / distance3D / this._getMetrics().tileSize);
        const bearing = radiansToDegrees(Math.atan2(dx, -dy));
        let pitch = radiansToDegrees(Math.acos(groundDistance / distance3D));
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;

        return {center: worldCoordinateHelper.lngLatFromWorld(toWorld.x, toWorld.y), elevation: altitudeTo, zoom, pitch, bearing};
    }

    /**
     * Projects the camera state as it is now into the {@link MercatorProjectedCamera} the other members read.
     * @param nearFarZ - The depth range to use instead of computing one, by default the camera state's override.
     * {@link GlobeTransform} passes the range of its vertical perspective part, so both parts share one range.
     */
    calcMatrices(nearFarZ?: NearFarZ | null): void {
        const metrics = this._getMetrics();
        this._projectedCamera = createMercatorProjectedCamera(metrics, this._worldCoordinateHelper, nearFarZ);
        this._projectedMetrics = metrics;
    }

    maxPitchScaleFactor(): number {
        return mercatorCameraMath.maxPitchScaleFactor(this._camera);
    }

    getCameraAltitude(): number {
        return mercatorCameraMath.getCameraAltitude(this._camera);
    }

    getCameraLngLat(): LngLat {
        return mercatorCameraMath.getCameraLngLat(this._camera, this._worldCoordinateHelper);
    }

    getProjectionData(params: ProjectionDataParams): RendererProjectionData {
        return mercatorCameraMath.getProjectionData(this._camera, params);
    }

    /** {@inheritDoc ITransform.isLocationOccluded} */
    isLocationOccluded(lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        return mercatorCameraMath.isLocationOccluded(this._camera, this._worldCoordinateHelper, lngLat, terrain, elevation);
    }

    getPixelScale(): number {
        return mercatorCameraMath.getPixelScale(this._camera);
    }

    getCircleRadiusCorrection(): number {
        return mercatorCameraMath.getCircleRadiusCorrection(this._camera);
    }

    getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        return mercatorCameraMath.getPitchedTextCorrection(this._camera, textAnchorX, textAnchorY, tileID);
    }

    transformLightDirection(dir: vec3): vec3 {
        return mercatorCameraMath.transformLightDirection(this._camera, dir);
    }

    getRayDirectionFromPixel(p: Point): vec3 {
        return mercatorCameraMath.getRayDirectionFromPixel(this._camera, p);
    }

    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        return mercatorCameraMath.projectTileCoordinates(this._camera, x, y, unwrappedTileID, elevation);
    }

    getProjectionDataForCustomLayer(applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        return mercatorCameraMath.getProjectionDataForCustomLayer(this._camera, applyGlobeMatrix);
    }

    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        return mercatorCameraMath.getFastPathSimpleProjectionMatrix(this._camera, tileID);
    }
}

/**
 * Creates a transform for the mercator projection, or for a registered CRS with that CRS's world coordinate helper.
 */
export function createMercatorTransform(options?: TransformOptions): Transform {
    return new Transform((getMetrics, worldCoordinateHelper) => new MercatorTransform(getMetrics, worldCoordinateHelper), options);
}
