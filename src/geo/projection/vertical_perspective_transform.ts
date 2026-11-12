import {vec3} from 'gl-matrix';
import {Transform} from '../transform.ts';
import {LngLat, type LngLatLike, earthRadius} from '../lng_lat.ts';
import {angleToRotateBetweenVectors2D, clamp, degreesToRadians, radiansToDegrees, scaleZoom, createVec3f64, distanceOfAnglesRadians, warnOnce} from '../../util/util.ts';
import {angularCoordinatesToSurfaceVector, getGlobeRadiusPixels, getZoomAdjustment} from './globe_utils.ts';
import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';
import {GlobeCoveringTilesDetailsProvider} from './globe_covering_tiles_details_provider.ts';
import {getBearing, getConstrainedCamera} from '../../camera/camera_view_state.ts';
import {VerticalPerspectiveCameraMath, createVerticalPerspectiveProjectedCamera, unprojectScreenPoint} from '../../camera/vertical_perspective_camera_math.ts';

import type {mat4, vec4} from 'gl-matrix';
import type Point from '@mapbox/point-geometry';
import type {MercatorCoordinate} from '../mercator_coordinate.ts';
import type {LngLatBounds} from '../lng_lat_bounds.ts';
import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../tile/tile_id.ts';
import type {Frustum} from '../../util/primitives/frustum.ts';
import type {CameraMetrics, VerticalPerspectiveProjectedCamera} from '../../camera/projected_camera.ts';
import type {CameraProjectionKind} from '../../camera/camera_context.ts';
import type {PointProjection} from '../../symbol/projection.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {CustomLayerProjectionData, ProjectionDataParams, RendererProjectionData} from './projection_data.ts';
import type {CoveringTilesDetailsProvider} from './covering_tiles_details_provider.ts';
import type {CameraOptionsFromTo, NearFarZ, TransformConstrainFunction} from '../../camera/camera_types.ts';
import type {WorldCoordinateHelper} from '../world_types.ts';

/** Two points on the unit globe closer than this, a micrometre, are the same point. */
const SAME_POINT_DISTANCE = 1e-12;
/** A camera whose horizontal offset is this small relative to its distance is straight above the center. */
const STRAIGHT_ABOVE_RATIO = 1e-9;

/** The math of every vertical perspective part, which holds nothing, so they all share one. */
const verticalPerspectiveCameraMath = new VerticalPerspectiveCameraMath();

/**
 * @internal
 * The vertical perspective part of a {@link Transform}. It projects the camera into a
 * {@link VerticalPerspectiveProjectedCamera} and hands it to {@link VerticalPerspectiveCameraMath}.
 */
export class VerticalPerspectiveTransform implements IProjectionTransform {
    /** The {@link CameraMetrics} of the camera state as it is now. */
    private readonly _getMetrics: () => CameraMetrics;
    /** The vertical perspective reads lng/lat on the sphere, so its math is handed mercator's world mapping. */
    private readonly _worldCoordinateHelper: WorldCoordinateHelper = mercatorWorldCoordinateHelper;

    readonly cameraProjection: CameraProjectionKind = 'vertical-perspective';
    readonly projectionTransition: number = 1;

    /**
     * The camera as {@link VerticalPerspectiveTransform.calcMatrices} last projected it, and before that the camera the
     * part was built with, which has no size and so has identity matrices.
     */
    private _projectedCamera: VerticalPerspectiveProjectedCamera;
    /** The metrics {@link VerticalPerspectiveTransform._projectedCamera} was projected from. */
    private _projectedMetrics: CameraMetrics;

    private _coveringTilesDetailsProvider: GlobeCoveringTilesDetailsProvider;

    /**
     * @param getMetrics - Returns the {@link CameraMetrics} of the camera state as it is now.
     */
    public constructor(getMetrics: () => CameraMetrics) {
        this._getMetrics = getMetrics;
        this._coveringTilesDetailsProvider = new GlobeCoveringTilesDetailsProvider();
        this._projectedMetrics = getMetrics();
        this._projectedCamera = createVerticalPerspectiveProjectedCamera(this._projectedMetrics);
    }

    /**
     * The camera the math reads: the one {@link VerticalPerspectiveTransform.calcMatrices} last projected. The transform
     * does not call `calcMatrices` while the camera has no size, so until it has one again the camera's metrics follow
     * the camera state while its matrices stay those of the last projection.
     */
    private get _camera(): VerticalPerspectiveProjectedCamera {
        const metrics = this._getMetrics();
        if (metrics === this._projectedMetrics) return this._projectedCamera;
        return {...this._projectedCamera, ...metrics};
    }

    clone(getMetrics: () => CameraMetrics): VerticalPerspectiveTransform {
        return new VerticalPerspectiveTransform(getMetrics);
    }

    getCameraQueryGeometry(queryGeometry: Point[]): Point[] {
        return verticalPerspectiveCameraMath.getCameraQueryGeometry(this._camera, queryGeometry);
    }

    setTransitionState(_value: number): void {
        // Do nothing
    }

    public get projectionMatrix(): mat4 { return this._camera.projectionMatrix; }

    public get nearZ(): number { return this._camera.nearZ; }

    public get farZ(): number { return this._camera.farZ; }

    public get modelViewProjectionMatrix(): mat4 { return this._camera.modelViewProjectionMatrix; }

    public get inverseProjectionMatrix(): mat4 { return this._camera.inverseProjectionMatrix; }

    /** A copy of the camera position, so that outside code cannot change the projected camera's. */
    public get cameraPosition(): vec3 {
        return vec3.copy(createVec3f64(), this._camera.cameraPosition);
    }

    getProjectionData(params: ProjectionDataParams): RendererProjectionData {
        return verticalPerspectiveCameraMath.getProjectionData(this._camera, params);
    }

    /** {@inheritDoc ITransform.isLocationOccluded} */
    public isLocationOccluded(lngLat: LngLat, terrain?: Terrain, elevation?: number): boolean {
        return verticalPerspectiveCameraMath.isLocationOccluded(this._camera, this._worldCoordinateHelper, lngLat, terrain, elevation);
    }

    public transformLightDirection(dir: vec3): vec3 {
        return verticalPerspectiveCameraMath.transformLightDirection(this._camera, dir);
    }

    public getPixelScale(): number {
        return verticalPerspectiveCameraMath.getPixelScale(this._camera);
    }

    public getCircleRadiusCorrection(): number {
        return verticalPerspectiveCameraMath.getCircleRadiusCorrection(this._camera);
    }

    public getPitchedTextCorrection(textAnchorX: number, textAnchorY: number, tileID: UnwrappedTileID): number {
        return verticalPerspectiveCameraMath.getPitchedTextCorrection(this._camera, textAnchorX, textAnchorY, tileID);
    }

    public projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, elevation?: number): PointProjection {
        return verticalPerspectiveCameraMath.projectTileCoordinates(this._camera, x, y, unwrappedTileID, elevation);
    }

    /**
     * Projects the camera state as it is now into the {@link VerticalPerspectiveProjectedCamera} the other members read.
     * @param nearFarZ - The depth range to use instead of computing one, by default the camera state's override.
     */
    calcMatrices(nearFarZ?: NearFarZ | null): void {
        const metrics = this._getMetrics();
        this._projectedCamera = createVerticalPerspectiveProjectedCamera(metrics, nearFarZ);
        this._projectedMetrics = metrics;
    }

    calculateFogMatrix(unwrappedTileID: UnwrappedTileID): mat4 {
        return verticalPerspectiveCameraMath.calculateFogMatrix(this._camera, unwrappedTileID);
    }

    getVisibleUnwrappedCoordinates(tileID: CanonicalTileID): UnwrappedTileID[] {
        return verticalPerspectiveCameraMath.getVisibleUnwrappedCoordinates(this._camera, this._worldCoordinateHelper, tileID);
    }

    getCameraFrustum(): Frustum {
        return verticalPerspectiveCameraMath.getCameraFrustum(this._camera);
    }
    getClippingPlane(): vec4 | null {
        return verticalPerspectiveCameraMath.getClippingPlane(this._camera);
    }
    getCoveringTilesDetailsProvider(): CoveringTilesDetailsProvider {
        return this._coveringTilesDetailsProvider;
    }

    getGroundElevationAtCenter(terrain?: Terrain): number | null {
        if (terrain) {
            warnOnce('terrain is not fully supported on vertical perspective projection.');
            return null;
        }
        return 0;
    }

    maxPitchScaleFactor(): number {
        return verticalPerspectiveCameraMath.maxPitchScaleFactor(this._camera);
    }

    getCameraAltitude(): number {
        return verticalPerspectiveCameraMath.getCameraAltitude(this._camera);
    }

    getCameraLngLat(): LngLat {
        return verticalPerspectiveCameraMath.getCameraLngLat(this._camera, this._worldCoordinateHelper);
    }

    getBounds(): LngLatBounds {
        return verticalPerspectiveCameraMath.getBounds(this._camera, this._worldCoordinateHelper);
    }

    /**
     * Inverts the camera placement of `calcMatrices` in unit-globe coordinates: the camera sits at radius
     * `1 + altitudeFrom / earthRadius` and looks at the center on the sea-level sphere, the target altitude only becoming
     * the center elevation (the inverse of {@link getCameraAltitude}). Pitch and bearing are read in the center's local
     * frame, +z up, +y north, +x east. A camera straight above the center keeps the transform's bearing.
     */
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const center = LngLat.convert(to);
        const camera = angularCoordinatesToSurfaceVector(LngLat.convert(from));
        vec3.scale(camera, camera, 1 + altitudeFrom / earthRadius);
        const target = angularCoordinatesToSurfaceVector(center);
        const targetAtAltitude = vec3.scale(createVec3f64(), target, 1 + altitudeTo / earthRadius);
        const toCamera = vec3.subtract(createVec3f64(), camera, target);
        const distance = vec3.length(toCamera);
        if (distance < SAME_POINT_DISTANCE || vec3.distance(camera, targetAtAltitude) < SAME_POINT_DISTANCE) {
            throw new Error('Can\'t calculate camera options with same From and To');
        }

        const zero = createVec3f64();
        vec3.rotateY(toCamera, toCamera, zero, -degreesToRadians(center.lng));
        vec3.rotateX(toCamera, toCamera, zero, degreesToRadians(center.lat));
        const pitch = radiansToDegrees(Math.acos(clamp(toCamera[2] / distance, -1, 1)));
        const straightAbove = Math.hypot(toCamera[0], toCamera[1]) < distance * STRAIGHT_ABOVE_RATIO;
        const bearing = straightAbove ? getBearing(this._getMetrics()) : radiansToDegrees(Math.atan2(-toCamera[0], -toCamera[1]));

        // The camera sits cameraToCenterDistance / getGlobeRadiusPixels(worldSize, lat) from the center, and the radius doubles per zoom level.
        const zoom = scaleZoom(this._getMetrics().cameraToCenterDistance / distance / getGlobeRadiusPixels(this._getMetrics().tileSize, center.lat));

        return {center, elevation: altitudeTo, zoom, pitch, bearing};
    }

    /**
     * The center and zoom that {@link Transform.setLocationAtPoint} moves the camera to, or null where the camera
     * stays where it is. The zoom keeps the planet at the size it has now, from the latitude the constrain lets the
     * center reach.
     */
    getCameraForLocationAtPoint(lnglat: LngLat, point: Point, _elevation: number | undefined, constrain: TransformConstrainFunction): {center: LngLat; zoom: number} | null {
        // The elevation is ignored: this transform solves on the planet's surface.
        // This returns some fake coordinates for pixels that do not lie on the planet.
        // Whatever uses `setLocationAtPoint` will need to account for that.
        const pointLngLat = unprojectScreenPoint(this._camera, point);
        const vecToPixelCurrent = angularCoordinatesToSurfaceVector(pointLngLat);
        const vecToTarget = angularCoordinatesToSurfaceVector(lnglat);

        const zero = createVec3f64();
        vec3.zero(zero);

        const rotatedPixelVector = createVec3f64();
        vec3.rotateY(rotatedPixelVector, vecToPixelCurrent, zero, -this._getMetrics().center.lng * Math.PI / 180.0);
        vec3.rotateX(rotatedPixelVector, rotatedPixelVector, zero, this._getMetrics().center.lat * Math.PI / 180.0);

        // We are looking for the lng,lat that will rotate `vecToTarget`
        // so that it is equal to `rotatedPixelVector`.

        // The second rotation around X axis cannot change the X component,
        // so we first must find the longitude such that rotating `vecToTarget` with it
        // will place it so its X component is equal to X component of `rotatedPixelVector`.
        // There will exist zero, one or two longitudes that satisfy this.

        //      x  |
        //     /   |
        //    /    | the line is the target X - rotatedPixelVector.x
        //   /     | the x is vecToTarget projected to x,z plane
        //  .      | the dot is origin
        //
        // We need to rotate vecToTarget so that it intersects the line.
        // If vecToTarget is shorter than the distance to the line from origin, it is impossible.

        // Otherwise, we compute the intersection of the line with a ring with radius equal to
        // length of vecToTarget projected to XZ plane.

        const vecToTargetXZLengthSquared = vecToTarget[0] * vecToTarget[0] + vecToTarget[2] * vecToTarget[2];
        const targetXSquared = rotatedPixelVector[0] * rotatedPixelVector[0];
        if (vecToTargetXZLengthSquared < targetXSquared) {
            // Zero solutions - setLocationAtPoint is impossible.
            return null;
        }

        // The intersection's Z coordinates
        const intersectionA = Math.sqrt(vecToTargetXZLengthSquared - targetXSquared);
        const intersectionB = -intersectionA; // the second solution

        const lngA = angleToRotateBetweenVectors2D(vecToTarget[0], vecToTarget[2], rotatedPixelVector[0], intersectionA);
        const lngB = angleToRotateBetweenVectors2D(vecToTarget[0], vecToTarget[2], rotatedPixelVector[0], intersectionB);

        const vecToTargetLngA = createVec3f64();
        vec3.rotateY(vecToTargetLngA, vecToTarget, zero, -lngA);
        const latA = angleToRotateBetweenVectors2D(vecToTargetLngA[1], vecToTargetLngA[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        const vecToTargetLngB = createVec3f64();
        vec3.rotateY(vecToTargetLngB, vecToTarget, zero, -lngB);
        const latB = angleToRotateBetweenVectors2D(vecToTargetLngB[1], vecToTargetLngB[2], rotatedPixelVector[1], rotatedPixelVector[2]);
        // Is at least one of the needed latitudes valid?

        const limit = Math.PI * 0.5;

        const isValidA = latA >= -limit && latA <= limit;
        const isValidB = latB >= -limit && latB <= limit;

        let validLng: number;
        let validLat: number;
        if (isValidA && isValidB) {
            // Pick the solution that is closer to current map center.
            const centerLngRadians = this._getMetrics().center.lng * Math.PI / 180.0;
            const centerLatRadians = this._getMetrics().center.lat * Math.PI / 180.0;
            const lngDistA = distanceOfAnglesRadians(lngA, centerLngRadians);
            const latDistA = distanceOfAnglesRadians(latA, centerLatRadians);
            const lngDistB = distanceOfAnglesRadians(lngB, centerLngRadians);
            const latDistB = distanceOfAnglesRadians(latB, centerLatRadians);

            if ((lngDistA + latDistA) < (lngDistB + latDistB)) {
                validLng = lngA;
                validLat = latA;
            } else {
                validLng = lngB;
                validLat = latB;
            }
        } else if (isValidA) {
            validLng = lngA;
            validLat = latA;
        } else if (isValidB) {
            validLng = lngB;
            validLat = latB;
        } else {
            // No solution.
            return null;
        }

        const newLng = validLng / Math.PI * 180;
        const newLat = clamp(validLat / Math.PI * 180, -90, 90);
        const moved = newLng !== this._getMetrics().center.lng || newLat !== this._getMetrics().center.lat;
        const {center, zoom} = moved ?
            getConstrainedCamera(this._getMetrics(), constrain, new LngLat(newLng, newLat), this._getMetrics().zoom) :
            {center: this._getMetrics().center, zoom: this._getMetrics().zoom};
        const adjustedZoom = constrain(center, zoom + getZoomAdjustment(this._getMetrics().center.lat, center.lat)).zoom;
        if (adjustedZoom !== zoom) return getConstrainedCamera(this._getMetrics(), constrain, center, adjustedZoom);
        return moved ? {center, zoom} : null;
    }

    locationToScreenPoint(lnglat: LngLat, terrain?: Terrain): Point {
        return verticalPerspectiveCameraMath.locationToScreenPoint(this._camera, this._worldCoordinateHelper, lnglat, terrain);
    }

    screenPointToMercatorCoordinate(p: Point, terrain?: Terrain): MercatorCoordinate {
        return verticalPerspectiveCameraMath.screenPointToMercatorCoordinate(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    /** {@inheritDoc ITransform.screenTerrainPointToMercatorCoordinate} */
    screenTerrainPointToMercatorCoordinate(p: Point, terrain: Terrain): MercatorCoordinate | null {
        return verticalPerspectiveCameraMath.screenTerrainPointToMercatorCoordinate(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    screenPointToLocation(p: Point, terrain?: Terrain): LngLat {
        return verticalPerspectiveCameraMath.screenPointToLocation(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    screenPointToLocationAtElevation(p: Point, elevation: number): LngLat {
        return verticalPerspectiveCameraMath.screenPointToLocationAtElevation(this._camera, this._worldCoordinateHelper, p, elevation);
    }

    isPointOnMapSurface(p: Point, terrain?: Terrain): boolean {
        return verticalPerspectiveCameraMath.isPointOnMapSurface(this._camera, this._worldCoordinateHelper, p, terrain);
    }

    /**
     * Computes normalized direction of a ray from the camera to the given screen pixel.
     */
    getRayDirectionFromPixel(p: Point): vec3 {
        return verticalPerspectiveCameraMath.getRayDirectionFromPixel(this._camera, p);
    }

    getProjectionDataForCustomLayer(applyGlobeMatrix: boolean = true): CustomLayerProjectionData {
        return verticalPerspectiveCameraMath.getProjectionDataForCustomLayer(this._camera, applyGlobeMatrix);
    }

    getFastPathSimpleProjectionMatrix(tileID: OverscaledTileID): mat4 {
        return verticalPerspectiveCameraMath.getFastPathSimpleProjectionMatrix(this._camera, tileID);
    }
}

/**
 * Creates a transform for the vertical perspective projection.
 */
export function createVerticalPerspectiveTransform(options?: TransformOptions): Transform {
    return new Transform((getMetrics) => new VerticalPerspectiveTransform(getMetrics), options);
}
