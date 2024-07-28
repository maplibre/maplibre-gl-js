import Point from '@mapbox/point-geometry';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {LngLat, LngLatLike} from '../lng_lat';
import {CameraForBoundsOptions} from '../../ui/camera';
import {PaddingOptions} from '../edge_insets';
import {LngLatBounds} from '../lng_lat_bounds';
import {warnOnce} from '../../util/util';

export type MapControlsDeltas = {
    panDelta: Point;
    zoomDelta: number;
    bearingDelta: number;
    pitchDelta: number;
    around: Point;
}

/**
 * @internal
 */
export function cameraBoundsWarning() {
    warnOnce(
        'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
    );
}

/**
 * @internal
 * Contains projection-specific functions related to camera controls, easeTo, flyTo, inertia, etc.
 */
export interface ICameraHelper {
    get useGlobeControls(): boolean;

    handlePanInertia(pan: Point, transform: IReadonlyTransform): {
        easingCenter: LngLat;
        easingOffset: Point;
    };

    handleMapControlsPitchBearingZoom(deltas: MapControlsDeltas, tr: ITransform): void;

    handleMapControlsPan(deltas: MapControlsDeltas, tr: ITransform, preZoomAroundLoc: LngLat): void;

    cameraForBoxAndBearing(options: CameraForBoundsOptions, padding: PaddingOptions, bounds: LngLatBounds, bearing: number, tr: IReadonlyTransform): {
        center: LngLat;
        zoom: number;
        bearing: number;
    };

    handleJumpToCenterZoom(tr: ITransform, options: { zoom?: number; apparentZoom?: number; center?: LngLatLike }): void;
}
