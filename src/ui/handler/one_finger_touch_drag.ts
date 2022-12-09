import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';

interface OneFingerTouchMoveResults {
    bearingDelta?: number;
    pitchDelta?: number;
}

interface OneFingerTouchRotateResults extends OneFingerTouchMoveResults {
    bearingDelta: number;
}

interface OneFingerTouchPitchResults extends OneFingerTouchMoveResults {
    pitchDelta: number;
}

type OneFingerTouchMoveFunction<T extends OneFingerTouchMoveResults> = (lastPoint: Point, point: Point) => T;

interface OneFingerTouchMoveHandler<T extends OneFingerTouchMoveResults> {
    _clickTolerance: number;
    _moveFunction: OneFingerTouchMoveFunction<T>;
    reset: () => void;
    touchstart: (e: TouchEvent, point: Point) => void;
    touchmoveWindow: (e: TouchEvent, point: Point) => T | void;
    touchendWindow: (e: TouchEvent) => void;
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    isActive: () => boolean;
}

export interface OneFingerTouchRotateHandler extends OneFingerTouchMoveHandler<OneFingerTouchRotateResults> {}
export interface OneFingerTouchPitchHandler extends OneFingerTouchMoveHandler<OneFingerTouchPitchResults> {}

export class OneFingerTouchHandler<T extends OneFingerTouchMoveResults> implements OneFingerTouchMoveHandler<T> {

    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _firstTouch: number;
    _moved: boolean;
    _clickTolerance: number;
    _moveFunction: OneFingerTouchMoveFunction<T>;

    constructor(options: {
        clickTolerance: number;
        move: OneFingerTouchMoveFunction<T>;
    }) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
        this._moveFunction = options.move;
    }

    _move(...params: Parameters<OneFingerTouchMoveFunction<T>>) {
        const move = this._moveFunction(...params);
        if (move.bearingDelta || move.pitchDelta) {
            this._active = true;
            return move;
        }
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
    }): OneFingerTouchRotateHandler {
        return new OneFingerTouchHandler<OneFingerTouchRotateResults>({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({bearingDelta: (point.x - lastPoint.x) * bearingDegreesPerPixelMoved}),
        });
    }

    static generatePitchHandler({clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
        clickTolerance: number;
        pitchDegreesPerPixelMoved?: number;
    }): OneFingerTouchPitchHandler {
        return new OneFingerTouchHandler<OneFingerTouchPitchResults>({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved}),
        });
    }
}
