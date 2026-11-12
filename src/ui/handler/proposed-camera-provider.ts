import Point from '@mapbox/point-geometry';
import {getCameraMath} from '../../camera/camera_math_factory.ts';
import {applyConstrain} from '../../camera/camera_constrain.ts';

import type {Camera} from '../camera.ts';
import type {JumpToOptions} from '../camera.ts';
import type {ProjectedCamera} from '../../camera/projected_camera.ts';
import type {LngLat} from '../../geo/lng_lat.ts';
import type {PointLike} from '../../camera/camera_types.ts';

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
        return getCameraMath(this.camera).locationToScreenPoint(this.camera, this._camera.context.worldCoordinateHelper, lngLat);
    }

    unproject(point: PointLike): LngLat {
        return getCameraMath(this.camera).screenPointToLocation(this.camera, this._camera.context.worldCoordinateHelper, Point.convert(point), this._camera.terrain);
    }

    /** Whether a screen point shows the map, rather than the sky or the space around the globe. */
    isPointOnMapSurface(point: Point): boolean {
        return getCameraMath(this.camera).isPointOnMapSurface(this.camera, this._camera.context.worldCoordinateHelper, point);
    }

    /** The location right under the proposed camera. */
    getCameraLngLat(): LngLat {
        return getCameraMath(this.camera).getCameraLngLat(this.camera, this._camera.context.worldCoordinateHelper);
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
        const worldCoordinateHelper = this._camera.context.worldCoordinateHelper;
        return this._camera._cameraForBoxAndBearing(
            getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, worldCoordinateHelper, Point.convert(p0)),
            getCameraMath(projectedCamera).screenPointToLocation(projectedCamera, worldCoordinateHelper, Point.convert(p1)),
            bearing);
    }
}
