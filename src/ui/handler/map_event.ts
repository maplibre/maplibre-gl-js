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
        return this._firePreventable(new MapWheelEvent(e.type, this._map, e));
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

export class BlockableMapEventHandler {
    _map: Map;
    _delayContextMenu: boolean;
    _ignoreContextMenu: boolean;
    _contextMenuEvent: MouseEvent;

    constructor(map: Map) {
        this._map = map;
    }

    reset(): void {
        this._delayContextMenu = false;
        this._ignoreContextMenu = true;
        delete this._contextMenuEvent;
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
    contextmenu(e: MouseEvent): void {
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
