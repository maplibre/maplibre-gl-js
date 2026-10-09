import Point from '@mapbox/point-geometry';
import {clamp, extend, wrap, defaultEasing, pick, evaluateZoomSnap, lerp, zoomScale} from '../util/util.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {browser} from '../util/browser.ts';
import {now} from '../util/time_control.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {Evented} from '../util/evented.ts';
import {MapMovementEvent} from './events.ts';
import {createMercatorTransform} from '../geo/projection/mercator_transform.ts';
import {MercatorCameraHelper} from '../geo/projection/mercator_camera_helper.ts';
import {sampleAt} from '../render/terrain_coverage.ts';
import {ElevationHold} from './elevation_hold.ts';

import type {MapEventType} from './events.ts';
import type {Terrain} from '../render/terrain.ts';
import type {ITransform, TransformConstrainFunction} from '../geo/transform_interface.ts';
import type {LngLatLike} from '../geo/lng_lat.ts';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.ts';
import type {TaskID} from '../util/task_queue.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper.ts';
import type {ElevationHolder} from './elevation_hold.ts';

/**
 * A [Point](https://github.com/mapbox/point-geometry) or an array of two numbers representing `x` and `y` screen coordinates in pixels.
 *
 * @group Geography and Geometry
 *
 * @example
 * ```ts
 * let p1 = new Point(-77, 38); // a PointLike which is a Point
 * let p2 = [-77, 38]; // a PointLike which is an array of two numbers
 * ```
 */
export type PointLike = Point | [number, number];

/**
 * How many times a camera update outside a held gesture raises a camera it found inside the terrain, each time by as far
 * as the terrain still reaches above it; the new pitch and zoom move the near clipping plane, so the remainder shrinks
 * with each pass, and three leave it within a few meters of a floor 20 km above the center in the tests.
 */
const MAX_CAMERA_RAISES = 3;

/**
 * How far from the terrain a zoom-in frame's re-solve may leave the held center and still count as moving it onto the
 * terrain. A re-solve that lands leaves the center within a millimeter; a meter or more means the terrain the center ray
 * hits and the terrain the DEM reports under the new center disagree, over a rise the scene has not drawn yet or past a
 * crest the ray slipped over, and the frame keeps the held center instead.
 */
const MAX_CENTER_OFF_TERRAIN_M = 1;

/**
 * How far the drawn terrain may rise above where the center would sit at maxZoom, see
 * {@link Camera._terrainHeightAboveMaxZoomForCenter}, and still count as below it: a center on the ground at maxZoom
 * sits there already, and two reads of the same surface under it differ by rounding.
 */
const MAX_ZOOM_FOR_CENTER_TOLERANCE_M = 0.01;

/**
 * Options common to {@link Map.jumpTo}, {@link Map.easeTo}, and {@link Map.flyTo}, controlling the desired location,
 * zoom, bearing, pitch, and roll of the camera. All properties are optional, and when a property is omitted, the current
 * camera value for that property will remain unchanged.
 *
 * @example
 * Set the map's initial perspective with CameraOptions
 * ```ts
 * let map = new Map({
 *   container: 'map',
 *   style: 'https://demotiles.maplibre.org/style.json',
 *   center: [-73.5804, 45.53483],
 *   pitch: 60,
 *   bearing: -60,
 *   zoom: 10
 * });
 * ```
 * @see [Set pitch and bearing](https://maplibre.org/maplibre-gl-js/docs/examples/set-pitch-and-bearing/)
 * @see [Jump to a series of locations](https://maplibre.org/maplibre-gl-js/docs/examples/jump-to-a-series-of-locations/)
 * @see [Fly to a location](https://maplibre.org/maplibre-gl-js/docs/examples/fly-to-a-location/)
 * @see [Display buildings in 3D](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/)
 */
export type CameraOptions = CenterZoomBearing & {
    /**
     * The desired pitch in degrees. The pitch is the angle towards the horizon
     * measured in degrees with a range between 0 and 60 degrees. For example, pitch: 0 provides the appearance
     * of looking straight down at the map, while pitch: 60 tilts the user's perspective towards the horizon.
     * Increasing the pitch value is often used to display 3D objects.
     */
    pitch?: number;
    /**
     * The desired roll in degrees. The roll is the angle about the camera boresight.
     */
    roll?: number;
    /**
     * The elevation of the center point in meters above sea level.
     */
    elevation?: number;
};

/**
 * Holds center, zoom and bearing properties
 */
export type CenterZoomBearing = {
    /**
     * The desired center.
     */
    center?: LngLatLike;
    /**
     * The desired mercator zoom level.
     */
    zoom?: number;
    /**
     * The desired bearing in degrees. The bearing is the compass direction that
     * is "up". For example, `bearing: 90` orients the map so that east is up.
     */
    bearing?: number;
};

/**
 * The options object related to the {@link Map.jumpTo} method
 */
export type JumpToOptions = CameraOptions & {
    /**
     * Dimensions in pixels applied on each side of the viewport for shifting the vanishing point.
     */
    padding?: PaddingOptions;
};

/** Options for calculating an anchored camera. */
export type AnchoredCameraOptions = {
    /** Geographic location to anchor. */
    anchorLocation: LngLatLike;
    /** Screen position for the anchor. */
    anchorScreenPoint: PointLike;
    /** Desired zoom level. */
    zoom?: number;
};

/**
 * A options object for the {@link Map.cameraForBounds} method
 */
export type CameraForBoundsOptions = CameraOptions & {
    /**
     * The amount of padding in pixels to add to the given bounds, on top of the map's current padding.
     */
    padding?: number | PaddingOptions;
    /**
     * If `true`, `padding` replaces the map's current padding instead of adding to it, and is returned with the result.
     * This will become the default in version 7.
     * @defaultValue false
     */
    absolutePadding?: boolean;
    /**
     * The center of the given bounds relative to the map's center, measured in pixels.
     * @defaultValue [0, 0]
     */
    offset?: PointLike;
    /**
     * The maximum zoom level to allow when the camera would transition to the specified bounds.
     */
    maxZoom?: number;
};

/**
 * The {@link Map.flyTo} options object
 */
export type FlyToOptions = AnimationOptions & CameraOptions & {
    /**
     * The zooming "curve" that will occur along the
     * flight path. A high value maximizes zooming for an exaggerated animation, while a low
     * value minimizes zooming for an effect closer to {@link Map.easeTo}. 1.42 is the average
     * value selected by participants in the user study discussed in
     * [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf). A value of
     * `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A
     * value of 1 would produce a circular motion.
     * @defaultValue 1.42
     */
    curve?: number;
    /**
     * The minimum zoom level that the flight arc may reach. The animation will
     * not zoom out beyond this level. If the natural flight arc stays within
     * this boundary, the arc is unchanged. This acts as a ceiling on zoom-out
     * even when `options.curve` is also specified.
     */
    minZoom?: number;
    /**
     * The average speed of the animation defined in relation to
     * `options.curve`. A speed of 1.2 means that the map appears to move along the flight path
     * by 1.2 times `options.curve` screenfulls every second. A _screenfull_ is the map's visible span.
     * It does not correspond to a fixed physical distance, but varies by zoom level.
     * @defaultValue 1.2
     */
    speed?: number;
    /**
     * The average speed of the animation measured in screenfulls
     * per second, assuming a linear timing curve. If `options.speed` is specified, this option is ignored.
     */
    screenSpeed?: number;
    /**
     * The animation's maximum duration, measured in milliseconds.
     * If duration exceeds maximum duration, it resets to 0.
     */
    maxDuration?: number;
    /**
     * The amount of padding in pixels to add to the given bounds.
     */
    padding?: number | PaddingOptions;
};

/**
 * The {@link Map.easeTo} options object
 */
export type EaseToOptions = AnimationOptions & CameraOptions & {
    delayEndEvents?: number;
    padding?: number | PaddingOptions;
    /**
     * If `zoom` is specified, `around` determines the point around which the zoom is centered.
     */
    around?: LngLatLike;
    easeId?: string;
    noMoveStart?: boolean;
};

/**
 * Options for {@link Map.fitBounds} method
 */
export type FitBoundsOptions = FlyToOptions & {
    /**
     * If `true`, the map transitions using {@link Map.easeTo}. If `false`, the map transitions using {@link Map.flyTo}.
     * See those functions and {@link AnimationOptions} for information about options available.
     * @defaultValue false
     */
    linear?: boolean;
    /**
     * If `true`, `padding` replaces the map's current padding instead of adding to it, and the map transitions to it.
     * This will become the default in version 7.
     * @defaultValue false
     */
    absolutePadding?: boolean;
    /**
     * The center of the given bounds relative to the map's center, measured in pixels.
     * @defaultValue [0, 0]
     */
    offset?: PointLike;
    /**
     * The maximum zoom level to allow when the map view transitions to the specified bounds.
     */
    maxZoom?: number;
};

/**
 * Options common to map movement methods that involve animation, such as {@link Map.panBy} and
 * {@link Map.easeTo}, controlling the duration and easing function of the animation. All properties
 * are optional.
 *
 */
export type AnimationOptions = {
    /**
     * The animation's duration, measured in milliseconds.
     */
    duration?: number;
    /**
     * A function taking a time in the range 0..1 and returning a number where 0 is
     * the initial state and 1 is the final state.
     */
    easing?: (_: number) => number;
    /**
     * of the target center relative to real map container center at the end of animation.
     */
    offset?: PointLike;
    /**
     * If `false`, no animation will occur.
     */
    animate?: boolean;
    /**
     * If `true`, then the animation is considered essential and will not be affected by
     * [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/\@media/prefers-reduced-motion).
     */
    essential?: boolean;
    /**
     * Default false. Needed in 3D maps to let the camera stay in a constant
     * height based on sea-level. After the animation finished the zoom-level will be recalculated in respect of
     * the distance from the camera to the center-coordinate-altitude.
     */
    freezeElevation?: boolean;
};

/**
 * A callback hook that allows manipulating the camera and being notified about camera updates before they happen
 */
export type CameraUpdateTransformFunction =  (next: {
    center: LngLat;
    zoom: number;
    roll: number;
    pitch: number;
    bearing: number;
    elevation: number;
}) => {
    center?: LngLat;
    zoom?: number;
    roll?: number;
    pitch?: number;
    bearing?: number;
    elevation?: number;
};

export type CameraInitOptions = {
    minZoom: number;
    maxZoom: number;
    minPitch: number;
    maxPitch: number;
    bearingSnap: number;
    zoomSnap: number;
    renderWorldCopies: boolean;
    centerClampedToGround: boolean;
    terrain: Terrain;
    transformConstrain: TransformConstrainFunction;
    requestRenderFrame: (a: () => void) => TaskID;
    cancelRenderFrame: (_: TaskID) => void;
    transformCameraUpdate: CameraUpdateTransformFunction | null;
    /**
     * @internal
     * Callback invoked by {@link Camera.stop} to halt any in-progress user gestures.
     * The `Camera` does not own the gesture handlers (the `Map` does), so it is injected
     * with a way to stop them rather than holding a reference to the `HandlerManager`.
     */
    stopHandlers?: () => void;
};

export class Camera extends Evented<MapEventType> {
    transform: ITransform;
    /**
     * @internal
     * Copy of the map's `terrain` (which the `Map` owns).
     * The camera reads terrain for elevation handling but does not own it.
     */
    terrain: Terrain;
    cameraHelper: ICameraHelper;
    /**
     * @internal
     * Stops any in-progress user gestures. Injected by the owner so the camera does not need
     * a reference to the `HandlerManager`. See {@link CameraInitOptions.stopHandlers}.
     */
    _stopHandlers: () => void;

    _moving: boolean;
    _zooming: boolean;
    _rotating: boolean;
    _pitching: boolean;
    _rolling: boolean;
    _padding: boolean;

    _bearingSnap: number;
    _zoomSnap: number;
    _easeStart: number;
    _easeOptions: {
        duration?: number;
        easing?: (_: number) => number;
    };
    _easeId: string | void;

    _onEaseFrame: (_: number) => void;
    _onEaseEnd: (easeId?: string) => void;
    _easeFrameId: TaskID;

    /**
     * @internal
     * The map center when the animation ends; the animation eases the center elevation to the terrain there.
     */
    _elevationCenter: LngLat;
    /**
     * @internal
     * holds the targ altitude value, = center elevation of the target.
     * This value may changes during flight, because new terrain-tiles loads during flight.
     */
    _elevationTarget: number;
    /**
     * @internal
     * holds the start altitude value, = center elevation before animation begins
     * this value will recalculated during flight in respect of changing _elevationTarget values,
     * so the linear interpolation between start and target keeps smooth and without jumps.
     */
    _elevationStart: number;
    /**
     * @internal
     * Saves the current state of the elevation freeze - this is used during map movement to prevent "rocky" camera movement.
     */
    elevationFreeze: boolean;
    /**
     * @internal
     * The hold a gesture or an animation with `freezeElevation` keeps on the center elevation, or null while nothing
     * holds it, see {@link Camera.holdElevation}. An animation that eases the center elevation sets `elevationFreeze`
     * without one.
     */
    _elevationHold: ElevationHold | null = null;
    /**
     * @internal
     * Used to track accumulated changes during continuous interaction
     */
    _requestedCameraState?: ITransform;
    /**
     * A callback used to defer camera updates or apply arbitrary constraints.
     * If specified, this Camera instance can be used as a stateless component in React etc.
     */
    transformCameraUpdate: CameraUpdateTransformFunction | null;

    /**
     * @internal
     * If true, the elevation of the center point will automatically be set to the terrain elevation
     * (or zero if terrain is not enabled). If false, the elevation of the center point will default
     * to sea level and will not automatically update. Defaults to true. Needs to be set to false to
     * keep the camera above ground when pitch \> 90 degrees.
     */
    _centerClampedToGround: boolean;

    _requestRenderFrame: (a: () => void) => TaskID;
    _cancelRenderFrame: (_: TaskID) => void;

    constructor(options: CameraInitOptions) {
        super();
        // For now we will use a temporary MercatorTransform instance.
        // Transform specialization will later be set by style when it creates its projection instance.
        // When this happens, the new transform will inherit all properties of this temporary transform.
        this.transform = createMercatorTransform();
        this.cameraHelper = new MercatorCameraHelper();
        if (options.minZoom !== undefined) {
            this.transform.setMinZoom(options.minZoom);
        }
        if (options.maxZoom !== undefined) {
            this.transform.setMaxZoom(options.maxZoom);
        }
        if (options.minPitch !== undefined) {
            this.transform.setMinPitch(options.minPitch);
        }
        if (options.maxPitch !== undefined) {
            this.transform.setMaxPitch(options.maxPitch);
        }
        if (options.renderWorldCopies !== undefined) {
            this.transform.setRenderWorldCopies(options.renderWorldCopies);
        }
        if (options.transformConstrain !== null) {
            this.transform.setConstrainOverride(options.transformConstrain);
        }
        this._moving = false;
        this._zooming = false;
        this._bearingSnap = options.bearingSnap;
        this._zoomSnap = options.zoomSnap;
        this._requestRenderFrame = options.requestRenderFrame;
        this._cancelRenderFrame = options.cancelRenderFrame;
        this.terrain = options.terrain;
        this._centerClampedToGround = options.centerClampedToGround ?? true;
        this.transformCameraUpdate = options.transformCameraUpdate ?? null;
        this._stopHandlers = options.stopHandlers ?? (() => {});

        this.on('moveend', () => {
            delete this._requestedCameraState;
        });
    }

    /**
     * @internal
     * Hands the camera the map's terrain, or null when the map has none, and brings the center elevation up to date
     * with it, see {@link Camera.applyTerrainChange}. A hold waits again when the terrain changes to one without DEM
     * data under the center, see {@link ElevationHold.take}.
     */
    setTerrain(terrain: Terrain): void {
        this.terrain = terrain;
        if (terrain) this._elevationHold?.noteTerrainChange();
        this.applyTerrainChange();
    }

    migrateProjection(newTransform: ITransform, newCameraHelper: ICameraHelper): void {
        newTransform.apply(this.transform, true);
        this.transform = newTransform;
        this.cameraHelper = newCameraHelper;
        if (this._requestedCameraState) {
            // The requested camera state is a transform of the old projection, so it has to be
            // moved onto the new one as well, otherwise the camera keeps reading a transform
            // that the new camera helper cannot use.
            const requestedCameraState = newTransform.clone();
            requestedCameraState.apply(this._requestedCameraState, true);
            this._requestedCameraState = requestedCameraState;
        }
    }

    getCenter(): LngLat { return new LngLat(this.transform.center.lng, this.transform.center.lat); }

    setCenter(center: LngLatLike, eventData?: Record<string, unknown>): this {
        return this.jumpTo({center}, eventData);
    }

    getCenterElevation(): number { return this.transform.elevation; }

    setCenterElevation(elevation: number, eventData?: any): this {
        this.jumpTo({elevation}, eventData);
        return this;
    }

    getCenterClampedToGround(): boolean { return this._centerClampedToGround; }

    setCenterClampedToGround(centerClampedToGround: boolean): void {
        this._centerClampedToGround = centerClampedToGround;
    }

    panBy(offset: PointLike, options?: EaseToOptions, eventData?: any): this {
        offset = Point.convert(offset).mult(-1);
        return this.panTo(this.transform.center, extend({offset}, options), eventData);
    }

    panTo(lnglat: LngLatLike, options?: EaseToOptions, eventData?: any): this {
        return this.easeTo(extend({
            center: lnglat
        }, options), eventData);
    }

    getZoom(): number { return this.transform.zoom; }

    setZoom(zoom: number, eventData?: any): this {
        this.jumpTo({zoom}, eventData);
        return this;
    }

    zoomTo(zoom: number, options?: EaseToOptions | null, eventData?: any): this {
        return this.easeTo(extend({
            zoom
        }, options), eventData);
    }

    zoomIn(options?: AnimationOptions, eventData?: any): this {
        this.zoomTo(evaluateZoomSnap(this.getZoom() + 1, this._zoomSnap), options, eventData);
        return this;
    }

    zoomOut(options?: AnimationOptions, eventData?: any): this {
        this.zoomTo(evaluateZoomSnap(this.getZoom() - 1, this._zoomSnap), options, eventData);
        return this;
    }

    getVerticalFieldOfView(): number { return this.transform.fov; }

    setVerticalFieldOfView(fov: number, eventData?: any): this {
        if (fov != this.transform.fov) {
            this.applyTransformChange(tr => tr.setFov(fov));
            this.fire(new MapMovementEvent('movestart', eventData))
                .fire(new MapMovementEvent('move', eventData))
                .fire(new MapMovementEvent('moveend', eventData));
        }
        return this;
    }

    getBearing(): number { return this.transform.bearing; }

    setZoomSnap(snap: number): this {
        this._zoomSnap = snap;
        return this;
    }

    getZoomSnap(): number {
        return this._zoomSnap;
    }

    setBearing(bearing: number, eventData?: any): this {
        this.jumpTo({bearing}, eventData);
        return this;
    }

    getPadding(): PaddingOptions { return this.transform.padding; }

    setPadding(padding: PaddingOptions, eventData?: any): this {
        this.jumpTo({padding}, eventData);
        return this;
    }

    rotateTo(bearing: number, options?: EaseToOptions, eventData?: any): this {
        return this.easeTo(extend({
            bearing
        }, options), eventData);
    }

    resetNorth(options?: AnimationOptions, eventData?: any): this {
        this.rotateTo(0, extend({duration: 1000}, options), eventData);
        return this;
    }

    resetNorthPitch(options?: AnimationOptions, eventData?: any): this {
        this.easeTo(extend({
            bearing: 0,
            pitch: 0,
            roll: 0,
            duration: 1000
        }, options), eventData);
        return this;
    }

    snapToNorth(options?: AnimationOptions, eventData?: any): this {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    }

    getPitch(): number { return this.transform.pitch; }

    setPitch(pitch: number, eventData?: any): this {
        this.jumpTo({pitch}, eventData);
        return this;
    }

    getRoll(): number { return this.transform.roll; }

    setRoll(roll: number, eventData?: any): this {
        this.jumpTo({roll}, eventData);
        return this;
    }

    /**
     * Returns {@link JumpToOptions} so the result can carry `padding` when `absolutePadding` is set.
     * Once that is the default, `padding` can move onto {@link CameraOptions} and this can return it.
     */
    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraForBoundsOptions): JumpToOptions | undefined {
        bounds = LngLatBounds.convert(bounds).adjustAntiMeridian();
        const bearing = options?.bearing || 0;

        return this._cameraForBoxAndBearing(bounds.getNorthWest(), bounds.getSouthEast(), bearing, options);
    }

    /**
     * @internal
     * Calculate the center of these two points in the viewport and use
     * the highest zoom level up to and including {@link Map.getMaxZoom} that fits
     * the AABB defined by these points in the viewport at the specified bearing.
     * @param p0 - First point
     * @param p1 - Second point
     * @param bearing - Desired map bearing at end of animation, in degrees
     * @param options - the camera options
     * @returns If map is able to fit to provided bounds, returns `center`, `zoom`, and `bearing`,
     *      plus `padding` when `absolutePadding` is set.
     *      If map is unable to fit, method will warn and return undefined.
     * @example
     * ```ts
     * let p0 = [-79, 43];
     * let p1 = [-73, 45];
     * let bearing = 90;
     * let newCameraTransform = map._cameraForBoxAndBearing(p0, p1, bearing, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * ```
     */
    _cameraForBoxAndBearing(p0: LngLatLike, p1: LngLatLike, bearing: number, options?: CameraForBoundsOptions): JumpToOptions | undefined {
        const defaultPadding = {
            top: 0,
            bottom: 0,
            right: 0,
            left: 0
        };
        options = extend({
            padding: defaultPadding,
            offset: [0, 0],
            maxZoom: this.transform.maxZoom
        }, options);

        if (typeof options.padding === 'number') {
            const p = options.padding;
            options.padding = {
                top: p,
                bottom: p,
                right: p,
                left: p
            };
        }

        const padding = extend(defaultPadding, options.padding) as PaddingOptions;
        options.padding = padding;
        const tr = this.transform;
        const bounds = new LngLatBounds(p0, p1);

        const noPadding = {top: 0, bottom: 0, right: 0, left: 0};
        const fitPadding = options.absolutePadding ? noPadding : padding;
        const mapPadding = options.absolutePadding ? padding : extend(noPadding, tr.padding) as PaddingOptions;

        const result = this.cameraHelper.cameraForBoxAndBearing(options, fitPadding, mapPadding, bounds, bearing, tr);
        if (!result) return undefined;
        if (this._zoomSnap) {
            result.zoom = evaluateZoomSnap(result.zoom, this._zoomSnap, -1);
        }
        return options.absolutePadding ? {...result, padding} : result;
    }

    fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions, eventData?: any): this {
        return this._fitInternal(
            this.cameraForBounds(bounds, options),
            options,
            eventData);
    }

    fitScreenCoordinates(p0: PointLike, p1: PointLike, bearing: number, options?: FitBoundsOptions, eventData?: any): this {
        return this._fitInternal(
            this._cameraForBoxAndBearing(
                this.transform.screenPointToLocation(Point.convert(p0)),
                this.transform.screenPointToLocation(Point.convert(p1)),
                bearing,
                options),
            options,
            eventData);
    }

    _fitInternal(calculatedOptions?: JumpToOptions, options?: FitBoundsOptions, eventData?: any): this {
        // cameraForBounds warns + returns undefined if unable to fit:
        if (!calculatedOptions) return this;

        options = extend(calculatedOptions, options);
        if (options.absolutePadding) {
            options.padding = calculatedOptions.padding;
            delete options.absolutePadding;
        } else {
            // Explicitly remove the padding field because, calculatedOptions already accounts for padding by setting zoom and center accordingly.
            delete options.padding;
        }

        return options.linear ?
            this.easeTo(options, eventData) :
            this.flyTo(options, eventData);
    }

    jumpTo(options: JumpToOptions, eventData?: any): this {
        this.stop();

        if (options.zoom !== undefined && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        const tr = this.getTransformForUpdate();
        let bearingChanged = false,
            pitchChanged = false;
        let rollChanged = false;

        const oldZoom = tr.zoom;
        if (this.terrain && this.getCenterClampedToGround()) {
            tr.setElevation(this.terrain.getElevationForLngLat(options.center ? LngLat.convert(options.center) : tr.center, tr));
        }
        this.cameraHelper.handleJumpToCenterZoom(tr, options);

        const zoomChanged = tr.zoom !== oldZoom;

        if (options.elevation !== undefined && tr.elevation !== +options.elevation) {
            tr.setElevation(+options.elevation);
        }

        if (options.bearing !== undefined && tr.bearing !== +options.bearing) {
            bearingChanged = true;
            tr.setBearing(+options.bearing);
        }

        if (options.pitch !== undefined && tr.pitch !== +options.pitch) {
            pitchChanged = true;
            tr.setPitch(+options.pitch);
        }

        if (options.roll !== undefined && tr.roll !== +options.roll) {
            rollChanged = true;
            tr.setRoll(+options.roll);
        }

        if (options.padding != null && !tr.isPaddingEqual(options.padding)) {
            tr.setPadding(options.padding);
        }
        this.applyUpdatedTransform(tr);

        this.fire(new MapMovementEvent('movestart', eventData))
            .fire(new MapMovementEvent('move', eventData));

        if (zoomChanged) {
            this.fire(new MapMovementEvent('zoomstart', eventData))
                .fire(new MapMovementEvent('zoom', eventData))
                .fire(new MapMovementEvent('zoomend', eventData));
        }

        if (bearingChanged) {
            this.fire(new MapMovementEvent('rotatestart', eventData))
                .fire(new MapMovementEvent('rotate', eventData))
                .fire(new MapMovementEvent('rotateend', eventData));
        }

        if (pitchChanged) {
            this.fire(new MapMovementEvent('pitchstart', eventData))
                .fire(new MapMovementEvent('pitch', eventData))
                .fire(new MapMovementEvent('pitchend', eventData));
        }

        if (rollChanged) {
            this.fire(new MapMovementEvent('rollstart', eventData))
                .fire(new MapMovementEvent('roll', eventData))
                .fire(new MapMovementEvent('rollend', eventData));
        }

        return this.fire(new MapMovementEvent('moveend', eventData));
    }

    /**
     * Calculates camera options for moving a geographic anchor to a screen point without
     * changing this camera.
     */
    calculateAnchoredCameraOptions(options: AnchoredCameraOptions): CameraOptions {
        const tr = this.transform.clone();
        const anchor = LngLat.convert(options.anchorLocation);
        const target = Point.convert(options.anchorScreenPoint);
        const deltas: MapControlsDeltas = {
            panDelta: target.sub(this.transform.locationToScreenPoint(anchor, this.terrain)),
            zoomDelta: options.zoom === undefined ? 0 : options.zoom - tr.zoom,
            bearingDelta: 0,
            pitchDelta: 0,
            rollDelta: 0,
            around: target,
            aroundElevation: this.terrain?.getElevationForLngLat(anchor, tr)
        };
        this.cameraHelper.handleMapControlsRollPitchBearingZoom(deltas, tr);
        this.cameraHelper.handleMapControlsPan(deltas, tr, anchor);

        return {
            center: tr.center,
            zoom: tr.zoom
        };
    }

    calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat: LngLatLike, cameraAlt: number, bearing: number, pitch: number, roll?: number): CameraOptions {
        const centerInfo = this.transform.calculateCenterFromCameraLngLatAlt(cameraLngLat, cameraAlt, bearing, pitch);
        return {
            center: centerInfo.center,
            elevation: centerInfo.elevation,
            zoom: centerInfo.zoom,
            bearing,
            pitch,
            roll
        };
    }

    easeTo(options: EaseToOptions, eventData?: any): this {
        this._stop(false, options.easeId);

        options = extend({
            offset: [0, 0],
            duration: 500,
            easing: defaultEasing
        }, options);

        if (options.zoom !== undefined && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        if (options.animate === false || (!options.essential && browser.prefersReducedMotion)) {
            options.duration = 0;
        }

        const tr = this.getTransformForUpdate();
        const startZoom = tr.zoom;
        const startBearing = this.getBearing(),
            startPitch = tr.pitch,
            startRoll = tr.roll,
            bearing = options.bearing !== undefined ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = options.pitch !== undefined ? +options.pitch : startPitch,
            roll = options.roll !== undefined ? this._normalizeBearing(options.roll, startRoll) : startRoll,
            padding = (options.padding !== undefined ? options.padding : tr.padding) as PaddingOptions;
        const offsetAsPoint = Point.convert(options.offset);

        let around, aroundPoint;

        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = tr.locationToScreenPoint(around);
        }

        const currently = {
            moving: this._moving,
            zooming: this._zooming,
            rotating: this._rotating,
            pitching: this._pitching,
            rolling: this._rolling
        };

        const easeHandler = this.cameraHelper.handleEaseTo(tr, {
            bearing,
            pitch,
            roll,
            padding,
            around,
            aroundPoint,
            offsetAsPoint,
            offset: options.offset,
            zoom: options.zoom,
            center: options.center,
        });

        this._rotating ||= (startBearing !== bearing);
        this._pitching ||= (pitch !== startPitch);
        this._rolling ||= (roll !== startRoll);
        this._padding = !tr.isPaddingEqual(padding);
        this._zooming ||= easeHandler.isZooming;
        this._easeId = options.easeId;
        const endZoom = options.zoom !== undefined ? +options.zoom : startZoom;
        this._prepareEase(eventData, options.noMoveStart, currently, {tr, center: easeHandler.elevationCenter, freeze: options.freezeElevation, lowestZoom: Math.min(startZoom, endZoom), endZoom});

        this._ease((k) => {
            easeHandler.easeFunc(k);

            if (this.terrain && !options.freezeElevation) this._updateElevation(k, tr);
            this.applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);

        }, (interruptingEaseId?: string) => {
            this._afterEase(eventData, interruptingEaseId, options.freezeElevation);
        }, options);

        return this;
    }

    /**
     * @param elevation - over terrain, the transform the animation edits, the map center it ends on, whether it holds
     * the center elevation (`freezeElevation`) instead of easing it, and the lowest and the end zoom the animation
     * passes through
     */
    _prepareEase(eventData: any, noMoveStart: boolean,
        currently: { moving?: boolean; zooming?: boolean; rotating?: boolean; pitching?: boolean; rolling?: boolean} = {},
        elevation?: {tr: ITransform; center: LngLat; freeze: boolean; lowestZoom: number; endZoom: number}): void {
        this._moving = true;
        if (this.terrain && elevation) {
            this._prepareElevation(elevation.center, elevation.tr, elevation.lowestZoom, elevation.endZoom);
            if (elevation.freeze) this.holdElevation(elevation.tr, 'animation');
        }
        if (!noMoveStart && !currently.moving) {
            this.fire(new MapMovementEvent('movestart', eventData));
        }
        if (this._zooming && !currently.zooming) {
            this.fire(new MapMovementEvent('zoomstart', eventData));
        }
        if (this._rotating && !currently.rotating) {
            this.fire(new MapMovementEvent('rotatestart', eventData));
        }
        if (this._pitching && !currently.pitching) {
            this.fire(new MapMovementEvent('pitchstart', eventData));
        }
        if (this._rolling && !currently.rolling) {
            this.fire(new MapMovementEvent('rollstart', eventData));
        }
    }

    /**
     * @internal
     * Starts easing the center elevation: records where it stands on the transform the animation edits and
     * samples the terrain under the map center the animation ends on. Where no DEM data covers that center yet, it
     * starts loading it for the lowest and the end zoom of the animation, so the elevation the animation heads for
     * arrives on the way rather than when the view reaches it, see {@link Terrain.loadDemAhead}.
     * @param center - the map center when the animation ends
     * @param tr - the transform the animation edits
     * @param lowestZoom - the lowest zoom the animation passes through
     * @param endZoom - the zoom the animation ends at
     */
    _prepareElevation(center: LngLat, tr: ITransform, lowestZoom: number, endZoom: number): void {
        this._elevationCenter = center;
        this._elevationStart = tr.elevation;
        this._elevationTarget = this.terrain.getElevationForLngLat(center, tr);
        this.elevationFreeze = true;
        if (!this.terrain.hasElevationForLngLat(center, tr)) {
            this.terrain.loadDemAhead(center, lowestZoom);
            this.terrain.loadDemAhead(center, endZoom);
        }
    }

    /**
     * @internal
     * Eases the center elevation towards the terrain under `_elevationCenter`, on the transform the
     * animation edits, so that `applyUpdatedTransform` carries it to the rendered transform. A center
     * that is not clamped to the ground keeps its elevation.
     * @param k - how far the center elevation has come from its start to the target, 0 to 1
     * @param tr - the transform the animation edits
     */
    _updateElevation(k: number, tr: ITransform): void {
        if (this._elevationStart === undefined || this._elevationCenter === undefined) {
            this._prepareElevation(tr.center, tr, tr.zoom, tr.zoom);
        }

        tr.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this._elevationCenter, tr.tileZoom));
        const elevation = this.terrain.getElevationForLngLat(this._elevationCenter, tr);
        // target terrain updated during flight, slowly move camera to new height
        if (k < 1 && elevation !== this._elevationTarget) {
            const pitch1 = this._elevationTarget - this._elevationStart;
            const pitch2 = (elevation - (pitch1 * k + this._elevationStart)) / (1 - k);
            this._elevationStart += k * (pitch1 - pitch2);
            this._elevationTarget = elevation;
        }
        if (this.getCenterClampedToGround()) {
            tr.setElevation(interpolates.number(this._elevationStart, this._elevationTarget, k));
        }
    }

    /**
     * @internal
     * Holds the center elevation for a gesture or an animation with `freezeElevation`: the frames leave it alone and
     * the end puts the center back onto the terrain. A hold that starts without DEM data under a center clamped to
     * the ground waits for it, see {@link ElevationHold.take}.
     * @param tr - the transform the gesture or animation edits, read for the center the hold starts at
     * @param holder - who holds it
     */
    holdElevation(tr: ITransform, holder: ElevationHolder): void {
        this.elevationFreeze = true;
        const startedWithoutDem = !!this.terrain && this.getCenterClampedToGround() && !this.terrain.hasElevationForLngLat(tr.center, tr);
        const terrainAboveMaxZoomForCenter = this.terrain ? this._terrainHeightAboveMaxZoomForCenter(tr) : undefined;
        this._elevationHold = new ElevationHold(holder, startedWithoutDem, terrainAboveMaxZoomForCenter !== undefined && terrainAboveMaxZoomForCenter <= MAX_ZOOM_FOR_CENTER_TOLERANCE_M);
    }

    /**
     * @internal
     * Ends a hold on the center elevation, and any wait for DEM data with it, see {@link Camera.holdElevation}.
     */
    releaseElevation(): boolean {
        const tookDem = this._elevationHold?.tookDem ?? false;
        this.elevationFreeze = false;
        this._elevationHold = null;
        return tookDem;
    }

    /**
     * @internal
     * Puts the center back onto the terrain at the end of a hold, re-solving zoom and center with the camera in place.
     * After a hold that took DEM data, a center over a tile without its own DEM data yet keeps the zoom and takes the
     * drawn elevation instead, with the camera check keeping the camera out of the terrain.
     * @param tr - the transform the end writes
     * @param terrain - the terrain the gesture or animation ends over
     * @param tookDem - whether the hold carried an elevation it took from DEM data, see {@link Camera.releaseElevation}
     */
    putCenterBackOnTerrain(tr: ITransform, terrain: Terrain, tookDem: boolean): void {
        if (tookDem && terrain.getDrawnElevationForLngLat(tr.center, true) === undefined) {
            tr.setElevation(terrain.getElevationForLngLat(tr.center, tr));
            const corrected = this._raiseCameraByPitchAndZoom(tr);
            if (corrected !== tr) tr.apply(corrected, false);
        } else {
            tr.recalculateZoomAndCenter(terrain);
        }
    }

    /**
     * @internal
     * Lets a hold on the center elevation take DEM data that landed, see {@link ElevationHold.take}.
     * @param tr - the transform the hold's gesture or animation edits
     * @returns whether it changed the elevation
     */
    _takeLandedElevation(tr: ITransform): boolean {
        if (!this._elevationHold || !this.terrain || !this.getCenterClampedToGround()) return false;
        return this._elevationHold.take(tr, this.terrain);
    }

    /**
     * @internal
     * Applies a change of the terrain under the center (terrain set or removed, a DEM tile landed): at rest the
     * camera moves with the center's elevation, as on every rendered frame; a hold keeps the camera where the user
     * put it unless it waits for DEM data. A gesture's hold takes here, on the requested camera state its frames
     * read; an animation's takes on its next frame, on the transform it edits, see {@link ElevationHold.take}.
     */
    applyTerrainChange(): void {
        if (this.elevationFreeze) {
            const tr = this._requestedCameraState;
            if (this._elevationHold?.holder === 'gesture' && tr && this._takeLandedElevation(tr)) this.applyUpdatedTransform(tr);
            return;
        }
        const tr = this.transform;
        tr.setMinElevationForCurrentTile(this.terrain ? this.terrain.getMinTileElevationForLngLatZoom(tr.center, tr.tileZoom) : 0);
        if (this.getCenterClampedToGround()) {
            tr.setElevation(this.terrain ? this.terrain.getElevationForLngLat(tr.center, tr) : 0);
        }
    }

    /**
     * @internal
     * Called when the camera is about to be manipulated.
     * If `transformCameraUpdate` is specified or terrain is enabled, a copy of
     * the current transform is created to track the accumulated changes.
     * This underlying transform represents the "desired state" proposed by input handlers / animations / UI controls.
     * It may differ from the state used for rendering (`this.transform`).
     * @returns Transform to apply changes to
     */
    getTransformForUpdate(): ITransform {
        if (!this.transformCameraUpdate && !this.terrain) return this.transform;

        this._requestedCameraState ||= this.transform.clone();
        return this._requestedCameraState;
    }

    /**
     * @internal
     * Keeps the camera above the terrain for a camera update. While a gesture or an animation holds the center elevation
     * over mercator terrain, below a pitch of 90 degrees with the center clamped to the ground, the held elevation is
     * lifted on the given transform just far enough that the drawn terrain stays below where the center would sit at
     * maxZoom once the hold keeps it there, see {@link ElevationHold.keepsTerrainBelowMaxZoomForCenter}, so the end does
     * not move the camera back. A gesture's lift also keeps the camera and its near clipping plane above the terrain,
     * so its pitch and zoom stay where the user puts them; the camera of an animation, and of any camera update without
     * a hold, is kept above the terrain by {@link Camera._raiseCameraByPitchAndZoom} instead. The lift is lowered again
     * as the terrain allows.
     * @param tr - the transform the camera update edits
     * @returns the transform to render: `tr`, or its corrected copy
     */
    _keepCameraAboveTerrain(tr: ITransform): ITransform {
        const hold = this._elevationHold;
        if (!this.terrain || !hold || tr.pitch >= 90 || !this.getCenterClampedToGround() || tr.getClippingPlane()) {
            return this._raiseCameraByPitchAndZoom(tr);
        }
        const isGesture = hold.holder === 'gesture';
        const lift = hold.lift && hold.lift.heldElevation + hold.lift.height === tr.elevation ? hold.lift : {heldElevation: tr.elevation, height: 0};
        const terrainAboveMaxZoomForCenter = this._terrainHeightAboveMaxZoomForCenter(tr);
        if (terrainAboveMaxZoomForCenter !== undefined && terrainAboveMaxZoomForCenter <= MAX_ZOOM_FOR_CENTER_TOLERANCE_M) {
            hold.keepsTerrainBelowMaxZoomForCenter = true;
        }
        const heightForMaxZoom = hold.keepsTerrainBelowMaxZoomForCenter && terrainAboveMaxZoomForCenter !== undefined ? terrainAboveMaxZoomForCenter : -Infinity;
        const heightForCamera = isGesture ? this._terrainHeightAboveCamera(tr) : -Infinity;
        const height = Math.max(0, Math.max(heightForCamera, heightForMaxZoom) + lift.height);
        if (height !== lift.height) {
            tr.setElevation(lift.heldElevation + height);
        }
        hold.lift = height > 0 ? {heldElevation: lift.heldElevation, height} : null;
        return isGesture ? tr : this._raiseCameraByPitchAndZoom(tr);
    }

    /**
     * @internal
     * Where the camera is inside the terrain, re-solves pitch and zoom on a copy of the transform so the camera sits
     * above it at the same ground position, still looking at the same center at the same elevation, and the transform
     * the update edits keeps what it asked for; over mercator terrain high enough that its near clipping plane clears the terrain too. Without
     * terrain the camera is kept above sea level, which only needs checking where the center elevation is negative or
     * the pitch passes 90 degrees. On a globe the camera is left where it is.
     * @param tr - the transform the camera update edits
     * @returns `tr` while the camera is clear, else the corrected copy
     */
    _raiseCameraByPitchAndZoom(tr: ITransform): ITransform {
        if ((!this.terrain && tr.elevation >= 0 && tr.pitch <= 90) || tr.getClippingPlane()) {
            return tr;
        }
        const cameraLngLat = tr.getCameraLngLat();
        let height = this.terrain ? this._terrainHeightAboveCamera(tr) : -tr.getCameraAltitude();
        if (height <= 0) {
            return tr;
        }
        const corrected = tr.clone();
        for (let pass = 0; pass < MAX_CAMERA_RAISES && height > 0; pass++) {
            const {zoom, pitch} = corrected.calculateCameraOptionsFromTo(cameraLngLat, corrected.getCameraAltitude() + height, corrected.center, corrected.elevation);
            corrected.setZoom(zoom);
            corrected.setPitch(pitch);
            height = this.terrain ? this._terrainHeightAboveCamera(corrected) : -corrected.getCameraAltitude();
        }
        return corrected;
    }

    /**
     * @internal
     * How far the terrain reaches above the camera, or the drawn terrain above one of nine points spread over its
     * near clipping plane, in meters, whichever is more; zero or less while all are clear. The renderer drops whatever
     * is nearer than that plane, so terrain reaching above it would show as a hole into the ground. The points are a
     * 3 by 3 grid weighted bilinearly over the plane's four corners, the frustum's first four points in order around
     * the plane. The plane is checked on mercator only, where the frustum is in mercator coordinates.
     * @param tr - the transform whose camera is checked
     */
    _terrainHeightAboveCamera(tr: ITransform): number {
        let height = this.terrain.getElevationForLngLat(tr.getCameraLngLat(), tr) - tr.getCameraAltitude();
        const index = tr.getClippingPlane() ? null : this.terrain.getCoverageIndex();
        if (!index) {
            return height;
        }
        const [p0, p1, p2, p3] = tr.getCameraFrustum().points;
        for (let row = 0; row <= 2; row++) {
            const v = row / 2;
            for (let column = 0; column <= 2; column++) {
                const u = column / 2;
                const w0 = (1 - u) * (1 - v), w1 = u * (1 - v), w2 = u * v, w3 = (1 - u) * v;
                const x = w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0];
                const y = w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1];
                const altitude = w0 * p0[2] + w1 * p1[2] + w2 * p2[2] + w3 * p3[2];
                const sample = sampleAt(index, this.terrain.exaggeration, x, y);
                if (sample.covered) {
                    height = Math.max(height, sample.elevation - altitude);
                }
            }
        }
        return height;
    }

    /**
     * @internal
     * How far the drawn terrain rises above the point on the center ray where the center would sit at maxZoom, with the
     * camera where it is, in meters; zero or less while the terrain is below that point, undefined where no terrain is
     * drawn under it. A hold's end puts the center onto the drawn terrain the center ray meets, with the camera where it
     * is, see {@link Camera.putCenterBackOnTerrain}; terrain above that point puts it nearer than maxZoom allows, and
     * `setZoom` clamps the zoom it needs by moving the camera back.
     * @param tr - the transform whose center ray is checked
     */
    _terrainHeightAboveMaxZoomForCenter(tr: ITransform): number | undefined {
        const index = this.terrain.getCoverageIndex();
        if (!index) {
            return undefined;
        }
        const camera = MercatorCoordinate.fromLngLat(tr.getCameraLngLat());
        const center = MercatorCoordinate.fromLngLat(tr.center);
        const distanceFractionAtMaxZoom = zoomScale(tr.zoom - tr.maxZoom);
        const sample = sampleAt(index, this.terrain.exaggeration, lerp(camera.x, center.x, distanceFractionAtMaxZoom), lerp(camera.y, center.y, distanceFractionAtMaxZoom));
        return sample.covered ? sample.elevation - lerp(tr.getCameraAltitude(), tr.elevation, distanceFractionAtMaxZoom) : undefined;
    }

    /**
     * @internal
     * Moves the center a zoom gesture holds onto the terrain the camera looks at and draws, with the camera where it
     * is, so a zoom toward rising terrain slows down before it instead of running into it. Farther terrain is followed
     * only by less than the frame zooms in, so the zoom keeps going in and speeds up gradually; a center ray that slips
     * over a crest onto terrain far behind it, and terrain so near that the zoom passes maxZoom, which would move the
     * camera back, are left to the gesture's end, as is everything with the center not clamped to the ground, and a
     * globe.
     * @param tr - the requested camera state
     * @param zoomDelta - how far the frame zooms in
     */
    moveCenterOntoTerrain(tr: ITransform, zoomDelta: number): void {
        if (!this.terrain || !this.getCenterClampedToGround() || tr.getClippingPlane()) {
            return;
        }
        const {center, elevation, zoom} = tr;
        tr.recalculateZoomAndCenter(this.terrain);
        const keepsZoomingIn = tr.zoom > zoom - zoomDelta && tr.zoom < tr.maxZoom;
        if (!keepsZoomingIn || Math.abs(this.terrain.getElevationForLngLat(tr.center, tr) - tr.elevation) >= MAX_CENTER_OFF_TERRAIN_M) {
            tr.setZoom(zoom);
            tr.setCenter(center);
            tr.setElevation(elevation);
        }
    }

    /**
     * @internal
     * Called after the camera is done being manipulated. A hold on the center elevation takes DEM data that landed, see
     * {@link ElevationHold.take}; then the camera is kept above the terrain, see {@link Camera._keepCameraAboveTerrain};
     * `transformCameraUpdate`, if present, proposes its changes on a copy, and the "approved" result is applied to the
     * rendered transform.
     * @param tr - the requested camera end state
     */
    applyUpdatedTransform(tr: ITransform): void {
        this._takeLandedElevation(tr);
        const corrected = this._keepCameraAboveTerrain(tr);
        if (!this.transformCameraUpdate) {
            if (corrected !== this.transform) this.transform.apply(corrected, false);
            return;
        }
        const nextTransform = corrected.clone();
        const {
            center,
            zoom,
            roll,
            pitch,
            bearing,
            elevation
        } = this.transformCameraUpdate(nextTransform);
        if (center) nextTransform.setCenter(center);
        if (elevation !== undefined) nextTransform.setElevation(elevation);
        if (zoom !== undefined) nextTransform.setZoom(zoom);
        if (roll !== undefined) nextTransform.setRoll(roll);
        if (pitch !== undefined) nextTransform.setPitch(pitch);
        if (bearing !== undefined) nextTransform.setBearing(bearing);
        this.transform.apply(elevation === undefined ? nextTransform : this._raiseCameraByPitchAndZoom(nextTransform), false);
    }

    /**
     * @internal
     * Applies a change that is not itself a movement, such as new bounds, limits or field of view, the way
     * any camera update is applied. A requested camera state created only for this change is dropped again,
     * so a later movement cannot restore the old values.
     */
    applyTransformChange(change: (tr: ITransform) => void): void {
        const hadRequestedCameraState = this._requestedCameraState !== undefined;
        const tr = this.getTransformForUpdate();
        change(tr);
        this.applyUpdatedTransform(tr);
        if (!hadRequestedCameraState) {
            delete this._requestedCameraState;
        }
    }

    _fireMoveEvents(eventData?: Record<string, unknown>): void {
        this.fire(new MapMovementEvent('move', eventData));
        if (this._zooming) {
            this.fire(new MapMovementEvent('zoom', eventData));
        }
        if (this._rotating) {
            this.fire(new MapMovementEvent('rotate', eventData));
        }
        if (this._pitching) {
            this.fire(new MapMovementEvent('pitch', eventData));
        }
        if (this._rolling) {
            this.fire(new MapMovementEvent('roll', eventData));
        }
    }

    /**
     * @param freezeElevation - whether the animation held the center elevation; its end then takes DEM data that
     * landed since its last frame and puts the center back onto the terrain, see {@link Camera.putCenterBackOnTerrain}
     */
    _afterEase(eventData?: Record<string, unknown>, easeId?: string, freezeElevation: boolean = false): void {
        this._takeLandedElevation(this.transform);
        const tookDem = this.releaseElevation();
        if (this.terrain && freezeElevation && this.getCenterClampedToGround()) {
            this.putCenterBackOnTerrain(this.transform, this.terrain, tookDem);
        }
        // if this easing is being stopped to start another easing with
        // the same id then don't fire any events to avoid extra start/stop events
        if (this._easeId && easeId && this._easeId === easeId) {
            return;
        }
        delete this._easeId;

        const wasZooming = this._zooming;
        const wasRotating = this._rotating;
        const wasPitching = this._pitching;
        const wasRolling = this._rolling;
        this._moving = false;
        this._zooming = false;
        this._rotating = false;
        this._pitching = false;
        this._rolling = false;
        this._padding = false;

        if (wasZooming) {
            this.fire(new MapMovementEvent('zoomend', eventData));
        }
        if (wasRotating) {
            this.fire(new MapMovementEvent('rotateend', eventData));
        }
        if (wasPitching) {
            this.fire(new MapMovementEvent('pitchend', eventData));
        }
        if (wasRolling) {
            this.fire(new MapMovementEvent('rollend', eventData));
        }
        this.fire(new MapMovementEvent('moveend', eventData));
    }

    flyTo(options: FlyToOptions, eventData?: any): this {
        // Fall through to jumpTo if user has set prefers-reduced-motion
        if (!options.essential && browser.prefersReducedMotion) {
            const coercedOptions = pick(options, ['center', 'zoom', 'bearing', 'pitch', 'roll', 'elevation', 'padding']) as JumpToOptions;
            return this.jumpTo(coercedOptions, eventData);
        }

        // This method implements an “optimal path” animation, as detailed in:
        //
        // Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
        //   ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
        //
        // Where applicable, local variable documentation begins with the associated variable or
        // function in van Wijk (2003).

        this.stop();

        options = extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: defaultEasing
        }, options);

        if (options.zoom !== undefined && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        const tr = this.getTransformForUpdate(),
            startZoom = tr.zoom,
            startBearing = tr.bearing,
            startPitch = tr.pitch,
            startRoll = tr.roll,
            startPadding = tr.padding;

        const bearing = options.bearing !== undefined ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = options.pitch !== undefined ? +options.pitch : startPitch;
        const roll = options.roll !== undefined ? this._normalizeBearing(options.roll, startRoll) : startRoll;
        const padding = (options.padding !== undefined ? options.padding : tr.padding) as PaddingOptions;

        const offsetAsPoint = Point.convert(options.offset);
        let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
        const locationAtOffset = tr.screenPointToLocation(pointAtOffset);

        const flyToHandler = this.cameraHelper.handleFlyTo(tr, {
            bearing,
            pitch,
            roll,
            padding,
            locationAtOffset,
            offsetAsPoint,
            center: options.center,
            minZoom: options.minZoom,
            zoom: options.zoom,
        });

        let rho = options.curve;

        // w₀: Initial visible span, measured in pixels at the initial scale.
        const w0 = Math.max(tr.width, tr.height);
        // w₁: Final visible span, measured in pixels with respect to the initial scale.
        const w1 = w0 / flyToHandler.scaleOfZoom;
        // Length of the flight path as projected onto the ground plane, measured in pixels from
        // the world image origin at the initial scale.
        const u1 = flyToHandler.pixelPathLength;

        // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
        // scale.
        const wMax = w0 / flyToHandler.scaleOfMinZoom;
        // Only reduce rho (limit zoom-out). If the natural arc stays within the minZoom
        // boundary, preserve the default rho rather than forcing the arc deeper.
        rho = Math.min(rho, Math.sqrt(wMax / u1 * 2));

        // ρ²
        const rho2 = rho * rho;

        /**
         * rᵢ: Returns the zoom-out factor at one end of the animation.
         *
         * @param descent - `true` for the descent, `false` for the ascent
         */
        function zoomOutFactor(descent: boolean) {
            const b = (w1 * w1 - w0 * w0 + (descent ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (descent ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }

        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }

        // r₀: Zoom-out factor during ascent.
        const r0 = zoomOutFactor(false);

        // w(s): Returns the visible span on the ground, measured in pixels with respect to the
        // initial scale. Uses the current vertical field of view setting.
        let w: (_: number) => number = function (s) {
            return (cosh(r0) / cosh(r0 + rho * s));
        };

        // u(s): Returns the distance along the flight path as projected onto the ground plane,
        // measured in pixels from the world image origin at the initial scale.
        let u: (_: number) => number = function (s) {
            return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1;
        };

        // S: Total length of the flight path, measured in ρ-screenfulls.
        let S = (zoomOutFactor(true) - r0) / rho;

        // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
        if (Math.abs(u1) < 0.000002 || !isFinite(S)) {
            // Perform a more or less instantaneous transition if the path is too short.
            if (Math.abs(w0 - w1) < 0.000001) return this.easeTo(options, eventData);

            const k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;

            u = () => 0;
            w = (s) => Math.exp(k * rho * s);
        }

        if (options.duration !== undefined) {
            options.duration = +options.duration;
        } else {
            const V = options.screenSpeed !== undefined ? +options.screenSpeed / rho : +options.speed;
            options.duration = 1000 * S / V;
        }

        if (options.maxDuration && options.duration > options.maxDuration) {
            options.duration = 0;
        }

        this._zooming = true;
        this._rotating = (startBearing !== bearing);
        this._pitching = (pitch !== startPitch);
        this._rolling = (roll !== startRoll);
        this._padding = !tr.isPaddingEqual(padding);

        // The lowest zoom of the flight is where the visible span w(s) peaks: at s = -r0 / rho on the arc, else at an end.
        const lowestZoom = startZoom - Math.log2(Math.max(w(0), w(S), w(clamp(-r0 / rho, 0, S))));
        const endZoom = startZoom + Math.log2(flyToHandler.scaleOfZoom);
        this._prepareEase(eventData, false, {}, {tr, center: flyToHandler.targetCenter, freeze: options.freezeElevation, lowestZoom, endZoom});

        this._ease((k) => {
            // s: The distance traveled along the flight path, measured in ρ-screenfulls.
            const s = k * S;
            const scale = 1 / w(s);
            const centerFactor = u(s);
            if (this._rotating) {
                tr.setBearing(interpolates.number(startBearing, bearing, k));
            }
            if (this._pitching) {
                tr.setPitch(interpolates.number(startPitch, pitch, k));
            }
            if (this._rolling) {
                tr.setRoll(interpolates.number(startRoll, roll, k));
            }
            if (this._padding) {
                tr.interpolatePadding(startPadding, padding, k);
                // When padding is being applied, Transform.centerPoint is changing continuously,
                // thus we need to recalculate offsetPoint every frame
                pointAtOffset = tr.centerPoint.add(offsetAsPoint);
            }

            flyToHandler.easeFunc(k, scale, centerFactor, pointAtOffset);

            // The center elevation moves with the center along the path, so it reaches the destination's while the camera
            // is still high instead of as the flight zooms in; a flight that does not move the center moves it with k.
            if (this.terrain && !options.freezeElevation) this._updateElevation(Math.max(k, centerFactor), tr);
            this.applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);
        }, () => {
            this._afterEase(eventData, undefined, options.freezeElevation);
        }, options);

        return this;
    }

    isEasing(): boolean {
        return !!this._easeFrameId;
    }

    stop(allowGestures?: boolean): this {
        return this._stop(allowGestures);
    }

    _stop(allowGestures?: boolean, easeId?: string): this {
        if (this._easeFrameId) {
            this._cancelRenderFrame(this._easeFrameId);
            delete this._easeFrameId;
            delete this._onEaseFrame;
        }

        if (this._onEaseEnd) {
            // The _onEaseEnd function might emit events which trigger new
            // animation, which sets a new _onEaseEnd. Ensure we don't delete
            // it unintentionally.
            const onEaseEnd = this._onEaseEnd;
            delete this._onEaseEnd;
            onEaseEnd.call(this, easeId);
        }
        if (!allowGestures) {
            this._stopHandlers();
        }
        return this;
    }

    _ease(frame: (_: number) => void,
        finish: () => void,
        options: {
            animate?: boolean;
            duration?: number;
            easing?: (_: number) => number;
        }): void {
        if (options.animate === false || options.duration === 0) {
            frame(1);
            finish();
        } else {
            this._easeStart = now();
            this._easeOptions = options;
            this._onEaseFrame = frame;
            this._onEaseEnd = finish;
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        }
    }

    // Callback for map._requestRenderFrame
    _renderFrameCallback = (): void => {
        const t = Math.min((now() - this._easeStart) / this._easeOptions.duration, 1);
        this._onEaseFrame(this._easeOptions.easing(t));

        // if _stop is called during _onEaseFrame from _fireMoveEvents we should avoid a new _requestRenderFrame, checking it by ensuring _easeFrameId was not deleted
        if (t < 1 && this._easeFrameId) {
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        } else {
            this.stop();
        }
    };

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number): number {
        bearing = wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    }

    isMoving(): boolean {
        return this._moving;
    }

    isZooming(): boolean {
        return this._zooming;
    }

    isRotating(): boolean {
        return this._rotating;
    }
}
