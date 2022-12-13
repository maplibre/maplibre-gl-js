import DOM from '../../util/dom';

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

export interface DragMoveStateManager<E extends Event> {
    startMove: (e: E) => void;
    endMove: (e?: E) => void;
    isValidStartEvent: (e: E) => boolean;
    isValidMoveEvent: (e: E) => boolean;
    isValidEndEvent: (e?: E) => boolean;
}

export class MouseMoveStateManager implements DragMoveStateManager<MouseEvent> {
    _eventButton: number | undefined;
    _correctButton: (e: MouseEvent) => boolean;

    constructor(options: {
        checkCorrectButton: (e: MouseEvent) => boolean;
    }) {
        this._correctButton = options.checkCorrectButton;
    }

    startMove(e: MouseEvent) {
        const eventButton = DOM.mouseButton(e);
        this._eventButton = eventButton;
    }

    endMove(_e?: MouseEvent) {
        delete this._eventButton;
    }

    isValidStartEvent(e: MouseEvent) {
        return this._correctButton(e);
    }

    isValidMoveEvent(e: MouseEvent) {
        // Some browsers don't fire a `mouseup` when the mouseup occurs outside
        // the window or iframe:
        // https://github.com/mapbox/mapbox-gl-js/issues/4622
        //
        // If the button is no longer pressed during this `mousemove` it may have
        // been released outside of the window or iframe.
        return !buttonNoLongerPressed(e, this._eventButton);
    }

    isValidEndEvent(e: MouseEvent) {
        const eventButton = DOM.mouseButton(e);
        return eventButton === this._eventButton;
    }
}

export class OneFingerTouchMoveStateManager implements DragMoveStateManager<TouchEvent> {
    _firstTouch: number | undefined;

    constructor() {
        this._firstTouch = undefined;
    }

    _isOneFingerTouch(e: TouchEvent) {
        return e.targetTouches.length === 1;
    }

    _isSameTouchEvent(e: TouchEvent) {
        return e.targetTouches[0].identifier === this._firstTouch;
    }

    startMove(e: TouchEvent) {
        const firstTouch = e.targetTouches[0].identifier;
        this._firstTouch = firstTouch;
    }

    endMove(_e?: TouchEvent) {
        delete this._firstTouch;
    }

    isValidStartEvent(e: TouchEvent) {
        return this._isOneFingerTouch(e);
    }

    isValidMoveEvent(e: TouchEvent) {
        return this._isOneFingerTouch(e) && this._isSameTouchEvent(e);
    }

    isValidEndEvent(e: TouchEvent) {
        return this._isOneFingerTouch(e) && this._isSameTouchEvent(e);
    }
}

