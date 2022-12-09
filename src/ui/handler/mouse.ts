import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';

interface MouseMovementResult {
    bearingDelta?: number;
    pitchDelta?: number;
    around?: Point;
    panDelta?: Point;
}

interface MousePanResult extends MouseMovementResult {
    around: Point;
    panDelta: Point;
}

interface MouseRotateResult extends MouseMovementResult {
    bearingDelta: number;
}

interface MousePitchResult extends MouseMovementResult {
    pitchDelta: number;
}

type MouseMoveFunction<T extends MouseMovementResult> = (lastPoint: Point, point: Point) => T;

interface MouseMoveHandler<T extends MouseMovementResult> {
    _clickTolerance: number;
    _moveFunction: MouseMoveFunction<T>;
    reset: () => void;
    mousedown: (e: MouseEvent, point: Point) => void;
    mousemoveWindow: (e: MouseEvent, point: Point) => T | void;
    mouseupWindow: (e: MouseEvent) => void;
    enable: () => void;
    disable: () => void;
    isEnabled: () => boolean;
    isActive: () => boolean;
}

export interface MousePanHandler extends MouseMoveHandler<MousePanResult> {}
export interface MouseRotateHandler extends MouseMoveHandler<MouseRotateResult> {}
export interface MousePitchHandler extends MouseMoveHandler<MousePitchResult> {}

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

// the values for each button in MouseEvent.buttons
const BUTTONS_FLAGS = {
    [LEFT_BUTTON]: 1,
    [RIGHT_BUTTON]: 2
};

function buttonNoLongerPressed(e: MouseEvent, button: number) {
    const flag = BUTTONS_FLAGS[button];
    return e.buttons === undefined || (e.buttons & flag) !== flag;
}

export class MouseHandler<T extends MouseMovementResult> implements MouseMoveHandler<T> {
    contextmenu?: (e: MouseEvent) => void;
    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _eventButton: number;
    _moved: boolean;
    _clickTolerance: number;
    _moveFunction: MouseMoveFunction<T>;
    _correctButton: (e: MouseEvent, button: number) => boolean;
    _activateOnMouseDown: boolean;

    constructor(options: {
        clickTolerance: number;
        move: MouseMoveFunction<T>;
        checkCorrectButton: (e: MouseEvent, button: number) => boolean;
        preventContextMenu?: boolean;
        activateOnMouseDown?: boolean;
    }) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
        this._moveFunction = options.move;
        this._activateOnMouseDown = !!options.activateOnMouseDown;
        this._correctButton = options.checkCorrectButton;

        if (options.preventContextMenu) {
            this.contextmenu = (e: MouseEvent) => {
                e.preventDefault();
            };
        }
    }

    reset() {
        this._active = false;
        this._moved = false;
        delete this._lastPoint;
        delete this._eventButton;
    }

    _move(...params: Parameters<MouseMoveFunction<T>>) {
        const move = this._moveFunction(...params);
        if (move.bearingDelta || move.pitchDelta || move.around || move.panDelta) {
            this._active = true;
            return move;
        }
    }

    mousedown(e: MouseEvent, point: Point) {
        if (this._lastPoint) return;

        const eventButton = DOM.mouseButton(e);
        if (!this._correctButton(e, eventButton)) return;

        this._lastPoint = point;
        this._eventButton = eventButton;

        if (this._activateOnMouseDown && this._lastPoint) this._active = true;
    }

    mousemoveWindow(e: MouseEvent, point: Point) {
        const lastPoint = this._lastPoint;
        if (!lastPoint) return;
        e.preventDefault();

        if (buttonNoLongerPressed(e, this._eventButton)) {
            // Some browsers don't fire a `mouseup` when the mouseup occurs outside
            // the window or iframe:
            // https://github.com/mapbox/mapbox-gl-js/issues/4622
            //
            // If the button is no longer pressed during this `mousemove` it may have
            // been released outside of the window or iframe.
            this.reset();
            return;
        }

        if (!this._moved && point.dist(lastPoint) < this._clickTolerance) return;
        this._moved = true;
        this._lastPoint = point;

        // implemented by child class
        return this._move(lastPoint, point);
    }

    mouseupWindow(e: MouseEvent) {
        if (!this._lastPoint) return;
        const eventButton = DOM.mouseButton(e);
        if (eventButton !== this._eventButton) return;
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

    static generatePanHandler({clickTolerance,}: {
        clickTolerance: number;
    }): MousePanHandler {
        return new MouseHandler<MousePanResult>({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({around: point, panDelta: point.sub(lastPoint)}),
            activateOnMouseDown: true,
            checkCorrectButton: (e: MouseEvent, button: number) =>
                button === LEFT_BUTTON && !e.ctrlKey,
        });
    }

    static generateRotationHandler({clickTolerance, bearingDegreesPerPixelMoved = 0.8}: {
        clickTolerance: number;
        bearingDegreesPerPixelMoved?: number;
    }): MouseRotateHandler {
        return new MouseHandler<MouseRotateResult>({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({bearingDelta: (point.x - lastPoint.x) * bearingDegreesPerPixelMoved}),
            // prevent browser context menu when necessary; we don't allow it with rotation
            // because we can't discern rotation gesture start from contextmenu on Mac
            preventContextMenu: true,
            checkCorrectButton: (e: MouseEvent, button: number) =>
                (button === LEFT_BUTTON && e.ctrlKey) || (button === RIGHT_BUTTON),
        });
    }

    static generatePitchHandler({clickTolerance, pitchDegreesPerPixelMoved = -0.5}: {
        clickTolerance: number;
        pitchDegreesPerPixelMoved?: number;
    }): MousePitchHandler {
        return new MouseHandler<MousePitchResult>({
            clickTolerance,
            move: (lastPoint: Point, point: Point) =>
                ({pitchDelta: (point.y - lastPoint.y) * pitchDegreesPerPixelMoved}),
            // prevent browser context menu when necessary; we don't allow it with rotation
            // because we can't discern rotation gesture start from contextmenu on Mac
            preventContextMenu: true,
            checkCorrectButton: (e: MouseEvent, button: number) =>
                (button === LEFT_BUTTON && e.ctrlKey) || (button === RIGHT_BUTTON),
        });
    }
}
