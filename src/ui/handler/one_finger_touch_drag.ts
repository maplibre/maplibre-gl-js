import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';

interface OneFingerTouchMoveResults {
    bearingDelta?: number;
    pitchDelta?: number;
}

type MoveFunction = (lastPoint: Point, point: Point) => OneFingerTouchMoveResults;

const defaultMove: MoveFunction = (lastPoint: Point, point: Point) => ({});

export class OneFingerTouchHandler {

    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _firstTouch: number;
    _moved: boolean;
    _clickTolerance: number;
    _moveFunction: MoveFunction;

    constructor(options: {
        clickTolerance: number;
        move: MoveFunction;
    }) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
        this._move = options.move || defaultMove;
    }

    _move(...params: Parameters<MoveFunction>) {
        const move = this._moveFunction(...params);
        if (move.bearingDelta || move.pitchDelta) {
            this._active = true;
        }
        return move;
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

        if (!this._correctTouch(e) || e.targetTouches[0].identifier !== this._firstTouch) {
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

    static generateRotationHandler({clickTolerance, bearingDegreesPerPixelMoved = 0.8}: {
        clickTolerance: number;
        bearingDegreesPerPixelMoved?: number;
    }) {
        return new OneFingerTouchHandler({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({bearingDelta: (point.x - lastPoint.x) * bearingDegreesPerPixelMoved}),
        });
    }

    static generatePitchHandler({clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
        clickTolerance: number;
        pitchDegreesPerPixelMoved?: number;
    }) {
        return new OneFingerTouchHandler({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved}),
        });
    }
}
