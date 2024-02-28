import {Handler} from '../handler_manager';
import {TapRecognizer, MAX_TAP_INTERVAL, MAX_DIST} from './tap_recognizer';
import type Point from '@mapbox/point-geometry';

/**
 * A `TapDragZoomHandler` allows the user to zoom the map at a point by double tapping. It also allows the user pan the map by dragging.
 */
export class TapDragZoomHandler implements Handler {

    _enabled: boolean;
    _active: boolean;
    _swipePoint: Point;
    _swipeTouch: number;
    _tapTime: number;
    _tapPoint: Point;
    _tap: TapRecognizer;

    constructor() {

        this._tap = new TapRecognizer({
            numTouches: 1,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this._active = false;
        delete this._swipePoint;
        delete this._swipeTouch;
        delete this._tapTime;
        delete this._tapPoint;
        this._tap.reset();
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (this._swipePoint) return;

        if (!this._tapTime) {
            this._tap.touchstart(e, points, mapTouches);
        } else {
            const swipePoint = points[0];

            const soonEnough = e.timeStamp - this._tapTime < MAX_TAP_INTERVAL;
            const closeEnough =  this._tapPoint.dist(swipePoint) < MAX_DIST;

            if (!soonEnough || !closeEnough) {
                this.reset();
            } else if (mapTouches.length > 0) {
                this._swipePoint = swipePoint;
                this._swipeTouch = mapTouches[0].identifier;
            }
        }
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._tapTime) {
            this._tap.touchmove(e, points, mapTouches);
        } else if (this._swipePoint) {
            if (mapTouches[0].identifier !== this._swipeTouch) {
                return;
            }

            const newSwipePoint = points[0];
            const dist = newSwipePoint.y - this._swipePoint.y;
            this._swipePoint = newSwipePoint;

            e.preventDefault();
            this._active = true;

            return {
                zoomDelta: dist / 128
            };
        }
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._tapTime) {
            const point = this._tap.touchend(e, points, mapTouches);
            if (point) {
                this._tapTime = e.timeStamp;
                this._tapPoint = point;
            }
        } else if (this._swipePoint) {
            if (mapTouches.length === 0) {
                this.reset();
            }
        }
    }

    touchcancel() {
        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
