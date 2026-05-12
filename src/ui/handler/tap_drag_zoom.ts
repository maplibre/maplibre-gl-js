import {type Handler} from '../handler_manager.ts';
import {TapRecognizer, MAX_TAP_INTERVAL, MAX_DIST} from './tap_recognizer.ts';
import type Point from '@mapbox/point-geometry';

const defaultZoomRate = 1;

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
    _zoomRate: number;

    constructor() {

        this._tap = new TapRecognizer({
            numTouches: 1,
            numTaps: 1
        });
        this._zoomRate = defaultZoomRate;

        this.reset();
    }

    setZoomRate(zoomRate?: number): void {
        this._zoomRate = zoomRate ?? defaultZoomRate;
    }

    reset(): void {
        this._active = false;
        delete this._swipePoint;
        delete this._swipeTouch;
        delete this._tapTime;
        delete this._tapPoint;
        this._tap.reset();
    }

    touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]): void {
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

    touchmove(e: TouchEvent, points: Point[], mapTouches: Touch[]): {zoomDelta: number} | void {
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
                zoomDelta: dist / 128 * this._zoomRate
            };
        }
    }

    touchend(e: TouchEvent, points: Point[], mapTouches: Touch[]): void {
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

    touchcancel(): void {
        this.reset();
    }

    enable(): void {
        this._enabled = true;
    }

    disable(): void {
        this._enabled = false;
        this.reset();
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    isActive(): boolean {
        return this._active;
    }
}
