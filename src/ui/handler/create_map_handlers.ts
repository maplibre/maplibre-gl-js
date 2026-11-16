import {MapEventHandler, BlockableMapEventHandler} from './map_event.ts';
import {BoxZoomHandler} from './box_zoom.ts';
import {TapZoomHandler} from './tap_zoom.ts';
import {generateMouseRotationHandler, generateMousePitchHandler, generateMousePanHandler, generateMouseRollHandler} from './mouse.ts';
import {TouchPanHandler} from './touch_pan.ts';
import {TwoFingersTouchZoomHandler, TwoFingersTouchRotateHandler, TwoFingersTouchPitchHandler} from './two_fingers_touch.ts';
import {KeyboardHandler} from './keyboard.ts';
import {ScrollZoomHandler} from './scroll_zoom.ts';
import {DoubleClickZoomHandler} from './shim/dblclick_zoom.ts';
import {ClickZoomHandler} from './click_zoom.ts';
import {TapDragZoomHandler} from './tap_drag_zoom.ts';
import {DragPanHandler} from './shim/drag_pan.ts';
import {DragRotateHandler} from './shim/drag_rotate.ts';
import {TwoFingersTouchZoomRotateHandler} from './shim/two_fingers_touch.ts';
import {CooperativeGesturesHandler} from './cooperative_gestures.ts';

import type Point from '@mapbox/point-geometry';
import type {Camera} from '../camera.ts';
import type {MapEventFactory} from '../map_event_factory.ts';
import type {CompleteMapOptions} from '../map.ts';
import type {Handler, HandlerRegistration} from '../handler_manager.ts';

/**
 * @internal
 * The handlers a map exposes as its properties of the same names, such as `map.dragPan`.
 */
export type MapHandlers = {
    boxZoom: BoxZoomHandler;
    cooperativeGestures: CooperativeGesturesHandler;
    doubleClickZoom: DoubleClickZoomHandler;
    touchPitch: TwoFingersTouchPitchHandler;
    dragRotate: DragRotateHandler;
    dragPan: DragPanHandler;
    touchZoomRotate: TwoFingersTouchZoomRotateHandler;
    scrollZoom: ScrollZoomHandler;
    keyboard: KeyboardHandler;
};

/**
 * @internal
 * What a map gives {@link createMapHandlers} to build its handlers with.
 */
export type MapHandlersContext = {
    camera: Camera;
    canvas: HTMLCanvasElement;
    /** The element that holds the canvas. */
    canvasContainer: HTMLElement;
    /** The map's container, which holds the box a box zoom draws. */
    container: HTMLElement;
    /** The map's UI strings, for the cooperative gestures help message. */
    locale: Record<string, string>;
    /** Creates the map's mouse, touch and wheel events for the handlers that fire them. */
    eventFactory: MapEventFactory;
    /** The map's `boxZoomEnd` option, with the map already bound to it. */
    boxZoomEnd?: (startPos: Point, endPos: Point, originalEvent: MouseEvent) => void;
};

/**
 * @internal
 * Builds a map's handlers, enabled as its options ask. The registrations are what a {@link HandlerManager} runs, in
 * the order it runs them and with the handlers each may run alongside; the map handlers are what the map exposes.
 */
export function createMapHandlers(context: MapHandlersContext, options: CompleteMapOptions): {registrations: HandlerRegistration[]; mapHandlers: MapHandlers} {
    const {camera, canvas, canvasContainer: el} = context;

    const registrations: HandlerRegistration[] = [];
    function add(handlerName: string, handler: Handler, allowed?: string[]): void {
        registrations.push({handlerName, handler, allowed});
    }

    add('mapEvent', new MapEventHandler(context.eventFactory, options));

    const boxZoom = new BoxZoomHandler(el, context.container, options, camera, context.boxZoomEnd);
    add('boxZoom', boxZoom);
    if (options.interactive && options.boxZoom) {
        boxZoom.enable();
    }

    const cooperativeGestures = new CooperativeGesturesHandler(el, context.locale, options.cooperativeGestures);
    add('cooperativeGestures', cooperativeGestures);
    if (options.cooperativeGestures) {
        cooperativeGestures.enable();
    }

    const tapZoom = new TapZoomHandler(camera);
    const clickZoom = new ClickZoomHandler(camera);
    const doubleClickZoom = new DoubleClickZoomHandler(clickZoom, tapZoom);
    add('tapZoom', tapZoom);
    add('clickZoom', clickZoom);
    if (options.interactive && options.doubleClickZoom) {
        doubleClickZoom.enable();
    }

    const tapDragZoom = new TapDragZoomHandler();
    add('tapDragZoom', tapDragZoom);

    const touchPitch = new TwoFingersTouchPitchHandler(cooperativeGestures);
    add('touchPitch', touchPitch);
    if (options.interactive && options.touchPitch) {
        touchPitch.enable(options.touchPitch);
    }

    const getCenter = () => camera.projectedCamera.centerPoint;
    const getAround = () => dragRotate.around;
    const getMovement = () => dragRotate.movement;
    const mouseRotate = generateMouseRotationHandler(options, getCenter, getAround, getMovement);
    const mousePitch = generateMousePitchHandler(options, getAround);
    const mouseRoll = generateMouseRollHandler(options, getCenter, getAround);
    const dragRotate = new DragRotateHandler(options, mouseRotate, mousePitch, mouseRoll);
    add('mouseRotate', mouseRotate, ['mousePitch']);
    add('mousePitch', mousePitch, ['mouseRotate', 'mouseRoll']);
    add('mouseRoll', mouseRoll, ['mousePitch']);
    if (options.interactive && options.dragRotate) {
        dragRotate.enable(options.dragRotate);
    }

    const mousePan = generateMousePanHandler(options);
    const touchPan = new TouchPanHandler(options, cooperativeGestures);
    const dragPan = new DragPanHandler(el, mousePan, touchPan);
    add('mousePan', mousePan);
    add('touchPan', touchPan, ['touchZoom', 'touchRotate']);
    if (options.interactive && options.dragPan) {
        dragPan.enable(options.dragPan);
    }

    const touchRotate = new TwoFingersTouchRotateHandler();
    const touchZoom = new TwoFingersTouchZoomHandler();
    const touchZoomRotate = new TwoFingersTouchZoomRotateHandler(el, touchZoom, touchRotate, tapDragZoom);
    add('touchRotate', touchRotate, ['touchPan', 'touchZoom']);
    add('touchZoom', touchZoom, ['touchPan', 'touchRotate']);
    if (options.interactive && options.touchZoomRotate) {
        touchZoomRotate.enable(options.touchZoomRotate);
    }

    add('blockableMapEvent', new BlockableMapEventHandler(context.eventFactory, options), ['touchPan']);

    const scrollZoom = new ScrollZoomHandler(canvas, cooperativeGestures, camera);
    add('scrollZoom', scrollZoom, ['mousePan']);
    if (options.interactive && options.scrollZoom) {
        scrollZoom.enable(options.scrollZoom);
    }

    const keyboard = new KeyboardHandler(camera);
    add('keyboard', keyboard);
    if (options.interactive && options.keyboard) {
        keyboard.enable();
    }

    return {
        registrations,
        mapHandlers: {boxZoom, cooperativeGestures, doubleClickZoom, touchPitch, dragRotate, dragPan, touchZoomRotate, scrollZoom, keyboard}
    };
}
