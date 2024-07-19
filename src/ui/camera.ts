import {extend, warnOnce, clamp, wrap, defaultEasing, pick, degreesToRadians, differenceOfAnglesDegrees} from '../util/util';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {browser} from '../util/browser';
import {LngLat} from '../geo/lng_lat';
import {LngLatBounds} from '../geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {Event, Evented} from '../util/evented';
import {Terrain} from '../render/terrain';
import {MercatorCoordinate} from '../geo/mercator_coordinate';

import type {ITransform} from '../geo/transform_interface';
import type {LngLatLike} from '../geo/lng_lat';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds';
import type {TaskID} from '../util/task_queue';
import type {PaddingOptions} from '../geo/edge_insets';
import type {HandlerManager} from './handler_manager';
import {angularCoordinatesToSurfaceVector, getZoomAdjustment, globeDistanceOfLocationsPixels, interpolateLngLatForGlobe} from '../geo/projection/globe_utils';
import {mat4, vec3} from 'gl-matrix';
import {projectToWorldCoordinates, unprojectFromWorldCoordinates} from '../geo/projection/mercator_utils';
import {scaleZoom, zoomScale} from '../geo/transform_helper';

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
 * A helper to allow require of at least one property
 */
export type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>; }[keyof T];

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo}, controlling the desired location,
 * zoom, bearing, and pitch of the camera. All properties are optional, and when a property is omitted, the current
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
 * @see [Set pitch and bearing](https://maplibre.org/maplibre-gl-js/docs/examples/set-perspective/)
 * @see [Jump to a series of locations](https://maplibre.org/maplibre-gl-js/docs/examples/jump-to/)
 * @see [Fly to a location](https://maplibre.org/maplibre-gl-js/docs/examples/flyto/)
 * @see [Display buildings in 3D](https://maplibre.org/maplibre-gl-js/docs/examples/3d-buildings/)
 */
export type CameraOptions = CenterZoomBearing & {
    /**
     * The desired pitch in degrees. The pitch is the angle towards the horizon
     * measured in degrees with a range between 0 and 60 degrees. For example, pitch: 0 provides the appearance
     * of looking straight down at the map, while pitch: 60 tilts the user's perspective towards the horizon.
     * Increasing the pitch value is often used to display 3D objects.
     */
    pitch?: number;
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
    /**
     * The desired apparent zoom level, relative to the animation's starting zoom level.
     * This is only used when globe projection is enabled, where changing latitude shifts the actual zoom level to match mercator.
     *
     * For example, when easing from near the pole with starting zoom 4 and end zoom 5, the map will
     * seem to zoom out, but will end up being at mercator zoom 5. When instead apparentZoom is set
     * to 5, the map will appear to zoom in by one level, but its end mercator zoom will be larger than 5.
     */
    apparentZoom?: number;
}

/**
 * The options object related to the {@link Map#jumpTo} method
 */
export type JumpToOptions = CameraOptions & {
    /**
     * Dimensions in pixels applied on each side of the viewport for shifting the vanishing point.
     */
    padding?: PaddingOptions;
}

/**
 * A options object for the {@link Map#cameraForBounds} method
 */
export type CameraForBoundsOptions = CameraOptions & {
    /**
     * The amount of padding in pixels to add to the given bounds.
     */
    padding?: number | RequireAtLeastOne<PaddingOptions>;
    /**
     * The center of the given bounds relative to the map's center, measured in pixels.
     * @defaultValue [0, 0]
     */
    offset?: PointLike;
    /**
     * The maximum zoom level to allow when the camera would transition to the specified bounds.
     */
    maxZoom?: number;
}

/**
 * The {@link Map#flyTo} options object
 */
export type FlyToOptions = AnimationOptions & CameraOptions & {
    /**
     * The zooming "curve" that will occur along the
     * flight path. A high value maximizes zooming for an exaggerated animation, while a low
     * value minimizes zooming for an effect closer to {@link Map#easeTo}. 1.42 is the average
     * value selected by participants in the user study discussed in
     * [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf). A value of
     * `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A
     * value of 1 would produce a circular motion.
     * @defaultValue 1.42
     */
    curve?: number;
    /**
     * The zero-based zoom level at the peak of the flight path. If
     * `options.curve` is specified, this option is ignored.
     */
    minZoom?: number;
    /**
     * The desired apparent zoom level at the peak of the flight path, relative to the animation's starting zoom level.
     * This is only used when globe projection is enabled, where changing latitude shifts the actual zoom level to match mercator.
     *
     * For example a value of -2 will allow the flightpath to zoom out enough to make the planet 4x smaller at most.
     */
    apparentMinZoom?: number;
    /**
     * The average speed of the animation defined in relation to
     * `options.curve`. A speed of 1.2 means that the map appears to move along the flight path
     * by 1.2 times `options.curve` screenfuls every second. A _screenful_ is the map's visible span.
     * It does not correspond to a fixed physical distance, but varies by zoom level.
     * @defaultValue 1.2
     */
    speed?: number;
    /**
     * The average speed of the animation measured in screenfuls
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
    padding?: number | RequireAtLeastOne<PaddingOptions>;
}

export type EaseToOptions = AnimationOptions & CameraOptions & {
    delayEndEvents?: number;
    padding?: number | RequireAtLeastOne<PaddingOptions>;
    /**
     * If `zoom` is specified, `around` determines the point around which the zoom is centered.
     */
    around?: LngLatLike;
}

/**
 * Options for {@link Map#fitBounds} method
 */
export type FitBoundsOptions = FlyToOptions & {
    /**
     * If `true`, the map transitions using {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}.
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
}

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration and easing function of the animation. All properties
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
    pitch: number;
    bearing: number;
    elevation: number;
}) => {
    center?: LngLat;
    zoom?: number;
    pitch?: number;
    bearing?: number;
    elevation?: number;
};

export abstract class Camera extends Evented {
    transform: ITransform;
    terrain: Terrain;
    handlers: HandlerManager;

    _moving: boolean;
    _zooming: boolean;
    _rotating: boolean;
    _pitching: boolean;
    _padding: boolean;

    _bearingSnap: number;
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
    _elevationFreeze: boolean;
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

    abstract _requestRenderFrame(a: () => void): TaskID;
    abstract _cancelRenderFrame(_: TaskID): void;

    constructor(transform: ITransform, options: {
        bearingSnap: number;
    }) {
        super();
        this._moving = false;
        this._zooming = false;
        this.transform = transform;
        this._bearingSnap = options.bearingSnap;

        this.on('moveend', () => {
            delete this._requestedCameraState;
        });
    }

    /**
     * @internal
     * Creates a new specialized transform instance from a projection instance and migrates
     * to this new transform, carrying over all the properties of the old transform (center, pitch, etc.).
     * When the style's projection is changed (or first set), this function should be called.
     */
    migrateProjection(newTransform: ITransform) {
        newTransform.apply(this.transform);
        this.transform = newTransform;
    }

    /**
     * Returns the map's geographical centerpoint.
     *
     * @returns The map's geographical centerpoint.
     * @example
     * Return a LngLat object such as `{lng: 0, lat: 0}`
     * ```ts
     * let center = map.getCenter();
     * // access longitude and latitude values directly
     * let {lng, lat} = map.getCenter();
     * ```
     */
    getCenter(): LngLat { return new LngLat(this.transform.center.lng, this.transform.center.lat); }

    /**
     * Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.
     *
     * Triggers the following events: `movestart` and `moveend`.
     *
     * @param center - The centerpoint to set.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * map.setCenter([-74, 38]);
     * ```
     */
    setCenter(center: LngLatLike, eventData?: any) {
        return this.jumpTo({center}, eventData);
    }

    /**
     * Pans the map by the specified offset.
     *
     * Triggers the following events: `movestart` and `moveend`.
     *
     * @param offset - `x` and `y` coordinates by which to pan the map.
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @see [Navigate the map with game-like controls](https://maplibre.org/maplibre-gl-js/docs/examples/game-controls/)
     */
    panBy(offset: PointLike, options?: AnimationOptions, eventData?: any): this {
        offset = Point.convert(offset).mult(-1);
        return this.panTo(this.transform.center, extend({offset}, options), eventData);
    }

    /**
     * Pans the map to the specified location with an animated transition.
     *
     * Triggers the following events: `movestart` and `moveend`.
     *
     * @param lnglat - The location to pan the map to.
     * @param options - Options describing the destination and animation of the transition.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * map.panTo([-74, 38]);
     * // Specify that the panTo animation should last 5000 milliseconds.
     * map.panTo([-74, 38], {duration: 5000});
     * ```
     * @see [Update a feature in realtime](https://maplibre.org/maplibre-gl-js/docs/examples/live-update-feature/)
     */
    panTo(lnglat: LngLatLike, options?: AnimationOptions, eventData?: any): this {
        return this.easeTo(extend({
            center: lnglat
        }, options), eventData);
    }

    /**
     * Returns the map's current zoom level.
     *
     * @returns The map's current zoom level.
     * @example
     * ```ts
     * map.getZoom();
     * ```
     */
    getZoom(): number { return this.transform.zoom; }

    /**
     * Sets the map's zoom level. Equivalent to `jumpTo({zoom: zoom})`.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.
     *
     * @param zoom - The zoom level to set (0-20).
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * Zoom to the zoom level 5 without an animated transition
     * ```ts
     * map.setZoom(5);
     * ```
     */
    setZoom(zoom: number, eventData?: any): this {
        this.jumpTo({zoom}, eventData);
        return this;
    }

    /**
     * Zooms the map to the specified zoom level, with an animated transition.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.
     *
     * @param zoom - The zoom level to transition to.
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * // Zoom to the zoom level 5 without an animated transition
     * map.zoomTo(5);
     * // Zoom to the zoom level 8 with an animated transition
     * map.zoomTo(8, {
     *   duration: 2000,
     *   offset: [100, 50]
     * });
     * ```
     */
    zoomTo(zoom: number, options?: AnimationOptions | null, eventData?: any): this {
        return this.easeTo(extend({
            zoom
        }, options), eventData);
    }

    /**
     * Increases the map's zoom level by 1.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.
     *
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * Zoom the map in one level with a custom animation duration
     * ```ts
     * map.zoomIn({duration: 1000});
     * ```
     */
    zoomIn(options?: AnimationOptions, eventData?: any): this {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    }

    /**
     * Decreases the map's zoom level by 1.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, and `zoomend`.
     *
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * Zoom the map out one level with a custom animation offset
     * ```ts
     * map.zoomOut({offset: [80, 60]});
     * ```
     */
    zoomOut(options?: AnimationOptions, eventData?: any): this {
        this.zoomTo(this.getZoom() - 1, options, eventData);
        return this;
    }

    /**
     * Returns the map's current bearing. The bearing is the compass direction that is "up"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * @returns The map's current bearing.
     * @see [Navigate the map with game-like controls](https://maplibre.org/maplibre-gl-js/docs/examples/game-controls/)
     */
    getBearing(): number { return this.transform.bearing; }

    /**
     * Sets the map's bearing (rotation). The bearing is the compass direction that is "up"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * Equivalent to `jumpTo({bearing: bearing})`.
     *
     * Triggers the following events: `movestart`, `moveend`, and `rotate`.
     *
     * @param bearing - The desired bearing.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * Rotate the map to 90 degrees
     * ```ts
     * map.setBearing(90);
     * ```
     */
    setBearing(bearing: number, eventData?: any): this {
        this.jumpTo({bearing}, eventData);
        return this;
    }

    /**
     * Returns the current padding applied around the map viewport.
     *
     * @returns The current padding around the map viewport.
     */
    getPadding(): PaddingOptions { return this.transform.padding; }

    /**
     * Sets the padding in pixels around the viewport.
     *
     * Equivalent to `jumpTo({padding: padding})`.
     *
     * Triggers the following events: `movestart` and `moveend`.
     *
     * @param padding - The desired padding.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * Sets a left padding of 300px, and a top padding of 50px
     * ```ts
     * map.setPadding({ left: 300, top: 50 });
     * ```
     */
    setPadding(padding: PaddingOptions, eventData?: any): this {
        this.jumpTo({padding}, eventData);
        return this;
    }

    /**
     * Rotates the map to the specified bearing, with an animated transition. The bearing is the compass direction
     * that is "up"; for example, a bearing of 90° orients the map so that east is up.
     *
     * Triggers the following events: `movestart`, `moveend`, and `rotate`.
     *
     * @param bearing - The desired bearing.
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     */
    rotateTo(bearing: number, options?: AnimationOptions, eventData?: any): this {
        return this.easeTo(extend({
            bearing
        }, options), eventData);
    }

    /**
     * Rotates the map so that north is up (0° bearing), with an animated transition.
     *
     * Triggers the following events: `movestart`, `moveend`, and `rotate`.
     *
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     */
    resetNorth(options?: AnimationOptions, eventData?: any): this {
        this.rotateTo(0, extend({duration: 1000}, options), eventData);
        return this;
    }

    /**
     * Rotates and pitches the map so that north is up (0° bearing) and pitch is 0°, with an animated transition.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `pitchstart`, `pitch`, `pitchend`, and `rotate`.
     *
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     */
    resetNorthPitch(options?: AnimationOptions, eventData?: any): this {
        this.easeTo(extend({
            bearing: 0,
            pitch: 0,
            duration: 1000
        }, options), eventData);
        return this;
    }

    /**
     * Snaps the map so that north is up (0° bearing), if the current bearing is close enough to it (i.e. within the
     * `bearingSnap` threshold).
     *
     * Triggers the following events: `movestart`, `moveend`, and `rotate`.
     *
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     */
    snapToNorth(options?: AnimationOptions, eventData?: any): this {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    }

    /**
     * Returns the map's current pitch (tilt).
     *
     * @returns The map's current pitch, measured in degrees away from the plane of the screen.
     */
    getPitch(): number { return this.transform.pitch; }

    /**
     * Sets the map's pitch (tilt). Equivalent to `jumpTo({pitch: pitch})`.
     *
     * Triggers the following events: `movestart`, `moveend`, `pitchstart`, and `pitchend`.
     *
     * @param pitch - The pitch to set, measured in degrees away from the plane of the screen (0-60).
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     */
    setPitch(pitch: number, eventData?: any): this {
        this.jumpTo({pitch}, eventData);
        return this;
    }

    /**
     * @param bounds - Calculate the center for these bounds in the viewport and use
     * the highest zoom level up to and including `Map#getMaxZoom()` that fits
     * in the viewport. LngLatBounds represent a box that is always axis-aligned with bearing 0.
     * @param options - Options object
     * @returns If map is able to fit to provided bounds, returns `center`, `zoom`, and `bearing`.
     * If map is unable to fit, method will warn and return undefined.
     * @example
     * ```ts
     * let bbox = [[-79, 43], [-73, 45]];
     * let newCameraTransform = map.cameraForBounds(bbox, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * ```
     */
    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraForBoundsOptions): CenterZoomBearing | undefined {
        bounds = LngLatBounds.convert(bounds);
        const bearing = options && options.bearing || 0;
        return this._cameraForBoxAndBearing(bounds.getNorthWest(), bounds.getSouthEast(), bearing, options);
    }

    /**
     * @internal
     */
    private _cameraBoundsWarning() {
        warnOnce(
            'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
        );
    }

    /**
     * @internal
     * Calculate the center of these two points in the viewport and use
     * the highest zoom level up to and including `Map#getMaxZoom()` that fits
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

        options.padding = extend(defaultPadding, options.padding) as PaddingOptions;
        const tr = this.transform;
        const edgePadding = tr.padding;

        // Consider all corners of the rotated bounding box derived from the given points
        // when find the camera position that fits the given points.
        const bounds = new LngLatBounds(p0, p1);
        const nwWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthWest());
        const neWorld = projectToWorldCoordinates(tr.worldSize, bounds.getNorthEast());
        const seWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthEast());
        const swWorld = projectToWorldCoordinates(tr.worldSize, bounds.getSouthWest());

        const bearingRadians = degreesToRadians(-bearing);

        const nwRotatedWorld = nwWorld.rotate(bearingRadians);
        const neRotatedWorld = neWorld.rotate(bearingRadians);
        const seRotatedWorld = seWorld.rotate(bearingRadians);
        const swRotatedWorld = swWorld.rotate(bearingRadians);

        const upperRight = new Point(
            Math.max(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x),
            Math.max(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y)
        );

        const lowerLeft = new Point(
            Math.min(nwRotatedWorld.x, neRotatedWorld.x, swRotatedWorld.x, seRotatedWorld.x),
            Math.min(nwRotatedWorld.y, neRotatedWorld.y, swRotatedWorld.y, seRotatedWorld.y)
        );

        // Calculate zoom: consider the original bbox and padding.
        const size = upperRight.sub(lowerLeft);

        const availableWidth = (tr.width - (edgePadding.left + edgePadding.right + options.padding.left + options.padding.right));
        const availableHeight = (tr.height - (edgePadding.top + edgePadding.bottom + options.padding.top + options.padding.bottom));
        const scaleX = availableWidth / size.x;
        const scaleY = availableHeight / size.y;

        if (scaleY < 0 || scaleX < 0) {
            this._cameraBoundsWarning();
            return undefined;
        }

        const zoom = Math.min(scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);

        // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of padding.
        const offset = Point.convert(options.offset);
        const paddingOffsetX = (options.padding.left - options.padding.right) / 2;
        const paddingOffsetY = (options.padding.top - options.padding.bottom) / 2;
        const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
        const rotatedPaddingOffset = paddingOffset.rotate(degreesToRadians(bearing));
        const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
        const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / zoomScale(zoom));

        const center = unprojectFromWorldCoordinates(
            tr.worldSize,
            // either world diagonal can be used (NW-SE or NE-SW)
            nwWorld.add(seWorld).div(2).sub(offsetAtFinalZoom)
        );

        const result = {
            center,
            zoom,
            bearing
        };

        // If globe is enabled, we use the parameters computed for mercator, and just update the zoom to fit the bounds.
        if (this.transform.useGlobeControls) {
            // Get clip space bounds including padding
            const xLeft = (options.padding.left) / tr.width * 2.0 - 1.0;
            const xRight = (tr.width - options.padding.right) / tr.width * 2.0 - 1.0;
            const yTop = (options.padding.top) / tr.height * -2.0 + 1.0;
            const yBottom = (tr.height - options.padding.bottom) / tr.height * -2.0 + 1.0;

            // Get camera bounds
            const flipEastWest = differenceOfAnglesDegrees(bounds.getWest(), bounds.getEast()) < 0;
            const lngWest = flipEastWest ? bounds.getEast() : bounds.getWest();
            const lngEast = flipEastWest ? bounds.getWest() : bounds.getEast();

            const latNorth = Math.max(bounds.getNorth(), bounds.getSouth()); // "getNorth" doesn't always return north...
            const latSouth = Math.min(bounds.getNorth(), bounds.getSouth());

            // Additional vectors will be tested for the rectangle midpoints
            const lngMid = lngWest + differenceOfAnglesDegrees(lngWest, lngEast) * 0.5;
            const latMid = latNorth + differenceOfAnglesDegrees(latNorth, latSouth) * 0.5;

            // Obtain a globe projection matrix that does not include pitch (unsupported)
            const clonedTr = tr.clone();
            clonedTr.setCenter(result.center);
            clonedTr.setBearing(result.bearing);
            clonedTr.setPitch(0);
            clonedTr.setZoom(result.zoom);
            const matrix = clonedTr.modelViewProjectionMatrix;

            // Vectors to test - the bounds' corners and edge midpoints
            const testVectors = [
                angularCoordinatesToSurfaceVector(bounds.getNorthWest()),
                angularCoordinatesToSurfaceVector(bounds.getNorthEast()),
                angularCoordinatesToSurfaceVector(bounds.getSouthWest()),
                angularCoordinatesToSurfaceVector(bounds.getSouthEast()),
                // Also test edge midpoints
                angularCoordinatesToSurfaceVector(new LngLat(lngEast, latMid)),
                angularCoordinatesToSurfaceVector(new LngLat(lngWest, latMid)),
                angularCoordinatesToSurfaceVector(new LngLat(lngMid, latNorth)),
                angularCoordinatesToSurfaceVector(new LngLat(lngMid, latSouth))
            ];
            const vecToCenter = angularCoordinatesToSurfaceVector(result.center);

            // Test each vector, measure how much to scale down the globe to satisfy all tested points that they are inside clip space.
            let smallestNeededScale = Number.POSITIVE_INFINITY;
            for (const vec of testVectors) {
                if (xLeft < 0)
                    smallestNeededScale = Camera.getLesserNonNegativeNonNull(smallestNeededScale, Camera.solveVectorScale(vec, vecToCenter, matrix, 'x', xLeft));
                if (xRight > 0)
                    smallestNeededScale = Camera.getLesserNonNegativeNonNull(smallestNeededScale, Camera.solveVectorScale(vec, vecToCenter, matrix, 'x', xRight));
                if (yTop > 0)
                    smallestNeededScale = Camera.getLesserNonNegativeNonNull(smallestNeededScale, Camera.solveVectorScale(vec, vecToCenter, matrix, 'y', yTop));
                if (yBottom < 0)
                    smallestNeededScale = Camera.getLesserNonNegativeNonNull(smallestNeededScale, Camera.solveVectorScale(vec, vecToCenter, matrix, 'y', yBottom));
            }

            if (!Number.isFinite(smallestNeededScale) || smallestNeededScale === 0) {
                this._cameraBoundsWarning();
                return undefined;
            }

            // Compute target zoom from the obtained scale.
            result.zoom = clonedTr.zoom + scaleZoom(smallestNeededScale);
        }

        return result;
    }

    /**
     * Pans and zooms the map to contain its visible area within the specified geographical bounds.
     * This function will also reset the map's bearing to 0 if bearing is nonzero.
     *
     * Triggers the following events: `movestart` and `moveend`.
     *
     * @param bounds - Center these bounds in the viewport and use the highest
     * zoom level up to and including `Map#getMaxZoom()` that fits them in the viewport.
     * @param options - Options supports all properties from {@link AnimationOptions} and {@link CameraOptions} in addition to the fields below.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * let bbox = [[-79, 43], [-73, 45]];
     * map.fitBounds(bbox, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * ```
     * @see [Fit a map to a bounding box](https://maplibre.org/maplibre-gl-js/docs/examples/fitbounds/)
     */
    fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions, eventData?: any): this {
        return this._fitInternal(
            this.cameraForBounds(bounds, options),
            options,
            eventData);
    }

    /**
     * Pans, rotates and zooms the map to to fit the box made by points p0 and p1
     * once the map is rotated to the specified bearing. To zoom without rotating,
     * pass in the current map bearing.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend` and `rotate`.
     *
     * @param p0 - First point on screen, in pixel coordinates
     * @param p1 - Second point on screen, in pixel coordinates
     * @param bearing - Desired map bearing at end of animation, in degrees
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * let p0 = [220, 400];
     * let p1 = [500, 900];
     * map.fitScreenCoordinates(p0, p1, map.getBearing(), {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * ```
     * @see Used by {@link BoxZoomHandler}
     */
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

    /**
     * Changes any combination of center, zoom, bearing, and pitch, without
     * an animated transition. The map will retain its current values for any
     * details not specified in `options`.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `pitchstart`,
     * `pitch`, `pitchend`, and `rotate`.
     *
     * @param options - Options object
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * // jump to coordinates at current zoom
     * map.jumpTo({center: [0, 0]});
     * // jump with zoom, pitch, and bearing options
     * map.jumpTo({
     *   center: [0, 0],
     *   zoom: 8,
     *   pitch: 45,
     *   bearing: 90
     * });
     * // jump while preserving planet size under globe projection
     * map.jumpTo({
     *   center: [0, 0],
     *   apparentZoom: map.getZoom(),
     * });
     * ```
     * @see [Jump to a series of locations](https://maplibre.org/maplibre-gl-js/docs/examples/jump-to/)
     * @see [Update a feature in realtime](https://maplibre.org/maplibre-gl-js/docs/examples/live-update-feature/)
     */
    jumpTo(options: JumpToOptions, eventData?: any): this {
        this.stop();

        const tr = this._getTransformForUpdate();
        let zoomChanged = false,
            bearingChanged = false,
            pitchChanged = false;

        const optionsZoom = typeof options.zoom === 'number';
        const optionsApparentZoom = typeof options.apparentZoom === 'number';

        if (this.transform.useGlobeControls) {
            // Special zoom & center handling for globe:
            // Globe constrained center isn't dependent on zoom level
            const startingLat = tr.center.lat;
            const constrainedCenter = tr.getConstrained(options.center ? LngLat.convert(options.center) : tr.center, tr.zoom).center;
            tr.setCenter(constrainedCenter.wrap());

            // Make sure to correctly apply apparentZoom
            let targetZoom;
            if (optionsApparentZoom) {
                targetZoom = +options.apparentZoom + getZoomAdjustment(startingLat, constrainedCenter.lat);
            } else if (optionsZoom) {
                targetZoom = +options.zoom;
            } else {
                targetZoom = tr.zoom + getZoomAdjustment(startingLat, constrainedCenter.lat);
            }
            if (tr.zoom !== targetZoom) {
                zoomChanged = true;
                tr.setZoom(targetZoom);
            }
        } else {
            // Mercator zoom & center handling.
            const zoom = optionsZoom ? +options.zoom : (optionsApparentZoom ? +options.apparentZoom : tr.zoom);
            if (tr.zoom !== zoom) {
                zoomChanged = true;
                tr.setZoom(+options.zoom);
            }

            if (options.center !== undefined) {
                tr.setCenter(LngLat.convert(options.center));
            }
        }

        if ('bearing' in options && tr.bearing !== +options.bearing) {
            bearingChanged = true;
            tr.setBearing(+options.bearing);
        }

        if ('pitch' in options && tr.pitch !== +options.pitch) {
            pitchChanged = true;
            tr.setPitch(+options.pitch);
        }

        if (options.padding != null && !tr.isPaddingEqual(options.padding)) {
            tr.setPadding(options.padding);
        }
        this._applyUpdatedTransform(tr);

        this.fire(new Event('movestart', eventData))
            .fire(new Event('move', eventData));

        if (zoomChanged) {
            this.fire(new Event('zoomstart', eventData))
                .fire(new Event('zoom', eventData))
                .fire(new Event('zoomend', eventData));
        }

        if (bearingChanged) {
            this.fire(new Event('rotatestart', eventData))
                .fire(new Event('rotate', eventData))
                .fire(new Event('rotateend', eventData));
        }

        if (pitchChanged) {
            this.fire(new Event('pitchstart', eventData))
                .fire(new Event('pitch', eventData))
                .fire(new Event('pitchend', eventData));
        }

        return this.fire(new Event('moveend', eventData));
    }

    /**
     * Calculates pitch, zoom and bearing for looking at `newCenter` with the camera position being `newCenter`
     * and returns them as {@link CameraOptions}.
     * @param from - The camera to look from
     * @param altitudeFrom - The altitude of the camera to look from
     * @param to - The center to look at
     * @param altitudeTo - Optional altitude of the center to look at. If none given the ground height will be used.
     * @returns the calculated camera options
     */
    calculateCameraOptionsFromTo(from: LngLat, altitudeFrom: number, to: LngLat, altitudeTo: number = 0): CameraOptions {
        const fromMerc = MercatorCoordinate.fromLngLat(from, altitudeFrom);
        const toMerc = MercatorCoordinate.fromLngLat(to, altitudeTo);
        const dx = toMerc.x - fromMerc.x;
        const dy = toMerc.y - fromMerc.y;
        const dz = toMerc.z - fromMerc.z;

        const distance3D = Math.hypot(dx, dy, dz);
        if (distance3D === 0) throw new Error('Can\'t calculate camera options with same From and To');

        const groundDistance = Math.hypot(dx, dy);

        const zoom = scaleZoom(this.transform.cameraToCenterDistance / distance3D / this.transform.tileSize);
        const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
        let pitch = (Math.acos(groundDistance / distance3D) * 180) / Math.PI;
        pitch = dz < 0 ? 90 - pitch : 90 + pitch;

        return {
            center: toMerc.toLngLat(),
            zoom,
            pitch,
            bearing
        };
    }

    /**
     * Changes any combination of `center`, `zoom`, `bearing`, `pitch`, and `padding` with an animated transition
     * between old and new values. The map will retain its current values for any
     * details not specified in `options`.
     *
     * Note: The transition will happen instantly if the user has enabled
     * the `reduced motion` accessibility feature enabled in their operating system,
     * unless `options` includes `essential: true`.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `pitchstart`,
     * `pitch`, `pitchend`, and `rotate`.
     *
     * @param options - Options describing the destination and animation of the transition.
     * Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * Supports `apparentZoom` for consistent planet radius when animating with globe projection enabled.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @see [Navigate the map with game-like controls](https://maplibre.org/maplibre-gl-js/docs/examples/game-controls/)
     */
    easeTo(options: EaseToOptions & {
        easeId?: string;
        noMoveStart?: boolean;
    }, eventData?: any): this {
        this._stop(false, options.easeId);

        options = extend({
            offset: [0, 0],
            duration: 500,
            easing: defaultEasing
        }, options);

        if (options.animate === false || (!options.essential && browser.prefersReducedMotion)) options.duration = 0;

        const tr = this._getTransformForUpdate(),
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),
            startPadding = this.getPadding(),

            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch,
            padding = 'padding' in options ? options.padding : tr.padding;
        const startCenter = tr.center;
        const offsetAsPoint = Point.convert(options.offset);

        const optionsZoom = typeof options.zoom === 'number';
        const optionsApparentZoom = typeof options.apparentZoom === 'number';

        let around, aroundPoint;

        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = tr.locationToScreenPoint(around);
        }

        const currently = {
            moving: this._moving,
            zooming: this._zooming,
            rotating: this._rotating,
            pitching: this._pitching
        };
        this._rotating = this._rotating || (startBearing !== bearing);
        this._pitching = this._pitching || (pitch !== startPitch);
        this._padding = !tr.isPaddingEqual(padding as PaddingOptions);

        if (this.transform.useGlobeControls) {
            // Globe needs special handling for how zoom should be animated.
            // 1) if zoom is set, ease to the given mercator zoom
            // 2) if apparentZoom is set, ease to the given apparent zoom
            // 3) if neither is set, assume constant apparent zoom is to be kept and go to case 2
            const preConstrainCenter = options.center ?
                LngLat.convert(options.center) :
                startCenter;
            const constrainedCenter = tr.getConstrained(
                preConstrainCenter,
                startZoom // zoom can be whatever at this stage, it should not affect anything if globe is enabled
            ).center;
            this._normalizeCenter(constrainedCenter);

            // Compute target mercator zoom which we will use to compute final animation targets
            const desiredApparentZoom = optionsApparentZoom ?
                +options.apparentZoom :
                (optionsZoom ?
                    undefined :
                    tr.zoom);
            const hasApparentZoom = typeof desiredApparentZoom === 'number';
            const desiredMercatorZoom = hasApparentZoom ?
                undefined :
                +options.zoom;
            const targetMercatorZoom = hasApparentZoom ?
                desiredApparentZoom + getZoomAdjustment(startCenter.lat, preConstrainCenter.lat) :
                desiredMercatorZoom;

            const clonedTr = tr.clone();
            clonedTr.setCenter(constrainedCenter);
            if (this._padding) {
                clonedTr.setPadding(padding as PaddingOptions);
            }
            clonedTr.setZoom(targetMercatorZoom);
            clonedTr.setBearing(bearing);
            const clampedPoint = new Point(
                clamp(tr.centerPoint.x + offsetAsPoint.x, 0, tr.width),
                clamp(tr.centerPoint.y + offsetAsPoint.y, 0, tr.height)
            );
            clonedTr.setLocationAtPoint(constrainedCenter, clampedPoint);
            // Find final animation targets
            const endCenterWithShift = (options.offset && offsetAsPoint.mag()) > 0 ? clonedTr.center : constrainedCenter;
            const endZoomWithShift = hasApparentZoom ?
                desiredApparentZoom + getZoomAdjustment(startCenter.lat, endCenterWithShift.lat) :
                desiredMercatorZoom; // Not adjusting this zoom will reduce accuracy of the offset center

            // Planet radius for a given zoom level differs according to latitude
            // Convert zooms to what they would be at equator for the given planet radius
            const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
            const normalizedEndZoom = endZoomWithShift + getZoomAdjustment(endCenterWithShift.lat, 0);
            const deltaLng = differenceOfAnglesDegrees(startCenter.lng, endCenterWithShift.lng);
            const deltaLat = differenceOfAnglesDegrees(startCenter.lat, endCenterWithShift.lat);

            const finalScale = zoomScale(normalizedEndZoom - normalizedStartZoom);
            this._zooming = this._zooming || (endZoomWithShift !== startZoom);
            this._easeId = options.easeId;
            this._prepareEase(eventData, options.noMoveStart, currently);
            if (this.terrain) this._prepareElevation(endCenterWithShift);

            this._ease((k) => {
                if (this._rotating) {
                    tr.setBearing(interpolates.number(startBearing, bearing, k));
                }
                if (this._pitching) {
                    tr.setPitch(interpolates.number(startPitch, pitch, k));
                }

                if (around) {
                    warnOnce('Easing around a point is not supported under globe projection.');
                    tr.setLocationAtPoint(around, aroundPoint);
                } else {
                    const base = normalizedEndZoom > normalizedStartZoom ?
                        Math.min(2, finalScale) :
                        Math.max(0.5, finalScale);
                    const speedup = Math.pow(base, 1 - k);
                    const factor = k * speedup;

                    // Spherical lerp might be used here instead, but that was tested and it leads to very weird paths when the interpolated arc gets near the poles.
                    // Instead we interpolate LngLat almost directly, but taking into account that
                    // one degree of longitude gets progressively smaller relative to latitude towards the poles.
                    const newCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, factor);
                    tr.setCenter(newCenter.wrap());
                }

                if (this._zooming) {
                    const normalizedInterpolatedZoom = interpolates.number(normalizedStartZoom, normalizedEndZoom, k);
                    const interpolatedZoom = normalizedInterpolatedZoom + getZoomAdjustment(0, tr.center.lat);
                    tr.setZoom(interpolatedZoom);
                }

                if (this.terrain && !options.freezeElevation) this._updateElevation(k);

                this._applyUpdatedTransform(tr);

                this._fireMoveEvents(eventData);

            }, (interruptingEaseId?: string) => {
                if (this.terrain && options.freezeElevation) this._finalizeElevation();
                this._afterEase(eventData, interruptingEaseId);
            }, options as any);
        } else {
            const zoom = optionsZoom ? +options.zoom : (optionsApparentZoom ? +options.apparentZoom : tr.zoom);

            let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
            const locationAtOffset = tr.screenPointToLocation(pointAtOffset);
            const {center, zoom: endZoom} = tr.getConstrained(
                LngLat.convert(options.center || locationAtOffset),
                zoom ?? startZoom
            );
            this._normalizeCenter(center);

            const from = projectToWorldCoordinates(tr.worldSize, locationAtOffset);
            const delta = projectToWorldCoordinates(tr.worldSize, center).sub(from);

            const finalScale = zoomScale(endZoom - startZoom);
            this._zooming = this._zooming || (endZoom !== startZoom);
            this._easeId = options.easeId;
            this._prepareEase(eventData, options.noMoveStart, currently);
            if (this.terrain) this._prepareElevation(center);

            this._ease((k) => {
                if (this._zooming) {
                    tr.setZoom(interpolates.number(startZoom, endZoom, k));
                }
                if (this._rotating) {
                    tr.setBearing(interpolates.number(startBearing, bearing, k));
                }
                if (this._pitching) {
                    tr.setPitch(interpolates.number(startPitch, pitch, k));
                }
                if (this._padding) {
                    tr.interpolatePadding(startPadding, padding as PaddingOptions, k);
                    // When padding is being applied, Transform#centerPoint is changing continuously,
                    // thus we need to recalculate offsetPoint every frame
                    pointAtOffset = tr.centerPoint.add(offsetAsPoint);
                }

                if (this.terrain && !options.freezeElevation) this._updateElevation(k);

                if (around) {
                    tr.setLocationAtPoint(around, aroundPoint);
                } else {
                    const scale = zoomScale(tr.zoom - startZoom);
                    const base = endZoom > startZoom ?
                        Math.min(2, finalScale) :
                        Math.max(0.5, finalScale);
                    const speedup = Math.pow(base, 1 - k);
                    const newCenter = unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(k * speedup)).mult(scale));
                    tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
                }

                this._applyUpdatedTransform(tr);

                this._fireMoveEvents(eventData);

            }, (interruptingEaseId?: string) => {
                if (this.terrain && options.freezeElevation) this._finalizeElevation();
                this._afterEase(eventData, interruptingEaseId);
            }, options as any);
        }

        return this;
    }

    _prepareEase(eventData: any, noMoveStart: boolean, currently: any = {}) {
        this._moving = true;
        if (!noMoveStart && !currently.moving) {
            this.fire(new Event('movestart', eventData));
        }
        if (this._zooming && !currently.zooming) {
            this.fire(new Event('zoomstart', eventData));
        }
        if (this._rotating && !currently.rotating) {
            this.fire(new Event('rotatestart', eventData));
        }
        if (this._pitching && !currently.pitching) {
            this.fire(new Event('pitchstart', eventData));
        }
    }

    _prepareElevation(center: LngLat) {
        this._elevationCenter = center;
        this._elevationStart = this.transform.elevation;
        this._elevationTarget = this.terrain.getElevationForLngLatZoom(center, this.transform.tileZoom);
        this._elevationFreeze = true;
    }

    _updateElevation(k: number) {
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

    _finalizeElevation() {
        this._elevationFreeze = false;
        this.transform.recalculateZoom(this.terrain);
    }

    /**
     * @internal
     * Called when the camera is about to be manipulated.
     * If `transformCameraUpdate` is specified, a copy of the current transform is created to track the accumulated changes.
     * This underlying transform represents the "desired state" proposed by input handlers / animations / UI controls.
     * It may differ from the state used for rendering (`this.transform`).
     * @returns Transform to apply changes to
     */
    _getTransformForUpdate(): ITransform {
        if (!this.transformCameraUpdate) return this.transform;

        if (!this._requestedCameraState) {
            this._requestedCameraState = this.transform.clone();
        }
        return this._requestedCameraState;
    }

    /**
     * @internal
     * Called after the camera is done being manipulated.
     * @param tr - the requested camera end state
     * Call `transformCameraUpdate` if present, and then apply the "approved" changes.
     */
    _applyUpdatedTransform(tr: ITransform) {
        if (!this.transformCameraUpdate) return;

        const nextTransform = tr.clone();
        const {
            center,
            zoom,
            pitch,
            bearing,
            elevation
        } = this.transformCameraUpdate(nextTransform);
        if (center) nextTransform.setCenter(center);
        if (zoom !== undefined) nextTransform.setZoom(zoom);
        if (pitch !== undefined) nextTransform.setPitch(pitch);
        if (bearing !== undefined) nextTransform.setBearing(bearing);
        if (elevation !== undefined) nextTransform.setElevation(elevation);
        this.transform.apply(nextTransform);
    }

    _fireMoveEvents(eventData?: any) {
        this.fire(new Event('move', eventData));
        if (this._zooming) {
            this.fire(new Event('zoom', eventData));
        }
        if (this._rotating) {
            this.fire(new Event('rotate', eventData));
        }
        if (this._pitching) {
            this.fire(new Event('pitch', eventData));
        }
    }

    _afterEase(eventData?: any, easeId?: string) {
        // if this easing is being stopped to start another easing with
        // the same id then don't fire any events to avoid extra start/stop events
        if (this._easeId && easeId && this._easeId === easeId) {
            return;
        }
        delete this._easeId;

        const wasZooming = this._zooming;
        const wasRotating = this._rotating;
        const wasPitching = this._pitching;
        this._moving = false;
        this._zooming = false;
        this._rotating = false;
        this._pitching = false;
        this._padding = false;

        if (wasZooming) {
            this.fire(new Event('zoomend', eventData));
        }
        if (wasRotating) {
            this.fire(new Event('rotateend', eventData));
        }
        if (wasPitching) {
            this.fire(new Event('pitchend', eventData));
        }
        this.fire(new Event('moveend', eventData));
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, animating the transition along a curve that
     * evokes flight. The animation seamlessly incorporates zooming and panning to help
     * the user maintain her bearings even after traversing a great distance.
     *
     * Note: The animation will be skipped, and this will behave equivalently to `jumpTo`
     * if the user has the `reduced motion` accessibility feature enabled in their operating system,
     * unless 'options' includes `essential: true`.
     *
     * Triggers the following events: `movestart`, `move`, `moveend`, `zoomstart`, `zoom`, `zoomend`, `pitchstart`,
     * `pitch`, `pitchend`, and `rotate`.
     *
     * @param options - Options describing the destination and animation of the transition.
     * Accepts {@link CameraOptions}, {@link AnimationOptions},
     * and the following additional options.
     * @param eventData - Additional properties to be added to event objects of events triggered by this method.
     * @example
     * ```ts
     * // fly with default options to null island
     * map.flyTo({center: [0, 0], zoom: 9});
     * // using flyTo options
     * map.flyTo({
     *   center: [0, 0],
     *   zoom: 9,
     *   speed: 0.2,
     *   curve: 1,
     *   easing(t) {
     *     return t;
     *   }
     * });
     * // using apparentZoom to keep consistent planet radius when globe projection is enabled
     * map.flyTo({
     *   center: [0, 0],
     *   apparentZoom: map.getZoom()
     * });
     * ```
     * @see [Fly to a location](https://maplibre.org/maplibre-gl-js/docs/examples/flyto/)
     * @see [Slowly fly to a location](https://maplibre.org/maplibre-gl-js/docs/examples/flyto-options/)
     * @see [Fly to a location based on scroll position](https://maplibre.org/maplibre-gl-js/docs/examples/scroll-fly-to/)
     */
    flyTo(options: FlyToOptions, eventData?: any): this {
        // Fall through to jumpTo if user has set prefers-reduced-motion
        if (!options.essential && browser.prefersReducedMotion) {
            const coercedOptions = pick(options, ['center', 'zoom', 'bearing', 'pitch']) as CameraOptions;
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

        const tr = this._getTransformForUpdate(),
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),
            startPadding = this.getPadding();
        const startCenter = tr.center;

        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;
        const padding = 'padding' in options ? options.padding : tr.padding;

        const offsetAsPoint = Point.convert(options.offset);
        let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
        const locationAtOffset = tr.screenPointToLocation(pointAtOffset);

        const optionsZoom = typeof options.zoom === 'number';
        const optionsApparentZoom = typeof options.apparentZoom === 'number';

        // Obtain target center and zoom
        let targetCenter, targetZoom;
        if (this.transform.useGlobeControls) {
            const constrainedCenter = tr.getConstrained(
                LngLat.convert(options.center || locationAtOffset),
                startZoom
            ).center;
            if (optionsApparentZoom) {
                targetZoom = +options.apparentZoom + getZoomAdjustment(tr.center.lat, constrainedCenter.lat);
            } else if (optionsZoom) {
                targetZoom = +options.zoom;
            } else {
                targetZoom = tr.zoom + getZoomAdjustment(tr.center.lat, constrainedCenter.lat);
            }

            // Compute target center that respects offset by creating a temporary transform and calling its `setLocationAtPoint`.
            const clonedTr = tr.clone();
            clonedTr.setCenter(constrainedCenter);
            if (this._padding) {
                clonedTr.setPadding(padding as PaddingOptions);
            }
            clonedTr.setZoom(targetZoom);
            clonedTr.setBearing(bearing);
            const clampedPoint = new Point(
                clamp(tr.centerPoint.x + offsetAsPoint.x, 0, tr.width),
                clamp(tr.centerPoint.y + offsetAsPoint.y, 0, tr.height)
            );
            clonedTr.setLocationAtPoint(constrainedCenter, clampedPoint);
            targetCenter = clonedTr.center;
        } else {
            const constrained = tr.getConstrained(
                LngLat.convert(options.center || locationAtOffset),
                optionsZoom ? +options.zoom : (optionsApparentZoom ? +options.apparentZoom : startZoom)
            );
            targetCenter = constrained.center;
            targetZoom = constrained.zoom;
        }

        this._normalizeCenter(targetCenter);

        const normalizedStartZoom = startZoom + getZoomAdjustment(startCenter.lat, 0);
        const normalizedTargetZoom = targetZoom + getZoomAdjustment(targetCenter.lat, 0);
        const scale = this.transform.useGlobeControls ? zoomScale(normalizedTargetZoom - normalizedStartZoom) : zoomScale(targetZoom - startZoom);

        const from = projectToWorldCoordinates(tr.worldSize, locationAtOffset);
        const delta = projectToWorldCoordinates(tr.worldSize, targetCenter).sub(from);

        let rho = options.curve;

        // w₀: Initial visible span, measured in pixels at the initial scale.
        const w0 = Math.max(tr.width, tr.height);
        // w₁: Final visible span, measured in pixels with respect to the initial scale.
        const w1 = w0 / scale;
        // Length of the flight path as projected onto the ground plane, measured in pixels from
        // the world image origin at the initial scale.
        const u1 = this.transform.useGlobeControls ?
            globeDistanceOfLocationsPixels(tr, startCenter, targetCenter) :
            delta.mag();

        const optionsMinZoom = typeof options.minZoom === 'number';
        const optionsApparentMinZoom = typeof options.apparentMinZoom === 'number';

        if (optionsMinZoom || optionsApparentMinZoom) {
            // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
            // scale.
            let wMax;
            if (this.transform.useGlobeControls) {
                let normalizedOptionsMinZoom;
                if (optionsApparentMinZoom) {
                    normalizedOptionsMinZoom = +options.apparentMinZoom + startZoom + getZoomAdjustment(startCenter.lat, 0);
                } else {
                    normalizedOptionsMinZoom = +options.minZoom + getZoomAdjustment(targetCenter.lat, 0);
                }
                const normalizedMinZoomPreConstrain = Math.min(normalizedOptionsMinZoom, normalizedStartZoom, normalizedTargetZoom);
                const minZoomPreConstrain = normalizedMinZoomPreConstrain + getZoomAdjustment(0, targetCenter.lat);
                const minZoom = tr.getConstrained(targetCenter, minZoomPreConstrain).zoom;
                const normalizedMinZoom = minZoom + getZoomAdjustment(targetCenter.lat, 0);
                wMax = w0 / zoomScale(normalizedMinZoom - normalizedStartZoom);
            } else {
                let minZoomPreConstrain;
                if (optionsMinZoom) {
                    minZoomPreConstrain = Math.min(+options.minZoom, startZoom, targetZoom);
                } else {
                    // We *do* have apparentMinZoom, but not minZoom, and globe controls are not in effect
                    minZoomPreConstrain = Math.min(+options.apparentMinZoom + startZoom, startZoom, targetZoom);
                }
                const minZoom = tr.getConstrained(targetCenter, minZoomPreConstrain).zoom;
                wMax = w0 / zoomScale(minZoom - startZoom);
            }
            rho = Math.sqrt(wMax / u1 * 2);
        }

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
        // initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
        let w: (_: number) => number = function (s) {
            return (cosh(r0) / cosh(r0 + rho * s));
        };

        // u(s): Returns the distance along the flight path as projected onto the ground plane,
        // measured in pixels from the world image origin at the initial scale.
        let u: (_: number) => number = function (s) {
            return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1;
        };

        // S: Total length of the flight path, measured in ρ-screenfuls.
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
        this._padding = !tr.isPaddingEqual(padding as PaddingOptions);

        this._prepareEase(eventData, false);
        if (this.terrain) this._prepareElevation(targetCenter);

        if (this.transform.useGlobeControls) {
            const deltaLng = differenceOfAnglesDegrees(startCenter.lng, targetCenter.lng);
            const deltaLat = differenceOfAnglesDegrees(startCenter.lat, targetCenter.lat);

            this._ease((k) => {
                // s: The distance traveled along the flight path, measured in ρ-screenfuls.
                const s = k * S;
                const scale = 1 / w(s);

                if (this._rotating) {
                    tr.setBearing(interpolates.number(startBearing, bearing, k));
                }
                if (this._pitching) {
                    tr.setPitch(interpolates.number(startPitch, pitch, k));
                }
                if (this._padding) {
                    tr.interpolatePadding(startPadding, padding as PaddingOptions, k);
                }

                if (this.terrain && !options.freezeElevation) this._updateElevation(k);

                const centerFactor = u(s);
                const interpolatedCenter = interpolateLngLatForGlobe(startCenter, deltaLng, deltaLat, centerFactor);

                const newCenter = k === 1 ? targetCenter : interpolatedCenter;
                tr.setCenter(newCenter.wrap());

                const interpolatedZoom = normalizedStartZoom + scaleZoom(scale);
                tr.setZoom(k === 1 ? targetZoom : (interpolatedZoom + getZoomAdjustment(0, newCenter.lat)));

                this._applyUpdatedTransform(tr);

                this._fireMoveEvents(eventData);

            }, () => {
                if (this.terrain && options.freezeElevation) this._finalizeElevation();
                this._afterEase(eventData);
            }, options);
        } else {
            this._ease((k) => {
                // s: The distance traveled along the flight path, measured in ρ-screenfuls.
                const s = k * S;
                const scale = 1 / w(s);
                tr.setZoom(k === 1 ? targetZoom : startZoom + scaleZoom(scale));

                if (this._rotating) {
                    tr.setBearing(interpolates.number(startBearing, bearing, k));
                }
                if (this._pitching) {
                    tr.setPitch(interpolates.number(startPitch, pitch, k));
                }
                if (this._padding) {
                    tr.interpolatePadding(startPadding, padding as PaddingOptions, k);
                    // When padding is being applied, Transform#centerPoint is changing continuously,
                    // thus we need to recalculate offsetPoint every frame
                    pointAtOffset = tr.centerPoint.add(offsetAsPoint);
                }

                if (this.terrain && !options.freezeElevation) this._updateElevation(k);

                const newCenter = k === 1 ? targetCenter : unprojectFromWorldCoordinates(tr.worldSize, from.add(delta.mult(u(s))).mult(scale));
                tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);

                this._applyUpdatedTransform(tr);

                this._fireMoveEvents(eventData);

            }, () => {
                if (this.terrain && options.freezeElevation) this._finalizeElevation();
                this._afterEase(eventData);
            }, options);
        }

        return this;
    }

    isEasing() {
        return !!this._easeFrameId;
    }

    /**
     * Stops any animated transition underway.
     */
    stop(): this {
        return this._stop();
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
            this.handlers?.stop(false);
        }
        return this;
    }

    _ease(frame: (_: number) => void,
        finish: () => void,
        options: {
            animate?: boolean;
            duration?: number;
            easing?: (_: number) => number;
        }) {
        if (options.animate === false || options.duration === 0) {
            frame(1);
            finish();
        } else {
            this._easeStart = browser.now();
            this._easeOptions = options;
            this._onEaseFrame = frame;
            this._onEaseEnd = finish;
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        }
    }

    // Callback for map._requestRenderFrame
    _renderFrameCallback = () => {
        const t = Math.min((browser.now() - this._easeStart) / this._easeOptions.duration, 1);
        this._onEaseFrame(this._easeOptions.easing(t));

        // if _stop is called during _onEaseFrame from _fireMoveEvents we should avoid a new _requestRenderFrame, checking it by ensuring _easeFrameId was not deleted
        if (t < 1 && this._easeFrameId) {
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        } else {
            this.stop();
        }
    };

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number) {
        bearing = wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    }

    // If a path crossing the antimeridian would be shorter, extend the final coordinate so that
    // interpolating between the two endpoints will cross it.
    _normalizeCenter(center: LngLat) {
        const tr = this.transform;
        if (!tr.renderWorldCopies || tr.lngRange) return;

        const delta = center.lng - tr.center.lng;
        center.lng +=
            delta > 180 ? -360 :
                delta < -180 ? 360 : 0;
    }

    /**
     * Get the elevation difference between a given point
     * and a point that is currently in the middle of the screen.
     * This method should be used for proper positioning of custom 3d objects, as explained [here](https://maplibre.org/maplibre-gl-js/docs/examples/add-3d-model-with-terrain/)
     * Returns null if terrain is not enabled.
     * This method is subject to change in Maplibre GL JS v5.
     * @param lngLatLike - [x,y] or LngLat coordinates of the location
     * @returns elevation offset in meters
     */
    queryTerrainElevation(lngLatLike: LngLatLike): number | null {
        if (!this.terrain) {
            return null;
        }
        const elevation = this.terrain.getElevationForLngLatZoom(LngLat.convert(lngLatLike), this.transform.tileZoom);
        return elevation - this.transform.elevation;
    }

    /**
     * Computes how much to scale the globe in order for a given point on its surface (a location) to project to a given clip space coordinate in either the X or the Y axis.
     * @param vector - Position of the queried location on the surface of the unit sphere globe.
     * @param toCenter - Position of current transform center on the surface of the unit sphere globe.
     * This is needed because zooming the globe not only changes its scale,
     * but also moves the camera closer or further away along this vector (pitch is disregarded).
     * @param projection - The globe projection matrix.
     * @param targetDimension - The dimension in which the scaled vector must match the target value in clip space.
     * @param targetValue - The target clip space value in the specified dimension to which the queried vector must project.
     * @returns How much to scale the globe.
     */
    private static solveVectorScale(vector: vec3, toCenter: vec3, projection: mat4, targetDimension: 'x' | 'y', targetValue: number): number | null {
        // We want to compute how much to scale the sphere in order for the input `vector` to project to `targetValue` in the given `targetDimension` (X or Y).
        const k = targetValue;
        const columnXorY = targetDimension === 'x' ?
            [projection[0], projection[4], projection[8], projection[12]] : // X
            [projection[1], projection[5], projection[9], projection[13]];  // Y
        const columnZ = [projection[3], projection[7], projection[11], projection[15]];

        const vecDotXY = vector[0] * columnXorY[0] + vector[1] * columnXorY[1] + vector[2] * columnXorY[2];
        const vecDotZ = vector[0] * columnZ[0] + vector[1] * columnZ[1] + vector[2] * columnZ[2];
        const toCenterDotXY = toCenter[0] * columnXorY[0] + toCenter[1] * columnXorY[1] + toCenter[2] * columnXorY[2];
        const toCenterDotZ = toCenter[0] * columnZ[0] + toCenter[1] * columnZ[1] + toCenter[2] * columnZ[2];

        // The following can be derived from writing down what happens to a vector scaled by a parameter ("V * t") when it is multiplied by a projection matrix, then solving for "t".
        // Or rather, we derive it for a vector "V * t + (1-t) * C". Where V is `vector` and C is `toCenter`. The extra addition is needed because zooming out also moves the camera along "C".

        const t = (toCenterDotXY + columnXorY[3] - k * toCenterDotZ - k * columnZ[3]) / (toCenterDotXY - vecDotXY - k * toCenterDotZ + k * vecDotZ);

        if (
            toCenterDotXY + k * vecDotZ === vecDotXY + k * toCenterDotZ ||
            columnZ[3] * (vecDotXY - toCenterDotXY) + columnXorY[3] * (toCenterDotZ - vecDotZ) + vecDotXY * toCenterDotZ === toCenterDotXY * vecDotZ
        ) {
            // The computed result is invalid.
            return null;
        }
        return t;
    }

    /**
     * Returns `newValue` if it is:
     *
     * - not null AND
     * - not negative AND
     * - smaller than `newValue`,
     *
     * ...otherwise returns `oldValue`.
     */
    private static getLesserNonNegativeNonNull(oldValue: number, newValue: number): number {
        if (newValue !== null && newValue >= 0 && newValue < oldValue) {
            return newValue;
        } else {
            return oldValue;
        }
    }
}
