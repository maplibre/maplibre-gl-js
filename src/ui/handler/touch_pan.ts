import Point from '@mapbox/point-geometry';
import {indexTouches} from './handler_util';
import {Handler} from '../handler_manager';
import type {Map} from '../map';

/**
 * A `TouchPanHandler` allows the user to pan the map using touch gestures.
 */
export class TouchPanHandler implements Handler {

    _enabled: boolean;
    _active: boolean;
    _touches: {
        [k in string | number]: Point;
    };
    _clickTolerance: number;
    _sum: Point;
    _map: Map;

    constructor(options: {clickTolerance: number}, map: Map) {
        this._clickTolerance = options.clickTolerance || 1;
        this._map = map;
        this.reset();
    }

    reset() {
        this._active = false;
        this._touches = {};
        this._sum = new Point(0, 0);
    }

    _shouldBePrevented(touchesCount: number) {
        const minTouches = this._map.cooperativeGestures.isEnabled() ? 2 : 1;
        return touchesCount < minTouches;
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        return this._calculateTransform(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._active) return;
        if (this._shouldBePrevented(mapTouches.length)) {
            this._map.cooperativeGestures.notifyGestureBlocked('touch_pan', e);
            return;
        }
        e.preventDefault();
        return this._calculateTransform(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._calculateTransform(e, points, mapTouches);

        if (this._active && this._shouldBePrevented(mapTouches.length)) {
            this.reset();
        }
    }

    touchcancel() {
        this.reset();
    }

    _calculateTransform(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (mapTouches.length > 0) this._active = true;

        const touches = indexTouches(mapTouches, points);

        const touchPointSum = new Point(0, 0);
        const touchDeltaSum = new Point(0, 0);
        let touchDeltaCount = 0;

        for (const identifier in touches) {
            const point = touches[identifier];
            const prevPoint = this._touches[identifier];
            if (prevPoint) {
                touchPointSum._add(point);
                touchDeltaSum._add(point.sub(prevPoint));
                touchDeltaCount++;
                touches[identifier] = point;
            }
        }

        this._touches = touches;

        if (this._shouldBePrevented(touchDeltaCount) || !touchDeltaSum.mag()) return;

        const panDelta = touchDeltaSum.div(touchDeltaCount);
        this._sum._add(panDelta);
        if (this._sum.mag() < this._clickTolerance) return;

        const around = touchPointSum.div(touchDeltaCount);

        return {
            around,
            panDelta
        };
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
