import {Event, Evented} from '../util/evented.ts';
import {MapMovementEvent} from './events.ts';
import {DOM} from '../util/dom.ts';
import {HandlerInertia} from './handler_inertia.ts';
import {extend, isPointableEvent, isTouchableEvent, isTouchableOrPointableType} from '../util/util.ts';
import {browser} from '../util/browser.ts';
import Point from '@mapbox/point-geometry';
import * as cameraMath from '../geo/projection/camera_math.ts';
import * as cameraUpdates from '../geo/projection/camera_updates.ts';

import type {MapEventType} from './events.ts';
import type {DragPanHandler} from './handler/shim/drag_pan.ts';
import type {Camera, EaseToOptions, RotationPivot} from './camera.ts';
import type {MapControlsDeltas} from '../geo/projection/camera_helper.ts';
import type {LngLat} from '../geo/lng_lat.ts';
import type {CameraState} from '../geo/camera_state.ts';
import type {ProjectedCamera} from '../geo/projected_camera.ts';
import type {Terrain} from '../render/terrain.ts';
import type {TaskID} from '../util/task_queue.ts';
import type {RenderLoop} from './camera_movement_scheduler.ts';

const isMoving = (p: EventsInProgress) => p.zoom || p.drag || p.roll || p.pitch || p.rotate;

/**
 * A terrain gesture's anchor plane must stay below this fraction of the camera's
 * altitude over the center-elevation plane, or the ray-plane solve degenerates.
 */
const TERRAIN_ANCHOR_MAX_CAMERA_ALTITUDE_FRACTION = 0.9;

/**
 * State of a gesture in flight over terrain, all of it living from the gesture's
 * first handler frame to the end of its movement.
 */
type TerrainGesture = {
    /** Whether a gesture over terrain is in flight, and the center elevation frozen with it. */
    inFlight: boolean;
    /**
     * Elevation in meters of the plane a drag or zoom is solved on, sampled from the terrain under the pointer on
     * the gesture's first drag or zoom frame and again whenever the hold has changed the center elevation since:
     * `null` not sampled yet, a number the terrain point that frame grabbed, `undefined` no terrain loaded under
     * the pointer (the gesture is solved on the center's elevation; sampling on other frames would change how far
     * the map moves per pixel mid-gesture).
     */
    anchorElevation: number | null | undefined;
    /** The center elevation the anchor was sampled at, or null while it has not been sampled. */
    anchorCenterElevation: number | null;
};

class RenderFrameEvent extends Event {
    type: 'renderFrame';
    timeStamp: number;
}

/**
 * Handlers interpret dom events and return camera changes that should be
 * applied to the map (`HandlerResult`s). The camera changes are all deltas.
 * The handler itself should have no knowledge of the map's current state.
 * This makes it easier to merge multiple results and keeps handlers simpler.
 * For example, if there is a mousedown and mousemove, the mousePan handler
 * would return a `panDelta` on the mousemove.
 */
export interface Handler {
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    /**
     * This is used to indicate if the handler is currently active or not.
     * In case a handler is active, it will block other handlers from getting the relevant events.
     * There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.
     */
    isActive(): boolean;
    /**
     * `reset` can be called by the manager at any time and must reset everything to it's original state
     */
    reset(): void;
    // Handlers can optionally implement these methods.
    // They are called with dom events whenever those dom evens are received.
    readonly touchstart?: (e: TouchEvent, points: Point[], mapTouches: Touch[]) => HandlerResult | void;
    readonly touchmove?: (e: TouchEvent, points: Point[], mapTouches: Touch[]) => HandlerResult | void;
    readonly touchmoveWindow?: (e: TouchEvent, points: Point[], mapTouches: Touch[]) => HandlerResult | void;
    readonly touchend?: (e: TouchEvent, points: Point[], mapTouches: Touch[]) => HandlerResult | void;
    readonly touchcancel?: (e: TouchEvent, points: Point[], mapTouches: Touch[]) => HandlerResult | void;
    readonly mousedown?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mousemove?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mousemoveWindow?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mouseup?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly mouseupWindow?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly dblclick?: (e: MouseEvent, point: Point) => HandlerResult | void;
    readonly contextmenu?: (e: MouseEvent) => HandlerResult | void;
    readonly wheel?: (e: WheelEvent, point: Point) => HandlerResult | void;
    readonly keydown?: (e: KeyboardEvent) => HandlerResult | void;
    readonly keyup?: (e: KeyboardEvent) => HandlerResult | void;
    /**
     * `renderFrame` is the only non-dom event. It is called during render
     * frames and can be used to smooth camera changes (see scroll handler).
     */
    readonly renderFrame?: () => HandlerResult | void;
    /**
     * Whether the handler is zooming the map apart from the zoom deltas it returns, such as a wheel zoom between a
     * wheel event and its first frame.
     */
    isZooming?(): boolean;
    /**
     * Called by the manager when a timeout the handler asked for runs out, see {@link HandlerResult.timeout}. The
     * manager runs a render frame when the result asks for one. The token is opaque to the manager, so a handler
     * declares the parameter as the type of the tokens it hands out.
     */
    onTimeout?(token: unknown): HandlerResult | void;
}

/**
 * All handler methods that are called with events can optionally return a `HandlerResult`.
 */
export type HandlerResult = {
    panDelta?: Point;
    zoomDelta?: number;
    bearingDelta?: number;
    pitchDelta?: number;
    rollDelta?: number;
    /**
     * the point to not move when changing the camera
     */
    around?: Point | null;
    /**
     * same as above, except for pinch actions, which are given higher priority
     */
    pinchAround?: Point | null;
    /**
     * A one-off easing of the camera, such as a double click's zoom, that ends the gesture: every handler is reset
     * before it starts, so that the next frame of a handler does not stop it, and its events carry the input event that
     * asked for it as `originalEvent`.
     */
    easeTo?: EaseToOptions;
    /**
     * Asks the manager to call the handler's `onTimeout` with `token` after `delay` milliseconds, for a handler that
     * waits for input that may not come, such as a wheel zoom telling a mouse wheel from a trackpad. The handler
     * ignores a timeout whose token it no longer waits for, so it never needs to cancel one.
     */
    timeout?: {delay: number; token: unknown};
    /**
     * The last three properties are needed by only one handler: scrollzoom.
     * The DOM event to be used as the `originalEvent` on any camera change events.
     */
    originalEvent?: Event;
    /**
     * Makes the manager trigger a frame, allowing the handler to return multiple results over time (see scrollzoom).
     */
    needsRenderFrame?: boolean;
    /**
     * The camera changes won't get recorded for inertial zooming.
     */
    noInertia?: boolean;
};

type EventInProgress = {
    handlerName: string;
    originalEvent: Event;
};

type EventsInProgress = {
    zoom?: EventInProgress;
    roll?: EventInProgress;
    pitch?: EventInProgress;
    rotate?: EventInProgress;
    drag?: EventInProgress;
};

type MapControlsScenarioOptions = {
    terrain?: Terrain | null;
    state: CameraState;
    deltasForHelper: MapControlsDeltas;
    preZoomAroundLoc: LngLat;
    combinedEventsInProgress: EventsInProgress;
    panDelta?: Point;
};

function hasChange(result: HandlerResult) {
    return result.panDelta?.mag() || result.zoomDelta || result.bearingDelta || result.pitchDelta || result.rollDelta;
}

/**
 * @internal
 * What the map that owns a {@link HandlerManager} gives it to work with.
 */
export type HandlerManagerContext = {
    camera: Camera;
    renderLoop: RenderLoop;
    canvas: HTMLCanvasElement;
    /** The element that holds the canvas, which the manager listens to for input. */
    canvasContainer: HTMLElement;
    /** The bearing below which the camera snaps back to north when a gesture ends. */
    bearingSnap: number;
    /** The map's drag pan, whose inertia options the inertia at the end of a gesture follows. */
    dragPan: DragPanHandler;
    /** The handlers to run, see {@link HandlerRegistration}. The manager is the evented parent of those that fire events. */
    registrations: HandlerRegistration[];
};

/**
 * @internal
 * A handler as a {@link HandlerManager} runs it: under its name, and with the names of the handlers that may stay
 * active while it is. The manager runs its handlers in the order they are registered in, and a handler that is active
 * stops every later one whose `allowed` list does not name it.
 */
export type HandlerRegistration = {
    handlerName: string;
    handler: Handler;
    allowed?: string[];
};

/**
 * @internal
 * Turns the input on the map's canvas into camera movement through its handlers. The handlers that fire the map's
 * own events, such as its mouse and box zoom events, fire them on the manager, whose evented parent is the map.
 */
export class HandlerManager extends Evented<MapEventType> {
    private _camera: Camera;
    private _el: HTMLElement;
    private _canvas: HTMLCanvasElement;
    private _renderLoop: RenderLoop;
    private _dragPan: DragPanHandler;
    private _handlers: HandlerRegistration[];
    private _eventsInProgress: EventsInProgress;
    private _frameId: number;
    private _inertia: HandlerInertia;
    private _bearingSnap: number;
    private _handlersById: {[x: string]: Handler};
    private _updatingCamera: boolean;
    private _changes: Array<[HandlerResult, EventsInProgress, {[handlerName: string]: Event}]>;
    /**
     * The gesture in flight over terrain, from its first handler frame to the `_fireEvents` call that sees the
     * movement end. It holds the center elevation (see {@link Camera.holdElevation}), which the camera lifts to keep
     * the camera out of the terrain, and a frame that zooms in moves the held center onto the terrain the camera looks
     * at, with the camera where it is (see {@link Camera.moveCenterOntoTerrain}); its end puts the center back onto
     * the terrain, or at 0 keeping the zoom with the terrain off (see {@link Camera.releaseElevation}).
     */
    private _terrainGesture: TerrainGesture = {inFlight: false, anchorElevation: null, anchorCenterElevation: null};
    /** The point a drag turns the camera around, picked on its first frame and kept until it ends or cannot be held. */
    private _rotationPivot: RotationPivot | null = null;
    private _zoom: {handlerName: string};
    private _previousActiveHandlers: {[x: string]: Handler};
    /** The timeouts handlers asked for that have not run out yet, see {@link HandlerResult.timeout}. */
    private _timeouts = new Set<ReturnType<typeof setTimeout>>();
    private _domListeners: Array<[Window | Document | HTMLElement, string, {
        passive?: boolean;
        capture?: boolean;
    } | undefined]>;

    /**
     * @internal
     * The document that contains the map container element, for cross-window support.
     */
    private get _ownerDocument(): Document {
        return this._el?.ownerDocument || document;
    }

    /**
     * @internal
     * The window that contains the map container element, for cross-window support.
     */
    private get _ownerWindow(): Window {
        return this._el?.ownerDocument?.defaultView || window;
    }

    constructor(context: HandlerManagerContext) {
        super();
        this._camera = context.camera;
        this._dragPan = context.dragPan;
        this._el = context.canvasContainer;
        this._canvas = context.canvas;
        this._renderLoop = context.renderLoop;
        this._handlers = [];
        this._handlersById = {};
        this._changes = [];

        this._inertia = new HandlerInertia(this._camera);
        this._bearingSnap = context.bearingSnap;
        this._previousActiveHandlers = {};

        // Track whether map is currently moving, to compute start/move/end events
        this._eventsInProgress = {};

        for (const {handlerName, handler, allowed} of context.registrations) {
            if (handler instanceof Evented) handler.setEventedParent(this);
            this._add(handlerName, handler, allowed);
        }

        const el = this._el;

        this._domListeners = [
            // This needs to be `passive: true` so that a double tap fires two
            // pairs of touchstart/end events in iOS Safari 13. If this is set to
            // `passive: false` then the second pair of events is only fired if
            // preventDefault() is called on the first touchstart. Calling preventDefault()
            // undesirably prevents click events.
            [el, 'touchstart', {passive: true}],
            // This needs to be `passive: false` so that scrolls and pinches can be
            // prevented in browsers that don't support `touch-actions: none`, for example iOS Safari 12.
            [el, 'touchmove', {passive: false}],
            [el, 'touchend', undefined],
            [el, 'touchcancel', undefined],

            [el, 'mousedown', undefined],
            [el, 'mousemove', undefined],
            [el, 'mouseup', undefined],

            // Bind window-level event listeners for move and up/end events. In the absence of
            // the pointer capture API, which is not supported by all necessary platforms,
            // window-level event listeners give us the best shot at capturing events that
            // fall outside the map canvas element. Use `{capture: true}` for the move event
            // to prevent map move events from being fired during a drag.
            [this._ownerDocument, 'mousemove', {capture: true}],
            [this._ownerDocument, 'mouseup', undefined],

            [el, 'mouseover', undefined],
            [el, 'mouseout', undefined],
            [el, 'dblclick', undefined],
            [el, 'click', undefined],

            [el, 'keydown', {capture: false}],
            [el, 'keyup', undefined],

            [el, 'wheel', {passive: false}],
            [el, 'contextmenu', undefined],

            [this._ownerWindow, 'blur', undefined]
        ];

        for (const [target, type, listenerOptions] of this._domListeners) {
            target.addEventListener(type, target === this._ownerDocument ? this.handleWindowEvent : this.handleEvent, listenerOptions);
        }
    }

    destroy(): void {
        if (this._frameId !== undefined) this._renderLoop.cancelRenderFrame(this._frameId);
        for (const timeout of this._timeouts) clearTimeout(timeout);
        for (const [target, type, listenerOptions] of this._domListeners) {
            target.removeEventListener(type, target === this._ownerDocument ? this.handleWindowEvent : this.handleEvent, listenerOptions);
        }
    }

    private _add(handlerName: string, handler: Handler, allowed?: string[]): void {
        this._handlers.push({handlerName, handler, allowed});
        this._handlersById[handlerName] = handler;
    }

    stop(allowEndAnimation: boolean): void {
        // do nothing if this method was triggered by a gesture update
        if (this._updatingCamera) return;

        for (const {handler} of this._handlers) {
            handler.reset();
        }
        this._inertia.clear();
        this._fireEvents({}, {}, allowEndAnimation);
        this._changes = [];
    }

    isActive(): boolean {
        for (const {handler} of this._handlers) {
            if (handler.isActive()) return true;
        }
        return false;
    }

    isZooming(): boolean {
        return !!this._eventsInProgress.zoom || this._handlers.some(({handler}) => handler.isZooming?.());
    }
    isRotating(): boolean {
        return !!this._eventsInProgress.rotate;
    }

    isMoving(): boolean {
        return Boolean(isMoving(this._eventsInProgress)) || this.isZooming();
    }

    private _blockedByActive(activeHandlers: {[x: string]: Handler}, allowed: string[], myName: string): boolean {
        for (const name in activeHandlers) {
            if (name === myName) continue;
            if (!allowed?.includes(name)) {
                return true;
            }
        }
        return false;
    }

    handleWindowEvent = (e: Event): void => {
        this.handleEvent(e, `${e.type}Window` as keyof Handler);
    };

    private _getMapTouches(touches: TouchList): TouchList {
        const mapTouches = [];
        for (const t of touches) {
            const target = (t.target as any as Node);
            if (this._el.contains(target)) {
                mapTouches.push(t);
            }
        }
        return mapTouches as any as TouchList;
    }

    handleEvent = (e: Event, eventName?: keyof Handler): void => {

        if (e.type === 'blur') {
            this.stop(true);
            return;
        }

        this._updatingCamera = true;

        const inputEvent = e.type === 'renderFrame' ? undefined : e as UIEvent;

        /*
         * We don't call e.preventDefault() for any events by default.
         * Handlers are responsible for calling it where necessary.
         */

        const mergedHandlerResult: HandlerResult = {needsRenderFrame: false};
        const eventsInProgress: EventsInProgress = {};
        const activeHandlers = {};

        for (const {handlerName, handler, allowed} of this._handlers) {
            if (!handler.isEnabled()) continue;

            let data: HandlerResult;
            if (this._blockedByActive(activeHandlers, allowed, handlerName)) {
                handler.reset();

            } else {
                if (handler[eventName || e.type]) {
                    if (isPointableEvent(e, eventName || e.type)){
                        const point = DOM.mousePos(this._canvas, e);
                        data = handler[eventName || e.type](e, point);
                    } else if (isTouchableEvent(e, eventName || e.type)) {
                        const eventTouches = e.touches;
                        const mapTouches = this._getMapTouches(eventTouches);
                        const points = DOM.touchPos(this._canvas, mapTouches);
                        data = handler[eventName || e.type](e, points, mapTouches);
                    } else if (!isTouchableOrPointableType(eventName || e.type)) {
                        data = handler[eventName || e.type](e);
                    }
                    this.mergeHandlerResult(mergedHandlerResult, eventsInProgress, data, handlerName, inputEvent);
                    if (data?.needsRenderFrame) {
                        this._triggerRenderFrame();
                    }
                    if (data?.timeout) this._startTimeout(handler, data.timeout);
                }
            }

            if (data || handler.isActive()) {
                activeHandlers[handlerName] = handler;
            }
        }

        const deactivatedHandlers: {[handlerName: string]: Event} = {};
        for (const name in this._previousActiveHandlers) {
            if (!activeHandlers[name]) {
                deactivatedHandlers[name] = inputEvent;
            }
        }
        this._previousActiveHandlers = activeHandlers;

        if (Object.keys(deactivatedHandlers).length || hasChange(mergedHandlerResult)) {
            this._changes.push([mergedHandlerResult, eventsInProgress, deactivatedHandlers]);
            this._triggerRenderFrame();
        }

        if (Object.keys(activeHandlers).length || hasChange(mergedHandlerResult)) {
            this._camera.stop();
        }

        this._updatingCamera = false;

        const {easeTo} = mergedHandlerResult;
        if (easeTo) {
            this.stop(true);
            this._camera.easeTo(easeTo, {originalEvent: inputEvent});
        }
    };

    mergeHandlerResult(mergedHandlerResult: HandlerResult,
        eventsInProgress: EventsInProgress,
        handlerResult: HandlerResult,
        name: string,
        e?: UIEvent): void {
        if (!handlerResult) return;

        extend(mergedHandlerResult, handlerResult);

        const eventData = {handlerName: name, originalEvent: handlerResult.originalEvent || e};

        // track which handler changed which camera property
        if (handlerResult.zoomDelta !== undefined) {
            eventsInProgress.zoom = eventData;
        }
        if (handlerResult.panDelta !== undefined) {
            eventsInProgress.drag = eventData;
        }
        if (handlerResult.rollDelta !== undefined) {
            eventsInProgress.roll = eventData;
        }
        if (handlerResult.pitchDelta !== undefined) {
            eventsInProgress.pitch = eventData;
        }
        if (handlerResult.bearingDelta !== undefined) {
            eventsInProgress.rotate = eventData;
        }

    }

    private _applyChanges(): void {
        const combined: HandlerResult = {};
        const combinedEventsInProgress: EventsInProgress = {};
        const combinedDeactivatedHandlers = {};

        for (const [change, eventsInProgress, deactivatedHandlers] of this._changes) {

            if (change.panDelta) combined.panDelta = (combined.panDelta || new Point(0, 0))._add(change.panDelta);
            if (change.zoomDelta) combined.zoomDelta = (combined.zoomDelta || 0) + change.zoomDelta;
            if (change.bearingDelta) combined.bearingDelta = (combined.bearingDelta || 0) + change.bearingDelta;
            if (change.pitchDelta) combined.pitchDelta = (combined.pitchDelta || 0) + change.pitchDelta;
            if (change.rollDelta) combined.rollDelta = (combined.rollDelta || 0) + change.rollDelta;
            if (change.around !== undefined) combined.around = change.around;
            if (change.pinchAround !== undefined) combined.pinchAround = change.pinchAround;
            if (change.noInertia) combined.noInertia = change.noInertia;

            extend(combinedEventsInProgress, eventsInProgress);
            extend(combinedDeactivatedHandlers, deactivatedHandlers);
        }

        this._updateMapCamera(combined, combinedEventsInProgress, combinedDeactivatedHandlers);
        this._changes = [];
    }

    /**
     * Applies a frame's combined handler deltas to the requested camera and fires the movement events. A
     * frame without a change only fires the events, so a trailing frame that merely ends a handler does not
     * start a movement on the camera.
     */
    private _updateMapCamera(combinedResult: HandlerResult,
        combinedEventsInProgress: EventsInProgress,
        deactivatedHandlers: {[handlerName: string]: Event}): void {
        const terrain = this._camera.terrain;

        if (!hasChange(combinedResult)) {
            this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true); return;
        }

        this._camera.stop();
        let state = this._camera.getStateForUpdate();

        if (this._turnsAroundPivot(combinedResult, combinedEventsInProgress)) {
            this._commitFrame(this._orbitRotationPivot(state, combinedResult, terrain), combinedResult, combinedEventsInProgress, deactivatedHandlers);
            return;
        }

        const {panDelta, zoomDelta, bearingDelta, pitchDelta, rollDelta} = combinedResult;
        if (zoomDelta > 0 && this._terrainGesture.inFlight) {
            state = this._camera.moveCenterOntoTerrain(state, zoomDelta);
        }

        const projectedCamera = this._camera._projectState(state);
        let {around, aroundOnSurface} = this._resolveAround(combinedResult, terrain, projectedCamera);
        const aroundElevation = terrain ? this._terrainGestureElevation(terrain, around, aroundOnSurface, projectedCamera, combinedEventsInProgress) : undefined;

        const deltasForHelper: MapControlsDeltas = {
            panDelta,
            zoomDelta,
            rollDelta,
            pitchDelta,
            bearingDelta,
            around,
            aroundElevation,
        };

        // Pre-zoom location under the mouse cursor is required for accurate mercator panning and zooming
        if (this._camera.cameraHelper.useGlobeControls && !cameraMath.isPointOnMapSurface(projectedCamera, this._camera.context.projection, around)) {
            around = projectedCamera.centerPoint;
        }
        const preZoomAroundLoc = this._computePreZoomAroundLoc(projectedCamera, around, panDelta, aroundElevation);

        state = this._handleMapControls({
            terrain,
            state,
            deltasForHelper,
            preZoomAroundLoc,
            combinedEventsInProgress,
            panDelta,
        });

        this._commitFrame(state, combinedResult, combinedEventsInProgress, deactivatedHandlers);
    }

    /** Applies the frame's camera to the map, records the frame for inertia and fires its events. */
    private _commitFrame(state: CameraState,
        combinedResult: HandlerResult,
        combinedEventsInProgress: EventsInProgress,
        deactivatedHandlers: Record<string, Event>): void {
        this._camera.applyUpdatedState(state);

        if (!combinedResult.noInertia) this._inertia.record(combinedResult);
        this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);
    }

    /** Whether a frame rotates the camera around its own `around` point, which drag to rotate sets when it turns around the pointer. */
    private _turnsAroundPivot(combinedResult: HandlerResult, combinedEventsInProgress: EventsInProgress): boolean {
        if (!combinedResult.around) return false;
        return !combinedEventsInProgress.drag && !combinedEventsInProgress.zoom;
    }

    /** Turns the camera around the drag's pivot, holding the center elevation over terrain until the drag ends like every gesture. */
    private _orbitRotationPivot(state: CameraState, combinedResult: HandlerResult, terrain: Terrain | null): CameraState {
        if (terrain && !this._terrainGesture.inFlight) {
            this._terrainGesture.inFlight = true;
            this._camera.holdElevation('gesture');
        }
        const {panDelta, zoomDelta, bearingDelta, pitchDelta, rollDelta, around} = combinedResult;
        this._rotationPivot ??= this._camera.captureRotationPivot(this._camera._projectState(state), around);
        const orbited = this._camera.orbitRotationPivot(state, this._rotationPivot, {panDelta, zoomDelta, bearingDelta, pitchDelta, rollDelta, around});
        if (!orbited.held) this._rotationPivot = null;
        return orbited.state;
    }

    /**
     * The gesture's anchor point: the pinch midpoint when pinching, otherwise the
     * pan's anchor, clamped to the center point when it does not lie on the map.
     */
    private _resolveAround(combinedResult: HandlerResult, terrain: Terrain | null, projectedCamera: ProjectedCamera): {around: Point; aroundOnSurface: boolean} {
        let around = combinedResult.pinchAround !== undefined ? combinedResult.pinchAround : combinedResult.around;
        around ||= this._camera.projectedCamera.centerPoint;
        if (terrain && !cameraMath.isPointOnMapSurface(projectedCamera, this._camera.context.projection, around)) {
            return {around: projectedCamera.centerPoint, aroundOnSurface: false};
        }
        return {around, aroundOnSurface: true};
    }

    /**
     * The elevation of the plane a terrain gesture is solved on: the elevation of the
     * terrain point grabbed at gesture start, captured here on the gesture's first
     * frame. Undefined means the gesture is solved at the center's elevation instead —
     * when the grabbed terrain is not loaded, the anchor is the center point (a
     * center-point anchor is skipped by the camera helper and would lose the pan), or
     * the anchor plane is too close to the camera for a stable ray-plane solve.
     */
    private _terrainGestureElevation(terrain: Terrain, around: Point, aroundOnSurface: boolean, projectedCamera: ProjectedCamera, combinedEventsInProgress: EventsInProgress): number | undefined {
        if (!aroundOnSurface) {
            return undefined;
        }
        if (this._terrainGesture.anchorCenterElevation !== projectedCamera.elevation && (combinedEventsInProgress.drag || combinedEventsInProgress.zoom)) {
            const anchor = cameraMath.screenTerrainPointToMercatorCoordinate(projectedCamera, this._camera.context.projection, around, terrain);
            this._terrainGesture.anchorElevation = anchor ? anchor.z : undefined;
            this._terrainGesture.anchorCenterElevation = projectedCamera.elevation;
        }
        const elevation = this._terrainGesture.anchorElevation;
        if (elevation === null || elevation === undefined) {
            return undefined;
        }
        if (around.distSqr(projectedCamera.centerPoint) < 1.0e-2) {
            return undefined;
        }
        if (elevation - projectedCamera.elevation >= TERRAIN_ANCHOR_MAX_CAMERA_ALTITUDE_FRACTION * (cameraMath.getCameraAltitude(projectedCamera) - projectedCamera.elevation)) {
            return undefined;
        }
        return elevation;
    }

    /**
     * The location that was under `around` before this frame's deltas — the point the
     * camera helper re-anchors after zooming — solved at `aroundElevation` when a
     * terrain gesture provides one. When rotating about the center point, the
     * camera's center is used directly to avoid numerical issues near the horizon.
     */
    private _computePreZoomAroundLoc(projectedCamera: ProjectedCamera, around: Point, panDelta: Point | undefined, aroundElevation: number | undefined): LngLat {
        if (around.distSqr(projectedCamera.centerPoint) < 1.0e-2) {
            return projectedCamera.center;
        }
        const aroundPreviousPoint = panDelta ? around.sub(panDelta) : around;
        if (aroundElevation !== undefined) {
            return cameraMath.screenPointToLocationAtElevation(projectedCamera, this._camera.context.projection, aroundPreviousPoint, aroundElevation);
        }
        return cameraMath.screenPointToLocation(projectedCamera, this._camera.context.projection, aroundPreviousPoint);
    }

    private _handleMapControls({
        terrain,
        state,
        deltasForHelper,
        preZoomAroundLoc,
        combinedEventsInProgress,
        panDelta}: MapControlsScenarioOptions): CameraState {

        const cameraHelper = this._camera.cameraHelper;
        const context = this._camera.context;

        state = cameraHelper.handleMapControlsRollPitchBearingZoom(state, context, deltasForHelper);
        const projectedCamera = this._camera._projectState(state);

        if (!terrain && !cameraHelper.useGlobeControls && !cameraMath.isPointOnMapSurface(projectedCamera, this._camera.context.projection, deltasForHelper.around)) {
            return panDelta ? this._panByPixels(state, projectedCamera, panDelta) : state;
        }

        if (!terrain) {
            return cameraHelper.handleMapControlsPan(state, context, deltasForHelper, preZoomAroundLoc);
        }

        if (!this._terrainGesture.inFlight) {
            this._terrainGesture.inFlight = true;
            this._camera.holdElevation('gesture');
            return cameraHelper.handleMapControlsPan(state, context, deltasForHelper, preZoomAroundLoc);
        }

        if (!cameraHelper.useGlobeControls && deltasForHelper.aroundElevation === undefined &&
            combinedEventsInProgress.drag && panDelta) {
            // no usable anchor: drag by pixel-delta on the center-elevation plane
            return this._panByPixels(state, projectedCamera, panDelta);
        }

        return cameraHelper.handleMapControlsPan(state, context, deltasForHelper, preZoomAroundLoc);
    }

    /** Moves the center to the location `panDelta` pixels against the drag from it, on the plane at the center's elevation. */
    _panByPixels(state: CameraState, projectedCamera: ProjectedCamera, panDelta: Point): CameraState {
        return cameraUpdates.setCenter(state, this._camera.context, cameraMath.screenPointToLocation(projectedCamera, this._camera.context.projection, projectedCamera.centerPoint.sub(panDelta)));
    }

    private _fireEvents(newEventsInProgress: EventsInProgress, deactivatedHandlers: {[handlerName: string]: Event}, allowEndAnimation: boolean): void {

        const wasMoving = isMoving(this._eventsInProgress);
        const nowMoving = isMoving(newEventsInProgress);

        const startEvents = {};

        for (const eventName in newEventsInProgress) {
            const {originalEvent} = newEventsInProgress[eventName];
            if (!this._eventsInProgress[eventName]) {
                startEvents[`${eventName}start`] = originalEvent;
            }
            this._eventsInProgress[eventName] = newEventsInProgress[eventName];
        }

        // fire start events only after this._eventsInProgress has been updated
        if (!wasMoving && nowMoving) {
            this._fireEvent('movestart', nowMoving.originalEvent);
        }

        for (const name in startEvents) {
            this._fireEvent(name, startEvents[name]);
        }

        if (nowMoving) {
            this._fireEvent('move', nowMoving.originalEvent);
        }

        for (const eventName in newEventsInProgress) {
            const {originalEvent} = newEventsInProgress[eventName];
            this._fireEvent(eventName, originalEvent);
        }

        const endEvents = {};

        let originalEndEvent;
        for (const eventName in this._eventsInProgress) {
            const {handlerName, originalEvent} = this._eventsInProgress[eventName];
            if (!this._handlersById[handlerName].isActive()) {
                delete this._eventsInProgress[eventName];
                originalEndEvent = deactivatedHandlers[handlerName] || originalEvent;
                endEvents[`${eventName}end`] = originalEndEvent;
            }
        }

        for (const name in endEvents) {
            this._fireEvent(name, endEvents[name]);
        }

        const stillMoving = isMoving(this._eventsInProgress);
        const finishedMoving = (wasMoving || nowMoving) && !stillMoving;
        if (finishedMoving && this._terrainGesture.inFlight) {
            this._terrainGesture = {inFlight: false, anchorElevation: null, anchorCenterElevation: null};
            this._camera.releaseElevation();
        }
        if (allowEndAnimation && finishedMoving) {
            this._updatingCamera = true;
            const inertialEase = this._inertia._onMoveEnd(this._dragPan._inertiaOptions);

            const shouldSnapToNorth = bearing => bearing !== 0 && -this._bearingSnap < bearing && bearing < this._bearingSnap;

            if (inertialEase && (inertialEase.essential || !browser.prefersReducedMotion)) {
                if (shouldSnapToNorth(inertialEase.bearing || this._camera.getBearing())) {
                    inertialEase.bearing = 0;
                }
                inertialEase.freezeElevation = true;
                this._camera.easeTo(inertialEase, {originalEvent: originalEndEvent});
            } else {
                this._fireEvent('moveend', originalEndEvent);
                if (shouldSnapToNorth(this._camera.getBearing())) {
                    this._camera.resetNorth();
                }
            }
            this._updatingCamera = false;
        }
        if (finishedMoving) this._rotationPivot = null;

    }

    /**
     * Fires a movement event through the camera, whose evented parent is the map: the map's listeners
     * see the event as before, and the camera's own `moveend` listener ends the movement on the requested
     * camera, so the next gesture starts from the camera as it was rendered.
     */
    private _fireEvent(type: string, e?: Event): void {
        this._camera.fire(new MapMovementEvent(type, e ? {originalEvent: e} : {}));
    }

    private _requestFrame(): TaskID {
        return this._renderLoop.requestRenderFrame(timeStamp => {
            delete this._frameId;
            this.handleEvent(new RenderFrameEvent('renderFrame', {timeStamp}));
            this._applyChanges();
        });
    }

    /** Runs a render frame of the handlers, unless one is requested already. */
    private _triggerRenderFrame(): void {
        if (this._frameId === undefined) {
            this._frameId = this._requestFrame();
        }
    }

    /** Calls the handler's `onTimeout` once the timeout it asked for runs out, see {@link HandlerResult.timeout}. */
    private _startTimeout(handler: Handler, {delay, token}: {delay: number; token: unknown}): void {
        const timeout = setTimeout(() => {
            this._timeouts.delete(timeout);
            const result = handler.onTimeout?.(token);
            if (result && result.needsRenderFrame) this._triggerRenderFrame();
        }, delay);
        this._timeouts.add(timeout);
    }
}
