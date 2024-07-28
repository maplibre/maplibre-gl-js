import Point from '@mapbox/point-geometry';
import {IReadonlyTransform, ITransform} from '../transform_interface';
import {LngLat, LngLatLike} from '../lng_lat';
import {CameraForBoundsOptions, PointLike} from '../../ui/camera';
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

export type EaseToHandlerOptions = {
    bearing: number;
    pitch: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    around?: LngLat;
    aroundPoint?: Point;
    center?: LngLatLike;
    zoom?: number;
    apparentZoom?: number;
    offset?: PointLike;
}

export type EaseToHandler = {
    easeFunc: (k: number) => void;
    elevationCenter: LngLat;
    isZooming: boolean;
}

export type FlyToHandlerOptions = {
    bearing: number;
    pitch: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    center?: LngLatLike;
    locationAtOffset: LngLat;
    zoom?: number;
    apparentZoom?: number;
    minZoom?: number;
    apparentMinZoom?: number;
}

export type FlyToHandler = {
    easeFunc: (k: number, scale: number, centerFactor: number, pointAtOffset: Point) => void;
    scaleOfZoom: number;
    scaleOfMinZoom?: number;
    targetCenter: LngLat;
    pixelPathLength: number;
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

    handleEaseTo(tr: ITransform, options: EaseToHandlerOptions): EaseToHandler;

    handleFlyTo(tr: ITransform, options: FlyToHandlerOptions): FlyToHandler;
}
