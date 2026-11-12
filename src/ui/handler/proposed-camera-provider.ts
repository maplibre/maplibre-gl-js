import Point from '@mapbox/point-geometry';
import * as cameraMath from '../../geo/projection/camera_math.ts';
import {applyConstrain} from '../../geo/projection/camera_constrain.ts';

import type {Camera} from '../camera.ts';
import type {JumpToOptions, PointLike} from '../camera.ts';
import type {ProjectedCamera} from '../../geo/projected_camera.ts';
import type {LngLat} from '../../geo/lng_lat.ts';

/**
 * @internal
 * The camera the handlers ask for, and what they read off it. While a movement runs, the camera it asks for may differ
 * from the rendered one, see {@link Camera.proposedProjectedCamera}, and the handlers need the one they asked for to
 * add up their changes.
 */
export class ProposedCameraProvider {
    _camera: Camera;

    constructor(camera: Camera) {
        this._camera = camera;
    }

    /** The proposed camera. */
    get camera(): ProjectedCamera {
        return this._camera.proposedProjectedCamera;
    }

    get center(): {lng: number; lat: number} {
        const {center} = this.camera;
        return {lng: center.lng, lat: center.lat};
    }

    get zoom(): number {
        return this.camera.zoom;
    }

    get pitch(): number {
        return this.camera.pitch;
    }

    get bearing(): number {
        return this.camera.bearing;
    }

    /** The screen point of a location on the proposed camera. */
    project(lngLat: LngLat): Point {
        return cameraMath.locationToScreenPoint(this.camera, this._camera.context.projection, lngLat);
    }

    unproject(point: PointLike): LngLat {
        return cameraMath.screenPointToLocation(this.camera, this._camera.context.projection, Point.convert(point), this._camera.terrain);
    }

    /** Whether a screen point shows the map, rather than the sky or the space around the globe. */
    isPointOnMapSurface(point: Point): boolean {
        return cameraMath.isPointOnMapSurface(this.camera, this._camera.context.projection, point);
    }

    /** The location right under the proposed camera. */
    getCameraLngLat(): LngLat {
        return cameraMath.getCameraLngLat(this.camera, this._camera.context.projection);
    }

    /** Where the camera's constrain puts a center and a zoom, see {@link applyConstrain}. */
    constrain(lngLat: LngLat, zoom: number): {center: LngLat; zoom: number} {
        return applyConstrain(this._camera.renderedState, this._camera.context, lngLat, zoom);
    }

    /** The step zoom levels snap to, see {@link Camera.getZoomSnap}. */
    get zoomSnap(): number {
        return this._camera.getZoomSnap();
    }

    /**
     * The camera that fits a box drawn on the screen with the map turned to `bearing`, as the camera's
     * `fitScreenCoordinates` finds it, or undefined where no zoom fits the box.
     */
    cameraForScreenBox(p0: PointLike, p1: PointLike, bearing: number): JumpToOptions | undefined {
        const projectedCamera = this._camera.projectedCamera;
        const projection = this._camera.context.projection;
        return this._camera._cameraForBoxAndBearing(
            cameraMath.screenPointToLocation(projectedCamera, projection, Point.convert(p0)),
            cameraMath.screenPointToLocation(projectedCamera, projection, Point.convert(p1)),
            bearing);
    }
}
