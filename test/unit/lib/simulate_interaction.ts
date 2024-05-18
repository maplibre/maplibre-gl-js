
function click(target: HTMLElement | Window | Element) {
    const options = {bubbles: true};
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
}

function drag(target: HTMLElement | Window, mousedownOptions, mouseUpOptions) {
    mousedownOptions = Object.assign({bubbles: true}, mousedownOptions);
    mouseUpOptions = Object.assign({bubbles: true}, mouseUpOptions);
    target.dispatchEvent(new MouseEvent('mousedown', mousedownOptions));
    target.dispatchEvent(new MouseEvent('mouseup', mouseUpOptions));
    target.dispatchEvent(new MouseEvent('click', mouseUpOptions));
}

function dragWithMove(target: HTMLElement | Window, start: {x: number; y: number}, end: {x: number; y: number}) {
    target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: start.x, clientY: start.y}));
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, buttons: 1, clientX: end.x, clientY: end.y}));
    target.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: end.x, clientY: end.y}));
}

function dblclick(target: HTMLElement | Window) {
    const options = {bubbles: true};
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
    target.dispatchEvent(new MouseEvent('dblclick', options));
}

function keyFunctionFactory(event: string) {
    return (target: HTMLElement | Window, options) => {
        options = Object.assign({bubbles: true}, options);
        target.dispatchEvent(new KeyboardEvent(event, options));
    };
}

function mouseFunctionFactory(event: string) {
    return (target: HTMLElement | Window, options?) => {
        options = Object.assign({bubbles: true}, options);
        target.dispatchEvent(new MouseEvent(event, options));
    };
}

function wheelFunctionFactory(event: string) {
    return (target: HTMLElement | Window, options) => {
        options = Object.assign({bubbles: true}, options);
        target.dispatchEvent(new WheelEvent(event, options));
    };
}

function touchFunctionFactory(event: string) {
    return (target: HTMLElement | Window, options?) => {
        const defaultTouches = event.endsWith('end') || event.endsWith('cancel') ? [] : [{clientX: 0, clientY: 0}];
        options = Object.assign({bubbles: true, touches: defaultTouches}, options);
        target.dispatchEvent(new TouchEvent(event, options));
    };
}

function focusBlueFunctionFactory(event: string) {
    return (target: HTMLElement | Window) => {
        const options = {bubbles: true};
        target.dispatchEvent(new FocusEvent(event, options));
    };
}

const events = {
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
