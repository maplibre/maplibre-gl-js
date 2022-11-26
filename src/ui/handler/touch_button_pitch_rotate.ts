import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';

class TouchHandler {

    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _firstTouch: number;
    _moved: boolean;
    _clickTolerance: number;

    constructor(options: {
        clickTolerance: number;
    }) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
    }

    reset() {
        this._active = false;
        this._moved = false;
        delete this._lastPoint;
        delete this._firstTouch;
    }

    _correctTouch(e: TouchEvent) {
        return e.targetTouches.length === 1;
    }

    _move(lastPoint: Point, point: Point) {  //eslint-disable-line
        return {}; // implemented by child
    }

    touchstart(e: TouchEvent, point: Point) {
        if (this._lastPoint) return;

        if (!this._correctTouch(e)) return;

        this._lastPoint = point;
        this._firstTouch = e.targetTouches[0].identifier;
    }

    touchmoveWindow(e: TouchEvent, point: Point) {
        const lastPoint = this._lastPoint;
        if (!lastPoint) return;
        e.preventDefault();

        if (!this._correctTouch(e) || e.targetTouches[0].identifier !== this._firstTouch)  {
            this.reset();
            return;
        }

        if (!this._moved && point.dist(lastPoint) < this._clickTolerance) return;
        this._moved = true;
        this._lastPoint = point;

        // implemented by child class
        return this._move(lastPoint, point);
    }

    touchendWindow(e: TouchEvent) {
        if (!this._lastPoint) return;
        if (!this._correctTouch(e) || e.targetTouches[0].identifier !== this._firstTouch) return;
        if (this._moved) DOM.suppressClick();
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

export class TouchRotateHandler extends TouchHandler {
    _move(lastPoint: Point, point: Point) {
        const degreesPerPixelMoved = 0.8;
        const bearingDelta = (point.x - lastPoint.x) * degreesPerPixelMoved;
        if (bearingDelta) {
            this._active = true;
            return {bearingDelta};
        }
    }
}

export class TouchPitchHandler extends TouchHandler {
    _move(lastPoint: Point, point: Point) {
        const degreesPerPixelMoved = -0.5;
        const pitchDelta = (point.y - lastPoint.y) * degreesPerPixelMoved;
        if (pitchDelta) {
            this._active = true;
            return {pitchDelta};
        }
    }
}
