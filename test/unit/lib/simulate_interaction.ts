
function click(target: HTMLElement | Window | Element): void {
    const options = {bubbles: true};
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
}

function drag(target: HTMLElement | Window, mousedownOptions?: MouseEventInit, mouseUpOptions?: MouseEventInit): void {
    const downOpts: MouseEventInit = {bubbles: true, ...mousedownOptions};
    const upOpts: MouseEventInit = {bubbles: true, ...mouseUpOptions};
    target.dispatchEvent(new MouseEvent('mousedown', downOpts));
    target.dispatchEvent(new MouseEvent('mouseup', upOpts));
    target.dispatchEvent(new MouseEvent('click', upOpts));
}

function dragWithMove(target: HTMLElement | Window, start: {x: number; y: number}, end: {x: number; y: number}): void {
    target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: start.x, clientY: start.y}));
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, buttons: 1, clientX: end.x, clientY: end.y}));
    target.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: end.x, clientY: end.y}));
}

function dblclick(target: HTMLElement | Window): void {
    const options = {bubbles: true};
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
    target.dispatchEvent(new MouseEvent('dblclick', options));
}

function keyFunctionFactory(event: string): (target: HTMLElement | Window, options: KeyboardEventInit) => void {
    return (target: HTMLElement | Window, options: KeyboardEventInit) => {
        options = {bubbles: true, ...options};
        target.dispatchEvent(new KeyboardEvent(event, options));
    };
}

function mouseFunctionFactory(event: string): (target: HTMLElement | Window, options?: MouseEventInit) => void {
    return (target: HTMLElement | Window, options?: MouseEventInit) => {
        options = {bubbles: true, ...options};
        target.dispatchEvent(new MouseEvent(event, options));
    };
}

function wheelFunctionFactory(event: string): (target: HTMLElement | Window, options: WheelEventInit) => void {
    return (target: HTMLElement | Window, options: WheelEventInit) => {
        options = {bubbles: true, ...options};
        target.dispatchEvent(new WheelEvent(event, options));
    };
}

type LooseTouchEventInit = Omit<TouchEventInit, 'touches' | 'targetTouches' | 'changedTouches'> & {
    touches?: Array<Partial<Touch>>;
    targetTouches?: Array<Partial<Touch>>;
    changedTouches?: Array<Partial<Touch>>;
};

function touchFunctionFactory(event: string): (target: HTMLElement | Window, options?: LooseTouchEventInit) => void {
    return (target: HTMLElement | Window, options?: LooseTouchEventInit) => {
        const defaultTouches = event.endsWith('end') || event.endsWith('cancel') ? [] : [{clientX: 0, clientY: 0}];
        const merged = {bubbles: true, touches: defaultTouches, ...options};
        target.dispatchEvent(new TouchEvent(event, merged as TouchEventInit));
    };
}

function focusBlueFunctionFactory(event: string): (target: HTMLElement | Window) => void {
    return (target: HTMLElement | Window) => {
        const options = {bubbles: true};
        target.dispatchEvent(new FocusEvent(event, options));
    };
}

const events: {
    click: typeof click;
    drag: typeof drag;
    dragWithMove: typeof dragWithMove;
    dblclick: typeof dblclick;
    keydown: (target: HTMLElement | Window, options: KeyboardEventInit) => void;
    keyup: (target: HTMLElement | Window, options: KeyboardEventInit) => void;
    keypress: (target: HTMLElement | Window, options: KeyboardEventInit) => void;
    mouseup: (target: HTMLElement | Window, options?: MouseEventInit) => void;
    mousedown: (target: HTMLElement | Window, options?: MouseEventInit) => void;
    mouseover: (target: HTMLElement | Window, options?: MouseEventInit) => void;
    mousemove: (target: HTMLElement | Window, options?: MouseEventInit) => void;
    mouseout: (target: HTMLElement | Window, options?: MouseEventInit) => void;
    contextmenu: (target: HTMLElement | Window, options?: MouseEventInit) => void;
    wheel: (target: HTMLElement | Window, options: WheelEventInit) => void;
    mousewheel: (target: HTMLElement | Window, options: WheelEventInit) => void;
    /**
     * magic deltaY value that indicates the event is from a mouse wheel (rather than a trackpad)
     */
    magicWheelZoomDelta: number;
    touchstart: (target: HTMLElement | Window, options?: LooseTouchEventInit) => void;
    touchend: (target: HTMLElement | Window, options?: LooseTouchEventInit) => void;
    touchmove: (target: HTMLElement | Window, options?: LooseTouchEventInit) => void;
    touchcancel: (target: HTMLElement | Window, options?: LooseTouchEventInit) => void;
    focus: (target: HTMLElement | Window) => void;
    blur: (target: HTMLElement | Window) => void;
} = {
    click,
    drag,
    dragWithMove,
    dblclick,
    keydown: keyFunctionFactory('keydown'),
    keyup: keyFunctionFactory('keyup'),
    keypress: keyFunctionFactory('keypress'),
    mouseup: mouseFunctionFactory('mouseup'),
    mousedown: mouseFunctionFactory('mousedown'),
    mouseover: mouseFunctionFactory('mouseover'),
    mousemove: mouseFunctionFactory('mousemove'),
    mouseout: mouseFunctionFactory('mouseout'),
    contextmenu: mouseFunctionFactory('contextmenu'),
    wheel: wheelFunctionFactory('wheel'),
    mousewheel: wheelFunctionFactory('mousewheel'),
    /**
     * magic deltaY value that indicates the event is from a mouse wheel (rather than a trackpad)
     */
    magicWheelZoomDelta: 4.000244140625,
    touchstart: touchFunctionFactory('touchstart'),
    touchend: touchFunctionFactory('touchend'),
    touchmove: touchFunctionFactory('touchmove'),
    touchcancel: touchFunctionFactory('touchcancel'),
    focus: focusBlueFunctionFactory('focus'),
    blur: focusBlueFunctionFactory('blur')
};

export default events;
