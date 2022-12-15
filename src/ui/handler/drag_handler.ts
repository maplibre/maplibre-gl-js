import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';
import {DragMoveStateManager, MouseMoveStateManager, OneFingerTouchMoveStateManager} from './drag_move_state_manager';

interface DragMovementResult {
    bearingDelta?: number;
    pitchDelta?: number;
    around?: Point;
    panDelta?: Point;
}

export interface DragPanResult extends DragMovementResult {
    around: Point;
    panDelta: Point;
}

export interface DragRotateResult extends DragMovementResult {
    bearingDelta: number;
}

export interface DragPitchResult extends DragMovementResult {
    pitchDelta: number;
}

type DragMoveFunction<T extends DragMovementResult> = (lastPoint: Point, point: Point) => T;

export interface DragMoveHandler<T extends DragMovementResult, E extends Event> {
    reset: (e?: E) => void;
    dragStart: (e: E, point: Point) => void;
    dragMove: (e: E, point: Point) => T | void;
    dragEnd: (e: E) => void;
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    isActive: () => boolean;
    getClickTolerance: () => number;
}

export class DragHandler<T extends DragMovementResult, E extends Event> implements DragMoveHandler<T, E> {
    contextmenu?: (e: E) => void;
    mousedown?: (e: E, point: Point) => void;
    mousemoveWindow?: (e: E, point: Point) => void;
    mouseup?: (e: E) => void;
    touchstart?: (e: E, point: Point) => void;
    touchmoveWindow?: (e: E, point: Point) => void;
    touchend?: (e: E) => void;
    _clickTolerance: number;
    _moveFunction: DragMoveFunction<T>;
    _activateOnStart: boolean;
    _active: boolean;
    _enabled: boolean;
    _moved: boolean;
    _lastPoint: Point | null;
    _moveStateManager: DragMoveStateManager<E>;

    constructor(options: {
        clickTolerance: number;
        move: DragMoveFunction<T>;
        preventContextMenu?: boolean;
        activateOnStart?: boolean;
        moveStateManager: DragMoveStateManager<E>;
        enable?: boolean;
    }) {
        this._enabled = !!options.enable;
        this._moveStateManager = options.moveStateManager;
        this._clickTolerance = options.clickTolerance || 1;
        this._moveFunction = options.move;
        this._activateOnStart = !!options.activateOnStart;

        if (this._moveStateManager instanceof MouseMoveStateManager) {
            if (options.preventContextMenu) {
                this.contextmenu = function(e: E) {
                    e.preventDefault();
                };
            }
            this.mousedown = this.dragStart;
            this.mousemoveWindow = this.dragMove;
            this.mouseup = this.dragEnd;
        } else if (this._moveStateManager instanceof OneFingerTouchMoveStateManager) {
            this.touchstart = this.dragStart;
            this.touchmoveWindow = this.dragMove;
            this.touchend = this.dragEnd;
        } else {
            throw new Error(`Unexpected drag movement type ${this._moveStateManager}`);
        }

        this.reset();
    }

    reset(e?: E) {
        this._active = false;
        this._moved = false;
        delete this._lastPoint;
        this._moveStateManager.endMove(e);
    }

    _move(...params: Parameters<DragMoveFunction<T>>) {
        const move = this._moveFunction(...params);
        if (move.bearingDelta || move.pitchDelta || move.around || move.panDelta) {
            this._active = true;
            return move;
        }
    }

    dragStart(e: E, point: Point) {
        if (!this.isEnabled() || this._lastPoint) return;

        if (!this._moveStateManager.isValidStartEvent(e)) return;
        this._moveStateManager.startMove(e);

        this._lastPoint = point;

        if (this._activateOnStart && this._lastPoint) this._active = true;
    }

    dragMove(e: E, point: Point) {
        if (!this.isEnabled()) return;
        const lastPoint = this._lastPoint;
        if (!lastPoint) return;
        e.preventDefault();

        if (!this._moveStateManager.isValidMoveEvent(e)) {
            this.reset(e);
            return;
        }

        if (!this._moved && point.dist(lastPoint) < this._clickTolerance) return;
        this._moved = true;
        this._lastPoint = point;

        return this._move(lastPoint, point);
    }

    dragEnd(e: E) {
        if (!this.isEnabled() || !this._lastPoint) return;
        if (!this._moveStateManager.isValidEndEvent(e)) return;
        if (this._moved) DOM.suppressClick();
        this.reset(e);
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

    getClickTolerance() {
        return this._clickTolerance;
    }
}
