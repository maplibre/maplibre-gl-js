import Point from '@mapbox/point-geometry';
import {vec3} from 'gl-matrix';
import {extend, wrap, defaultEasing, evaluateZoomSnap, lerp, scaleZoom, zoomScale} from '../util/util.ts';
import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import {browser} from '../util/browser.ts';
import {LngLat, earthRadius} from '../geo/lng_lat.ts';
import {LngLatBounds} from '../geo/lng_lat_bounds.ts';
import {Evented} from '../util/evented.ts';
import {MapMovementEvent} from './events.ts';
import {angularCoordinatesToSurfaceVector} from '../geo/projection/globe_utils.ts';
import {createCameraState, getBearing, getCenterPoint, getFov, getPitch, getRoll, isPaddingEqual} from '../geo/camera_state.ts';
import {createMercatorCameraProjection, usesGlobeControls, withGlobeness} from '../geo/projection/camera_projection.ts';
import * as cameraMath from '../geo/projection/camera_math.ts';
import * as cameraUpdates from '../geo/projection/camera_updates.ts';
import * as cameraSolvers from '../geo/projection/camera_solvers.ts';
import {sampleAt} from '../render/terrain_coverage.ts';
import {takeDrawnElevation} from './center_elevation.ts';
import {adjustCamera, combineActions, constrainCamera, createCameraStore, endMovement, proposeCamera, resizeCamera, setCenterElevationRule, setProjectionTransition, setProposedElevation, startMovement, terrainChanged} from './camera_store.ts';
import {CameraMovementScheduler} from './camera_movement_scheduler.ts';

import type {MapEventType} from './events.ts';
import type {Terrain} from '../render/terrain.ts';
import type {TransformConstrainFunction} from '../geo/camera_types.ts';
import type {CameraState} from '../geo/camera_state.ts';
import type {CameraMetrics, ProjectedCamera} from '../geo/projected_camera.ts';
import type {CameraContext} from '../geo/projection/camera_constrain.ts';
import type {CameraProjection} from '../geo/projection/camera_projection.ts';
import type {LngLatLike} from '../geo/lng_lat.ts';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';
import type {MapControlsDeltas} from '../geo/projection/camera_updates.ts';
import type {ElevationHolder} from './center_elevation.ts';
import type {CameraAction, CameraAdjustment, CameraStore, CameraStoreState} from './camera_store.ts';
import type {RenderLoop} from './camera_movement_scheduler.ts';

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

/** Pixels a rotation pivot keeps below the horizon, closer to which a pixel spans too much ground to hold it. */
const PIVOT_HORIZON_MARGIN_PX = 16;

/** How many times the zoom is corrected to reach a rotation pivot's distance. Mercator needs two, the globe a few more. */
const MAX_PIVOT_ZOOM_CORRECTIONS = 5;

/** The share of a rotation pivot's distance within which the camera counts as being at that distance. */
const PIVOT_DISTANCE_TOLERANCE = 1e-7;

/** The share of a rotation pivot's distance within which the ground under its screen point counts as the pivot, about a tenth of a pixel. */
const PIVOT_POINT_TOLERANCE = 1e-4;

/** The point a drag turns the camera around, with the screen point and the distance in meters from the camera it keeps. */
export type RotationPivot = {
    point: Point;
    location: LngLat;
    /** The elevation of a pivot on mercator terrain. Without it the pivot lies on the ground the transform unprojects to. */
    elevation?: number;
    distance: number;
};

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
    /**
     * @deprecated Has no effect, and will be removed in the next major version.
     */
    delayEndEvents?: number;
    /**
     * Dimensions in pixels applied on each side of the viewport for shifting the vanishing point, which the transition
     * animates to. The map keeps this padding once the transition ends.
     */
    padding?: number | PaddingOptions;
    /**
     * If `zoom` is specified, `around` determines the point around which the zoom is centered.
     */
    around?: LngLatLike;
    /**
     * @internal
     * An animation started with the `easeId` of the one running continues its movement instead of interrupting it, so
     * that no end and start events fire between the two, as for a key the keyboard handler sees held down.
     * @deprecated Set by MapLibre's own handlers and not meant for applications; it will be removed from this type in
     * the next major version.
     */
    easeId?: string;
    /**
     * @internal
     * Whether the animation continues a movement whose `movestart` someone else fired, such as the gesture whose
     * inertia it is.
     * @deprecated Set by MapLibre's own handlers and not meant for applications; it will be removed from this type in
     * the next major version.
     */
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
    /** The map's render loop, on which the camera runs each frame of an animation. */
    renderLoop: RenderLoop;
    transformCameraUpdate: CameraUpdateTransformFunction | null;
};

export class Camera extends Evented<MapEventType> {
    /** The projection the style moved the camera onto, see {@link Camera.migrateProjection}, at a globe's full transition. */
    private _projection: CameraProjection;
    /** The function the map was given to constrain the camera with instead of the projection's own, or null. */
    private _constrainOverride: TransformConstrainFunction | null;
    /**
     * The last context {@link Camera.context} built and the transition it was built at. It is kept so that the same
     * projection object is handed out while nothing it is built from changes: the projected camera is memoised by it.
     */
    private _contextAt: {projectionTransition: number; context: CameraContext} | null = null;

    /** The last camera {@link Camera.renderedState} derived and what it derived it from. */
    private _renderedFrom: {inputs: readonly unknown[]; rendered: CameraState} | null = null;

    /**
     * @internal
     * The camera the map is drawn with, derived from the camera's state and the terrain, see
     * {@link Camera._renderedFromProposal}. It is derived again only when something it is derived from changes.
     */
    get renderedState(): CameraState {
        const state = this._state;
        const inputs = [state.proposed, state.adjustment, state.terrainRevision, state.centerElevation, state.moving, this.context, this.terrain, this._centerClampedToGround];
        if (!this._renderedFrom || inputs.some((input, i) => input !== this._renderedFrom.inputs[i])) {
            this._renderedFrom = {inputs, rendered: this._renderedFromProposal()};
        }
        return this._renderedFrom.rendered;
    }

    /**
     * @internal
     * The camera the map is drawn with and what follows from it, see {@link CameraStoreState.rendered}.
     */
    get projectedCamera(): ProjectedCamera { return cameraMath.projectCamera(this.renderedState, this.context.projection); }

    /**
     * @internal
     * What the camera is projected and constrained with: its projection, at the transition the store holds, see
     * {@link CameraStoreState.projectionTransition}, and the constrain it was given.
     */
    get context(): CameraContext {
        const projectionTransition = this._state.projectionTransition;
        if (this._contextAt?.projectionTransition !== projectionTransition) {
            const projection = withGlobeness(this._projection, projectionTransition);
            this._contextAt = {projectionTransition, context: {projection, constrainOverride: this._constrainOverride}};
        }
        return this._contextAt.context;
    }

    /**
     * @internal
     * Copy of the map's `terrain` (which the `Map` owns).
     * The camera reads terrain for elevation handling but does not own it.
     */
    terrain: Terrain;

    /** Runs `easeTo`, `flyTo` and `jumpTo` and fires their movement events. */
    private readonly _scheduler: CameraMovementScheduler;

    _bearingSnap: number;
    _zoomSnap: number;

    /**
     * The camera's state, see {@link CameraStoreState}: the proposed camera and what the rendered camera is derived from
     * besides it. Only actions change it, see {@link Camera._onStateChange} for what follows a change.
     */
    private readonly _store: CameraStore;
    /** How many {@link Camera._batch} calls are under way, during which state changes render once, at the end. */
    private _batching = 0;
    /** Whether the state changed in a way that renders while {@link Camera._batch} held the render back. */
    private _changedInBatch = false;
    /**
     * The elevation of the camera last handed to a movement, see {@link Camera._proposedForUpdate}, which tells an
     * elevation the movement set apart from the one the proposed camera is drawn at.
     */
    private _elevationHandedOut: number;
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

    constructor(options: CameraInitOptions) {
        super();
        // The camera starts in mercator; the style moves it onto its own projection, see `migrateProjection`.
        this._projection = createMercatorCameraProjection();
        this._constrainOverride = options.transformConstrain ?? null;
        const context: CameraContext = {projection: this._projection, constrainOverride: this._constrainOverride};
        let state = createCameraState();
        if (options.minZoom !== undefined) state = cameraUpdates.setMinZoom(state, context, options.minZoom);
        if (options.maxZoom !== undefined) state = cameraUpdates.setMaxZoom(state, context, options.maxZoom);
        if (options.minPitch !== undefined) state = cameraUpdates.setMinPitch(state, options.minPitch);
        if (options.maxPitch !== undefined) state = cameraUpdates.setMaxPitch(state, options.maxPitch);
        if (options.renderWorldCopies !== undefined) state = cameraUpdates.setRenderWorldCopies(state, context.projection.worldCoordinateHelper, options.renderWorldCopies);
        this._elevationHandedOut = state.elevation;
        this._store = createCameraStore(state);
        this._store.subscribe(this._onStateChange);
        this._bearingSnap = options.bearingSnap;
        this._zoomSnap = options.zoomSnap;
        this.terrain = options.terrain;
        this._centerClampedToGround = options.centerClampedToGround ?? true;
        this.transformCameraUpdate = options.transformCameraUpdate ?? null;
        this._scheduler = new CameraMovementScheduler(options.renderLoop);
        this._scheduler.setEventedParent(this);

        this.on('moveend', () => {
            if (!this._scheduler.isMoving()) this._dispatch(endMovement(this.renderedState));
        });
    }

    /** The camera's state, see {@link CameraStoreState}. */
    private get _state(): CameraStoreState {
        return this._store.getState();
    }

    /** Changes the camera's state, see {@link CameraAction}. */
    private _dispatch(action: CameraAction): void {
        this._store.setState(action);
    }

    /**
     * Lets `transformCameraUpdate` adjust the camera after a change of the proposal, the elevation rule or the
     * terrain, see {@link Camera._adjustProposal}, or once at the end of a {@link Camera._batch}.
     */
    private readonly _onStateChange = (state: CameraStoreState, previous: CameraStoreState): void => {
        if (state.proposed === previous.proposed && state.centerElevation === previous.centerElevation && state.terrainRevision === previous.terrainRevision) return;
        if (this._batching) {
            this._changedInBatch = true;
            return;
        }
        this._adjustProposal();
    };

    /** Runs an update that dispatches several actions, adjusting the camera once at its end if they changed it. */
    private _batch(update: () => void): void {
        this._batching++;
        try {
            update();
        } finally {
            this._batching--;
        }
        if (this._batching) return;
        const changed = this._changedInBatch;
        this._changedInBatch = false;
        if (changed) this._adjustProposal();
    }

    /**
     * @internal
     * The proposed camera as the handlers read it, see {@link Camera._proposedAsDrawn}.
     */
    get proposedProjectedCamera(): ProjectedCamera {
        return this._projectState(this._proposedAsDrawn());
    }

    /**
     * @internal
     * A camera state projected in the camera's context, for reading a camera a movement is changing.
     */
    _projectState(state: CameraState): ProjectedCamera {
        return cameraMath.projectCamera(state, this.context.projection);
    }

    /** The values every projection derives from a camera state. */
    private _metricsOf(state: CameraState): CameraMetrics {
        return cameraMath.getCameraMetrics(state, this.context.projection.worldCoordinateHelper);
    }

    /**
     * @internal
     * Hands the camera the map's terrain, or null when the map has none, and brings the center elevation up to date
     * with it, see {@link Camera.applyTerrainChange}. A hold puts the center back at the 0 a new terrain gives it where
     * that terrain has no DEM data under the center yet, and waits for it.
     */
    setTerrain(terrain: Terrain): void {
        this.terrain = terrain;
        this._batch(() => {
            const hold = this._state.centerElevation;
            if (!terrain || hold.rule !== 'held' || !this.getCenterClampedToGround()) return;
            const projectedCamera = this.proposedProjectedCamera;
            if (terrain.getElevationAndDEMStateForLngLat(projectedCamera.center, projectedCamera.tileZoom).demState === 'loaded') return;
            this._dispatch(combineActions(setProposedElevation(0), setCenterElevationRule({...hold, dem: 'awaiting'})));
        });
        this.applyTerrainChange();
    }

    /**
     * @internal
     * Moves the camera onto a new projection, at its full transition until the next frame sets it, see
     * {@link Camera.prepareNextFrame}. The camera states are plain data and stay, constrained to the new projection.
     */
    migrateProjection(projection: CameraProjection): void {
        this._projection = projection;
        this._contextAt = null;
        this._batch(() => {
            this._dispatch(setProjectionTransition(projection.kind === 'globe' ? projection.globeness : 1));
            this._dispatch(constrainCamera(this.context));
        });
    }

    /**
     * @internal
     * Sets the function that constrains the camera instead of the projection's own, and constrains the camera with
     * it, see {@link Camera.applyStateChange}.
     */
    setConstrainOverride(constrain: TransformConstrainFunction | null): void {
        if (this._constrainOverride === constrain) return;
        this._constrainOverride = constrain;
        this._contextAt = null;
        this.applyStateChange(cameraUpdates.constrainState);
    }

    /**
     * @internal
     * Resizes the camera to the map's size.
     */
    resize(width: number, height: number, constrain: boolean): void {
        this._dispatch(resizeCamera(this.context, width, height, constrain));
    }

    /**
     * @internal
     * Prepares the camera for the next frame.
     * @param transition - how far the style's projection is between mercator, at 0, and globe, at 1
     */
    prepareNextFrame(transition: number): void {
        this._dispatch(setProjectionTransition(transition));
        const projection = this.context.projection;
        if (projection.kind !== 'globe') return;
        projection.verticalPerspective.coveringTilesDetailsProvider.prepareNextFrame();
        projection.mercator.coveringTilesDetailsProvider.prepareNextFrame();
    }

    getCenter(): LngLat { return new LngLat(this.renderedState.center.lng, this.renderedState.center.lat); }

    /** Returns the location drawn at a point on the screen, on the terrain's surface when the map has terrain. */
    unproject(point: PointLike): LngLat {
        return cameraMath.screenPointToLocation(this.projectedCamera, this.context.projection, Point.convert(point), this.terrain);
    }

    setCenter(center: LngLatLike, eventData?: Record<string, unknown>): this {
        return this.jumpTo({center}, eventData);
    }

    getCenterElevation(): number { return this.renderedState.elevation; }

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
        return this.panTo(this.renderedState.center, extend({offset}, options), eventData);
    }

    panTo(lnglat: LngLatLike, options?: EaseToOptions, eventData?: any): this {
        return this.easeTo(extend({
            center: lnglat
        }, options), eventData);
    }

    getZoom(): number { return this.renderedState.zoom; }

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

    getVerticalFieldOfView(): number { return getFov(this.renderedState); }

    setVerticalFieldOfView(fov: number, eventData?: any): this {
        if (fov != this.getVerticalFieldOfView()) {
            this.applyStateChange(state => cameraUpdates.setFov(state, fov));
            this.fire(new MapMovementEvent('movestart', eventData))
                .fire(new MapMovementEvent('move', eventData))
                .fire(new MapMovementEvent('moveend', eventData));
        }
        return this;
    }

    getBearing(): number { return getBearing(this.renderedState); }

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

    getPadding(): PaddingOptions { return {...this.renderedState.padding}; }

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

    getPitch(): number { return getPitch(this.renderedState); }

    setPitch(pitch: number, eventData?: any): this {
        this.jumpTo({pitch}, eventData);
        return this;
    }

    getRoll(): number { return getRoll(this.renderedState); }

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
            maxZoom: this.renderedState.maxZoom
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
        const bounds = new LngLatBounds(p0, p1);

        const noPadding = {top: 0, bottom: 0, right: 0, left: 0};
        const fitPadding = options.absolutePadding ? noPadding : padding;
        const mapPadding = options.absolutePadding ? padding : extend(noPadding, this.renderedState.padding) as PaddingOptions;

        const result = cameraUpdates.cameraForBoxAndBearing(options, fitPadding, mapPadding, bounds, bearing, this.renderedState, this.context);
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
                cameraMath.screenPointToLocation(this.projectedCamera, this.context.projection, Point.convert(p0)),
                cameraMath.screenPointToLocation(this.projectedCamera, this.context.projection, Point.convert(p1)),
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
        this._scheduler.interrupt();

        if (options.zoom !== undefined && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        let state = this.getStateForUpdate();
        const context = this.context;

        const oldZoom = state.zoom;
        if (this.terrain && this.getCenterClampedToGround()) {
            const center = options.center ? LngLat.convert(options.center) : state.center;
            const {elevation, demState} = this.terrain.getElevationAndDEMStateForLngLat(center, this._metricsOf(state).tileZoom);
            if (demState !== 'loading') state = cameraUpdates.setElevation(state, context, elevation);
        }
        state = cameraUpdates.jumpToCenterZoom(state, context, options);

        const zoomChanged = state.zoom !== oldZoom;
        const bearingChanged = options.bearing !== undefined && getBearing(state) !== +options.bearing;
        const pitchChanged = options.pitch !== undefined && getPitch(state) !== +options.pitch;
        const rollChanged = options.roll !== undefined && getRoll(state) !== +options.roll;

        if (options.elevation !== undefined && state.elevation !== +options.elevation) {
            state = cameraUpdates.setElevation(state, context, +options.elevation);
        }
        if (bearingChanged) state = cameraUpdates.setBearing(state, +options.bearing);
        if (pitchChanged) state = cameraUpdates.setPitch(state, +options.pitch);
        if (rollChanged) state = cameraUpdates.setRoll(state, +options.roll);
        if (options.padding != null && !isPaddingEqual(state.padding, options.padding)) {
            state = cameraUpdates.setPadding(state, context, options.padding);
        }
        this.applyUpdatedState(state);

        const events = [
            new MapMovementEvent('movestart', eventData),
            new MapMovementEvent('move', eventData)
        ];

        if (zoomChanged) {
            events.push(
                new MapMovementEvent('zoomstart', eventData),
                new MapMovementEvent('zoom', eventData),
                new MapMovementEvent('zoomend', eventData));
        }

        if (bearingChanged) {
            events.push(
                new MapMovementEvent('rotatestart', eventData),
                new MapMovementEvent('rotate', eventData),
                new MapMovementEvent('rotateend', eventData));
        }

        if (pitchChanged) {
            events.push(
                new MapMovementEvent('pitchstart', eventData),
                new MapMovementEvent('pitch', eventData),
                new MapMovementEvent('pitchend', eventData));
        }

        if (rollChanged) {
            events.push(
                new MapMovementEvent('rollstart', eventData),
                new MapMovementEvent('roll', eventData),
                new MapMovementEvent('rollend', eventData));
        }

        events.push(new MapMovementEvent('moveend', eventData));
        this._scheduler.fireAfterQueued(events);
        return this;
    }

    /**
     * Calculates camera options for moving a geographic anchor to a screen point without
     * changing this camera.
     */
    calculateAnchoredCameraOptions(options: AnchoredCameraOptions): CameraOptions {
        const projectedCamera = this.projectedCamera;
        const anchor = LngLat.convert(options.anchorLocation);
        const target = Point.convert(options.anchorScreenPoint);
        const deltas: MapControlsDeltas = {
            panDelta: target.sub(cameraMath.locationToScreenPoint(projectedCamera, this.context.projection, anchor, this.terrain)),
            zoomDelta: options.zoom === undefined ? 0 : options.zoom - projectedCamera.zoom,
            bearingDelta: 0,
            pitchDelta: 0,
            rollDelta: 0,
            around: target,
            aroundElevation: this.terrain?.getElevationForLngLat(anchor, projectedCamera.tileZoom)
        };
        const zoomed = cameraUpdates.rollPitchBearingZoom(this.renderedState, this.context, deltas);
        const anchored = cameraUpdates.pan(zoomed, this.context, deltas, anchor);

        return {
            center: anchored.center,
            zoom: anchored.zoom
        };
    }

    calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat: LngLatLike, cameraAlt: number, bearing: number, pitch: number, roll?: number): CameraOptions {
        const centerInfo = cameraUpdates.calculateCenterFromCameraLngLatAlt(this.renderedState, this.context.projection.worldCoordinateHelper, cameraLngLat, cameraAlt, bearing, pitch);
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
        if (!this._scheduler.isContinuedBy(options.easeId)) this._scheduler.interrupt();

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

        const state = this.getStateForUpdate();
        const startBearing = this.getBearing(),
            startPitch = getPitch(state),
            startRoll = getRoll(state),
            bearing = options.bearing !== undefined ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = options.pitch !== undefined ? +options.pitch : startPitch,
            roll = options.roll !== undefined ? this._normalizeBearing(options.roll, startRoll) : startRoll,
            padding = (options.padding !== undefined ? options.padding : state.padding) as PaddingOptions;
        const offsetAsPoint = Point.convert(options.offset);

        let around, aroundPoint;

        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = cameraMath.locationToScreenPoint(this._projectState(state), this.context.projection, around);
        }

        const easeMotion = cameraUpdates.easeTo(state, this.context, {
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

        const elevationHandler = this._createElevationEase(state, easeMotion.elevationCenter, options.freezeElevation);

        this._scheduler.scheduleSegment({
            onFrame: (k) => {
                const frame = easeMotion.easeFunc(this._proposedForUpdate(), this.context, k);
                this.applyUpdatedState(elevationHandler.easeFunc(frame, k));
            },
            onFinish: () => this._finishAnimationElevation(options.freezeElevation)
        }, {
            duration: options.duration,
            easing: options.easing,
            axes: {zoom: easeMotion.isZooming, rotate: startBearing !== bearing, pitch: pitch !== startPitch, roll: roll !== startRoll},
            eventData,
            easeId: options.easeId,
            movestartFired: options.noMoveStart
        });

        return this;
    }

    /**
     * Creates the handler of the center elevation for an animation, whose `easeFunc` each frame calls after the camera
     * helper's, and starts the animation's hold on the elevation when it has one.
     *
     * Over terrain the animation either holds the center elevation, with `freezeElevation`, or eases it to the
     * terrain under the center it ends on. Terrain that is added while an easing animation runs is eased to from the
     * center the animation has reached by then.
     * @param start - the camera the animation starts from
     * @param center - the map center the animation ends on
     * @param freeze - whether the animation holds the center elevation instead of easing it
     */
    private _createElevationEase(start: CameraState, center: LngLat, freeze: boolean): {easeFunc: (state: CameraState, k: number) => CameraState} {
        if (freeze) {
            if (this.terrain) this.holdElevation('animation');
            return {easeFunc: state => state};
        }

        let easing = this.terrain ? this._startElevationEasing(center, start) : null;
        return {
            easeFunc: (state, k) => {
                if (!this.terrain) return state;
                easing ??= this._startElevationEasing(state.center, state);
                return easing(state, k);
            }
        };
    }

    /**
     * Starts easing the center elevation towards the terrain under `center` and returns what each frame of the
     * animation does to it, under the `eased` rule, see {@link CenterElevationRule}.
     *
     * The ease follows a straight line from the elevation it starts at to the terrain elevation under `center`. DEM
     * tiles that land during the animation move that target, and the line is then turned about the elevation reached
     * so far, so the camera carries on towards the new target without a jump. While the DEM data under `center` is
     * still loading, the target stays where it is. A center that is not clamped to the ground keeps its elevation.
     * @param center - the map center the animation ends on
     * @param start - the camera the easing starts from
     */
    private _startElevationEasing(center: LngLat, start: CameraState): (state: CameraState, k: number) => CameraState {
        this._dispatch(setCenterElevationRule({rule: 'eased'}));
        const tileZoom = this._metricsOf(start).tileZoom;
        const atStart = this.terrain.getElevationAndDEMStateForLngLat(center, tileZoom);
        let from = start.elevation;
        let target = atStart.demState === 'loading' ? start.elevation : atStart.elevation;

        return (state, k) => {
            const {elevation, demState} = this.terrain.getElevationAndDEMStateForLngLat(center, tileZoom);
            if (k < 1 && demState !== 'loading' && elevation !== target) {
                const reached = interpolates.number(from, target, k);
                const slope = (elevation - reached) / (1 - k);
                from = reached - k * slope;
                target = elevation;
            }
            if (!this.getCenterClampedToGround()) return state;
            return cameraUpdates.setElevation(state, this.context, interpolates.number(from, target, k));
        };
    }

    /**
     * @internal
     * Holds the center elevation for a gesture or an animation with `freezeElevation`, see {@link HeldCenterElevation}.
     * A hold that starts without DEM data under a center clamped to the ground waits for it, see
     * {@link takeDrawnElevation}.
     * @param holder - who holds it
     */
    holdElevation(holder: ElevationHolder): void {
        const projectedCamera = this.proposedProjectedCamera;
        const startedWithoutDem = !!this.terrain && this.getCenterClampedToGround() && this.terrain.getElevationAndDEMStateForLngLat(projectedCamera.center, projectedCamera.tileZoom).demState !== 'loaded';
        const terrainAboveMaxZoomForCenter = this.terrain ? this._terrainHeightAboveMaxZoomForCenter(projectedCamera) : undefined;
        this._dispatch(setCenterElevationRule({
            rule: 'held',
            holder,
            dem: startedWithoutDem ? 'awaiting' : 'loaded',
            keepsTerrainBelowMaxZoomForCenter: terrainAboveMaxZoomForCenter !== undefined && terrainAboveMaxZoomForCenter <= MAX_ZOOM_FOR_CENTER_TOLERANCE_M
        }));
    }

    /**
     * @internal
     * Whether a movement holds the center elevation, see {@link Camera.holdElevation}.
     */
    isHoldingElevation(): boolean {
        return this._state.centerElevation.rule === 'held';
    }

    /**
     * @internal
     * Ends a hold on the center elevation and puts the center back onto the terrain, see
     * {@link Camera.putCenterBackOnTerrain}, or onto sea level without terrain, with the center clamped to the ground.
     */
    releaseElevation(): void {
        const hold = this._state.centerElevation;
        if (hold.rule !== 'held') return;
        this._batch(() => {
            let state = this.getStateForUpdate();
            this._dispatch(setCenterElevationRule({rule: 'ground'}));
            if (this.getCenterClampedToGround()) {
                state = this.terrain ?
                    this.putCenterBackOnTerrain(state, this.terrain, hold.dem === 'taken') :
                    cameraUpdates.setElevation(state, this.context, 0);
            }
            this.applyUpdatedState(state);
        });
    }

    /**
     * @internal
     * Puts the center back onto the terrain at the end of a hold, re-solving zoom and center with the camera in place.
     * After a hold that took DEM data, a center over a tile without its own DEM data yet keeps the zoom and takes the
     * drawn elevation instead, with the camera check keeping the camera out of the terrain.
     * @param state - the camera the end starts from
     * @param terrain - the terrain the gesture or animation ends over
     * @param tookDem - whether the hold carried an elevation it took from DEM data, see {@link DEMHoldState}
     * @returns the camera with its center on the terrain
     */
    putCenterBackOnTerrain(state: CameraState, terrain: Terrain, tookDem: boolean): CameraState {
        if (!tookDem || terrain.getDrawnElevationForLngLat(state.center, true) !== undefined) {
            return cameraSolvers.recenterOnTerrain(state, this.context, terrain);
        }
        const elevation = terrain.getElevationForLngLat(state.center, this._metricsOf(state).tileZoom);
        return this._raiseCameraByPitchAndZoom(cameraUpdates.setElevation(state, this.context, elevation));
    }

    /**
     * @internal
     * Applies a change of the terrain under the center (terrain set or removed, a DEM tile landed): the proposed
     * center elevation follows the terrain by its rule, see {@link Camera._followTerrainByRule}, and the camera is
     * rendered again. Without terrain the center is drawn at sea level, see {@link Camera._drawnElevation}.
     */
    applyTerrainChange(): void {
        this._batch(() => {
            this._dispatch(terrainChanged());
            this._followTerrainByRule();
        });
    }

    /**
     * @internal
     * Brings the camera up to date with the terrain on a rendered frame. At rest the center follows the terrain under
     * it; while a movement runs only the lowest elevation of the tile under the rendered center is updated, the
     * movement's frames and the terrain changes rendering the rest.
     */
    followTerrain(): void {
        const rendered = this.renderedState;
        const terrainChangedUnderCenter = this._minElevationUnder(rendered) !== rendered.minElevationForCurrentTile;
        this._batch(() => {
            if (terrainChangedUnderCenter) this._dispatch(terrainChanged());
            if (!this._state.moving) this._followTerrainByRule();
        });
    }

    /**
     * Lets the proposed center elevation follow the terrain by its rule, see {@link CenterElevationRule}: on the
     * `ground` it takes the terrain elevation under the center unless the DEM data there is still loading, or 0
     * without terrain; a hold takes the DEM data it waits for, see {@link takeDrawnElevation}, and finds out when the
     * terrain is below where the center would sit at maxZoom.
     */
    private _followTerrainByRule(): void {
        if (!this.getCenterClampedToGround()) return;
        const rule = this._state.centerElevation;
        if (rule.rule === 'eased') return;
        if (!this.terrain) {
            if (rule.rule === 'ground') this._dispatch(setProposedElevation(0));
            return;
        }
        const projectedCamera = this.proposedProjectedCamera;
        if (rule.rule === 'ground') {
            const {elevation, demState} = this.terrain.getElevationAndDEMStateForLngLat(projectedCamera.center, projectedCamera.tileZoom);
            if (demState !== 'loading') this._dispatch(setProposedElevation(elevation));
            return;
        }
        const taken = takeDrawnElevation(rule, projectedCamera.center, this.terrain);
        if (taken) this._dispatch(combineActions(setCenterElevationRule(taken.hold), setProposedElevation(taken.elevation)));
        this._noteTerrainBelowMaxZoomForCenter();
    }

    /** Lets a hold keep the drawn terrain below where the center would sit at maxZoom from the first time it is, see {@link HeldCenterElevation.keepsTerrainBelowMaxZoomForCenter}. */
    private _noteTerrainBelowMaxZoomForCenter(): void {
        const hold = this._state.centerElevation;
        if (hold.rule !== 'held' || hold.keepsTerrainBelowMaxZoomForCenter) return;
        const projectedCamera = this.proposedProjectedCamera;
        if (projectedCamera.pitch >= 90 || cameraMath.getClippingPlane(projectedCamera)) return;
        const terrainAboveMaxZoomForCenter = this._terrainHeightAboveMaxZoomForCenter(projectedCamera);
        if (terrainAboveMaxZoomForCenter !== undefined && terrainAboveMaxZoomForCenter <= MAX_ZOOM_FOR_CENTER_TOLERANCE_M) {
            this._dispatch(setCenterElevationRule({...hold, keepsTerrainBelowMaxZoomForCenter: true}));
        }
    }

    /** The lowest elevation of the terrain tile under a camera's center, or 0 without terrain. */
    private _minElevationUnder(state: CameraState): number {
        return this.terrain ? this.terrain.getMinTileElevationForLngLatZoom(state.center, this._metricsOf(state).tileZoom) : 0;
    }

    /**
     * The proposed camera at the elevation its center is drawn at, see {@link Camera._drawnElevation}, and with the
     * lowest elevation of the terrain tile under it.
     */
    private _proposedAsDrawn(): CameraState {
        const proposed = this._state.proposed;
        const state = cameraUpdates.setMinElevationForCurrentTile(proposed, this._minElevationUnder(proposed));
        const elevation = this._drawnElevation(state);
        return elevation === state.elevation ? state : cameraUpdates.setElevation(state, this.context, elevation);
    }

    /**
     * The proposed camera for a movement to change, see {@link Camera._proposedAsDrawn}, remembering the elevation it was loaded
     * with, which {@link Camera.applyUpdatedState} tells a movement's own change of elevation apart from.
     */
    private _proposedForUpdate(): CameraState {
        const state = this._proposedAsDrawn();
        this._elevationHandedOut = state.elevation;
        return state;
    }

    /**
     * The elevation the proposed center is drawn at: sea level without terrain under a center clamped to the ground,
     * and a held elevation lifted just far enough to keep the camera out of the terrain. While a gesture or an
     * animation holds the center elevation over mercator terrain, below a pitch of 90 degrees, the lift keeps the drawn
     * terrain below where the center would sit at maxZoom once the hold keeps it there, see
     * {@link HeldCenterElevation.keepsTerrainBelowMaxZoomForCenter}, so the end does not move the camera back. A
     * gesture's lift also keeps the camera and its near clipping plane above the terrain, so its pitch and zoom stay
     * where the user puts them; the camera of an animation, and of any movement without a hold, is kept above the
     * terrain by {@link Camera._raiseCameraByPitchAndZoom} instead. The lift is a function of the proposed camera
     * and the terrain, so it is lowered again as soon as the terrain allows.
     * @param state - the proposed camera
     */
    private _drawnElevation(state: CameraState): number {
        if (!this.getCenterClampedToGround()) return state.elevation;
        if (!this.terrain) return 0;
        const hold = this._state.centerElevation;
        if (hold.rule !== 'held' || getPitch(state) >= 90) return state.elevation;
        const projectedCamera = this._projectState(state);
        if (cameraMath.getClippingPlane(projectedCamera)) return state.elevation;
        const terrainAboveMaxZoomForCenter = hold.keepsTerrainBelowMaxZoomForCenter ? this._terrainHeightAboveMaxZoomForCenter(projectedCamera) : undefined;
        const heightForMaxZoom = terrainAboveMaxZoomForCenter ?? -Infinity;
        const heightForCamera = hold.holder === 'gesture' ? this._terrainHeightAboveCamera(projectedCamera) : -Infinity;
        return state.elevation + Math.max(0, heightForCamera, heightForMaxZoom);
    }

    /**
     * Whether the rendered camera keeps the camera out of the terrain by its held elevation alone, which a gesture's
     * hold lifts, see {@link Camera._drawnElevation}, so that its pitch and zoom stay where the user puts them.
     */
    private _isLiftedByHold(state: CameraState): boolean {
        const hold = this._state.centerElevation;
        return !!this.terrain && hold.rule === 'held' && hold.holder === 'gesture' && this.getCenterClampedToGround() && getPitch(state) < 90 && !cameraMath.getClippingPlane(this._projectState(state));
    }

    /**
     * @internal
     * Starts or continues a movement, and returns the proposed camera for it to change, see
     * {@link Camera._proposedForUpdate}. The movement hands the camera it changed it into to {@link Camera.applyUpdatedState}.
     */
    getStateForUpdate(): CameraState {
        this._dispatch(startMovement());
        return this._proposedForUpdate();
    }

    /**
     * @internal
     * Where the camera is inside the terrain, re-solves pitch and zoom so the camera sits above it at the same ground
     * position, still looking at the same center at the same elevation; over mercator terrain high enough that its near
     * clipping plane clears the terrain too. Without terrain the camera is kept above sea level, which only needs
     * checking where the center elevation is negative or the pitch passes 90 degrees. On a globe the camera is left
     * where it is.
     * @param state - the camera to check
     * @returns `state` while the camera is clear, else the corrected camera
     */
    _raiseCameraByPitchAndZoom(state: CameraState): CameraState {
        const projectedCamera = this._projectState(state);
        if ((!this.terrain && state.elevation >= 0 && projectedCamera.pitch <= 90) || cameraMath.getClippingPlane(projectedCamera)) {
            return state;
        }
        const cameraLngLat = cameraMath.getCameraLngLat(projectedCamera, this.context.projection);
        let height = this._heightAboveCamera(projectedCamera);
        if (height <= 0) {
            return state;
        }
        let corrected = state;
        for (let pass = 0; pass < MAX_CAMERA_RAISES && height > 0; pass++) {
            const altitude = cameraMath.getCameraAltitude(this._projectState(corrected));
            const {zoom, pitch} = cameraSolvers.calculateCameraOptionsFromTo(corrected, this.context.projection, cameraLngLat, altitude + height, corrected.center, corrected.elevation);
            corrected = cameraUpdates.setPitch(cameraUpdates.setZoom(corrected, this.context, zoom), pitch);
            height = this._heightAboveCamera(this._projectState(corrected));
        }
        return corrected;
    }

    /** How far the terrain, or without terrain sea level, reaches above the camera, see {@link Camera._terrainHeightAboveCamera}. */
    private _heightAboveCamera(projectedCamera: ProjectedCamera): number {
        return this.terrain ? this._terrainHeightAboveCamera(projectedCamera) : -cameraMath.getCameraAltitude(projectedCamera);
    }

    /**
     * @internal
     * How far the terrain reaches above the camera, or the drawn terrain above one of nine points spread over its
     * near clipping plane, in meters, whichever is more; zero or less while all are clear. The renderer drops whatever
     * is nearer than that plane, so terrain reaching above it would show as a hole into the ground. The points are a
     * 3 by 3 grid weighted bilinearly over the plane's four corners, the frustum's first four points in order around
     * the plane. The plane is checked on mercator only, where the frustum is in mercator coordinates.
     * @param projectedCamera - the camera whose camera is checked
     */
    _terrainHeightAboveCamera(projectedCamera: ProjectedCamera): number {
        let height = this.terrain.getElevationForLngLat(cameraMath.getCameraLngLat(projectedCamera, this.context.projection), projectedCamera.tileZoom) - cameraMath.getCameraAltitude(projectedCamera);
        const index = cameraMath.getClippingPlane(projectedCamera) ? null : this.terrain.getCoverageIndex();
        if (!index) {
            return height;
        }
        const [p0, p1, p2, p3] = cameraMath.getCameraFrustum(projectedCamera).points;
        for (let row = 0; row <= 2; row++) {
            const v = row / 2;
            for (let column = 0; column <= 2; column++) {
                const u = column / 2;
                const w0 = (1 - u) * (1 - v), w1 = u * (1 - v), w2 = u * v, w3 = (1 - u) * v;
                const x = w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0];
                const y = w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1];
                const altitude = w0 * p0[2] + w1 * p1[2] + w2 * p2[2] + w3 * p3[2];
                const sample = sampleAt(index, this.terrain.exaggeration, x, y, this.context.projection.worldCoordinateHelper.wraps);
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
     * @param projectedCamera - the camera whose center ray is checked
     */
    _terrainHeightAboveMaxZoomForCenter(projectedCamera: ProjectedCamera): number | undefined {
        const index = this.terrain.getCoverageIndex();
        if (!index) {
            return undefined;
        }
        const worldCoordinateHelper = this.context.projection.worldCoordinateHelper;
        const cameraLngLat = cameraMath.getCameraLngLat(projectedCamera, this.context.projection);
        const camera = worldCoordinateHelper.worldFromLngLat(cameraLngLat.lng, cameraLngLat.lat);
        const center = worldCoordinateHelper.worldFromLngLat(projectedCamera.center.lng, projectedCamera.center.lat);
        const distanceFractionAtMaxZoom = zoomScale(projectedCamera.zoom - projectedCamera.maxZoom);
        const sample = sampleAt(index, this.terrain.exaggeration, lerp(camera.x, center.x, distanceFractionAtMaxZoom), lerp(camera.y, center.y, distanceFractionAtMaxZoom), worldCoordinateHelper.wraps);
        return sample.covered ? sample.elevation - lerp(cameraMath.getCameraAltitude(projectedCamera), projectedCamera.elevation, distanceFractionAtMaxZoom) : undefined;
    }

    /**
     * @internal
     * Moves the center a zoom gesture holds onto the terrain the camera looks at and draws, with the camera where it
     * is, so a zoom toward rising terrain slows down before it instead of running into it. Farther terrain is followed
     * only by less than the frame zooms in, so the zoom keeps going in and speeds up gradually; a center ray that slips
     * over a crest onto terrain far behind it, and terrain so near that the zoom passes maxZoom, which would move the
     * camera back, are left to the gesture's end, as is everything with the center not clamped to the ground, and a
     * globe.
     * @param state - the proposed camera, see {@link Camera.getStateForUpdate}
     * @param zoomDelta - how far the frame zooms in
     * @returns the camera with its center on the terrain, or `state` where it stays
     */
    moveCenterOntoTerrain(state: CameraState, zoomDelta: number): CameraState {
        if (!this.terrain || !this.getCenterClampedToGround() || cameraMath.getClippingPlane(this._projectState(state))) {
            return state;
        }
        const moved = cameraSolvers.recenterOnTerrain(state, this.context, this.terrain);
        const keepsZoomingIn = moved.zoom > state.zoom - zoomDelta && moved.zoom < moved.maxZoom;
        if (!keepsZoomingIn) return state;
        const terrainElevation = this.terrain.getElevationForLngLat(moved.center, this._metricsOf(moved).tileZoom);
        return Math.abs(terrainElevation - moved.elevation) < MAX_CENTER_OFF_TERRAIN_M ? moved : state;
    }

    /**
     * @internal
     * Picks the point a drag turns the camera around, the terrain under the point, or the ground without terrain there,
     * and the center for a point in the sky. On the globe, which holds no location at an elevation, a pivot on terrain
     * is held by the planet's surface under it.
     * @param projectedCamera - the camera the drag starts from
     * @param point - the screen point the drag starts at
     */
    captureRotationPivot(projectedCamera: ProjectedCamera, point: Point): RotationPivot {
        if (!isBelowHorizon(projectedCamera, this.context.projection, point)) {
            return {point: projectedCamera.centerPoint, location: projectedCamera.center, distance: distanceFromCamera(projectedCamera, this.context.projection, projectedCamera.center)};
        }
        const hit = this.terrain ? cameraMath.screenTerrainPointToMercatorCoordinate(projectedCamera, this.context.projection, point, this.terrain) : null;
        const location = hit ? hit.toLngLat() : cameraMath.screenPointToLocation(projectedCamera, this.context.projection, point);
        if (hit && usesGlobeControls(this.context.projection)) {
            return {point: cameraMath.locationToScreenPoint(projectedCamera, this.context.projection, location), location, distance: distanceFromCamera(projectedCamera, this.context.projection, location)};
        }
        return {point, location, elevation: hit?.z, distance: distanceFromCamera(projectedCamera, this.context.projection, location, hit?.z)};
    }

    /**
     * @internal
     * Turns the camera around a pivot, keeping only the change of bearing where the tilt would bring the pivot close to
     * the horizon. A pivot at the center turns the camera in place, without that limit.
     * @param state - the proposed camera, see {@link Camera.getStateForUpdate}
     * @param pivot - the pivot, see {@link Camera.captureRotationPivot}
     * @param deltas - the frame's change of bearing, pitch and roll
     * @returns the turned camera, and whether the pivot was held: it cannot be where the camera would have to pass a
     * pole of the globe, which turns the camera in place
     */
    orbitRotationPivot(state: CameraState, pivot: RotationPivot, deltas: MapControlsDeltas): {state: CameraState; held: boolean} {
        if (pivot.point.equals(getCenterPoint(state))) {
            return {state: cameraUpdates.rollPitchBearingZoom(state, this.context, deltas), held: true};
        }
        const turned = this._turnAroundPivot(state, pivot, deltas) ?? this._turnAroundPivot(state, pivot, {...deltas, pitchDelta: 0, rollDelta: 0});
        if (!turned) {
            return {state: cameraUpdates.rollPitchBearingZoom(state, this.context, deltas), held: false};
        }
        return {state: turned, held: true};
    }

    /**
     * @internal
     * Returns the camera turned around the pivot, or null where that would make it look up, bring the pivot close to the
     * horizon or lose it.
     */
    _turnAroundPivot(start: CameraState, pivot: RotationPivot, deltas: MapControlsDeltas): CameraState | null {
        const turned = cameraUpdates.rollPitchBearingZoom(start, this.context, deltas);
        if (getPitch(turned) >= 90 || !isBelowHorizon(this._projectState(turned), this.context.projection, pivot.point)) return null;
        const held = holdPivot(turned, this.context, pivot);
        return held && isAtScreenPoint(this._projectState(held), this.context.projection, pivot) ? held : null;
    }

    /**
     * @internal
     * Takes the camera a movement changed the one from {@link Camera.getStateForUpdate} into as the proposed camera,
     * and renders it. An elevation the movement left where the camera was loaded with it stays the proposed one, which
     * it was drawn from, see {@link Camera._proposedForUpdate}. The center elevation then follows the terrain by its rule.
     * @param state - the camera the movement changed it into
     */
    applyUpdatedState(state: CameraState): void {
        this._batch(() => {
            this._dispatch(proposeCamera(state.elevation === this._elevationHandedOut ? {...state, elevation: this._state.proposed.elevation} : state));
            this._followTerrainByRule();
        });
    }

    /**
     * @internal
     * Applies a change that is not itself a movement, such as new bounds, limits or field of view, the way any camera
     * update is applied. At rest the change ends there, see {@link endMovement}.
     */
    applyStateChange(change: (state: CameraState, context: CameraContext) => CameraState): void {
        const moving = this._state.moving;
        this.applyUpdatedState(change(this.getStateForUpdate(), this.context));
        if (!moving) this._dispatch(endMovement(this.renderedState));
    }

    /**
     * The camera the map is drawn with: the proposed camera at the elevation its center is drawn at, see
     * {@link Camera._proposedAsDrawn}. While a movement runs, it is kept out of the terrain, see
     * {@link Camera._correctedForMovement}, and takes the adjustment `transformCameraUpdate` made, see
     * {@link CameraStoreState.adjustment}.
     */
    private _renderedFromProposal(): CameraState {
        const drawn = this._proposedAsDrawn();
        if (!this._state.moving) return drawn;
        const corrected = this._correctedForMovement(drawn);
        const adjustment = this._state.adjustment;
        if (!adjustment) return corrected;
        const adjusted = this._applyAdjustment(corrected, adjustment);
        return cameraUpdates.setMinElevationForCurrentTile(adjusted, this._minElevationUnder(adjusted));
    }

    /**
     * A movement's camera kept out of the terrain: by a gesture's lift, see {@link Camera._isLiftedByHold}, or by
     * {@link Camera._raiseCameraByPitchAndZoom}.
     */
    private _correctedForMovement(drawn: CameraState): CameraState {
        return this._isLiftedByHold(drawn) ? drawn : this._raiseCameraByPitchAndZoom(drawn);
    }

    /**
     * Lets `transformCameraUpdate` adjust the camera a movement draws: it is shown the proposal as the movement corrects
     * it, and what it returns is kept as the adjustment, see {@link CameraStoreState.adjustment}. At rest, and without
     * the callback, there is no adjustment.
     */
    private _adjustProposal(): void {
        if (!this._state.moving || !this.transformCameraUpdate) {
            this._dispatch(adjustCamera(null));
            return;
        }
        const corrected = this._correctedForMovement(this._proposedAsDrawn());
        this._dispatch(adjustCamera(this.transformCameraUpdate(this._metricsOf(corrected))));
    }

    /** The camera with an adjustment applied, kept out of the terrain where the adjustment sets the elevation. */
    private _applyAdjustment(camera: CameraState, {center, zoom, roll, pitch, bearing, elevation}: CameraAdjustment): CameraState {
        const context = this.context;
        let adjusted = camera;
        if (center) adjusted = cameraUpdates.setCenter(adjusted, context, center);
        if (elevation !== undefined) adjusted = cameraUpdates.setElevation(adjusted, context, elevation);
        if (zoom !== undefined) adjusted = cameraUpdates.setZoom(adjusted, context, zoom);
        if (roll !== undefined) adjusted = cameraUpdates.setRoll(adjusted, roll);
        if (pitch !== undefined) adjusted = cameraUpdates.setPitch(adjusted, pitch);
        if (bearing !== undefined) adjusted = cameraUpdates.setBearing(adjusted, bearing);
        return elevation === undefined ? adjusted : this._raiseCameraByPitchAndZoom(adjusted);
    }

    /**
     * Ends an animation's work on the center elevation, whether it ran to the end or was interrupted. An animation that
     * held it takes the DEM data that landed since its last frame and puts the center back onto the terrain, see
     * {@link Camera.releaseElevation}; one that eased it hands it back to the terrain.
     * @param freezeElevation - whether the animation held the center elevation
     */
    private _finishAnimationElevation(freezeElevation: boolean = false): void {
        const rule = this._state.centerElevation;
        if (rule.rule === 'eased') {
            this._dispatch(setCenterElevationRule({rule: 'ground'}));
            return;
        }
        if (rule.rule === 'held') {
            this._followTerrainByRule();
            this.releaseElevation();
            return;
        }
        if (!freezeElevation || !this.terrain || !this.getCenterClampedToGround()) return;
        this.applyUpdatedState(this.putCenterBackOnTerrain(this.getStateForUpdate(), this.terrain, false));
    }

    /*
     * This method implements an “optimal path” animation, as detailed in:
     *
     * Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
     * ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
     *
     * Where applicable, local variable documentation begins with the associated variable or
     * function in van Wijk (2003).
     */
    flyTo(options: FlyToOptions, eventData?: any): this {
        if (!options.essential && browser.prefersReducedMotion) {
            return this.easeTo(options, eventData);
        }

        this._scheduler.interrupt();

        options = extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: defaultEasing
        }, options);

        if (options.zoom !== undefined && this._zoomSnap) {
            options.zoom = evaluateZoomSnap(options.zoom, this._zoomSnap);
        }

        const state = this.getStateForUpdate(),
            startBearing = getBearing(state),
            startPitch = getPitch(state),
            startRoll = getRoll(state),
            startPadding = state.padding;

        const bearing = options.bearing !== undefined ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = options.pitch !== undefined ? +options.pitch : startPitch;
        const roll = options.roll !== undefined ? this._normalizeBearing(options.roll, startRoll) : startRoll;
        const padding = (options.padding !== undefined ? options.padding : state.padding) as PaddingOptions;

        const offsetAsPoint = Point.convert(options.offset);
        let pointAtOffset = getCenterPoint(state).add(offsetAsPoint);
        const locationAtOffset = cameraMath.screenPointToLocation(this._projectState(state), this.context.projection, pointAtOffset);

        const flyToMotion = cameraUpdates.flyTo(state, this.context, {
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
        const w0 = Math.max(state.width, state.height);
        // w₁: Final visible span, measured in pixels with respect to the initial scale.
        const w1 = w0 / flyToMotion.scaleOfZoom;
        // Length of the flight path as projected onto the ground plane, measured in pixels from
        // the world image origin at the initial scale.
        const u1 = flyToMotion.pixelPathLength;

        // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
        // scale.
        const wMax = w0 / flyToMotion.scaleOfMinZoom;
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

        const rotating = startBearing !== bearing;
        const pitching = pitch !== startPitch;
        const rolling = roll !== startRoll;
        const paddingChanging = !isPaddingEqual(state.padding, padding);

        const elevationHandler = this._createElevationEase(state, flyToMotion.targetCenter, options.freezeElevation);

        this._scheduler.scheduleSegment({
            onFrame: (k) => {
                const context = this.context;
                let frame = this._proposedForUpdate();
                // s: The distance traveled along the flight path, measured in ρ-screenfulls.
                const s = k * S;
                const scale = 1 / w(s);
                const centerFactor = u(s);
                if (rotating) frame = cameraUpdates.setBearing(frame, interpolates.number(startBearing, bearing, k));
                if (pitching) frame = cameraUpdates.setPitch(frame, interpolates.number(startPitch, pitch, k));
                if (rolling) frame = cameraUpdates.setRoll(frame, interpolates.number(startRoll, roll, k));
                if (paddingChanging) {
                    frame = cameraUpdates.interpolatePadding(frame, context, startPadding, padding, k);
                    // The center point moves with the padding, and the offset point with it.
                    pointAtOffset = getCenterPoint(frame).add(offsetAsPoint);
                }

                frame = flyToMotion.easeFunc(frame, context, k, scale, centerFactor, pointAtOffset);
                this.applyUpdatedState(elevationHandler.easeFunc(frame, k));
            },
            onFinish: () => this._finishAnimationElevation(options.freezeElevation)
        }, {
            duration: options.animate === false ? 0 : options.duration,
            easing: options.easing,
            axes: {zoom: true, rotate: rotating, pitch: pitching, roll: rolling},
            eventData
        });

        return this;
    }

    /** Ends the running animation where it is, firing its end events. */
    stop(): this {
        this._scheduler.interrupt();
        return this;
    }

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number): number {
        bearing = wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    }

    isMoving(): boolean {
        return this._scheduler.isMoving();
    }

    isZooming(): boolean {
        return this._scheduler.isMovingAxis('zoom');
    }

    isRotating(): boolean {
        return this._scheduler.isMovingAxis('rotate');
    }

    isPitching(): boolean {
        return this._scheduler.isMovingAxis('pitch');
    }

    isRolling(): boolean {
        return this._scheduler.isMovingAxis('roll');
    }
}

/**
 * Zooms and moves the camera so the pivot is at its screen point and distance, or as close to the distance as the zoom limits allow.
 * Returns false where no zoom gives the distance, which is where the camera would have to go below the ground.
 *
 * The distance grows with the span of the view, in a straight line on mercator and nearly so on the globe,
 * so the span is found with the secant method.
 */
function holdPivot(state: CameraState, context: CameraContext, pivot: RotationPivot): CameraState | null {
    let span = 1;
    let placed = placePivot(state, context, pivot);
    let nextSpan = pivot.distance / placed.distance;
    for (let i = 0; i < MAX_PIVOT_ZOOM_CORRECTIONS && !isAtDistance(placed.distance, pivot); i++) {
        if (!Number.isFinite(nextSpan) || nextSpan <= 0) return null;
        const zoom = placed.state.zoom;
        const zoomed = cameraUpdates.setZoom(placed.state, context, zoom + scaleZoom(span / nextSpan));
        const reachedSpan = span * zoomScale(zoom - zoomed.zoom);
        if (reachedSpan === span) return zoomed;
        const reached = placePivot(zoomed, context, pivot);
        nextSpan = reachedSpan + (pivot.distance - reached.distance) * (reachedSpan - span) / (reached.distance - placed.distance);
        span = reachedSpan;
        placed = reached;
    }
    return isAtDistance(placed.distance, pivot) ? placed.state : null;
}

/** Moves the camera so the pivot is at its screen point, and returns it with the pivot's distance from it. */
function placePivot(state: CameraState, context: CameraContext, pivot: RotationPivot): {state: CameraState; distance: number} {
    const placed = cameraSolvers.setLocationAtPoint(state, context, pivot.location, pivot.point, pivot.elevation);
    return {state: placed, distance: distanceFromCamera(cameraMath.projectCamera(placed, context.projection), context.projection, pivot.location, pivot.elevation)};
}

function isAtDistance(distance: number, pivot: RotationPivot): boolean {
    return Math.abs(distance / pivot.distance - 1) < PIVOT_DISTANCE_TOLERANCE;
}

/** Whether the ground under the pivot's screen point is the pivot, which the edge of the map or a pole of the globe can prevent. A pivot on terrain is not checked. */
function isAtScreenPoint(projectedCamera: ProjectedCamera, projection: CameraProjection, pivot: RotationPivot): boolean {
    if (pivot.elevation !== undefined) return true;
    const offset = vec3.distance(positionOf(cameraMath.screenPointToLocation(projectedCamera, projection, pivot.point), 0), positionOf(pivot.location, 0));
    return offset < pivot.distance * PIVOT_POINT_TOLERANCE;
}

function isBelowHorizon(projectedCamera: ProjectedCamera, projection: CameraProjection, point: Point): boolean {
    return cameraMath.isPointOnMapSurface(projectedCamera, projection, new Point(point.x, point.y - PIVOT_HORIZON_MARGIN_PX));
}

/** Returns the straight-line distance in meters from the camera to a location, at the center's elevation unless it has its own. */
function distanceFromCamera(projectedCamera: ProjectedCamera, projection: CameraProjection, location: LngLat, elevation: number = projectedCamera.elevation): number {
    return vec3.distance(positionOf(cameraMath.getCameraLngLat(projectedCamera, projection), cameraMath.getCameraAltitude(projectedCamera)), positionOf(location, elevation));
}

/** Returns the position of a location in meters from the center of the earth. */
function positionOf(location: LngLat, elevation: number): vec3 {
    const position = angularCoordinatesToSurfaceVector(location);
    return vec3.scale(position, position, earthRadius + elevation);
}
