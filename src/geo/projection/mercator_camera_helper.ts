import Point from '@mapbox/point-geometry';
import {LngLat} from '../lng_lat';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {ICameraHelper, MapControlsDeltas} from './camera_helper';

/**
 * @internal
 */
export class MercatorCameraHelper implements ICameraHelper {
    get useGlobeControls(): boolean { return false; }

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    } {
        return {
            easingOffset: pan,
            easingCenter: transform.center,
        };
    }

    handleMapControlsPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void {
        if (deltas.bearingDelta) tr.setBearing(tr.bearing + deltas.bearingDelta);
        if (deltas.pitchDelta) tr.setPitch(tr.pitch + deltas.pitchDelta);
        if (deltas.zoomDelta) tr.setZoom(tr.zoom + deltas.zoomDelta);
    }

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void {
        tr.setLocationAtPoint(preZoomAroundLoc, deltas.around);
    }
}
