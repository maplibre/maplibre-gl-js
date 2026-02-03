import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../events';
import {type Handler} from '../handler_manager';
import type {Map} from '../map';
import Point from '@mapbox/point-geometry';

const LONG_PRESS_DURATION = 500;
const MAX_DIST = 30;

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

    reset() {
        delete this._mousedownPos;
    }

    wheel(e: WheelEvent) {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - ScrollZoom
        return this._firePreventable(new MapWheelEvent(e.type, this._map, e));
    }

    mousedown(e: MouseEvent, point: Point) {
        this._mousedownPos = point;
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - MousePan
        // - MouseRotate
        // - MousePitch
        // - DblclickHandler
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }

    mouseup(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    click(e: MouseEvent, point: Point) {
        if (this._mousedownPos && this._mousedownPos.dist(point) >= this._clickTolerance) return;
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    dblclick(e: MouseEvent) {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - DblClickZoom
        return this._firePreventable(new MapMouseEvent(e.type, this._map, e));
    }

    mouseover(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    mouseout(e: MouseEvent) {
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    touchstart(e: TouchEvent) {
        // If mapEvent.preventDefault() is called by the user, prevent handlers such as:
        // - TouchPan
        // - TouchZoom
        // - TouchRotate
        // - TouchPitch
        // - TapZoom
        // - SwipeZoom
        return this._firePreventable(new MapTouchEvent(e.type, this._map, e));
    }

    touchmove(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    touchend(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    touchcancel(e: TouchEvent) {
        this._map.fire(new MapTouchEvent(e.type, this._map, e));
    }

    _firePreventable(mapEvent: MapMouseEvent | MapTouchEvent | MapWheelEvent) {
        this._map.fire(mapEvent);
        if (mapEvent.defaultPrevented) {
            // returning an object marks the handler as active and resets other handlers
            return {};
        }
    }

    isEnabled() {
        return true;
    }

    isActive() {
        return false;
    }
    enable() {}
    disable() {}
}

export class BlockableMapEventHandler {
    _map: Map;
    _delayContextMenu: boolean;
    _ignoreContextMenu: boolean;
    _contextMenuEvent: MouseEvent;
    _longPressTimer: ReturnType<typeof setTimeout> | null;
    _touchStartPoint: Point | null;
    _touchId: number | null;

    constructor(map: Map) {
        this._map = map;
        this._longPressTimer = null;
        this._touchStartPoint = null;
        this._touchId = null;
    }

    reset() {
        this._delayContextMenu = false;
        this._ignoreContextMenu = true;
        delete this._contextMenuEvent;
        this._clearLongPress();
    }

    _clearLongPress() {
        if (this._longPressTimer) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
        this._touchStartPoint = null;
        this._touchId = null;
    }

    mousemove(e: MouseEvent) {
        // mousemove map events should not be fired when interaction handlers (pan, rotate, etc) are active
        this._map.fire(new MapMouseEvent(e.type, this._map, e));
    }

    mousedown() {
        this._delayContextMenu = true;
        this._ignoreContextMenu = false;
    }

    mouseup() {
        this._delayContextMenu = false;
        if (this._contextMenuEvent) {
            this._map.fire(new MapMouseEvent('contextmenu', this._map, this._contextMenuEvent));
            delete this._contextMenuEvent;
        }
    }
    contextmenu(e: MouseEvent) {
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

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        // Only handle single-finger touch for long press
        if (mapTouches.length !== 1) {
            this._clearLongPress();
            return;
        }

        const touch = mapTouches[0];
        this._touchId = touch.identifier;
        this._touchStartPoint = points[0];
        this._ignoreContextMenu = false;

        this._longPressTimer = setTimeout(() => {
            if (this._touchStartPoint && !this._ignoreContextMenu) {
                // Create a synthetic mouse event for the contextmenu
                const canvas = this._map.getCanvas();
                const rect = canvas.getBoundingClientRect();
                const clientX = rect.left + this._touchStartPoint.x;
                const clientY = rect.top + this._touchStartPoint.y;

                const simulatedMouseEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    clientX,
                    clientY,
                    screenX: clientX,
                    screenY: clientY
                });

                this._map.fire(new MapMouseEvent('contextmenu', this._map, simulatedMouseEvent));

                // Prevent browser context menu
                if (this._map.listens('contextmenu')) {
                    e.preventDefault();
                }
            }
            this._clearLongPress();
        }, LONG_PRESS_DURATION);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._longPressTimer || !this._touchStartPoint) return;

        const touch = mapTouches.find(t => t.identifier === this._touchId);
        if (!touch) {
            this._clearLongPress();
            return;
        }

        const touchIndex = mapTouches.indexOf(touch);
        const movePoint = points[touchIndex];
        if (movePoint && this._touchStartPoint.dist(movePoint) > MAX_DIST) {
            this._clearLongPress();
        }
    }

    touchend() {
        this._clearLongPress();
    }

    touchcancel() {
        this._clearLongPress();
    }

    isEnabled() {
        return true;
    }

    isActive() {
        return false;
    }
    enable() {}
    disable() {}
}
