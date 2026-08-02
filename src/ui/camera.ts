import Point from '@mapbox/point-geometry';
import {extend, wrap, defaultEasing, pick, scaleZoom, evaluateZoomSnap} from '../util/util.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {browser} from '../util/browser.ts';
import {now} from '../util/time_control.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {Evented} from '../util/evented.ts';
import {MapMovementEvent} from './events.ts';
import {MercatorCoordinate} from '../geo/mercator_coordinate.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {MercatorCameraHelper} from '../geo/projection/mercator_camera_helper.ts';

import type {MapEventType} from './events.ts';
import type {Terrain} from '../render/terrain.ts';
import type {ITransform, TransformConstrainFunction} from '../geo/transform_interface.ts';
import type {LngLatLike} from '../geo/lng_lat.ts';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.ts';
import type {TaskID} from '../util/task_queue.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {ICameraHelper} from '../geo/projection/camera_helper.ts';

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

/**
 * A options object for the {@link Map.cameraForBounds} method
 */
export type CameraForBoundsOptions = CameraOptions & {
    /**
     * The amount of padding in pixels to add to the given bounds.
     */
    padding?: number | PaddingOptions;
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
     * holds the geographical coordinate of the target
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
        this.transform = new MercatorTransform();
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

    migrateProjection(newTransform: ITransform, newCameraHelper: ICameraHelper): void {
        newTransform.apply(this.transform, true);
        this.transform = newTransform;
        this.cameraHelper = newCameraHelper;
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
            this.transform.setFov(fov);
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

    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraForBoundsOptions): CenterZoomBearing | undefined {
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
     * @returns If map is able to fit to provided bounds, returns `center`, `zoom`, and `bearing`.
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
    _cameraForBoxAndBearing(p0: LngLatLike, p1: LngLatLike, bearing: number, options?: CameraForBoundsOptions): CenterZoomBearing | undefined {
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

        const result = this.cameraHelper.cameraForBoxAndBearing(options, padding, bounds, bearing, tr);
        if (result && this._zoomSnap) {
            result.zoom = evaluateZoomSnap(result.zoom, this._zoomSnap, -1);
        }
        return result;
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

    _fitInternal(calculatedOptions?: CenterZoomBearing, options?: FitBoundsOptions, eventData?: any): this {
        // cameraForBounds warns + returns undefined if unable to fit:
        if (!calculatedOptions) return this;

        options = extend(calculatedOptions, options);
        // Explicitly remove the padding field because, calculatedOptions already accounts for padding by setting zoom and center accordingly.
        delete options.padding;

        return options.linear ?
            this.easeTo(options, eventData) :
            this.flyTo(options, eventData);
    }

    jumpTo(options: JumpToOptions, eventData?: any): this {
        this.stop();

        if ('zoom' in options && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        const tr = this.getTransformForUpdate();
        let bearingChanged = false,
            pitchChanged = false;
        let rollChanged = false;

        const oldZoom = tr.zoom;
        if (this.terrain) {
            tr.setElevation(this.terrain.getElevationForLngLatZoom(options.center ? LngLat.convert(options.center) : tr.center, options.zoom || tr.tileZoom));
        }
        this.cameraHelper.handleJumpToCenterZoom(tr, options);

        const zoomChanged = tr.zoom !== oldZoom;

        if ('elevation' in options && tr.elevation !== +options.elevation) {
            tr.setElevation(+options.elevation);
        }

        if ('bearing' in options && tr.bearing !== +options.bearing) {
            bearingChanged = true;
            tr.setBearing(+options.bearing);
        }

        if ('pitch' in options && tr.pitch !== +options.pitch) {
            pitchChanged = true;
            tr.setPitch(+options.pitch);
        }

        if ('roll' in options && tr.roll !== +options.roll) {
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

    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo: number = 0): CameraOptions {
        const fromMercator = MercatorCoordinate.fromLngLat(from, altitudeFrom);
        const toMercator = MercatorCoordinate.fromLngLat(to, altitudeTo);
        const dx = toMercator.x - fromMercator.x;
        const dy = toMercator.y - fromMercator.y;
        const dz = toMercator.z - fromMercator.z;

        const distance3D = Math.hypot(dx, dy, dz);
        if (distance3D === 0) throw new Error('Can\'t calculate camera options with same From and To');

        const groundDistance = Math.hypot(dx, dy);

        const zoom = scaleZoom(this.transform.cameraToCenterDistance / distance3D / this.transform.tileSize);
        const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
        let pitch = (Math.acos(groundDistance / distance3D) * 180) / Math.PI;
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;

        return {
            center: toMercator.toLngLat(),
            elevation: altitudeTo,
            zoom,
            pitch,
            bearing
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

        if ('zoom' in options && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        if (options.animate === false || (!options.essential && browser.prefersReducedMotion)) {
            options.duration = 0;
        }

        const tr = this.getTransformForUpdate();
        const startBearing = this.getBearing(),
            startPitch = tr.pitch,
            startRoll = tr.roll,
            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch,
            roll = 'roll' in options ? this._normalizeBearing(options.roll, startRoll) : startRoll,
            padding = ('padding' in options ? options.padding : tr.padding) as PaddingOptions;
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
        this._prepareEase(eventData, options.noMoveStart, currently);

        if (this.terrain) {
            this._prepareElevation(easeHandler.elevationCenter);
        }

        this._ease((k) => {
            easeHandler.easeFunc(k);

            if (this.terrain && !options.freezeElevation) this._updateElevation(k);
            this.applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);

        }, (interruptingEaseId?: string) => {
            if (this.terrain && options.freezeElevation) this._finalizeElevation();
            this._afterEase(eventData, interruptingEaseId);
        }, options);

        return this;
    }

    _prepareEase(eventData: any, noMoveStart: boolean,
        currently: { moving?: boolean; zooming?: boolean; rotating?: boolean; pitching?: boolean; rolling?: boolean} = {}): void {
        this._moving = true;
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

    _prepareElevation(center: LngLat): void {
        this._elevationCenter = center;
        this._elevationStart = this.transform.elevation;
        this._elevationTarget = this.terrain.getElevationForLngLatZoom(center, this.transform.tileZoom);
        this.elevationFreeze = true;
    }

    _updateElevation(k: number): void {

        if (this._elevationStart === undefined || this._elevationCenter === undefined) {
            this._prepareElevation(this.transform.center);
        }

        this.transform.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this._elevationCenter, this.transform.tileZoom));
        const elevation = this.terrain.getElevationForLngLatZoom(this._elevationCenter, this.transform.tileZoom);
        // target terrain updated during flight, slowly move camera to new height
        if (k < 1 && elevation !== this._elevationTarget) {
            const pitch1 = this._elevationTarget - this._elevationStart;
            const pitch2 = (elevation - (pitch1 * k + this._elevationStart)) / (1 - k);
            this._elevationStart += k * (pitch1 - pitch2);
            this._elevationTarget = elevation;
        }
        this.transform.setElevation(interpolates.number(this._elevationStart, this._elevationTarget, k));
    }

    _finalizeElevation(): void {
        this.elevationFreeze = false;
        if (this.getCenterClampedToGround()) {
            this.transform.recalculateZoomAndCenter(this.terrain);
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
     * Checks the given transform for the camera being below terrain surface and
     * returns new pitch and zoom to fix that.
     *
     * With the new pitch and zoom, the camera will be at the same ground
     * position but at higher altitude. It will still point to the same spot on
     * the map.
     *
     * @param tr - The transform to check.
     */
    _elevateCameraIfInsideTerrain(tr: ITransform) : { pitch?: number; zoom?: number } {
        if (!this.terrain && tr.elevation >= 0 && tr.pitch <= 90) {
            return {};
        }
        const cameraLngLat = tr.getCameraLngLat();
        const cameraAltitude = tr.getCameraAltitude();
        const minAltitude = this.terrain ? this.terrain.getElevationForLngLatZoom(cameraLngLat, tr.zoom) : 0;
        if (cameraAltitude < minAltitude) {
            const newCamera = this.calculateCameraOptionsFromTo(
                cameraLngLat, minAltitude, tr.center, tr.elevation);
            return {
                pitch: newCamera.pitch,
                zoom: newCamera.zoom,
            };
        }
        return {};
    }

    /**
     * @internal
     * Called after the camera is done being manipulated.
     * @param tr - the requested camera end state
     * If the camera is inside terrain, it gets elevated.
     * Call `transformCameraUpdate` if present, and then apply the "approved" changes.
     */
    applyUpdatedTransform(tr: ITransform): void {
        const modifiers : Array<(tr: ITransform) => ReturnType<CameraUpdateTransformFunction>> = [];
        modifiers.push(tr => this._elevateCameraIfInsideTerrain(tr));
        if (this.transformCameraUpdate) {
            modifiers.push(tr => this.transformCameraUpdate(tr));
        }
        if (!modifiers.length) {
            return;
        }
        const finalTransform = tr.clone();
        for (const modifier of modifiers) {
            const nextTransform = finalTransform.clone();
            const {
                center,
                zoom,
                roll,
                pitch,
                bearing,
                elevation
            } = modifier(nextTransform);
            if (center) nextTransform.setCenter(center);
            if (elevation !== undefined) nextTransform.setElevation(elevation);
            if (zoom !== undefined) nextTransform.setZoom(zoom);
            if (roll !== undefined) nextTransform.setRoll(roll);
            if (pitch !== undefined) nextTransform.setPitch(pitch);
            if (bearing !== undefined) nextTransform.setBearing(bearing);
            finalTransform.apply(nextTransform, false);
        }
        this.transform.apply(finalTransform, false);
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

    _afterEase(eventData?: Record<string, unknown>, easeId?: string): void {
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

        if ('zoom' in options && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        const tr = this.getTransformForUpdate(),
            startBearing = tr.bearing,
            startPitch = tr.pitch,
            startRoll = tr.roll,
            startPadding = tr.padding;

        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;
        const roll = 'roll' in options ? this._normalizeBearing(options.roll, startRoll) : startRoll;
        const padding = ('padding' in options ? options.padding : tr.padding) as PaddingOptions;

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

        if ('duration' in options) {
            options.duration = +options.duration;
        } else {
            const V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
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

        this._prepareEase(eventData, false);
        if (this.terrain) this._prepareElevation(flyToHandler.targetCenter);

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

            if (this.terrain && !options.freezeElevation) this._updateElevation(k);
            this.applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);
        }, () => {
            if (this.terrain && options.freezeElevation) this._finalizeElevation();
            this._afterEase(eventData);
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
