import {LngLat, type LngLatLike} from '../geo/lng_lat.ts';
import {radiansToDegrees, scaleZoom} from '../util/util.ts';
import {getConstrainedCamera, moveCenterToElevation, setCenterAndZoom} from './camera_updates.ts';
import {projectCamera} from './project_camera.ts';
import {renderedProjectedCamera} from './projected_camera.ts';
import {screenPointToMercatorCoordinateAtZ, terrainPointPastMaxZoom} from './mercator_camera_math.ts';
import {getCameraMath} from './camera_math_factory.ts';

import type Point from '@mapbox/point-geometry';
import type {CameraViewState} from './camera_view_state.ts';
import type {CameraContext} from './camera_context.ts';
import type {CameraOptionsFromTo} from './camera_types.ts';
import type {MercatorProjectedCamera} from './projected_camera.ts';
import type {Terrain} from '../render/terrain.ts';
import type {CameraSolver} from './camera_solver.ts';

/**
 * How many times {@link MercatorCameraSolver.recenterOnTerrain} picks the terrain under the center and moves the center onto it, and how far
 * above or below the terrain a center may stay. Each pass keeps the camera where it is, so the center's latitude changes
 * the mercator scale the next pass sees and the terrain pick moves with it; the remainder shrinks by the scale
 * difference each pass, from meters to under a millimeter on the second.
 */
const CENTER_ON_TERRAIN_PASSES = 3;
const CENTER_ON_TERRAIN_TOLERANCE_M = 0.0001;

/** The camera of a view in a context that renders with mercator, as mercator projects it. */
function projectMercator(view: CameraViewState, context: CameraContext): MercatorProjectedCamera {
    return renderedProjectedCamera(projectCamera(view, context)) as MercatorProjectedCamera;
}

/**
 * The elevation of the ground a mercator camera looks at, which {@link MercatorCameraSolver.recenterOnTerrain} moves the center to, or null
 * where the camera would end up below that ground.
 */
function getGroundElevationAtCenter(view: CameraViewState, context: CameraContext, terrain?: Terrain): number | null {
    const rendered = projectMercator(view, context);
    const worldCoordinateHelper = context.worldCoordinateHelper;
    const center = (terrain && terrainPointPastMaxZoom(rendered, worldCoordinateHelper, terrain)) || getCameraMath(rendered).screenPointToLocation(rendered, worldCoordinateHelper, rendered.centerPoint, terrain);
    const elevation = terrain ? terrain.getElevationForLngLat(center, rendered.tileZoom) : 0;
    if (rendered.pitch < 90 && elevation >= getCameraMath(rendered).getCameraAltitude(rendered)) return null;
    return elevation;
}

/** @internal The {@link CameraSolver} of a camera rendered with mercator, which solves on the flat world. */
export class MercatorCameraSolver implements CameraSolver {
    setLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point, elevation?: number): CameraViewState {
        const camera = this.getCameraForLocationAtPoint(view, context, lnglat, point, elevation);
        return camera ? setCenterAndZoom(view, camera.center, camera.zoom) : view;
    }

    /**
     * Both rays are cast through the same inverse pixel matrix so its inversion error cancels out of their difference;
     * the current-center ray must be intersected at the center's own elevation (z=0), since intersecting it with the
     * elevated plane would land `(elevation - centerElevation)·tan(pitch)` away from the center and make repeated calls
     * drift. In a world that wraps, a center outside the main world is then wrapped into it and constrained again.
     */
    getCameraForLocationAtPoint(view: CameraViewState, context: CameraContext, lnglat: LngLat, point: Point, elevation: number = view.elevation): {center: LngLat; zoom: number} | null {
        const rendered = projectMercator(view, context);
        const z = elevation - rendered.elevation;
        const a = screenPointToMercatorCoordinateAtZ(rendered, point, z);
        const b = screenPointToMercatorCoordinateAtZ(rendered, rendered.centerPoint, 0);
        const worldCoordinateHelper = context.worldCoordinateHelper;
        const loc = worldCoordinateHelper.worldFromLngLat(lnglat.lng, lnglat.lat);
        const center = worldCoordinateHelper.lngLatFromWorld(
            loc.x - (a.x - b.x),
            loc.y - (a.y - b.y));
        const moved = center.lng !== rendered.center.lng || center.lat !== rendered.center.lat;
        let camera = moved ? getConstrainedCamera(view, context, center, rendered.zoom) : null;
        if (rendered.renderWorldCopies && worldCoordinateHelper.wraps) {
            const unwrapped = camera ?? {center: rendered.center, zoom: rendered.zoom};
            const wrapped = unwrapped.center.wrap();
            if (wrapped.lng !== unwrapped.center.lng) camera = getConstrainedCamera(view, context, wrapped, unwrapped.zoom);
        }
        return camera;
    }

    /**
     * Picks the terrain under the center and moves the center onto it until it stays there, see
     * {@link CENTER_ON_TERRAIN_PASSES}; a center the camera would end up below stays where it is.
     */
    recenterOnTerrain(view: CameraViewState, context: CameraContext, terrain?: Terrain): CameraViewState {
        let next = view;
        for (let pass = 0; pass < CENTER_ON_TERRAIN_PASSES; pass++) {
            const elevation = getGroundElevationAtCenter(next, context, terrain);
            if (elevation === null) return next;
            next = moveCenterToElevation(next, context, elevation);
            if (!terrain || Math.abs(terrain.getElevationForLngLat(next.center, projectCamera(next, context).tileZoom) - next.elevation) <= CENTER_ON_TERRAIN_TOLERANCE_M) return next;
        }
        return next;
    }

    calculateCameraOptionsFromTo(view: CameraViewState, context: CameraContext, from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number): CameraOptionsFromTo {
        const rendered = projectMercator(view, context);
        const worldCoordinateHelper = context.worldCoordinateHelper;
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

        const zoom = scaleZoom(rendered.cameraToCenterDistance / distance3D / rendered.tileSize);
        const bearing = radiansToDegrees(Math.atan2(dx, -dy));
        let pitch = radiansToDegrees(Math.acos(groundDistance / distance3D));
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;

        return {center: worldCoordinateHelper.lngLatFromWorld(toWorld.x, toWorld.y), elevation: altitudeTo, zoom, pitch, bearing};
    }
}
