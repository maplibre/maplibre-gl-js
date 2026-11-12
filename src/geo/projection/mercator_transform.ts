import {LngLat, type LngLatLike} from '../lng_lat.ts';
import {mercatorWorldCoordinateHelper} from '../mercator_coordinate.ts';
import {radiansToDegrees, scaleZoom} from '../../util/util.ts';
import {Transform} from '../transform.ts';
import {getConstrainedCamera} from '../../camera/camera_view_state.ts';
import {renderedProjectedCamera} from '../../camera/projected_camera.ts';
import {screenPointToMercatorCoordinateAtZ, terrainPointPastMaxZoom} from '../../camera/mercator_camera_math.ts';
import {getCameraMath} from '../../camera/camera_math_factory.ts';

import type Point from '@mapbox/point-geometry';
import type {MercatorProjectedCamera, ProjectedCamera} from '../../camera/projected_camera.ts';
import type {CameraProjectionKind} from '../../camera/camera_context.ts';
import type {Terrain} from '../../render/terrain.ts';
import type {IProjectionTransform, TransformOptions} from '../transform.ts';
import type {WorldCoordinateHelper} from '../world_types.ts';
import type {CameraOptionsFromTo, TransformConstrainFunction} from '../../camera/camera_types.ts';

/**
 * @internal
 * The mercator part of a {@link Transform}: where it places a mercator camera.
 */
export class MercatorTransform implements IProjectionTransform {
    /** The transform's camera as it is now, see {@link Transform.projectedCamera}. */
    private readonly _getProjectedCamera: () => ProjectedCamera;

    readonly cameraProjection: CameraProjectionKind = 'mercator';
    readonly projectionTransition: number = 0;
    /** The lng/lat to world coordinate mapping, mercator's unless the part is built for a registered CRS. */
    private readonly _worldCoordinateHelper: WorldCoordinateHelper;

    /**
     * @param getProjectedCamera - Returns the transform's camera as it is now.
     * @param worldCoordinateHelper - The lng/lat to world coordinate mapping, mercator's by default.
     */
    constructor(getProjectedCamera: () => ProjectedCamera, worldCoordinateHelper: WorldCoordinateHelper = mercatorWorldCoordinateHelper) {
        this._getProjectedCamera = getProjectedCamera;
        this._worldCoordinateHelper = worldCoordinateHelper;
    }

    /**
     * The transform's camera as mercator projects it: a globe's part reads it only while the globe renders as
     * mercator, see {@link renderedProjectedCamera}.
     */
    private get _camera(): MercatorProjectedCamera {
        return renderedProjectedCamera(this._getProjectedCamera()) as MercatorProjectedCamera;
    }

    clone(getProjectedCamera: () => ProjectedCamera): MercatorTransform {
        return new MercatorTransform(getProjectedCamera, this._worldCoordinateHelper);
    }

    setTransitionState(_value: number): void {
        // Do nothing
    }

    /**
     * The elevation of the ground the camera looks at, which {@link Transform.recalculateZoomAndCenter} moves the
     * center to, or null where the camera would end up below that ground.
     */
    getGroundElevationAtCenter(terrain?: Terrain): number | null {
        const projectedCamera = this._camera;
        const cameraMath = getCameraMath(projectedCamera);
        const center = (terrain && terrainPointPastMaxZoom(projectedCamera, this._worldCoordinateHelper, terrain)) || cameraMath.screenPointToLocation(projectedCamera, this._worldCoordinateHelper, projectedCamera.centerPoint, terrain);
        const elevation = terrain ? terrain.getElevationForLngLat(center, projectedCamera.tileZoom) : 0;
        if (projectedCamera.pitch < 90 && elevation >= cameraMath.getCameraAltitude(projectedCamera)) return null;
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
        const projectedCamera = this._camera;
        const z = (elevation ?? projectedCamera.elevation) - projectedCamera.elevation;
        const a = screenPointToMercatorCoordinateAtZ(projectedCamera, point, z);
        const b = screenPointToMercatorCoordinateAtZ(projectedCamera, projectedCamera.centerPoint, 0);
        const worldCoordinateHelper = this._worldCoordinateHelper;
        const loc = worldCoordinateHelper.worldFromLngLat(lnglat.lng, lnglat.lat);
        const center = worldCoordinateHelper.lngLatFromWorld(
            loc.x - (a.x - b.x),
            loc.y - (a.y - b.y));
        const moved = center.lng !== projectedCamera.center.lng || center.lat !== projectedCamera.center.lat;
        let camera = moved ? getConstrainedCamera(projectedCamera, constrain, center, projectedCamera.zoom) : null;
        if (projectedCamera.renderWorldCopies && worldCoordinateHelper.wraps) {
            const unwrapped = camera ?? {center: projectedCamera.center, zoom: projectedCamera.zoom};
            const wrapped = unwrapped.center.wrap();
            if (wrapped.lng !== unwrapped.center.lng) camera = getConstrainedCamera(projectedCamera, constrain, wrapped, unwrapped.zoom);
        }
        return camera;
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

        const projectedCamera = this._getProjectedCamera();
        const zoom = scaleZoom(projectedCamera.cameraToCenterDistance / distance3D / projectedCamera.tileSize);
        const bearing = radiansToDegrees(Math.atan2(dx, -dy));
        let pitch = radiansToDegrees(Math.acos(groundDistance / distance3D));
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;

        return {center: worldCoordinateHelper.lngLatFromWorld(toWorld.x, toWorld.y), elevation: altitudeTo, zoom, pitch, bearing};
    }
}

/**
 * Creates a transform for the mercator projection, or for a registered CRS with that CRS's world coordinate helper.
 */
export function createMercatorTransform(options?: TransformOptions): Transform {
    return new Transform((getProjectedCamera, worldCoordinateHelper) => new MercatorTransform(getProjectedCamera, worldCoordinateHelper), options);
}
