import type Point from '@mapbox/point-geometry';
import type {LngLat, LngLatLike} from '../geo/lng_lat.ts';
import type {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {CameraViewState} from './camera_view_state.ts';
import type {ProjectedCamera} from './projected_camera.ts';
import type {CameraContext} from './camera_context.ts';
import type {CameraForBoundsOptions, PointLike} from './camera_types.ts';

/** @internal What a frame of a gesture changes, which {@link CameraMotions.rollPitchBearingZoom} and {@link CameraMotions.pan} apply. */
export type MapControlsDeltas = {
    panDelta: Point;
    zoomDelta: number;
    bearingDelta: number;
    pitchDelta: number;
    rollDelta: number;
    around: Point;
    /**
     * Elevation in meters of the terrain under `around` at gesture start; when set,
     * pan and zoom keep the terrain at this elevation under `around`.
     */
    aroundElevation?: number;
};

/** @internal The camera {@link CameraMotions.cameraForBoxAndBearing} fits a box with. */
export type CameraForBoxAndBearingResult = {
    center: LngLat;
    zoom: number;
    bearing: number;
};

/** @internal What an `easeTo` animation eases to, see {@link CameraMotions.easeTo}. */
export type EaseToMotionOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    around?: LngLat;
    aroundPoint?: Point;
    center?: LngLatLike;
    zoom?: number;
    offset?: PointLike;
};

/** @internal The frames of an `easeTo` animation, see {@link CameraMotions.easeTo}. */
export type EaseToMotion = {
    /**
     * The camera `k` of the way through the animation, from the camera the frame starts with and the context it is in
     * then, which a globe's transition between its projections changes as it zooms.
     */
    easeFunc: (view: CameraViewState, context: CameraContext, k: number) => CameraViewState;
    /**
     * The map center when the animation ends.
     */
    elevationCenter: LngLat;
    isZooming: boolean;
};

/** @internal Where a `flyTo` flight goes, see {@link CameraMotions.flyTo}. */
export type FlyToMotionOptions = {
    bearing: number;
    pitch: number;
    roll: number;
    padding: PaddingOptions;
    offsetAsPoint: Point;
    center?: LngLatLike;
    locationAtOffset: LngLat;
    zoom?: number;
    minZoom?: number;
};

/** @internal The frames of a `flyTo` flight, see {@link CameraMotions.flyTo}. */
export type FlyToMotion = {
    /** The camera `k` of the way along the flight, from the camera the frame starts with and its context, see {@link EaseToMotion.easeFunc}. */
    easeFunc: (view: CameraViewState, context: CameraContext, k: number, scale: number, centerFactor: number, pointAtOffset: Point) => CameraViewState;
    scaleOfZoom: number;
    scaleOfMinZoom: number;
    /**
     * The map center when the animation ends.
     */
    targetCenter: LngLat;
    pixelPathLength: number;
};

/**
 * @internal
 * How gestures and animations move the camera, which the projection the camera is drawn with decides: a globe is
 * turned while it renders as a globe, and moved like mercator once it has turned into mercator. `getCameraMotions` in
 * `camera_motions_factory.ts` picks the one for a context. The implementations hold nothing, so every method is handed
 * the camera.
 */
export interface CameraMotions {
    /**
     * Where pan inertia eases the camera to after a drag that ended moving by `pan` pixels: an offset from the center
     * on a plane, kept short of the horizon, and a new center on the globe.
     */
    panInertia(projectedCamera: ProjectedCamera, pan: Point): {easingCenter: LngLat; easingOffset: Point};

    /** The camera turned and zoomed by a gesture frame's deltas, zooming around its `around` point on the globe. */
    rollPitchBearingZoom(view: CameraViewState, context: CameraContext, deltas: MapControlsDeltas): CameraViewState;

    /** The camera panned by a gesture frame, keeping `preZoomAroundLoc` under the point it was grabbed at. */
    pan(view: CameraViewState, context: CameraContext, deltas: MapControlsDeltas, preZoomAroundLoc: LngLat): CameraViewState;

    /**
     * The camera that fits a box at a bearing, see `cameraForBounds`.
     * @param fitPadding - The `padding` option of `cameraForBounds`: the space wanted around the bounds.
     * @param mapPadding - The map's own padding, as in `map.getPadding()`, which the bounds must also stay clear of.
     */
    cameraForBoxAndBearing(options: CameraForBoundsOptions, fitPadding: PaddingOptions, mapPadding: PaddingOptions, bounds: LngLatBounds, bearing: number, view: CameraViewState, context: CameraContext): CameraForBoxAndBearingResult;

    /** The camera a `jumpTo` puts at its center and zoom. */
    jumpToCenterZoom(view: CameraViewState, context: CameraContext, options: {zoom?: number; center?: LngLatLike}): CameraViewState;

    /** The frames of an `easeTo` animation from the camera it starts with. */
    easeTo(view: CameraViewState, context: CameraContext, options: EaseToMotionOptions): EaseToMotion;

    /** The frames of a `flyTo` flight from the camera it starts with. */
    flyTo(view: CameraViewState, context: CameraContext, options: FlyToMotionOptions): FlyToMotion;
}
