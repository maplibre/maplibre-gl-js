import Point from '@mapbox/point-geometry';
import {extend, wrap, defaultEasing, pick, evaluateZoomSnap} from '../util/util.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {browser} from '../util/browser.ts';
import {now} from '../util/time_control.ts';
import {LngLat} from '../geo/lng_lat.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {Evented} from '../util/evented.ts';
import {MapMovementEvent} from './events.ts';
import {MercatorTransform} from '../geo/projection/mercator_transform.ts';
import {MercatorCameraHelper} from '../geo/projection/mercator_camera_helper.ts';
import {createFlyToArc, type FlyToArc} from './fly_to_arc.ts';

import type {CameraMovement} from './camera_movement.ts';
import type {MapEventType} from './events.ts';
import type {Terrain} from '../render/terrain.ts';
import type {ITransform, TransformConstrainFunction} from '../geo/transform_interface.ts';
import type {LngLatLike} from '../geo/lng_lat.ts';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.ts';
import type {TaskID} from '../util/task_queue.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {EaseToHandlerOptions, FlyToHandlerOptions, ICameraHelper, MapControlsDeltas} from '../geo/projection/camera_helper.ts';
import type {PreloadTilesOptions} from './tile_preloader.ts';
import type {TilePreloader} from './tile_preloader.ts';

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
    /**
     * Loads the tiles the animation is about to need, so that it finds them as it reaches them
     * instead of showing empty or low-detail map while it waits for them.
     *
     * The movement starts at once and the tiles arrive while it travels, so a movement over a slow
     * network can reach its destination before they do. A movement keeps asking for the tiles
     * further along its path as it goes, which is what lets a long movement cover its path without
     * requesting all of it at once. Any movement that interrupts it gives up on its tiles.
     *
     * Takes a {@link PreloadTilesOptions} to tune how far ahead the movement reads and how much it
     * may ask each source for.
     *
     * @defaultValue false
     */
    preload?: boolean | PreloadTilesOptions;
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
    /**
     * @internal
     * The tile preload a movement runs ahead of itself when it is given the `preload` option. Injected
     * so that the `Camera` can preload without holding a reference to the `Map` that owns it.
     */
    preloader: TilePreloader;
};

/** Who holds the center elevation: a gesture, or an animation with `freezeElevation`. */
type ElevationHolder = 'gesture' | 'animation';

/**
 * A hold on the center elevation, see {@link Camera.holdElevation}: one that started where no DEM data under a center
 * clamped to the ground had loaded waits for it and takes it when it lands. It holds no transform: a gesture's takes
 * on the terrain change, on the requested camera state its frames read; an animation's on its next frame, on the
 * transform it edits, which a projection change does not replace, or at its end when nothing ran in between.
 */
class ElevationHold {
    /** Whether the hold waits for DEM data under the center: from its start, or since a terrain change left none there. */
    awaitsDem: boolean;
    private _terrainChanged = false;

    /**
     * @param holder - who holds the elevation
     * @param startedWithoutDem - whether the hold started without DEM data under the center; only such a hold waits
     */
    constructor(readonly holder: ElevationHolder, readonly startedWithoutDem: boolean) {
        this.awaitsDem = startedWithoutDem;
    }

    /** Whether the hold carries an elevation it took from DEM data. */
    get tookDem(): boolean {
        return this.startedWithoutDem && !this.awaitsDem;
    }

    /** Asks the next {@link take} to check for DEM data under the center, after the terrain changed. */
    noteTerrainChange(): void {
        if (this.startedWithoutDem) this._terrainChanged = true;
    }

    /**
     * While the hold waits, takes the elevation the terrain draws under the center once the tile there has its own
     * DEM data, or a coarser tile's sooner where it lifts a camera that would be inside the terrain. After a terrain
     * change that leaves no DEM data under the center, puts the center back at the 0 the terrain gives there and
     * waits again.
     * @param tr - the transform the gesture or animation edits
     * @param terrain - the terrain under it
     * @returns whether it changed the elevation
     */
    take(tr: ITransform, terrain: Terrain): boolean {
        let changed = false;
        if (this._terrainChanged) {
            this._terrainChanged = false;
            if (!terrain.hasElevationForLngLat(tr.center, tr)) {
                tr.setElevation(0);
                this.awaitsDem = true;
                changed = true;
            }
        }
        if (!this.awaitsDem) return changed;
        const elevation = terrain.getDrawnElevationForLngLat(tr.center, true);
        if (elevation !== undefined) {
            tr.setElevation(elevation);
            this.awaitsDem = false;
            return true;
        }
        const drawnElevation = terrain.getDrawnElevationForLngLat(tr.center);
        if (drawnElevation === undefined || drawnElevation <= tr.elevation) return changed;
        if (tr.getCameraAltitude() >= terrain.getElevationForLngLatZoom(tr.getCameraLngLat(), tr.zoom)) return changed;
        tr.setElevation(drawnElevation);
        return true;
    }
}

/**
 * Which of a movement's opening announcements continue an interrupted movement rather than beginning
 * a new one.
 */
type CurrentMovement = {
    moving?: boolean;
    zooming?: boolean;
    rotating?: boolean;
    pitching?: boolean;
    rolling?: boolean;
};

/**
 * The tiles a movement carrying a `preload` option should ask for, or `undefined` when it should ask
 * for none.
 *
 * @param preload - the movement's `preload` option, where `true` means the defaults
 */
function preloadOptionsOf(preload: boolean | PreloadTilesOptions | undefined): PreloadTilesOptions | undefined {
    if (!preload) return undefined;
    return preload === true ? {} : preload;
}

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

    /**
     * @internal
     * Loads the tiles a movement will need, ahead of the movement reaching them.
     */
    _preloader: TilePreloader;

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
        this._preloader = options.preloader;

        this.on('moveend', () => {
            delete this._requestedCameraState;
        });
    }

    /**
     * @internal
     * Hands the camera the map's terrain, or null when the map has none, and brings the center elevation up to date
     * with it, see {@link Camera.applyTerrainChange}. A hold that started without DEM data waits again when the
     * terrain changes to one without data under the center, see {@link ElevationHold.take}.
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
        this._preloader.cancel();
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
        this._preloader.cancel();
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

        const easeHandlerOptions: EaseToHandlerOptions = {
            bearing,
            pitch,
            roll,
            padding,
            around,
            aroundPoint,
            offsetAsPoint,
            offset: options.offset,
            zoom: options.zoom,
            center: options.center
        };
        const easeHandler = this.cameraHelper.handleEaseTo(tr, easeHandlerOptions);

        this._rotating ||= (startBearing !== bearing);
        this._pitching ||= (pitch !== startPitch);
        this._rolling ||= (roll !== startRoll);
        this._padding = !tr.isPaddingEqual(padding);
        this._zooming ||= easeHandler.isZooming;
        this._easeId = options.easeId;

        this._runMovement({
            transform: tr,
            duration: options.duration,
            easing: options.easing,
            freezeElevation: options.freezeElevation,
            elevationCenter: easeHandler.elevationCenter,
            at: this._easePath(easeHandlerOptions),
            applyElevation: this._applyMovementElevation.bind(this)
        }, eventData, options, {noMoveStart: options.noMoveStart, currently, namesInterruption: true});

        return this;
    }

    /**
     * @internal
     * Builds the walk a tile preload takes along an eased movement: the handler the animation itself
     * runs, built on a transform of the preload's own, so that the camera states it samples are the
     * ones the animation passes through.
     *
     * @param easeHandlerOptions - the options the animation built for its own handler
     */
    private _easePath(easeHandlerOptions: EaseToHandlerOptions): CameraMovement['at'] {
        return (tr) => {
            const easeHandler = this.cameraHelper.handleEaseTo(tr, easeHandlerOptions);
            return (k) => easeHandler.easeFunc(k);
        };
    }

    /**
     * @internal
     * Builds the walk a tile preload takes along a flight: the handler the animation itself runs, built
     * on a transform of the preload's own, taking the same per-frame step the animation takes.
     *
     * @param flyHandlerOptions - the options the animation built for its own handler
     * @param flyFrame - the frame step the animation applies, see {@link Camera.flyTo}
     */
    private _flyPath(flyHandlerOptions: FlyToHandlerOptions, arc: FlyToArc, setEulerAngles: (_: ITransform, __: number) => void): CameraMovement['at'] {
        return (tr) => {
            const flyHandler = this.cameraHelper.handleFlyTo(tr, flyHandlerOptions);
            const offsetAsPoint = flyHandlerOptions.offsetAsPoint;
            return (k) => {
                const {scale, centerFactor} = arc.at(k);
                setEulerAngles(tr, k);
                flyHandler.easeFunc(k, scale, centerFactor, tr.centerPoint.add(offsetAsPoint));
            };
        };
    }

    /**
     * Runs a camera movement, and hands the same movement to the tile preload so the tiles it will
     * need are on their way before it arrives.
     *
     * Everything a movement needs in order to be preloaded is decided here and nowhere else, so a
     * movement cannot be animated without the preload being told about it, and the preload cannot be
     * pointed at a path the animation is not taking.
     *
     * @param movement - the path to animate, and to read ahead of
     * @param eventData - what to attach to the movement's events
     * @param options - the movement's animation options, including `preload`
     * @param start - how the movement begins: whether it announces itself, which announcements
     *   continue an interrupted movement rather than beginning a new one, and whether its `moveend`
     *   names the movement that interrupted it
     */
    private _runMovement(movement: CameraMovement, eventData: any, options: AnimationOptions,
        start: {noMoveStart: boolean; currently: CurrentMovement; namesInterruption: boolean}): void {
        const {transform: tr} = movement;
        // Bound to the transform once: a camera handler remembers where its transform started, so
        // building a fresh one per frame would restart the movement's zoom from every frame's zoom.
        const step = movement.at(tr);

        this._prepareEase(eventData, start.noMoveStart, start.currently, {
            tr,
            center: movement.elevationCenter,
            freeze: movement.freezeElevation
        });

        // The movement's elevation endpoints have to exist before the preload can read the path, so
        // this is the first moment a preload could be told about this movement at all.
        const preload = preloadOptionsOf(options.preload);
        if (preload) this._preloader.start(movement, preload, this.terrain);

        this._ease((k) => {
            if (preload) this._preloader.advance(k);

            step(k);

            if (this.terrain && !movement.freezeElevation) this._updateElevation(k, tr);
            this.applyUpdatedTransform(tr);
            this._fireMoveEvents(eventData);
        }, (interruptingEaseId?: string) => {
            this._afterEase(eventData, start.namesInterruption ? interruptingEaseId : undefined, movement.freezeElevation);
        }, {...options, duration: movement.duration, easing: movement.easing});
    }

    /**
     * @param elevation - over terrain, the transform the animation edits, the map center it ends on, and whether
     * it holds the center elevation (`freezeElevation`) instead of easing it
     */
    _prepareEase(eventData: any, noMoveStart: boolean,
        currently: { moving?: boolean; zooming?: boolean; rotating?: boolean; pitching?: boolean; rolling?: boolean} = {},
        elevation?: {tr: ITransform; center: LngLat; freeze: boolean}): void {
        this._moving = true;
        if (this.terrain && elevation) {
            this._prepareElevation(elevation.center, elevation.tr);
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
     * samples the terrain under the map center the animation ends on.
     * @param center - the map center when the animation ends
     * @param tr - the transform the animation edits
     */
    _prepareElevation(center: LngLat, tr: ITransform): void {
        this._elevationCenter = center;
        this._elevationStart = tr.elevation;
        this._elevationTarget = this.terrain.getElevationForLngLat(center, tr);
        this.elevationFreeze = true;
    }

    /**
     * @internal
     * Eases the center elevation towards the terrain under `_elevationCenter`, on the transform the
     * animation edits, so that `applyUpdatedTransform` carries it to the rendered transform. A center
     * that is not clamped to the ground keeps its elevation.
     * @param k - the animation's progress, 0 to 1
     * @param tr - the transform the animation edits
     */
    _updateElevation(k: number, tr: ITransform): void {
        if (this._elevationStart === undefined || this._elevationCenter === undefined) {
            this._prepareElevation(tr.center, tr);
        }

        // target terrain updated during flight, slowly move camera to new height
        if (k < 1) {
            const elevation = this.terrain.getElevationForLngLat(this._elevationCenter, tr);
            if (elevation !== this._elevationTarget) {
                const pitch1 = this._elevationTarget - this._elevationStart;
                const pitch2 = (elevation - (pitch1 * k + this._elevationStart)) / (1 - k);
                this._elevationStart += k * (pitch1 - pitch2);
                this._elevationTarget = elevation;
            }
        }

        this._applyMovementElevation(tr, k);
    }

    /**
     * @internal
     * Puts `tr` at the center elevation, and the lowest tile elevation under the movement's target,
     * that the movement has reached at progress `k`.
     *
     * A camera's elevation decides which tiles cover it, so the animation and the preload that reads
     * ahead of it both run this. The one part of {@link Camera._updateElevation} they do not share is
     * the refinement above, which moves the movement's own elevation from one frame to the next and so
     * has no meaning outside the animation.
     *
     * @param tr - the camera state to apply the elevation to; the preload passes a transform of its own
     * @param k - the movement's progress, 0 to 1
     */
    _applyMovementElevation(tr: ITransform, k: number): void {
        if (!this.terrain || !this._elevationCenter) return;

        tr.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this._elevationCenter, tr.tileZoom));
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
        this._elevationHold = new ElevationHold(holder, startedWithoutDem);
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
            const cameraOptions = this._elevateCameraIfInsideTerrain(tr);
            if (cameraOptions.zoom !== undefined) tr.setZoom(cameraOptions.zoom);
            if (cameraOptions.pitch !== undefined) tr.setPitch(cameraOptions.pitch);
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
            const newCamera = tr.calculateCameraOptionsFromTo(cameraLngLat, minAltitude, tr.center, tr.elevation);
            return {
                pitch: newCamera.pitch,
                zoom: newCamera.zoom,
            };
        }
        return {};
    }

    /**
     * @internal
     * Called after the camera is done being manipulated; a hold on the center elevation takes DEM data that landed
     * first, see {@link ElevationHold.take}.
     * @param tr - the requested camera end state
     * If the camera is inside terrain, it gets elevated.
     * Call `transformCameraUpdate` if present, and then apply the "approved" changes.
     */
    applyUpdatedTransform(tr: ITransform): void {
        this._takeLandedElevation(tr);
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
        // The camera has arrived, so the tiles the preload was reading ahead for are the ones the
        // viewport itself covers now.
        this._preloader.finish();

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
        this._preloader.cancel();

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
            startBearing = tr.bearing,
            startPitch = tr.pitch,
            startRoll = tr.roll,
            startPadding = tr.padding;

        const bearing = options.bearing !== undefined ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = options.pitch !== undefined ? +options.pitch : startPitch;
        const roll = options.roll !== undefined ? this._normalizeBearing(options.roll, startRoll) : startRoll;
        const padding = (options.padding !== undefined ? options.padding : tr.padding) as PaddingOptions;

        const offsetAsPoint = Point.convert(options.offset);
        const locationAtOffset = tr.screenPointToLocation(tr.centerPoint.add(offsetAsPoint));

        const flyHandlerOptions: FlyToHandlerOptions = {
            bearing,
            pitch,
            roll,
            padding,
            locationAtOffset,
            offsetAsPoint,
            center: options.center,
            minZoom: options.minZoom,
            zoom: options.zoom
        };
        const flyToHandler = this.cameraHelper.handleFlyTo(tr, flyHandlerOptions);

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
        const rho = Math.min(options.curve, Math.sqrt(wMax / u1 * 2));

        const arc = createFlyToArc(w0, w1, u1, rho);
        // Perform a more or less instantaneous transition if the path is too short.
        if (!arc) return this.easeTo(options, eventData);

        if (options.duration !== undefined) {
            options.duration = +options.duration;
        } else {
            const V = options.screenSpeed !== undefined ? +options.screenSpeed / rho : +options.speed;
            options.duration = 1000 * arc.S / V;
        }

        if (options.maxDuration && options.duration > options.maxDuration) {
            options.duration = 0;
        }

        /**
         * The rotation and the padding at some point along the animation. Padding moves
         * `Transform.centerPoint` continuously, so the animation reads its offset point from it again
         * on every frame.
         */
        const setEulerAngles = (target: ITransform, k: number): void => {
            if (this._rotating) {
                target.setBearing(interpolates.number(startBearing, bearing, k));
            }
            if (this._pitching) {
                target.setPitch(interpolates.number(startPitch, pitch, k));
            }
            if (this._rolling) {
                target.setRoll(interpolates.number(startRoll, roll, k));
            }
            if (this._padding) {
                target.interpolatePadding(startPadding, padding, k);
            }
        };

        this._zooming = true;
        this._rotating = (startBearing !== bearing);
        this._pitching = (pitch !== startPitch);
        this._rolling = (roll !== startRoll);
        this._padding = !tr.isPaddingEqual(padding);

        this._runMovement({
            transform: tr,
            // A flight that does not animate is already at its destination, so there is no path to read.
            duration: options.animate === false ? 0 : options.duration,
            easing: options.easing,
            freezeElevation: options.freezeElevation,
            elevationCenter: flyToHandler.targetCenter,
            at: this._flyPath(flyHandlerOptions, arc, setEulerAngles),
            applyElevation: this._applyMovementElevation.bind(this)
        }, eventData, options, {noMoveStart: false, currently: {}, namesInterruption: false});

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
