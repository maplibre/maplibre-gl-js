import Point from '@mapbox/point-geometry';
import {indexTouches} from './handler_util';
import type Map from '../map';
import {GestureOptions} from '../map';

export default class TouchPanHandler {

    _enabled: boolean;
    _active: boolean;
    _touches: {
        [k in string | number]: Point;
    };
    _minTouches: number;
    _clickTolerance: number;
    _sum: Point;
    _map: Map;
    _cancelCooperativeMessage: boolean;

    constructor(options: {
        clickTolerance: number;
        cooperativeGestures: boolean | GestureOptions;
    }, map: Map) {
        this._minTouches = options.cooperativeGestures ? 2 : 1;
        this._clickTolerance = options.clickTolerance || 1;
        this._map = map;
        this.reset();
    }

    reset() {
        this._active = false;
        this._touches = {};
        this._sum = new Point(0, 0);

        // Put a delay on the cooperative gesture message so it's less twitchy
        setTimeout(() => {
            this._cancelCooperativeMessage = false;
        }, 200);
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        return this._calculateTransform(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (this._map._cooperativeGestures) {
            if (this._minTouches === 2 && mapTouches.length < 2 && !this._cancelCooperativeMessage) {
                // If coop gesture enabled, show panning info to user
                this._map._onCooperativeGesture(e, false, mapTouches.length);
            } else if (!this._cancelCooperativeMessage) {
                // If user is successfully navigating, we don't need this warning until the touch resets
                this._cancelCooperativeMessage = true;
            }
        }
        if (!this._active || mapTouches.length < this._minTouches) return;
        e.preventDefault();
        return this._calculateTransform(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._calculateTransform(e, points, mapTouches);

        if (this._active && mapTouches.length < this._minTouches) {
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

        if (touchDeltaCount < this._minTouches || !touchDeltaSum.mag()) return;

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
