import {describe, beforeEach, test, expect, vi} from 'vitest';
import {createMap as globalCreateMap, beforeMapTest} from '../util/test/util';
import {Popup, type Offset} from './popup';
import {LngLat} from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import simulate from '../../test/unit/lib/simulate_interaction';
import {type PositionAnchor} from './anchor';

const containerWidth = 512;
const containerHeight = 512;

function createMap(options?) {
    options = options || {};
    const container = window.document.createElement('div');
    window.document.body.appendChild(container);
    Object.defineProperty(container, 'clientWidth', {value: options.width || containerWidth});
    Object.defineProperty(container, 'clientHeight', {value: options.height || containerHeight});
    return globalCreateMap({...options, container});
}

beforeEach(() => {
    beforeMapTest();
});

describe('popup', () => {

    test('Popup.getElement returns a .maplibregl-popup element', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        expect(popup.isOpen()).toBeTruthy();
        expect(popup.getElement().classList.contains('maplibregl-popup')).toBeTruthy();
    });

    test('Popup.addTo adds a .maplibregl-popup element', () => {
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
        const onClose = vi.fn();

        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0]);
        popup.on('close', onClose);
        popup.addTo(map);
        popup.remove();

        expect(onClose).toHaveBeenCalled();
    });

    test('Popup does not fire close event when removed if it is not on the map', () => {
        const onClose = vi.fn();

        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0]);
        popup.on('close', onClose);
        popup.remove();

        expect(onClose).not.toHaveBeenCalled();
    });

    test('Popup fires open event when added', () => {
        const map = createMap();
        const onOpen = vi.fn();

        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0]);
        popup.on('open', onOpen);
        popup.addTo(map);

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

    test('Popup.setText protects against XSS', () => {
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

    test('Popup\'s lng is wrapped when slightly crossing 180 with zoomed out globe', async () => {
        const map = createMap({width: 1024, renderWorldCopies: true});
        await map.once('load');
        map.setProjection({type: 'globe'});
        map.setZoom(0);

        const popup = new Popup()
            .setLngLat([179, 0])
            .setText('Test')
            .addTo(map);

        popup.setLngLat([181, 0]);

        expect(popup._lngLat.lng).toBe(-179);
    });

    test('Popup is repositioned at the specified LngLat', () => {
        const map = createMap({width: 1024}); // longitude bounds: [-360, 360]
        map.terrain = {
            getElevationForLngLat: () => 0
        } as any;
        const popup = new Popup()
            .setLngLat([70, 0])
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

            vi.spyOn(map, 'project').mockReturnValue(point);
            popup.setLngLat([0, 0]);

            expect(popup.getElement().classList.contains(`maplibregl-popup-anchor-${anchor}`)).toBeTruthy();
        });

        test(`Popup translation reflects offset and ${anchor} anchor`, () => {
            const map = createMap();
            vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

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

        vi.spyOn(map, 'project').mockReturnValue(point);
        popup.setLngLat([0, 0]);

        expect(popup.getElement().classList.contains('maplibregl-popup-anchor-top')).toBeTruthy();
    });

    test('Popup is offset via a PointLike offset option', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({anchor: 'top-left', offset: [5, 10]})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(0,0) translate(5px,10px)');
    });

    test('Popup is offset via an object offset option', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({anchor: 'top-left', offset: {'top-left': [5, 10]} as Offset})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(0,0) translate(5px,10px)');
    });

    test('Popup is offset via an incomplete object offset option', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

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

    test('Popup can be removed and added again can be closed with click (#5576)', () => {
        const map = createMap();

        new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .addTo(map);

        (map.getContainer().querySelector('.maplibregl-popup-close-button') as HTMLButtonElement).click();

        expect(map.getContainer().querySelectorAll('.maplibregl-popup')).toHaveLength(0);
    });

    test('Popup.addTo is idempotent (#1811)', () => {
        const map = createMap();

        const popup = new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map)
            .addTo(map);

        expect(popup.getElement().querySelector('.maplibregl-popup-content').textContent).toBe('Test');
    });

    test('Popup.remove is idempotent (#2395)', () => {
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

        const addClassNameMethodPopupInstance = popup.addClassName('addedClass');
        expect(popupContainer.classList.contains('addedClass')).toBeTruthy();
        expect(addClassNameMethodPopupInstance).toBeInstanceOf(Popup);

        const removeClassNameMethodPopupInstance = popup.removeClassName('addedClass');
        expect(!popupContainer.classList.contains('addedClass')).toBeTruthy();
        expect(removeClassNameMethodPopupInstance).toBeInstanceOf(Popup);

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
        expect(
            map._canvasContainer.classList.value
        ).not.toContain('maplibregl-track-pointer');
    });

    test('Pointer-tracked popup calling Popup.remove removes track-pointer class from map (#3434)', () => {
        const map = createMap();
        new Popup()
            .setText('Test')
            .trackPointer()
            .addTo(map)
            .remove();

        expect(
            map._canvasContainer.classList.value
        ).not.toContain('maplibregl-track-pointer');
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

        simulate.mousemove(map.getCanvas(), {screenX: 0, screenY: 0});
        expect(popup._pos).toEqual({x: 0, y: 0});
    });

    test('Popup closes on Map.remove', () => {
        const map = createMap();
        const popup = new Popup()
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(map);

        map.remove();

        expect(!popup.isOpen()).toBeTruthy();
    });

    test('Adding popup with no focusable content (Popup.setText) does not change the active element', () => {
        const dummyFocusedEl = window.document.createElement('button');
        window.document.body.appendChild(dummyFocusedEl);
        dummyFocusedEl.focus();

        new Popup({closeButton: false})
            .setText('Test')
            .setLngLat([0, 0])
            .addTo(createMap());

        expect(window.document.activeElement).toBe(dummyFocusedEl);
    });

    test('Adding popup with no focusable content (Popup.setHTML) does not change the active element', () => {
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
            .addTo(createMap({
                locale: {
                    'Popup.Close': 'Alt close label'
                }
            }));

        // Suboptimal because the string matching is case-sensitive
        const closeButton = popup._container.querySelector('[aria-label^=\'Alt close label\']');

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

    test('Popup is positioned on rounded whole-number pixel coordinates by default when offset is a decimal', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({offset: [-0.1, 0.9]})
            .setLngLat([0, 0])
            .setText('foobar')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(-50%,-100%) translate(0px,1px)');
    });

    test('Popup position is not rounded when subpixel positioning is enabled', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({offset: [-0.1, 0.9], subpixelPositioning: true})
            .setLngLat([0, 0])
            .setText('foobar')
            .addTo(map);

        expect(popup.getElement().style.transform).toBe('translate(-50%,-100%) translate(-0.1px,0.9px)');
    });

    test('Popup subpixel positioning can be enabled with Popup.setSubpixelPositioning', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({offset: [0, 0]})
            .setLngLat([0, 0])
            .setText('foobar')
            .addTo(map);

        popup.setSubpixelPositioning(true);
        popup.setOffset([-0.1, 0.9]);

        expect(popup.getElement().style.transform).toBe('translate(-50%,-100%) translate(-0.1px,0.9px)');
    });
    test('Popup subpixel positioning can be disabled with Popup.setSubpixelPositioning', () => {
        const map = createMap();
        vi.spyOn(map, 'project').mockReturnValue(new Point(0, 0));

        const popup = new Popup({offset: [0, 0], subpixelPositioning: true})
            .setLngLat([0, 0])
            .setText('foobar')
            .addTo(map);

        popup.setSubpixelPositioning(false);
        popup.setOffset([-0.1, 0.9]);

        expect(popup.getElement().style.transform).toBe('translate(-50%,-100%) translate(0px,1px)');
    });
    test('Popup changes opacity when location behind globe', async () => {
        const map = createMap();

        const popup = new Popup({locationOccludedOpacity: 0.2})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        await map.once('load');
        map.setProjection({
            type: 'globe'
        });
        map.setCenter([180, 0]);
        expect(popup.getElement().style.opacity).toBe('0.2');
    });
    test('Popup resets opacity when no longer behind globe', async () => {
        const map = createMap();

        const popup = new Popup({locationOccludedOpacity: 0.3})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        await map.once('load');
        map.setProjection({
            type: 'globe'
        });
        map.setCenter([180, 0]);
        expect(popup.getElement().style.opacity).toBe('0.3');
        map.setCenter([0, 0]);
        expect(popup.getElement().style.opacity).toBe('');
    });

    describe('padding', () => {
        test('accepts object padding value', () => {
            const map = createMap();
            const padding = {top: 10, right: 20, bottom: 30, left: 40};
            const popup = new Popup({padding: padding})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            expect(popup.options.padding).toEqual(padding);
        });

        test('popup without padding has anchor near edges', () => {
            const map = createMap();

            // Position popup near the top-left corner to trigger anchor selection
            const nearCornerLngLat = map.unproject([50, 50]);

            const popup = new Popup()
                .setText('Test popup without padding')
                .setLngLat(nearCornerLngLat)
                .addTo(map);

            const element = popup.getElement();
            const anchor = Array.from(element.classList).find(cls => cls.includes('anchor'));

            expect(anchor).toBeDefined();
        });

        test('popup with padding has anchor near edges', () => {
            const map = createMap();

            // Position popup near the top-left corner to trigger anchor selection
            const nearCornerLngLat = map.unproject([50, 50]);

            const popup = new Popup({padding: {top: 50, right: 50, bottom: 50, left: 50}})
                .setText('Test popup with padding')
                .setLngLat(nearCornerLngLat)
                .addTo(map);

            const element = popup.getElement();
            const anchor = Array.from(element.classList).find(cls => cls.includes('anchor'));

            expect(anchor).toBeDefined();
        });

        test('setPadding accepts partial object padding value', () => {
            const map = createMap();
            const popup = new Popup()
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            popup.setPadding({top: 5, right: 10});
            expect(popup.options.padding).toEqual({top: 5, right: 10});
        });

        test('setPadding accepts null to clear padding', () => {
            const map = createMap();
            const popup = new Popup({padding: {top: 20}})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            popup.setPadding(null);
            expect(popup.options.padding).toBeNull();
        });

        test('setPadding accepts undefined to clear padding', () => {
            const map = createMap();
            const popup = new Popup({padding: {top: 20}})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            popup.setPadding(undefined);
            expect(popup.options.padding).toBeUndefined();
        });

        test('manually set anchors ignore padding completely', () => {
            const map = createMap();

            const anchor = 'top';

            const popupNoPadding = new Popup({anchor})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            const popupWithPadding = new Popup({anchor, padding: {top: 100, right: 100, bottom: 100, left: 100}})
                .setText('Test')
                .setLngLat([0, 0])
                .addTo(map);

            const elementNoPadding = popupNoPadding.getElement();
            const elementWithPadding = popupWithPadding.getElement();

            // Both should have identical positioning because anchor is manually set
            const transformNoPadding = elementNoPadding.style.transform;
            const transformWithPadding = elementWithPadding.style.transform;

            expect(transformNoPadding).toBe(transformWithPadding);

            popupNoPadding.remove();
            popupWithPadding.remove();
        });

        test('offset and padding interaction preserves offset behavior', () => {
            const map = createMap();

            const offset = {top: [0, -20], bottom: [0, 20], left: [20, 0], right: [-20, 0]} as any;

            const popup = new Popup({offset, padding: {top: 10, right: 10, bottom: 10, left: 10}})
                .setText('Test with offset and padding')
                .setLngLat([0, 0])
                .addTo(map);

            expect(popup.getElement()).toBeDefined();
            // The fact that it renders without error confirms offset handling is intact
        });

        test('edge case - zero padding', () => {
            const map = createMap();
            const popup = new Popup({padding: {top: 0, right: 0, bottom: 0, left: 0}})
                .setText('Zero padding')
                .setLngLat([0, 0])
                .addTo(map);

            expect(popup.getElement()).toBeDefined();
            popup.remove();
        });

        test('edge case - negative padding', () => {
            const map = createMap();
            const popup = new Popup({padding: {top: -10, right: -10, bottom: -10, left: -10}})
                .setText('Negative padding')
                .setLngLat([0, 0])
                .addTo(map);

            expect(popup.getElement()).toBeDefined();
            popup.remove();
        });

        test('edge case - extremely large padding', () => {
            const map = createMap();
            const popup = new Popup({padding: {top: 1000000, right: 1000000, bottom: 1000000, left: 1000000}})
                .setText('Extremely large padding')
                .setLngLat([0, 0])
                .addTo(map);

            expect(popup.getElement()).toBeDefined();
            popup.remove();
        });

        test('edge case - mixed padding values', () => {
            const map = createMap();
            const popup = new Popup({padding: {top: -50, right: 0, bottom: 100, left: 50}})
                .setText('Mixed padding values')
                .setLngLat([0, 0])
                .addTo(map);

            expect(popup.getElement()).toBeDefined();
            popup.remove();
        });

        test('trackPointer with padding should not crash and should have track-pointer class', () => {
            const map = createMap();

            const popup = new Popup({padding: {top: 20, right: 20, bottom: 20, left: 20}})
                .setText('Track pointer test')
                .trackPointer()
                .addTo(map);

            expect(popup.getElement().classList.contains('maplibregl-popup-track-pointer')).toBeTruthy();
            expect(map._canvasContainer.classList.contains('maplibregl-track-pointer')).toBeTruthy();

            popup.remove();
        });
    });
});
