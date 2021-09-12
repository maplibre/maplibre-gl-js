import '../../stub_loader';
import {test} from '../../util/test';
import {createMap as globalCreateMap} from '../../util';
import Popup from '../../../rollup/build/tsc/ui/popup';
import LngLat from '../../../rollup/build/tsc/geo/lng_lat';
import Point from '../../../rollup/build/tsc/util/point';
import simulate from '../../util/simulate_interaction';

const containerWidth = 512;
const containerHeight = 512;

function createMap(t, options) {
    options = options || {};
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: options.width || containerWidth});
    Object.defineProperty(container, 'clientHeight', {value: options.height || containerHeight});
    return globalCreateMap(t, {container});
}

test('Popup#getElement returns a .maplibregl-popup element', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    expect(popup.isOpen()).toBeTruthy();
    expect(popup.getElement().classList.contains('maplibregl-popup')).toBeTruthy();
    t.end();
});

test('Popup#addTo adds a .maplibregl-popup element', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    expect(popup.isOpen()).toBeTruthy();
    expect(map.getContainer().querySelectorAll('.maplibregl-popup').length).toBe(1);
    t.end();
});

test('Popup closes on map click events by default', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    simulate.click(map.getCanvas());

    expect(!popup.isOpen()).toBeTruthy();
    t.end();
});

test('Popup does not close on map click events when the closeOnClick option is false', (t) => {
    const map = createMap(t);
    const popup = new Popup({closeOnClick: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    simulate.click(map.getCanvas());

    expect(popup.isOpen()).toBeTruthy();
    t.end();
});

test('Popup closes on close button click events', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    simulate.click(map.getContainer().querySelector('.maplibregl-popup-close-button'));

    expect(!popup.isOpen()).toBeTruthy();
    t.end();
});

test('Popup has no close button if closeButton option is false', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    expect(
        popup.getElement().querySelectorAll('.maplibregl-popup-close-button').length
    ).toBe(0);
    t.end();
});

test('Popup does not close on map move events when the closeOnMove option is false', (t) => {
    const map = createMap(t);
    const popup = new Popup({closeOnMove: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    map.setCenter([-10, 0]); // longitude bounds: [-370, 350]

    expect(popup.isOpen()).toBeTruthy();
    t.end();
});

test('Popup closes on map move events when the closeOnMove option is true', (t) => {
    const map = createMap(t);
    const popup = new Popup({closeOnMove: true})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    map.setCenter([-10, 0]); // longitude bounds: [-370, 350]

    expect(!popup.isOpen()).toBeTruthy();
    t.end();
});

test('Popup fires close event when removed', (t) => {
    const map = createMap(t);
    const onClose = t.spy();

    new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .on('close', onClose)
        .addTo(map)
        .remove();

    expect(onClose.called).toBeTruthy();
    t.end();
});

test('Popup fires open event when added', (t) => {
    const map = createMap(t);
    const onOpen = t.spy();

    new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .on('open', onOpen)
        .addTo(map);

    expect(onOpen.called).toBeTruthy();
    t.end();
});

test('Popup content can be set via setText', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setText('Test');

    expect(popup.getElement().textContent).toBe('Test');
    t.end();
});

test('Popup content can be set via setHTML', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    expect(popup.getElement().querySelector('.maplibregl-popup-content').innerHTML).toBe("<span>Test</span>");
    t.end();
});

test('Popup width maximum defaults to 240px', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    expect(popup.getMaxWidth()).toBe('240px');
    t.end();
});

test('Popup width maximum can be set via using maxWidth option', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false, maxWidth: '5px'})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    expect(popup.getMaxWidth()).toBe('5px');
    t.end();
});

test('Popup width maximum can be set via maxWidth', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .setHTML("<span>Test</span>")
        .setMaxWidth('5px')
        .addTo(map);

    expect(popup.getMaxWidth()).toBe('5px');
    t.end();
});

test('Popup content can be set via setDOMContent', (t) => {
    const map = createMap(t);
    const content = window.document.createElement('span');

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setDOMContent(content);

    expect(popup.getElement().querySelector('.maplibregl-popup-content').firstChild).toBe(content);
    t.end();
});

test('Popup#setText protects against XSS', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setText("<script>alert('XSS')</script>");

    expect(popup.getElement().textContent).toBe("<script>alert('XSS')</script>");
    t.end();
});

test('Popup content setters overwrite previous content', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map);

    popup.setText('Test 1');
    expect(popup.getElement().textContent).toBe('Test 1');

    popup.setHTML('Test 2');
    expect(popup.getElement().textContent).toBe('Test 2');

    popup.setDOMContent(window.document.createTextNode('Test 3'));
    expect(popup.getElement().textContent).toBe('Test 3');

    t.end();
});

test('Popup provides LngLat accessors', (t) => {
    expect(new Popup().getLngLat()).toBe(undefined);

    expect(new Popup().setLngLat([1, 2]).getLngLat() instanceof LngLat).toBeTruthy();
    expect(new Popup().setLngLat([1, 2]).getLngLat()).toEqual(new LngLat(1, 2));

    expect(new Popup().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat).toBeTruthy();
    expect(new Popup().setLngLat(new LngLat(1, 2)).getLngLat()).toEqual(new LngLat(1, 2));

    t.end();
});

test('Popup is positioned at the specified LngLat in a world copy', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([270, 0])
        .setText('Test')
        .addTo(map);

    expect(popup._pos).toEqual(map.project([270, 0]));
    t.end();
});

test('Popup preserves object constancy of position after map move', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([270, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
    expect(popup._pos).toEqual(map.project([270, 0]));

    map.setCenter([-20, 0]); // longitude bounds: [-380, 340]
    expect(popup._pos).toEqual(map.project([270, 0]));

    t.end();
});

test('Popup preserves object constancy of position after auto-wrapping center (left)', (t) => {
    const map = createMap(t, {width: 1024});
    map.setCenter([-175, 0]); // longitude bounds: [-535, 185]

    const popup = new Popup()
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([175, 0]); // longitude bounds: [-185, 535]
    expect(popup._pos).toEqual(map.project([360, 0]));

    t.end();
});

test('Popup preserves object constancy of position after auto-wrapping center (right)', (t) => {
    const map = createMap(t, {width: 1024});
    map.setCenter([175, 0]); // longitude bounds: [-185, 535]

    const popup = new Popup()
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([-175, 0]); // longitude bounds: [-185, 535]
    expect(popup._pos).toEqual(map.project([-360, 0]));

    t.end();
});

test('Popup wraps position after map move if it would otherwise go offscreen (right)', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([-355, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([10, 0]); // longitude bounds: [-350, 370]
    expect(popup._pos).toEqual(map.project([5, 0]));
    t.end();
});

test('Popup wraps position after map move if it would otherwise go offscreen (right)', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([355, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
    expect(popup._pos).toEqual(map.project([-5, 0]));
    t.end();
});

test('Popup is repositioned at the specified LngLat', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([270, 0])
        .setText('Test')
        .addTo(map)
        .setLngLat([0, 0]);

    expect(popup._pos).toEqual(map.project([0, 0]));
    t.end();
});

test('Popup anchors as specified by the anchor option', (t) => {
    const map = createMap(t);
    const popup = new Popup({anchor: 'top-left'})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    expect(popup.getElement().classList.contains('maplibregl-popup-anchor-top-left')).toBeTruthy();
    t.end();
});

[
    ['top-left',     new Point(10, 10),                                     'translate(0,0) translate(7px,7px)'],
    ['top',          new Point(containerWidth / 2, 10),                     'translate(-50%,0) translate(0px,10px)'],
    ['top-right',    new Point(containerWidth - 10, 10),                    'translate(-100%,0) translate(-7px,7px)'],
    ['right',        new Point(containerWidth - 10, containerHeight / 2),   'translate(-100%,-50%) translate(-10px,0px)'],
    ['bottom-right', new Point(containerWidth - 10, containerHeight - 10),  'translate(-100%,-100%) translate(-7px,-7px)'],
    ['bottom',       new Point(containerWidth / 2, containerHeight - 10),   'translate(-50%,-100%) translate(0px,-10px)'],
    ['bottom-left',  new Point(10, containerHeight - 10),                   'translate(0,-100%) translate(7px,-7px)'],
    ['left',         new Point(10, containerHeight / 2),                    'translate(0,-50%) translate(10px,0px)'],
    ['bottom',       new Point(containerWidth / 2, containerHeight / 2),    'translate(-50%,-100%) translate(0px,-10px)']
].forEach((args) => {
    const anchor = args[0];
    const point = args[1];
    const transform = args[2];

    test(`Popup automatically anchors to ${anchor}`, (t) => {
        const map = createMap(t);
        const popup = new Popup()
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        Object.defineProperty(popup.getElement(), 'offsetWidth', {value: 100});
        Object.defineProperty(popup.getElement(), 'offsetHeight', {value: 100});

        t.stub(map, 'project').returns(point);
        popup.setLngLat([0, 0]);

        expect(popup.getElement().classList.contains(`maplibregl-popup-anchor-${anchor}`)).toBeTruthy();
        t.end();
    });

    test(`Popup translation reflects offset and ${anchor} anchor`, (t) => {
        const map = createMap(t);
        t.stub(map, 'project').returns(new Point(0, 0));

        const popup = new Popup({anchor, offset: 10})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe(transform);
        t.end();
    });
});

test('Popup automatically anchors to top if its bottom offset would push it off-screen', (t) => {
    const map = createMap(t);
    const point = new Point(containerWidth / 2, containerHeight / 2);
    const options = {offset: {
        'bottom': [0, -25],
        'top': [0, 0]
    }};
    const popup = new Popup(options)
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    Object.defineProperty(popup.getElement(), 'offsetWidth', {value: containerWidth / 2});
    Object.defineProperty(popup.getElement(), 'offsetHeight', {value: containerHeight / 2});

    t.stub(map, 'project').returns(point);
    popup.setLngLat([0, 0]);

    expect(popup.getElement().classList.contains('maplibregl-popup-anchor-top')).toBeTruthy();
    t.end();
});

test('Popup is offset via a PointLike offset option', (t) => {
    const map = createMap(t);
    t.stub(map, 'project').returns(new Point(0, 0));

    const popup = new Popup({anchor: 'top-left', offset: [5, 10]})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    expect(popup.getElement().style.transform).toBe('translate(0,0) translate(5px,10px)');
    t.end();
});

test('Popup is offset via an object offset option', (t) => {
    const map = createMap(t);
    t.stub(map, 'project').returns(new Point(0, 0));

    const popup = new Popup({anchor: 'top-left', offset: {'top-left': [5, 10]}})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    expect(popup.getElement().style.transform).toBe('translate(0,0) translate(5px,10px)');
    t.end();
});

test('Popup is offset via an incomplete object offset option', (t) => {
    const map = createMap(t);
    t.stub(map, 'project').returns(new Point(0, 0));

    const popup = new Popup({anchor: 'top-right', offset: {'top-left': [5, 10]}})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    expect(popup.getElement().style.transform).toBe('translate(-100%,0) translate(0px,0px)');
    t.end();
});

test('Popup offset can be set via setOffset', (t) => {
    const map = createMap(t);

    const popup = new Popup({offset: 5})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    expect(popup.options.offset).toBe(5);

    popup.setOffset(10);

    expect(popup.options.offset).toBe(10);
    t.end();
});

test('Popup can be removed and added again (#1477)', (t) => {
    const map = createMap(t);

    new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map)
        .remove()
        .addTo(map);

    expect(map.getContainer().querySelectorAll('.maplibregl-popup').length).toBe(1);
    t.end();
});

test('Popup#addTo is idempotent (#1811)', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map)
        .addTo(map);

    expect(popup.getElement().querySelector('.maplibregl-popup-content').textContent).toBe('Test');
    t.end();
});

test('Popup#remove is idempotent (#2395)', (t) => {
    const map = createMap(t);

    new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map)
        .remove()
        .remove();

    expect(map.getContainer().querySelectorAll('.maplibregl-popup').length).toBe(0);
    t.end();
});

test('Popup adds classes from className option, methods for class manipulations works properly', (t) => {
    const map = createMap(t);
    const popup = new Popup({className: 'some classes'})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    const popupContainer = popup.getElement();
    expect(popupContainer.classList.contains('some')).toBeTruthy();
    expect(popupContainer.classList.contains('classes')).toBeTruthy();

    popup.addClassName('addedClass');
    expect(popupContainer.classList.contains('addedClass')).toBeTruthy();

    popup.removeClassName('addedClass');
    expect(!popupContainer.classList.contains('addedClass')).toBeTruthy();

    popup.toggleClassName('toggle');
    expect(popupContainer.classList.contains('toggle')).toBeTruthy();

    popup.toggleClassName('toggle');
    expect(!popupContainer.classList.contains('toggle')).toBeTruthy();

    expect(() => popup.addClassName('should throw exception')).toThrowError(window.DOMException);
    expect(() => popup.removeClassName('should throw exception')).toThrowError(window.DOMException);
    expect(() => popup.toggleClassName('should throw exception')).toThrowError(window.DOMException);

    expect(() => popup.addClassName('')).toThrowError(window.DOMException);
    expect(() => popup.removeClassName('')).toThrowError(window.DOMException);
    expect(() => popup.toggleClassName('')).toThrowError(window.DOMException);

    t.end();
});

test('Cursor-tracked popup disappears on mouseout', (t) => {
    const map = createMap(t);

    const popup = new Popup()
        .setText("Test")
        .trackPointer()
        .addTo(map);

    expect(popup._trackPointer).toBe(true);
    t.end();
});

test('Pointer-tracked popup is tagged with right class', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .trackPointer()
        .addTo(map);

    expect(
        popup._container.classList.value.includes('maplibregl-popup-track-pointer')
    ).toBe(true);
    t.end();
});

test('Pointer-tracked popup with content set later is tagged with right class ', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .trackPointer()
        .addTo(map);

    popup.setText("Test");

    expect(
        popup._container.classList.value.includes('maplibregl-popup-track-pointer')
    ).toBe(true);
    t.end();
});

test('Pointer-tracked popup that is set afterwards is tagged with right class ', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .addTo(map);

    popup.setText("Test");
    popup.trackPointer();

    expect(
        popup._container.classList.value.includes('maplibregl-popup-track-pointer')
    ).toBe(true);
    t.end();
});

test('Pointer-tracked popup can be repositioned with setLngLat', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .trackPointer()
        .setLngLat([0, 0])
        .addTo(map);

    expect(popup._pos).toEqual(map.project([0, 0]));
    expect(
        popup._container.classList.value.includes('maplibregl-popup-track-pointer')
    ).toBe(false);
    t.end();
});

test('Positioned popup lacks pointer-tracking class', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    expect(
        popup._container.classList.value.includes('maplibregl-popup-track-pointer')
    ).toBe(false);
    t.end();
});

test('Positioned popup can be set to track pointer', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .trackPointer()
        .addTo(map);

    simulate.mousemove(map.getCanvas(), {screenX:0, screenY:0});
    expect(popup._pos).toEqual({x:0, y:0});
    t.end();
});

test('Popup closes on Map#remove', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    map.remove();

    expect(!popup.isOpen()).toBeTruthy();
    t.end();
});

test('Adding popup with no focusable content (Popup#setText) does not change the active element', (t) => {
    const dummyFocusedEl = window.document.createElement('button');
    dummyFocusedEl.focus();

    new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(createMap(t));

    expect(window.document.activeElement).toBe(dummyFocusedEl);
    t.end();
});

test('Adding popup with no focusable content (Popup#setHTML) does not change the active element', (t) => {
    const dummyFocusedEl = window.document.createElement('button');
    dummyFocusedEl.focus();

    new Popup({closeButton: false})
        .setHTML('<span>Test</span>')
        .setLngLat([0, 0])
        .addTo(createMap(t));

    expect(window.document.activeElement).toBe(dummyFocusedEl);
    t.end();
});

test('Close button is focused if it is the only focusable element', (t) => {
    const dummyFocusedEl = window.document.createElement('button');
    dummyFocusedEl.focus();

    const popup = new Popup({closeButton: true})
        .setHTML('<span>Test</span>')
        .setLngLat([0, 0])
        .addTo(createMap(t));

    // Suboptimal because the string matching is case-sensitive
    const closeButton = popup._container.querySelector("[aria-label^='Close']");

    expect(window.document.activeElement).toBe(closeButton);
    t.end();
});

test('If popup content contains a focusable element it is focused', (t) => {
    const popup = new Popup({closeButton: true})
        .setHTML('<span tabindex="0" data-testid="abc">Test</span>')
        .setLngLat([0, 0])
        .addTo(createMap(t));

    const focusableEl = popup._container.querySelector("[data-testid='abc']");

    expect(window.document.activeElement).toBe(focusableEl);
    t.end();
});

test('Element with tabindex="-1" is not focused', (t) => {
    const popup = new Popup({closeButton: true})
        .setHTML('<span tabindex="-1" data-testid="abc">Test</span>')
        .setLngLat([0, 0])
        .addTo(createMap(t));

    const nonFocusableEl = popup._container.querySelector("[data-testid='abc']");
    const closeButton = popup._container.querySelector("button[aria-label='Close popup']");

    expect(window.document.activeElement).not.toBe(nonFocusableEl);
    expect(window.document.activeElement).toBe(closeButton);
    t.end();
});

test('If popup contains a disabled button and a focusable element then the latter is focused', (t) => {
    const popup = new Popup({closeButton: true})
        .setHTML(`
            <button disabled>No focus here</button>
            <select data-testid="abc">
                <option value="1">1</option>
                <option value="2">2</option>
            </select>
        `)
        .setLngLat([0, 0])
        .addTo(createMap(t));

    const focusableEl = popup._container.querySelector("[data-testid='abc']");

    expect(window.document.activeElement).toBe(focusableEl);
    t.end();
});

test('Popup with disabled focusing does not change the active element', (t) => {
    const dummyFocusedEl = window.document.createElement('button');
    dummyFocusedEl.focus();

    new Popup({closeButton: false, focusAfterOpen: false})
        .setHTML('<span tabindex="0" data-testid="abc">Test</span>')
        .setLngLat([0, 0])
        .addTo(createMap(t));

    expect(window.document.activeElement).toBe(dummyFocusedEl);
    t.end();
});
