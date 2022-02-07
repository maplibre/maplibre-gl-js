import {createMap as globalCreateMap, setPerformance, setWebGlContext} from '../util/test/util';
import Popup, {Offset} from './popup';
import LngLat from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import simulate from '../../test/unit/lib/simulate_interaction';
import {PositionAnchor} from './anchor';

const containerWidth = 512;
const containerHeight = 512;

function createMap(options?) {
    options = options || {};
    const container = window.document.createElement('div');
    window.document.body.appendChild(container);
    Object.defineProperty(container, 'clientWidth', {value: options.width || containerWidth});
    Object.defineProperty(container, 'clientHeight', {value: options.height || containerHeight});
    return globalCreateMap({container});
}

beforeEach(() => {
    setPerformance();
    setWebGlContext();
});

describe('popup', () => {

    test('Popup#getElement returns a .maplibregl-popup element', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup.isOpen()).toBeTruthy();
        expect(popup.getElement().classList.contains('maplibregl-popup')).toBeTruthy();
    });

    test('Popup#addTo adds a .maplibregl-popup element', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup.isOpen()).toBeTruthy();
        expect(map.getContainer().querySelectorAll('.maplibregl-popup')).toHaveLength(1);
    });

    test('Popup closes on map click events by default', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        simulate.click(map.getCanvas());

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Popup does not close on map click events when the closeOnClick option is false', () => {
        const map = createMap();
        const popup = new Popup({closeOnClick: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        simulate.click(map.getCanvas());

        expect(popup.isOpen()).toBeTruthy();
    });

    test('Popup closes on close button click events', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        simulate.click(map.getContainer().querySelector('.maplibregl-popup-close-button'));

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Popup has no close button if closeButton option is false', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(
            popup.getElement().querySelectorAll('.maplibregl-popup-close-button')
        ).toHaveLength(0);
    });

    test('Popup does not close on map move events when the closeOnMove option is false', () => {
        const map = createMap();
        const popup = new Popup({closeOnMove: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        map.setCenter([-10, 0]); // longitude bounds: [-370, 350]

        expect(popup.isOpen()).toBeTruthy();
    });

    test('Popup closes on map move events when the closeOnMove option is true', () => {
        const map = createMap();
        const popup = new Popup({closeOnMove: true})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        map.setCenter([-10, 0]); // longitude bounds: [-370, 350]

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Popup fires close event when removed', () => {
        const map = createMap();
        const onClose = jest.fn();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .on('close', onClose)
            .addTo(map)
            .remove();

        expect(onClose).toHaveBeenCalled();
    });

    test('Popup fires open event when added', () => {
        const map = createMap();
        const onOpen = jest.fn();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .on('open', onOpen)
            .addTo(map);

        expect(onOpen).toHaveBeenCalled();
    });

    test('Popup content can be set via setText', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setText('Test');

        expect(popup.getElement().textContent).toBe('Test');
    });

    test('Popup content can be set via setHTML', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setHTML('<span>Test</span>');

        expect(popup.getElement().querySelector('.maplibregl-popup-content').innerHTML).toBe('<span>Test</span>');
    });

    test('Popup width maximum defaults to 240px', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setHTML('<span>Test</span>');

        expect(popup.getMaxWidth()).toBe('240px');
    });

    test('Popup width maximum can be set via using maxWidth option', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false, maxWidth: '5px'})
            .setLngLat([0, 0])
            .addTo(map)
            .setHTML('<span>Test</span>');

        expect(popup.getMaxWidth()).toBe('5px');
    });

    test('Popup width maximum can be set via maxWidth', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .setHTML('<span>Test</span>')
            .setMaxWidth('5px')
            .addTo(map);

        expect(popup.getMaxWidth()).toBe('5px');
    });

    test('Popup content can be set via setDOMContent', () => {
        const map = createMap();
        const content = window.document.createElement('span');

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setDOMContent(content);

        expect(popup.getElement().querySelector('.maplibregl-popup-content').firstChild).toBe(content);
    });

    test('Popup#setText protects against XSS', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map)
            .setText('<script>alert(\'XSS\')</script>');

        expect(popup.getElement().textContent).toBe('<script>alert(\'XSS\')</script>');
    });

    test('Popup content setters overwrite previous content', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setLngLat([0, 0])
            .addTo(map);

        popup.setText('Test 1');
        expect(popup.getElement().textContent).toBe('Test 1');

        popup.setHTML('Test 2');
        expect(popup.getElement().textContent).toBe('Test 2');

        popup.setDOMContent(window.document.createTextNode('Test 3'));
        expect(popup.getElement().textContent).toBe('Test 3');

    });

    test('Popup provides LngLat accessors', () => {
        expect(new Popup().getLngLat()).toBeUndefined();

        expect(new Popup().setLngLat([1, 2]).getLngLat() instanceof LngLat).toBeTruthy();
        expect(new Popup().setLngLat([1, 2]).getLngLat()).toEqual(new LngLat(1, 2));

        expect(new Popup().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat).toBeTruthy();
        expect(new Popup().setLngLat(new LngLat(1, 2)).getLngLat()).toEqual(new LngLat(1, 2));

    });

    test('Popup is positioned at the specified LngLat in a world copy', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([270, 0])
            .setText('Test')
            .addTo(map);

        expect(popup._pos).toEqual(map.project([270, 0]));
    });

    test('Popup preserves object constancy of position after map move', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([270, 0])
            .setText('Test')
            .addTo(map);

        map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
        expect(popup._pos).toEqual(map.project([270, 0]));

        map.setCenter([-20, 0]); // longitude bounds: [-380, 340]
        expect(popup._pos).toEqual(map.project([270, 0]));

    });

    test('Popup preserves object constancy of position after auto-wrapping center (left)', () => {
        const map = createMap({width: 1024});
        map.setCenter([-175, 0]); // longitude bounds: [-535, 185]

        const popup = new Popup()
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        map.setCenter([175, 0]); // longitude bounds: [-185, 535]
        expect(popup._pos).toEqual(map.project([360, 0]));

    });

    test('Popup preserves object constancy of position after auto-wrapping center (right)', () => {
        const map = createMap({width: 1024});
        map.setCenter([175, 0]); // longitude bounds: [-185, 535]

        const popup = new Popup()
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        map.setCenter([-175, 0]); // longitude bounds: [-185, 535]
        expect(popup._pos).toEqual(map.project([-360, 0]));

    });

    test('Popup wraps position after map move if it would otherwise go offscreen (right)', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([-355, 0])
            .setText('Test')
            .addTo(map);

        map.setCenter([10, 0]); // longitude bounds: [-350, 370]
        expect(popup._pos).toEqual(map.project([5, 0]));
    });

    test('Popup wraps position after map move if it would otherwise go offscreen (right)', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([355, 0])
            .setText('Test')
            .addTo(map);

        map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
        expect(popup._pos).toEqual(map.project([-5, 0]));
    });

    test('Popup is repositioned at the specified LngLat', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]

        const popup = new Popup()
            .setLngLat([270, 0])
            .setText('Test')
            .addTo(map)
            .setLngLat([0, 0]);

        expect(popup._pos).toEqual(map.project([0, 0]));
    });

    test('Popup anchors as specified by the anchor option', () => {
        const map = createMap();
        const popup = new Popup({anchor: 'top-left'})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().classList.contains('maplibregl-popup-anchor-top-left')).toBeTruthy();
    });

    ([
        ['top-left',     new Point(10, 10),                                     'translate(0,0) translate(7px,7px)'],
        ['top',          new Point(containerWidth / 2, 10),                     'translate(-50%,0) translate(0px,10px)'],
        ['top-right',    new Point(containerWidth - 10, 10),                    'translate(-100%,0) translate(-7px,7px)'],
        ['right',        new Point(containerWidth - 10, containerHeight / 2),   'translate(-100%,-50%) translate(-10px,0px)'],
        ['bottom-right', new Point(containerWidth - 10, containerHeight - 10),  'translate(-100%,-100%) translate(-7px,-7px)'],
        ['bottom',       new Point(containerWidth / 2, containerHeight - 10),   'translate(-50%,-100%) translate(0px,-10px)'],
        ['bottom-left',  new Point(10, containerHeight - 10),                   'translate(0,-100%) translate(7px,-7px)'],
        ['left',         new Point(10, containerHeight / 2),                    'translate(0,-50%) translate(10px,0px)'],
        ['bottom',       new Point(containerWidth / 2, containerHeight / 2),    'translate(-50%,-100%) translate(0px,-10px)']
    ] as [PositionAnchor, Point, string][]).forEach((args) => {
        const anchor = args[0];
        const point = args[1];
        const transform = args[2];

        test(`Popup automatically anchors to ${anchor}`, () => {
            const map = createMap();
            const popup = new Popup()
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);

            Object.defineProperty(popup.getElement(), 'offsetWidth', {value: 100});
            Object.defineProperty(popup.getElement(), 'offsetHeight', {value: 100});

            jest.spyOn(map, 'project').mockReturnValue(point);
            popup.setLngLat([0, 0]);

            expect(popup.getElement().classList.contains(`maplibregl-popup-anchor-${anchor}`)).toBeTruthy();
        });

        test(`Popup translation reflects offset and ${anchor} anchor`, () => {
            const map = createMap();
            jest.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

            const popup = new Popup({anchor, offset: 10})
                .setLngLat([0, 0])
                .setText('Test')
                .addTo(map);

            expect(popup.getElement().style.transform).toBe(transform);
        });
    });

    test('Popup automatically anchors to top if its bottom offset would push it off-screen', () => {
        const map = createMap();
        const point = new Point(containerWidth / 2, containerHeight / 2);
        const options = {offset: {
            'bottom': [0, -25],
            'top': [0, 0]
        } as Offset};
        const popup = new Popup(options)
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        Object.defineProperty(popup.getElement(), 'offsetWidth', {value: containerWidth / 2});
        Object.defineProperty(popup.getElement(), 'offsetHeight', {value: containerHeight / 2});

        jest.spyOn(map, 'project').mockReturnValue(point);
        popup.setLngLat([0, 0]);

        expect(popup.getElement().classList.contains('maplibregl-popup-anchor-top')).toBeTruthy();
    });

    test('Popup is offset via a PointLike offset option', () => {
        const map = createMap();
        jest.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({anchor: 'top-left', offset: [5, 10]})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(0,0) translate(5px,10px)');
    });

    test('Popup is offset via an object offset option', () => {
        const map = createMap();
        jest.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({anchor: 'top-left', offset: {'top-left': [5, 10]} as Offset})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(0,0) translate(5px,10px)');
    });

    test('Popup is offset via an incomplete object offset option', () => {
        const map = createMap();
        jest.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({anchor: 'top-right', offset: {'top-left': [5, 10]} as Offset})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(-100%,0) translate(0px,0px)');
    });

    test('Popup offset can be set via setOffset', () => {
        const map = createMap();

        const popup = new Popup({offset: 5})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.options.offset).toBe(5);

        popup.setOffset(10);

        expect(popup.options.offset).toBe(10);
    });

    test('Popup can be removed and added again (#1477)', () => {
        const map = createMap();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .remove()
            .addTo(map);

        expect(map.getContainer().querySelectorAll('.maplibregl-popup')).toHaveLength(1);
    });

    test('Popup#addTo is idempotent (#1811)', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .addTo(map);

        expect(popup.getElement().querySelector('.maplibregl-popup-content').textContent).toBe('Test');
    });

    test('Popup#remove is idempotent (#2395)', () => {
        const map = createMap();

        new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .remove()
            .remove();

        expect(map.getContainer().querySelectorAll('.maplibregl-popup')).toHaveLength(0);
    });

    test('Popup adds classes from className option, methods for class manipulations works properly', () => {
        const map = createMap();
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

        expect(() => popup.addClassName('should throw exception')).toThrow(window.DOMException);
        expect(() => popup.removeClassName('should throw exception')).toThrow(window.DOMException);
        expect(() => popup.toggleClassName('should throw exception')).toThrow(window.DOMException);

        expect(() => popup.addClassName('')).toThrow(window.DOMException);
        expect(() => popup.removeClassName('')).toThrow(window.DOMException);
        expect(() => popup.toggleClassName('')).toThrow(window.DOMException);

    });

    test('Cursor-tracked popup disappears on mouseout', () => {
        const map = createMap();

        const popup = new Popup()
            .setText('Test')
            .trackPointer()
            .addTo(map);

        expect(popup._trackPointer).toBe(true);
    });

    test('Pointer-tracked popup is tagged with right class', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .trackPointer()
            .addTo(map);

        expect(
            popup._container.classList.value
        ).toContain('maplibregl-popup-track-pointer');
    });

    test('Pointer-tracked popup with content set later is tagged with right class ', () => {
        const map = createMap();
        const popup = new Popup()
            .trackPointer()
            .addTo(map);

        popup.setText('Test');

        expect(
            popup._container.classList.value
        ).toContain('maplibregl-popup-track-pointer');
    });

    test('Pointer-tracked popup that is set afterwards is tagged with right class ', () => {
        const map = createMap();
        const popup = new Popup()
            .addTo(map);

        popup.setText('Test');
        popup.trackPointer();

        expect(
            popup._container.classList.value
        ).toContain('maplibregl-popup-track-pointer');
    });

    test('Pointer-tracked popup can be repositioned with setLngLat', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .trackPointer()
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup._pos).toEqual(map.project([0, 0]));
        expect(
            popup._container.classList.value
        ).not.toContain('maplibregl-popup-track-pointer');
    });

    test('Positioned popup lacks pointer-tracking class', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(
            popup._container.classList.value
        ).not.toContain('maplibregl-popup-track-pointer');
    });

    test('Positioned popup can be set to track pointer', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .trackPointer()
            .addTo(map);

        simulate.mousemove(map.getCanvas(), {screenX:0, screenY:0});
        expect(popup._pos).toEqual({x:0, y:0});
    });

    test('Popup closes on Map#remove', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        map.remove();

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Adding popup with no focusable content (Popup#setText) does not change the active element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(createMap());

        expect(window.document.activeElement).toBe(dummyFocusedEl);
    });

    test('Adding popup with no focusable content (Popup#setHTML) does not change the active element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        new Popup({closeButton: false})
            .setHTML('<span>Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        expect(window.document.activeElement).toBe(dummyFocusedEl);
    });

    test('Close button is focused if it is the only focusable element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        const popup = new Popup({closeButton: true})
            .setHTML('<span>Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        // Suboptimal because the string matching is case-sensitive
        const closeButton = popup._container.querySelector('[aria-label^=\'Close\']');

        expect(window.document.activeElement).toBe(closeButton);
    });

    test('If popup content contains a focusable element it is focused', () => {
        const popup = new Popup({closeButton: true})
            .setHTML('<span tabindex="0" data-testid="abc">Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        const focusableEl = popup._container.querySelector('[data-testid=\'abc\']');

        expect(window.document.activeElement).toBe(focusableEl);
    });

    test('Element with tabindex="-1" is not focused', () => {
        const popup = new Popup({closeButton: true})
            .setHTML('<span tabindex="-1" data-testid="abc">Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        const nonFocusableEl = popup._container.querySelector('[data-testid=\'abc\']');
        const closeButton = popup._container.querySelector('button[aria-label=\'Close popup\']');

        expect(window.document.activeElement).not.toBe(nonFocusableEl);
        expect(window.document.activeElement).toBe(closeButton);
    });

    test('If popup contains a disabled button and a focusable element then the latter is focused', () => {
        const popup = new Popup({closeButton: true})
            .setHTML(`
            <button disabled>No focus here</button>
            <select data-testid="abc">
                <option value="1">1</option>
                <option value="2">2</option>
            </select>
        `)
            .setLngLat([0, 0])
            .addTo(createMap());

        const focusableEl = popup._container.querySelector('[data-testid=\'abc\']');

        expect(window.document.activeElement).toBe(focusableEl);
    });

    test('Popup with disabled focusing does not change the active element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        new Popup({closeButton: false, focusAfterOpen: false})
            .setHTML('<span tabindex="0" data-testid="abc">Test</span>')
            .setLngLat([0, 0])
            .addTo(createMap());

        expect(window.document.activeElement).toBe(dummyFocusedEl);
    });
});
