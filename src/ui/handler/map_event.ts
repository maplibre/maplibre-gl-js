import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../events.ts';
import {type Handler, type HandlerResult} from '../handler_manager.ts';
import type {Map} from '../map.ts';
import type Point from '@mapbox/point-geometry';

export class MapEventHandler implements Handler {

    _mousedownPos: Point;
    _clickTolerance: number;
    _map: Map;

    constructor(map: Map, options: {
        clickTolerance: number;
    }) {
        this._map = map;
        this._clickTolerance = options.clickTolerance;
    }

    reset(): void {
        delete this._mousedownPos;
    }

    wheel(e: WheelEvent): HandlerResult | void {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - ScrollZoom
        return this._firePreventable(new MapWheelEvent(this._map, e));
    }

    mousedown(e: MouseEvent, point: Point): HandlerResult | void {
        this._mousedownPos = point;
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - MousePan
        // - MouseRotate
        // - MousePitch
        // - DblclickHandler
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }

    mouseup(e: MouseEvent): void {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    click(e: MouseEvent, point: Point): void {
        if (this._mousedownPos && this._mousedownPos.dist(point) >= this._clickTolerance) return;
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    dblclick(e: MouseEvent): HandlerResult | void {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - DblClickZoom
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }

    mouseover(e: MouseEvent): void {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    mouseout(e: MouseEvent): void {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    touchstart(e: TouchEvent): HandlerResult | void {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - TouchPan
        // - TouchZoom
        // - TouchRotate
        // - TouchPitch
        // - TapZoom
        // - SwipeZoom
        return this._firePreventable(new MapTouchEvent(e.type, this._map, e));
    }

    touchmove(e: TouchEvent): void {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    touchend(e: TouchEvent): void {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    touchcancel(e: TouchEvent): void {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    _firePreventable(mapEvent: MapMouseEvent | MapTouchEvent | MapWheelEvent): HandlerResult | void {
        this._map.fire(mapEvent);
        if (mapEvent.defaultPrevented) {
            // returning an object marks the handler as active and resets other handlers
            return {};
        }
    }

    isEnabled(): boolean {
        return true;
    }

    isActive(): boolean {
        return false;
    }
    enable(): void {}
    disable(): void {}
}

/**
 * A single finger held in place this long fires a long-press contextmenu.
 */
const LONG_PRESS_DELAY = 500;

export class BlockableMapEventHandler {
    _map: Map;
    _clickTolerance: number;
    _delayContextMenu: boolean;
    _ignoreContextMenu: boolean;
    _contextMenuEvent: MouseEvent;
    _touchActive: boolean;
    _longPressTimer: ReturnType<typeof setTimeout>;
    _longPressStart: Point;

    constructor(map: Map, options: {
        clickTolerance: number;
    }) {
        this._map = map;
        this._clickTolerance = options.clickTolerance || 1;
    }

    reset(): void {
        this._delayContextMenu = false;
        this._ignoreContextMenu = true;
        delete this._contextMenuEvent;
        this._clearLongPress();
        this._touchActive = false;
    }

    mousemove(e: MouseEvent): void {
        // mousemove map events should not be fired when interaction handlers (pan, rotate, etc) are active
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    mousedown(): void {
        this._delayContextMenu = true;
        this._ignoreContextMenu = false;
    }

    mouseup(): void {
        this._delayContextMenu = false;
        if (this._contextMenuEvent) {
            this._map.fire(new MapMouseEvent('contextmenu', this._map, this._contextMenuEvent));
            delete this._contextMenuEvent;
        }
    }

    /**
     * Starts the touch long press. Touch devices have no right click, so a long press opens
     * the context menu. It is detected with a timer rather than by relying on a native
     * contextmenu event, because Android Chrome fires one on a long press but iOS
     * Safari does not. A single finger held past the delay without moving fires a
     * contextmenu at that point; a pan or a lift cancels it.
     * @param e - the touch event
     * @param points - the touch points, in map coordinates
     * @param mapTouches - the touches that are on the map
     */
    touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]): void {
        this._clearLongPress();
        this._touchActive = mapTouches.length > 0;
        if (mapTouches.length !== 1) return; // single finger only, never during a pinch
        this._longPressStart = points[0];
        const touch = mapTouches[0];
        this._longPressTimer = setTimeout(() => {
            this._longPressTimer = undefined;
            const originalEvent = new MouseEvent('contextmenu', {clientX: touch.clientX, clientY: touch.clientY, button: 2, bubbles: true, cancelable: true});
            this._map.fire(new MapMouseEvent('contextmenu', this._map, originalEvent));
        }, LONG_PRESS_DELAY);
    }

    /**
     * Cancels a pending long press once the finger has moved further than the map's
     * click tolerance, or once a second finger lands.
     * @param e - the touch event
     * @param points - the touch points, in map coordinates
     * @param mapTouches - the touches that are on the map
     */
    touchmove(e: TouchEvent, points: Point[], mapTouches: Touch[]): void {
        if (!this._longPressTimer) return;
        if (mapTouches.length !== 1 || !this._longPressStart || points[0].dist(this._longPressStart) > this._clickTolerance) {
            this._clearLongPress();
        }
    }

    touchend(): void {
        this._touchActive = false;
        this._clearLongPress();
    }

    touchcancel(): void {
        this._touchActive = false;
        this._clearLongPress();
    }

    _clearLongPress(): void {
        if (this._longPressTimer) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = undefined;
        }
        this._longPressStart = undefined;
    }

    contextmenu(e: MouseEvent): void {
        if (this._touchActive) {
            // A native contextmenu during a touch (Android's long press, or an iOS
            // callout) is suppressed: the long-press timer owns touch, so letting
            // this through would double-fire or pop the browser's own menu.
            e.preventDefault();
            return;
        }
        if (this._delayContextMenu) {
            // Mac: contextmenu fired on mousedown; we save it until mouseup for consistency's sake
            this._contextMenuEvent = e;
        } else if (!this._ignoreContextMenu) {
            // Windows: contextmenu fired on mouseup, so fire event now
            this._map.fire(new MapMouseEvent(e.type, this._map, e));
        }

        // prevent browser context menu when necessary
        if (this._map.listens('contextmenu')) {
            e.preventDefault();
        }
    }

    isEnabled(): boolean {
        return true;
    }

    isActive(): boolean {
        return false;
    }
    enable(): void {}
    disable(): void {}
}
