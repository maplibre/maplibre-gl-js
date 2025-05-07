import {MercatorCameraHelper} from './mercator_camera_helper';
import {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper';

import type Point from '@mapbox/point-geometry';
import type {CameraForBoxAndBearingHandlerResult, EaseToHandlerResult, EaseToHandlerOptions, FlyToHandlerResult, FlyToHandlerOptions, ICameraHelper, MapControlsDeltas} from './camera_helper';
import type {LngLat, LngLatLike} from '../lng_lat';
import type {IReadonlyTransform, ITransform} from '../transform_interface';
import type {GlobeProjection} from './globe_projection';
import type {CameraForBoundsOptions} from '../../ui/camera';
import type {LngLatBounds} from '../lng_lat_bounds';
import type {PaddingOptions} from '../edge_insets';

/**
 * @internal
 */
export class GlobeCameraHelper implements ICameraHelper {
    private _globe: GlobeProjection;
    private _mercatorCameraHelper: MercatorCameraHelper;
    private _verticalPerspectiveCameraHelper: VerticalPerspectiveCameraHelper;

    constructor(globe: GlobeProjection) {
        this._globe = globe;
        this._mercatorCameraHelper = new MercatorCameraHelper();
        this._verticalPerspectiveCameraHelper = new VerticalPerspectiveCameraHelper();
    }

    get useGlobeControls(): boolean { return this._globe.useGlobeRendering; }

    get currentHelper(): ICameraHelper {
        return this.useGlobeControls ? this._verticalPerspectiveCameraHelper : this._mercatorCameraHelper;
    }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        return this.currentHelper.handlePanInertia(pan, transform);
    }

    handleMapControlsRollPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        return this.currentHelper.handleMapControlsRollPitchBearingZoom(deltas, tr);
    }

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        this.currentHelper.handleMapControlsPan(deltas, tr, preZoomAroundLoc);
    }

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: ITransform): CameraForBoxAndBearingHandlerResult {
        return this.currentHelper.cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
    }

    /**
     * Handles the zoom and center change during camera jumpTo.
     */
    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; center?: LngLatLike }): void {
        this.currentHelper.handleJumpToCenterZoom(tr, options);
    }

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandlerResult {
        return this.currentHelper.handleEaseTo(tr, options);
    }

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandlerResult {
        return this.currentHelper.handleFlyTo(tr, options);
    }
}