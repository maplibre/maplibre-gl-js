import {Event} from '../util/evented';
import {DOM} from '../util/dom';
import {Map, CompleteMapOptions} from './map';
import {HandlerInertia} from './handler_inertia';
import {MapEventHandler, BlockableMapEventHandler} from './handler/map_event';
import {BoxZoomHandler} from './handler/box_zoom';
import {TapZoomHandler} from './handler/tap_zoom';
import {generateMouseRotationHandler, generateMousePitchHandler, generateMousePanHandler} from './handler/mouse';
import {TouchPanHandler} from './handler/touch_pan';
import {TwoFingersTouchZoomHandler, TwoFingersTouchRotateHandler, TwoFingersTouchPitchHandler} from './handler/two_fingers_touch';
import {KeyboardHandler} from './handler/keyboard';
import {ScrollZoomHandler} from './handler/scroll_zoom';
import {DoubleClickZoomHandler} from './handler/shim/dblclick_zoom';
import {ClickZoomHandler} from './handler/click_zoom';
import {TapDragZoomHandler} from './handler/tap_drag_zoom';
import {DragPanHandler} from './handler/shim/drag_pan';
import {DragRotateHandler} from './handler/shim/drag_rotate';
import {TwoFingersTouchZoomRotateHandler} from './handler/shim/two_fingers_touch';
import {CooperativeGesturesHandler} from './handler/cooperative_gestures';
import {clamp, differenceOfAnglesDegrees, extend, lerp, remapSaturate, solveQuadratic} from '../util/util';
import {browser} from '../util/browser';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../geo/lng_lat';
import {angularCoordinatesToVector, getGlobeRadiusPixels, getZoomAdjustment, sphereSurfacePointToCoordinates} from '../geo/projection/globe_transform';
import {MAX_VALID_LATITUDE} from '../geo/transform';
import {vec3} from 'gl-matrix';

function getDegreesPerPixel(worldSize: number, lat: number): number {
    const radius = getGlobeRadiusPixels(worldSize, lat);
    const circumference = 2.0 * Math.PI * radius;
    return 360.0 / circumference;
}

const isMoving = (p: EventsInProgress) => p.zoom || p.drag || p.pitch || p.rotate;

class RenderFrameEvent extends Event {
    type: 'renderFrame';
    timeStamp: number;
}

function createVec3(): vec3 { return new Float64Array(3) as any; }

/**
 * When given a list of vectors, return the one with the greatest dot product in regards to the target vector.
 * @param target - Target vector the dot product is computed with.
 * @param vectors - The list of vectors to pick from. Must not be empty.
 */
function pickVector(target: vec3, ...vectors: Array<vec3>): vec3 {
    let bestVec: vec3 = vectors[0];
    let bestDot = -1;
    for (const v of vectors) {
        const dot = vec3.dot(target, v);
        if (dot > bestDot) {
            bestDot = dot;
            bestVec = v;
        }
    }
    return bestVec;
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
     * In case a handler is active, it will block other handlers from gettting the relevant events.
     * There is an allow list of handlers that can be active at the same time, which is configured when adding a handler.
     */
    isActive(): boolean;
    /**
     * `reset` can be called by the manager at any time and must reset everything to it's original state
     */
    reset(): void;
    // Handlers can optionally implement these methods.
    // They are called with dom events whenever those dom evens are received.
    readonly touchstart?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchmove?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchmoveWindow?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchend?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
    readonly touchcancel?: (e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) => HandlerResult | void;
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
}

/**
 * All handler methods that are called with events can optionally return a `HandlerResult`.
 */
export type HandlerResult = {
    panDelta?: Point;
    zoomDelta?: number;
    bearingDelta?: number;
    pitchDelta?: number;
    /**
     * the point to not move when changing the camera
     */
    around?: Point | null;
    /**
     * same as above, except for pinch actions, which are given higher priority
     */
    pinchAround?: Point | null;
    /**
     * A method that can fire a one-off easing by directly changing the map's camera.
     */
    cameraAnimation?: (map: Map) => any;
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

export type EventInProgress = {
    handlerName: string;
    originalEvent: Event;
}

export type EventsInProgress = {
    zoom?: EventInProgress;
    pitch?: EventInProgress;
    rotate?: EventInProgress;
    drag?: EventInProgress;
}

function hasChange(result: HandlerResult) {
    return (result.panDelta && result.panDelta.mag()) || result.zoomDelta || result.bearingDelta || result.pitchDelta;
}

export class HandlerManager {
    _map: Map;
    _el: HTMLElement;
    _handlers: Array<{
        handlerName: string;
        handler: Handler;
        allowed: Array<string>;
    }>;
    _eventsInProgress: EventsInProgress;
    _frameId: number;
    _inertia: HandlerInertia;
    _bearingSnap: number;
    _handlersById: {[x: string]: Handler};
    _updatingCamera: boolean;
    _changes: Array<[HandlerResult, EventsInProgress, {[handlerName: string]: Event}]>;
    _terrainMovement: boolean;
    _zoom: {handlerName: string};
    _previousActiveHandlers: {[x: string]: Handler};
    _listeners: Array<[Window | Document | HTMLElement, string, {
        passive?: boolean;
        capture?: boolean;
    } | undefined]>;

    constructor(map: Map, options: CompleteMapOptions) {
        this._map = map;
        this._el = this._map.getCanvasContainer();
        this._handlers = [];
        this._handlersById = {};
        this._changes = [];

        this._inertia = new HandlerInertia(map);
        this._bearingSnap = options.bearingSnap;
        this._previousActiveHandlers = {};

        // Track whether map is currently moving, to compute start/move/end events
        this._eventsInProgress = {};

        this._addDefaultHandlers(options);

        const el = this._el;

        this._listeners = [
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
            [document, 'mousemove', {capture: true}],
            [document, 'mouseup', undefined],

            [el, 'mouseover', undefined],
            [el, 'mouseout', undefined],
            [el, 'dblclick', undefined],
            [el, 'click', undefined],

            [el, 'keydown', {capture: false}],
            [el, 'keyup', undefined],

            [el, 'wheel', {passive: false}],
            [el, 'contextmenu', undefined],

            [window, 'blur', undefined]
        ];

        for (const [target, type, listenerOptions] of this._listeners) {
            DOM.addEventListener(target, type, target === document ? this.handleWindowEvent : this.handleEvent, listenerOptions);
        }
    }

    destroy() {
        for (const [target, type, listenerOptions] of this._listeners) {
            DOM.removeEventListener(target, type, target === document ? this.handleWindowEvent : this.handleEvent, listenerOptions);
        }
    }

    _addDefaultHandlers(options: CompleteMapOptions) {
        const map = this._map;
        const el = map.getCanvasContainer();
        this._add('mapEvent', new MapEventHandler(map, options));

        const boxZoom = map.boxZoom = new BoxZoomHandler(map, options);
        this._add('boxZoom', boxZoom);
        if (options.interactive && options.boxZoom) {
            boxZoom.enable();
        }

        const cooperativeGestures = map.cooperativeGestures = new CooperativeGesturesHandler(map, options.cooperativeGestures);
        this._add('cooperativeGestures', cooperativeGestures);
        if (options.cooperativeGestures) {
            cooperativeGestures.enable();
        }

        const tapZoom = new TapZoomHandler(map);
        const clickZoom = new ClickZoomHandler(map);
        map.doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);
        this._add('tapZoom', tapZoom);
        this._add('clickZoom', clickZoom);
        if (options.interactive && options.doubleClickZoom) {
            map.doubleClickZoom.enable();
        }

        const tapDragZoom = new TapDragZoomHandler();
        this._add('tapDragZoom', tapDragZoom);

        const touchPitch = map.touchPitch = new TwoFingersTouchPitchHandler(map);
        this._add('touchPitch', touchPitch);
        if (options.interactive && options.touchPitch) {
            map.touchPitch.enable(options.touchPitch);
        }

        const mouseRotate = generateMouseRotationHandler(options);
        const mousePitch = generateMousePitchHandler(options);
        map.dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch);
        this._add('mouseRotate', mouseRotate, ['mousePitch']);
        this._add('mousePitch', mousePitch, ['mouseRotate']);
        if (options.interactive && options.dragRotate) {
            map.dragRotate.enable();
        }

        const mousePan = generateMousePanHandler(options);
        const touchPan = new TouchPanHandler(options, map);
        map.dragPan = new DragPanHandler(el, mousePan, touchPan);
        this._add('mousePan', mousePan);
        this._add('touchPan', touchPan, ['touchZoom', 'touchRotate']);
        if (options.interactive && options.dragPan) {
            map.dragPan.enable(options.dragPan);
        }

        const touchRotate = new TwoFingersTouchRotateHandler();
        const touchZoom = new TwoFingersTouchZoomHandler();
        map.touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
        this._add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
        this._add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
        if (options.interactive && options.touchZoomRotate) {
            map.touchZoomRotate.enable(options.touchZoomRotate);
        }

        const scrollZoom = map.scrollZoom = new ScrollZoomHandler(map, () => this._triggerRenderFrame());
        this._add('scrollZoom', scrollZoom, ['mousePan']);
        if (options.interactive && options.scrollZoom) {
            map.scrollZoom.enable(options.scrollZoom);
        }

        const keyboard = map.keyboard = new KeyboardHandler(map);
        this._add('keyboard', keyboard);
        if (options.interactive && options.keyboard) {
            map.keyboard.enable();
        }

        this._add('blockableMapEvent', new BlockableMapEventHandler(map));
    }

    _add(handlerName: string, handler: Handler, allowed?: Array<string>) {
        this._handlers.push({handlerName, handler, allowed});
        this._handlersById[handlerName] = handler;
    }

    stop(allowEndAnimation: boolean) {
        // do nothing if this method was triggered by a gesture update
        if (this._updatingCamera) return;

        for (const {handler} of this._handlers) {
            handler.reset();
        }
        this._inertia.clear();
        this._fireEvents({}, {}, allowEndAnimation);
        this._changes = [];
    }

    isActive() {
        for (const {handler} of this._handlers) {
            if (handler.isActive()) return true;
        }
        return false;
    }

    isZooming() {
        return !!this._eventsInProgress.zoom || this._map.scrollZoom.isZooming();
    }
    isRotating() {
        return !!this._eventsInProgress.rotate;
    }

    isMoving() {
        return Boolean(isMoving(this._eventsInProgress)) || this.isZooming();
    }

    _blockedByActive(activeHandlers: {[x: string]: Handler}, allowed: Array<string>, myName: string) {
        for (const name in activeHandlers) {
            if (name === myName) continue;
            if (!allowed || allowed.indexOf(name) < 0) {
                return true;
            }
        }
        return false;
    }

    handleWindowEvent = (e: { type: 'mousemove' | 'mouseup' | 'touchmove'}) => {
        this.handleEvent(e, `${e.type}Window`);
    };

    _getMapTouches(touches: TouchList) {
        const mapTouches = [];
        for (const t of touches) {
            const target = (t.target as any as Node);
            if (this._el.contains(target)) {
                mapTouches.push(t);
            }
        }
        return mapTouches as any as TouchList;
    }

    handleEvent = (e: Event, eventName?: keyof Handler) => {

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
        const eventTouches = (e as TouchEvent).touches;

        const mapTouches = eventTouches ? this._getMapTouches(eventTouches) : undefined;
        const points = mapTouches ?
            DOM.touchPos(this._map.getCanvas(), mapTouches) :
            DOM.mousePos(this._map.getCanvas(), ((e as MouseEvent)));

        for (const {handlerName, handler, allowed} of this._handlers) {
            if (!handler.isEnabled()) continue;

            let data: HandlerResult;
            if (this._blockedByActive(activeHandlers, allowed, handlerName)) {
                handler.reset();

            } else {
                if (handler[eventName || e.type]) {
                    data = handler[eventName || e.type](e, points, mapTouches);
                    this.mergeHandlerResult(mergedHandlerResult, eventsInProgress, data, handlerName, inputEvent);
                    if (data && data.needsRenderFrame) {
                        this._triggerRenderFrame();
                    }
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
            this._map._stop(true);
        }

        this._updatingCamera = false;

        const {cameraAnimation} = mergedHandlerResult;
        if (cameraAnimation) {
            this._inertia.clear();
            this._fireEvents({}, {}, true);
            this._changes = [];
            cameraAnimation(this._map);
        }
    };

    mergeHandlerResult(mergedHandlerResult: HandlerResult,
        eventsInProgress: EventsInProgress,
        handlerResult: HandlerResult,
        name: string,
        e?: UIEvent) {
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
        if (handlerResult.pitchDelta !== undefined) {
            eventsInProgress.pitch = eventData;
        }
        if (handlerResult.bearingDelta !== undefined) {
            eventsInProgress.rotate = eventData;
        }

    }

    _applyChanges() {
        const combined: HandlerResult = {};
        const combinedEventsInProgress: EventsInProgress = {};
        const combinedDeactivatedHandlers = {};

        for (const [change, eventsInProgress, deactivatedHandlers] of this._changes) {

            if (change.panDelta) combined.panDelta = (combined.panDelta || new Point(0, 0))._add(change.panDelta);
            if (change.zoomDelta) combined.zoomDelta = (combined.zoomDelta || 0) + change.zoomDelta;
            if (change.bearingDelta) combined.bearingDelta = (combined.bearingDelta || 0) + change.bearingDelta;
            if (change.pitchDelta) combined.pitchDelta = (combined.pitchDelta || 0) + change.pitchDelta;
            if (change.around !== undefined) combined.around = change.around;
            if (change.pinchAround !== undefined) combined.pinchAround = change.pinchAround;
            if (change.noInertia) combined.noInertia = change.noInertia;

            extend(combinedEventsInProgress, eventsInProgress);
            extend(combinedDeactivatedHandlers, deactivatedHandlers);
        }

        this._updateMapTransform(combined, combinedEventsInProgress, combinedDeactivatedHandlers);
        this._changes = [];
    }

    _updateMapTransform(combinedResult: HandlerResult,
        combinedEventsInProgress: EventsInProgress,
        deactivatedHandlers: {[handlerName: string]: Event}) {
        const map = this._map;
        const tr = map._getTransformForUpdate();
        const terrain = map.terrain;

        if (!hasChange(combinedResult) && !(terrain && this._terrainMovement)) {
            return this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);
        }

        let {panDelta, zoomDelta, bearingDelta, pitchDelta, around, pinchAround} = combinedResult;

        if (pinchAround !== undefined) {
            around = pinchAround;
        }

        // stop any ongoing camera animations (easeTo, flyTo)
        map._stop(true);

        around = around || map.transform.centerPoint;

        if (terrain && !tr.isPointOnMapSurface(around)) {
            around = tr.centerPoint;
        }

        // JP: TODO: inertia is NOT handled here
        if (this._map.projection.useGlobeControls) {
            // Globe map controls
            const zoomPixel = around;
            const zoomLoc = tr.pointLocation(zoomPixel);

            // We need special handling of cases when the zoomed point is on the more distant hemisphere (aligned with equator).
            // This can happen when looking at the poles at low zooms.

            // if (zoomDelta && distanceOfAnglesDegrees(zoomLoc.lng, tr.center.lng) > 90) {
            //     const vectorToCenter = angularCoordinatesToVector(tr.center);
            //     const vectorToZoomLoc = angularCoordinatesToVector(zoomLoc);
            //     const zoomPlaneNormal: vec3 = new Float64Array(3) as any;
            //     vec3.cross(zoomPlaneNormal, vectorToCenter, vectorToZoomLoc);
            //     vec3.normalize(zoomPlaneNormal, zoomPlaneNormal);

            //     const hemisphereNormal: vec3 = new Float64Array(3) as any;
            //     hemisphereNormal[0] = vectorToCenter[0];
            //     hemisphereNormal[2] = vectorToCenter[2];
            //     vec3.normalize(hemisphereNormal, hemisphereNormal);

            //     const intersectionAxis = new Float64Array(3) as any;
            //     vec3.cross(intersectionAxis, hemisphereNormal, zoomPlaneNormal);
            //     vec3.normalize(intersectionAxis, intersectionAxis);

            //     if (vec3.dot(intersectionAxis, vectorToZoomLoc) < 0) {
            //         vec3.scale(intersectionAxis, intersectionAxis, -1);
            //     }

            //     zoomLoc = sphereSurfacePointToCoordinates(intersectionAxis);
            //     zoomPixel = tr.locationPoint(zoomLoc);
            // }

            // if (zoomDelta && distanceOfAnglesDegrees(zoomLoc.lng, tr.center.lng) > 90) {
            //     const candidateLngA = mod(tr.center.lng + 90, 360);
            //     const candidateLngB = mod(tr.center.lng - 90, 360);

            //     if (distanceOfAnglesDegrees(zoomLoc.lng, candidateLngA) < distanceOfAnglesDegrees(zoomLoc.lng, candidateLngB)) {
            //         zoomLoc.lng = candidateLngA;
            //     } else {
            //         zoomLoc.lng = candidateLngB;
            //     }

            //     // We will instead zoom to the closest point that *is* on the nearer hemisphere,
            //     // assuming we keep its latitude the same.
            //     zoomPixel = tr.locationPoint(zoomLoc);
            // }

            if (bearingDelta) tr.bearing += bearingDelta;
            if (pitchDelta) tr.pitch += pitchDelta;
            const oldZoom = tr.zoom;
            if (zoomDelta) tr.zoom += zoomDelta;
            const postZoomDegreesPerPixel = getDegreesPerPixel(tr.worldSize, tr.center.lat);
            const actualZoomDelta = tr.zoom - oldZoom;

            // If `actualZoomDelta` is zero, it is interpreted as falsy, which is the desired behavior here.
            if (actualZoomDelta) {
                // Problem: `setLocationAtPoint` for globe works when it is called a single time, but is absolutely cursed in practice, unless the globe is in such a state that it approximates a flat map anyway.
                // - `setLocationAtPoint` at location behind a pole will eventually glitch out
                // - `setLocationAtPoint` at location the longitude of which is more than 90° different from current center will eventually glitch out
                // - possibly some more random glitches
                // - but works fine at higher zooms, where the map is still curved, but not yet mercator
                // Solution: use a heuristic zooming at low zoom levels, interpolate to `setLocationAtPoint` at higher zoom levels.
                // Needed:
                // - a good heuristic zooming
                // - interpolation approach
                // - interpolation constants tuning

                // Hard cases:
                // - cursor is not on planet surface
                // - cursor is on the other side of a pole

                // For our heuristic, we want to move the map center towards the location under the cursor.
                // But if the location is behind the pole region (that is beyond mercator edge), we first
                // project a line from the original target to current center, and choose a point on the line
                // that intersects the pole ring closer to the map center.
                // This translates to a plane-cone intersection.

                const zoomLocVec = angularCoordinatesToVector(zoomLoc);
                const centerVec = angularCoordinatesToVector(tr.center);

                let targetLocVec: vec3 = zoomLocVec;

                const planeNormal = createVec3();
                vec3.cross(planeNormal, zoomLocVec, centerVec);
                vec3.normalize(planeNormal, planeNormal);
                const nx = planeNormal[0];
                const ny = planeNormal[1];
                const nz = planeNormal[2];

                const coneAngleCos = Math.cos((90 - MAX_VALID_LATITUDE) * Math.PI / 180);

                const epsilon = 1e-10;
                const isNxZero = Math.abs(planeNormal[0]) < epsilon;
                const isNzZero = Math.abs(planeNormal[2]) < epsilon;
                if (!isNxZero) {
                    const a = nz * nz / nx / nx + 1;
                    const b = 2 * coneAngleCos * ny * nz / nx / nx;
                    const c = coneAngleCos * coneAngleCos * ny * ny / nx / nx + coneAngleCos * coneAngleCos - 1;
                    const sol = solveQuadratic(a, b, c);
                    if (sol) {
                        // 0 = we use t0
                        // 1 = we use t1
                        // a = we assume north pole
                        // b = we assume south pole
                        const vz0a = sol.t0;
                        const vy0a = coneAngleCos;
                        const vx0a = -(vy0a * ny + vz0a * nz) / nx;

                        const vz0b = sol.t0;
                        const vy0b = -coneAngleCos;
                        const vx0b = -(vy0b * ny + vz0b * nz) / nx;

                        const vz1a = sol.t1;
                        const vy1a = coneAngleCos;
                        const vx1a = -(vy1a * ny + vz1a * nz) / nx;

                        const vz1b = sol.t1;
                        const vy1b = -coneAngleCos;
                        const vx1b = -(vy1b * ny + vz1b * nz) / nx;

                        targetLocVec = pickVector(
                            centerVec,
                            [vx0a, vy0a, vz0a],
                            [vx0b, vy0b, vz0b],
                            [vx1a, vy1a, vz1a],
                            [vx1b, vy1b, vz1b]
                        );
                    }
                } else if (!isNzZero) {
                    const a = nx * nx / nz / nz + 1;
                    const b = 2 * coneAngleCos * ny * nx / nz / nz;
                    const c = coneAngleCos * coneAngleCos * ny * ny / nz / nz + coneAngleCos * coneAngleCos - 1;
                    const sol = solveQuadratic(a, b, c);
                    if (sol) {
                        // 0 = we use t0
                        // 1 = we use t1
                        // a = we assume north pole
                        // b = we assume south pole
                        const vx0a = sol.t0;
                        const vy0a = coneAngleCos;
                        const vz0a = -(vy0a * ny + vx0a * nx) / nz;

                        const vx0b = sol.t0;
                        const vy0b = -coneAngleCos;
                        const vz0b = -(vy0b * ny + vx0b * nx) / nz;

                        const vx1a = sol.t1;
                        const vy1a = coneAngleCos;
                        const vz1a = -(vy1a * ny + vx1a * nx) / nz;

                        const vx1b = sol.t1;
                        const vy1b = -coneAngleCos;
                        const vz1b = -(vy1b * ny + vx1b * nx) / nz;

                        targetLocVec = pickVector(
                            centerVec,
                            [vx0a, vy0a, vz0a],
                            [vx0b, vy0b, vz0b],
                            [vx1a, vy1a, vz1a],
                            [vx1b, vy1b, vz1b]
                        );
                    }
                } else {
                    // Use the original zoomLoc as target loc
                }

                const targetLoc = sphereSurfacePointToCoordinates(targetLocVec);
                const dLng = differenceOfAnglesDegrees(tr.center.lng, targetLoc.lng);
                const dLat = differenceOfAnglesDegrees(tr.center.lat, targetLoc.lat);

                tr.center = new LngLat(
                );

                //

                // cos(x) * a + sin(x) * b = c, solve for x

                // rovina normála: (nx ny nz)
                // cone vector: (cx cy cz)
                // cos(cone angle): ca
                // hledaný vektor: (vx vy vz)
                //
                // splňuje:
                // vx^2 + vy^2 + vz^2 = 1     ... je jednotkový
                // vx*nx + vy*ny + vz*nz = 0  ... leží v rovině
                // vx*cx + vy*cy + vz*cz = ca ... je na okraji kuželu
                //
                // vím, že cx,cz=0, cy=1,-1 pak umím zjednodušit:
                // vx^2 + vy^2 + vz^2 = 1     ... je jednotkový
                // vx*nx + vy*ny + vz*nz = 0  ... leží v rovině
                // vy*cy = ca ... je na okraji kuželu
                //       -> znám vy: vy = ca nebo -ca
                // vx = -(vy*ny + vz*nz) / nx
                // ... kde nx != 0
                // Dosadíme:
                // (-(vy*ny + vz*nz) / nx)^2 + vy^2 + vz^2 = 1
                // (vy^2*ny^2 + 2*vy*ny*vz*nz + vz^2*nz^2) / nx^2 + vy^2 + vz^2 = 1
                // vy^2*ny^2/nx^2 + vy^2 - 1 = -vz^2 - 2*vy*ny*vz*nz/nx^2 - vz^2*nz^2/nx^2
                // vz^2 + 2*vy*ny*vz*nz/nx^2 + vz^2*nz^2/nx^2 + vy^2*ny^2/nx^2 + vy^2 - 1 = 0
                //
                // Což je kvadratická rovnice pro vz:
                // a = nz^2/nx^2 + 1
                // b = 2*vy*ny*nz/nx^2
                // c = vy^2*ny^2/nx^2 + vy^2 - 1
                // ... kde nx != 0
            }

            // Terrain needs no special handling in this case, since the drag-pixel-at-horizon problem described below
            // is avoided here - dragging speed is the same no matter what screen pixel you grab.
            if (panDelta) {
                // These are actually very similar to mercator controls, and should converge to them at high zooms.
                // We avoid using the "grab a place and move it around" approach from mercator here,
                // since it is not a very pleasant way to pan a globe.

                // Apply map bearing to the panning vector
                const rotatedPanDelta = panDelta.rotate(-tr.angle);

                const oldLat = tr.center.lat;
                // Note: we divide longitude speed by planet width at the given latitude. But we diminish this effect when the globe is zoomed out a lot.
                const normalizedGlobeZoom = tr.zoom + getZoomAdjustment(tr.center.lat, 0); // If the transform center would be moved to latitude 0, what would the current zoom be?
                const lngSpeed = lerp(
                    1.0 / Math.cos(tr.center.lat * Math.PI / 180), // speed adjusted by latitude
                    1.0 / Math.cos(Math.min(Math.abs(tr.center.lat), 60) * Math.PI / 180), // also adjusted, but latitude is clamped to 60° to avoid too large speeds near poles
                    remapSaturate(normalizedGlobeZoom, 7, 3, 0, 1.0) // Empirically chosen values
                );
                tr.center = new LngLat(
                    tr.center.lng - rotatedPanDelta.x * postZoomDegreesPerPixel * lngSpeed,
                    clamp(tr.center.lat + rotatedPanDelta.y * postZoomDegreesPerPixel, -MAX_VALID_LATITUDE, MAX_VALID_LATITUDE)
                );
                tr.zoom += getZoomAdjustment(oldLat, tr.center.lat);
            }
        } else {
            // Flat map controls
            if (!tr.isPointOnMapSurface(around)) {
                around = tr.centerPoint;
            }

            const loc = tr.pointLocation(panDelta ? around.sub(panDelta) : around);
            if (bearingDelta) tr.bearing += bearingDelta;
            if (pitchDelta) tr.pitch += pitchDelta;
            if (zoomDelta) tr.zoom += zoomDelta;

            if (!terrain) {
                tr.setLocationAtPoint(loc, around);
            } else {
                // when 3d-terrain is enabled act a little different:
                //    - dragging do not drag the picked point itself, instead it drags the map by pixel-delta.
                //      With this approach it is no longer possible to pick a point from somewhere near
                //      the horizon to the center in one move.
                //      So this logic avoids the problem, that in such cases you easily loose orientation.
                if (!this._terrainMovement &&
                    (combinedEventsInProgress.drag || combinedEventsInProgress.zoom)) {
                    // When starting to drag or move, flag it and register moveend to clear flagging
                    this._terrainMovement = true;
                    this._map._elevationFreeze = true;
                    tr.setLocationAtPoint(loc, around);
                } else if (combinedEventsInProgress.drag && this._terrainMovement) {
                    // drag map
                    tr.center = tr.pointLocation(tr.centerPoint.sub(panDelta));
                } else {
                    tr.setLocationAtPoint(loc, around);
                }
            }
        }

        map._applyUpdatedTransform(tr);

        this._map._update();
        if (!combinedResult.noInertia) this._inertia.record(combinedResult);
        this._fireEvents(combinedEventsInProgress, deactivatedHandlers, true);

    }

    _fireEvents(newEventsInProgress: EventsInProgress, deactivatedHandlers: {[handlerName: string]: Event}, allowEndAnimation: boolean) {

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
        if (finishedMoving && this._terrainMovement) {
            this._map._elevationFreeze = false;
            this._terrainMovement = false;
            this._map.transform.recalculateZoom(this._map.terrain);
        }
        if (allowEndAnimation && finishedMoving) {
            this._updatingCamera = true;
            const inertialEase = this._inertia._onMoveEnd(this._map.dragPan._inertiaOptions);

            const shouldSnapToNorth = bearing => bearing !== 0 && -this._bearingSnap < bearing && bearing < this._bearingSnap;

            if (inertialEase && (inertialEase.essential || !browser.prefersReducedMotion)) {
                if (shouldSnapToNorth(inertialEase.bearing || this._map.getBearing())) {
                    inertialEase.bearing = 0;
                }
                inertialEase.freezeElevation = true;
                this._map.easeTo(inertialEase, {originalEvent: originalEndEvent});
            } else {
                this._map.fire(new Event('moveend', {originalEvent: originalEndEvent}));
                if (shouldSnapToNorth(this._map.getBearing())) {
                    this._map.resetNorth();
                }
            }
            this._updatingCamera = false;
        }

    }

    _fireEvent(type: string, e?: Event) {
        this._map.fire(new Event(type, e ? {originalEvent: e} : {}));
    }

    _requestFrame() {
        this._map.triggerRepaint();
        return this._map._renderTaskQueue.add(timeStamp => {
            delete this._frameId;
            this.handleEvent(new RenderFrameEvent('renderFrame', {timeStamp}));
            this._applyChanges();
        });
    }

    _triggerRenderFrame() {
        if (this._frameId === undefined) {
            this._frameId = this._requestFrame();
        }
    }
}
