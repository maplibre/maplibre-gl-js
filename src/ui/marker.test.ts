import {createMap as globalCreateMap, setPerformance, setWebGlContext} from '../util/test/util';
import Marker from './marker';
import Popup from './popup';
import LngLat from '../geo/lng_lat';
import Point from '@mapbox/point-geometry';
import simulate from '../../test/unit/lib/simulate_interaction';
import type Terrain from '../render/terrain';

function createMap(options = {}) {
    const container = window.document.createElement('div');
    window.document.body.appendChild(container);
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    return globalCreateMap({container, ...options});
}

beforeEach(() => {
    setWebGlContext();
    setPerformance();
});

describe('marker', () => {
    test('Marker uses a default marker element with an appropriate offset', () => {
        const marker = new Marker();
        expect(marker.getElement()).toBeTruthy();
        expect(marker.getOffset().equals(new Point(0, -14))).toBeTruthy();
    });

    test('Marker uses a default marker element with custom color', () => {
        const marker = new Marker({color: '#123456'});
        expect(marker.getElement().innerHTML.includes('#123456')).toBeTruthy();
    });

    test('Marker uses a default marker element with custom scale', () => {
        const map = createMap();
        const defaultMarker = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        // scale smaller than default
        const smallerMarker = new Marker({scale: 0.8})
            .setLngLat([0, 0])
            .addTo(map);
        // scale larger than default
        const largerMarker = new Marker({scale: 2})
            .setLngLat([0, 0])
            .addTo(map);

        // initial dimensions of svg element
        expect(
            defaultMarker.getElement().children[0].getAttribute('height').includes('41')
        ).toBeTruthy();
        expect(defaultMarker.getElement().children[0].getAttribute('width').includes('27')).toBeTruthy();

        // (41 * 0.8) = 32.8, (27 * 0.8) = 21.6
        expect(
            smallerMarker.getElement().children[0].getAttribute('height').includes('32.8')
        ).toBeTruthy();
        expect(
            smallerMarker.getElement().children[0].getAttribute('width').includes('21.6')
        ).toBeTruthy();

        // (41 * 2) = 82, (27 * 2) = 54
        expect(largerMarker.getElement().children[0].getAttribute('height').includes('82')).toBeTruthy();
        expect(largerMarker.getElement().children[0].getAttribute('width').includes('54')).toBeTruthy();

    });

    test('Marker uses a default marker with custom offset', () => {
        const marker = new Marker({offset: [1, 2]});
        expect(marker.getElement()).toBeTruthy();
        expect(marker.getOffset().equals(new Point(1, 2))).toBeTruthy();
    });

    test('Marker uses the provided element', () => {
        const element = window.document.createElement('div');
        const marker = new Marker({element});
        expect(marker.getElement()).toBe(element);
    });

    test('Marker#addTo adds the marker element to the canvas container', () => {
        const map = createMap();
        new Marker()
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        expect(map.getCanvasContainer().querySelectorAll('.maplibregl-marker')).toHaveLength(1);

        map.remove();
    });

    test('Marker provides LngLat accessors', () => {
        expect(new Marker().getLngLat()).toBeUndefined();

        expect(new Marker().setLngLat([1, 2]).getLngLat() instanceof LngLat).toBeTruthy();
        expect(new Marker().setLngLat([1, 2]).getLngLat()).toEqual(new LngLat(1, 2));

        expect(new Marker().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat).toBeTruthy();
        expect(new Marker().setLngLat(new LngLat(1, 2)).getLngLat()).toEqual(new LngLat(1, 2));

    });

    test('Marker provides offset accessors', () => {
        expect(new Marker().setOffset([1, 2]).getOffset() instanceof Point).toBeTruthy();
        expect(new Marker().setOffset([1, 2]).getOffset()).toEqual(new Point(1, 2));

        expect(new Marker().setOffset(new Point(1, 2)).getOffset() instanceof Point).toBeTruthy();
        expect(new Marker().setOffset(new Point(1, 2)).getOffset()).toEqual(new Point(1, 2));

    });

    test('Marker#setPopup binds a popup', () => {
        const popup = new Popup();
        const marker = new Marker()
            .setPopup(popup);
        expect(marker.getPopup()).toBe(popup);
    });

    test('Marker#setPopup unbinds a popup', () => {
        const marker = new Marker()
            .setPopup(new Popup())
            .setPopup();
        expect(!marker.getPopup()).toBeTruthy();
    });

    test('Marker#togglePopup opens a popup that was closed', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map)
            .setPopup(new Popup())
            .togglePopup();

        expect(marker.getPopup().isOpen()).toBeTruthy();

        map.remove();
    });

    test('Marker#togglePopup closes a popup that was open', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map)
            .setPopup(new Popup())
            .togglePopup()
            .togglePopup();

        expect(!marker.getPopup().isOpen()).toBeTruthy();

        map.remove();
    });

    test('Enter key on Marker opens a popup that was closed', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map)
            .setPopup(new Popup());

        // popup not initially open
        expect(marker.getPopup().isOpen()).toBeFalsy();

        simulate.keypress(marker.getElement(), {code: 'Enter'});

        // popup open after Enter keypress
        expect(marker.getPopup().isOpen()).toBeTruthy();

        map.remove();
    });

    test('Space key on Marker opens a popup that was closed', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map)
            .setPopup(new Popup());

        // popup not initially open
        expect(marker.getPopup().isOpen()).toBeFalsy();

        simulate.keypress(marker.getElement(), {code: 'Space'});

        // popup open after Enter keypress
        expect(marker.getPopup().isOpen()).toBeTruthy();

        map.remove();
    });

    test('Marker#setPopup sets a tabindex', () => {
        const popup = new Popup();
        const marker = new Marker()
            .setPopup(popup);
        expect(marker.getElement().getAttribute('tabindex')).toBe('0');
    });

    test('Marker#setPopup removes tabindex when unset', () => {
        const popup = new Popup();
        const marker = new Marker()
            .setPopup(popup)
            .setPopup();
        expect(marker.getElement().getAttribute('tabindex')).toBeFalsy();
    });

    test('Marker#setPopup does not replace existing tabindex', () => {
        const element = window.document.createElement('div');
        element.setAttribute('tabindex', '5');
        const popup = new Popup();
        const marker = new Marker({element})
            .setPopup(popup);
        expect(marker.getElement().getAttribute('tabindex')).toBe('5');
    });

    test('Marker anchor defaults to center', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.getElement().classList.contains('maplibregl-marker-anchor-center')).toBeTruthy();
        expect(marker.getElement().style.transform).toMatch(/translate\(-50%,-50%\)/);

        map.remove();
    });

    test('Marker anchors as specified by the anchor option', () => {
        const map = createMap();
        const marker = new Marker({anchor: 'top'})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.getElement().classList.contains('maplibregl-marker-anchor-top')).toBeTruthy();
        expect(marker.getElement().style.transform).toMatch(/translate\(-50%,0\)/);

        map.remove();
    });

    test('Marker accepts backward-compatible constructor parameters', () => {
        const element = window.document.createElement('div');

        const m1 = new Marker(element);
        expect(m1.getElement()).toBe(element);

        const m2 = new Marker(element, {offset: [1, 2]});
        expect(m2.getElement()).toBe(element);
        expect(m2.getOffset().equals(new Point(1, 2))).toBeTruthy();
    });

    test('Popup offsets around default Marker', () => {
        const map = createMap();

        const marker = new Marker()
            .setLngLat([0, 0])
            .setPopup(new Popup().setText('Test'))
            .addTo(map);

        expect(marker.getPopup().options.offset['bottom'][1] < 0).toBeTruthy();
        expect(marker.getPopup().options.offset['top'][1] === 0).toBeTruthy();
        expect(marker.getPopup().options.offset['left'][0] > 0).toBeTruthy();
        expect(marker.getPopup().options.offset['right'][0] < 0).toBeTruthy();

        expect(marker.getPopup().options.offset['bottom-left'][0] > 0).toBeTruthy();
        expect(marker.getPopup().options.offset['bottom-left'][1] < 0).toBeTruthy();
        expect(marker.getPopup().options.offset['bottom-right'][0] < 0).toBeTruthy();
        expect(marker.getPopup().options.offset['bottom-right'][1] < 0).toBeTruthy();

        expect(marker.getPopup().options.offset['top-left']).toEqual([0, 0]);
        expect(marker.getPopup().options.offset['top-right']).toEqual([0, 0]);

    });

    test('Popup anchors around default Marker', () => {
        const map = createMap();

        const marker = new Marker()
            .setLngLat([0, 0])
            .setPopup(new Popup().setText('Test'))
            .addTo(map);

        // open the popup
        marker.togglePopup();

        const mapHeight = map.getContainer().clientHeight;
        const markerTop = -marker.getPopup().options.offset['bottom'][1]; // vertical distance from tip of marker to the top in pixels
        const markerRight = -marker.getPopup().options.offset['right'][0]; // horizontal distance from the tip of the marker to the right in pixels

        // give the popup some height
        Object.defineProperty(marker.getPopup()._container, 'offsetWidth', {value: 100});
        Object.defineProperty(marker.getPopup()._container, 'offsetHeight', {value: 100});

        // marker should default to above since it has enough space
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-bottom')
        ).toBeTruthy();

        // move marker to the top forcing the popup to below
        marker.setLngLat(map.unproject([mapHeight / 2, markerTop]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-top')
        ).toBeTruthy();

        // move marker to the right forcing the popup to the left
        marker.setLngLat(map.unproject([mapHeight - markerRight, mapHeight / 2]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-right')
        ).toBeTruthy();

        // move marker to the left forcing the popup to the right
        marker.setLngLat(map.unproject([markerRight, mapHeight / 2]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-left')
        ).toBeTruthy();

        // move marker to the top left forcing the popup to the bottom right
        marker.setLngLat(map.unproject([markerRight, markerTop]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-top-left')
        ).toBeTruthy();

        // move marker to the top right forcing the popup to the bottom left
        marker.setLngLat(map.unproject([mapHeight - markerRight, markerTop]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-top-right')
        ).toBeTruthy();

        // move marker to the bottom left forcing the popup to the top right
        marker.setLngLat(map.unproject([markerRight, mapHeight]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-bottom-left')
        ).toBeTruthy();

        // move marker to the bottom right forcing the popup to the top left
        marker.setLngLat(map.unproject([mapHeight - markerRight, mapHeight]));
        expect(
            marker.getPopup()._container.classList.contains('maplibregl-popup-anchor-bottom-right')
        ).toBeTruthy();

    });

    test('Marker drag functionality can be added with drag option', () => {
        const map = createMap();
        const marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.isDraggable()).toBe(true);

        map.remove();
    });

    test('Marker#setDraggable adds drag functionality', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .setDraggable(true)
            .addTo(map);

        expect(marker.isDraggable()).toBe(true);

        map.remove();
    });

    test('Marker#setDraggable turns off drag functionality', () => {
        const map = createMap();
        const marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.isDraggable()).toBe(true);

        marker.setDraggable(false);

        expect(marker.isDraggable()).toBe(false);

        map.remove();
    });

    test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to mouse-triggered drag with map-inherited clickTolerance', () => {
        const map = createMap();
        const marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        marker.on('dragstart', dragstart);
        marker.on('drag',      drag);
        marker.on('dragend',   dragend);

        simulate.mousedown(el, {clientX: 0, clientY: 0});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        simulate.mousemove(el, {clientX: 2.9, clientY: 0});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        // above map's click tolerance
        simulate.mousemove(el, {clientX: 3.1, clientY: 0});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.mousemove(el, {clientX: 0, clientY: 0});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.mouseup(el);
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(1);
        expect(el.style.pointerEvents).toBe('auto');

        map.remove();
    });

    test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to mouse-triggered drag with marker-specific clickTolerance', () => {
        const map = createMap();
        const marker = new Marker({draggable: true, clickTolerance: 4})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        marker.on('dragstart', dragstart);
        marker.on('drag',      drag);
        marker.on('dragend',   dragend);

        simulate.mousedown(el, {clientX: 0, clientY: 0});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        simulate.mousemove(el, {clientX: 3.9, clientY: 0});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        // above map's click tolerance
        simulate.mousemove(el, {clientX: 4.1, clientY: 0});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.mousemove(el, {clientX: 0, clientY: 0});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.mouseup(el);
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(1);
        expect(el.style.pointerEvents).toBe('auto');

        map.remove();
    });

    test('Marker with draggable:false does not fire dragstart, drag, and dragend events in response to a mouse-triggered drag', () => {
        const map = createMap();
        const marker = new Marker({})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        marker.on('dragstart', dragstart);
        marker.on('drag',      drag);
        marker.on('dragend',   dragend);

        simulate.mousedown(el, {clientX: 0, clientY: 0});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.mousemove(el, {clientX: 3, clientY: 1});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.mouseup(el);
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        map.remove();
    });

    test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag with map-inherited clickTolerance', () => {
        const map = createMap();
        const marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        marker.on('dragstart', dragstart);
        marker.on('drag',      drag);
        marker.on('dragend',   dragend);

        simulate.touchstart(el, {touches: [{clientX: 0, clientY: 0}]});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        simulate.touchmove(el, {touches: [{clientX: 2.9, clientY: 0}]});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        // above map's click tolerance
        simulate.touchmove(el, {touches: [{clientX: 3.1, clientY: 0}]});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.touchmove(el, {touches: [{clientX: 0, clientY: 0}]});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.touchend(el);
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(1);
        expect(el.style.pointerEvents).toBe('auto');

        map.remove();
    });

    test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag with marker-specific clickTolerance', () => {
        const map = createMap();
        const marker = new Marker({draggable: true, clickTolerance: 4})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        marker.on('dragstart', dragstart);
        marker.on('drag',      drag);
        marker.on('dragend',   dragend);

        simulate.touchstart(el, {touches: [{clientX: 0, clientY: 0}]});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        simulate.touchmove(el, {touches: [{clientX: 3.9, clientY: 0}]});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('');

        // above map's click tolerance
        simulate.touchmove(el, {touches: [{clientX: 4.1, clientY: 0}]});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(1);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.touchmove(el, {touches: [{clientX: 0, clientY: 0}]});
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).not.toHaveBeenCalled();
        expect(el.style.pointerEvents).toBe('none');

        simulate.touchend(el);
        expect(dragstart).toHaveBeenCalledTimes(1);
        expect(drag).toHaveBeenCalledTimes(2);
        expect(dragend).toHaveBeenCalledTimes(1);
        expect(el.style.pointerEvents).toBe('auto');

        map.remove();
    });

    test('Marker with draggable:false does not fire dragstart, drag, and dragend events in response to a touch-triggered drag', () => {
        const map = createMap();
        const marker = new Marker({})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();

        const dragstart = jest.fn();
        const drag      = jest.fn();
        const dragend   = jest.fn();

        marker.on('dragstart', dragstart);
        marker.on('drag',      drag);
        marker.on('dragend',   dragend);

        simulate.touchstart(el, {touches: [{clientX: 0, clientY: 0}]});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.touchmove(el, {touches: [{clientX: 0, clientY: 0}]});
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.touchend(el);
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        map.remove();
    });

    test('Marker with draggable:true moves to new position in response to a mouse-triggered drag', () => {
        const map = createMap();
        const marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();
        const startPos = map.project(marker.getLngLat());
        simulate.mousedown(el);
        simulate.mousemove(el, {clientX: 10, clientY: 10});
        simulate.mouseup(el);

        const endPos = map.project(marker.getLngLat());
        expect(Math.round(endPos.x)).toBe(startPos.x + 10);
        expect(Math.round(endPos.y)).toBe(startPos.y + 10);

        map.remove();
    });

    test('Marker with draggable:false does not move to new position in response to a mouse-triggered drag', () => {
        const map = createMap();
        const marker = new Marker({})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();
        const startPos = map.project(marker.getLngLat());

        simulate.mousedown(el);
        simulate.mousemove(el);
        simulate.mouseup(el);

        const endPos = map.project(marker.getLngLat());

        expect(startPos.x).toBe(endPos.x);
        expect(startPos.y).toBe(endPos.y);

        map.remove();
    });

    test('Marker with draggable:true does not error if removed on mousedown', () => {
        const map = createMap();
        const marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map);
        const el = marker.getElement();
        simulate.mousedown(el);
        simulate.mousemove(el, {clientX: 10, clientY: 10});

        marker.remove();
        expect(map.fire('mouseup')).toBeTruthy();
    });

    test('Marker can set rotationAlignment and pitchAlignment', () => {
        const map = createMap();
        const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.getRotationAlignment()).toBe('map');
        expect(marker.getPitchAlignment()).toBe('map');

        map.remove();
    });

    test('Marker can set and update rotation', () => {
        const map = createMap();
        const marker = new Marker({rotation: 45})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.getRotation()).toBe(45);

        marker.setRotation(90);
        expect(marker.getRotation()).toBe(90);

        map.remove();
    });

    test('Marker transforms rotation with the map', () => {
        const map = createMap();
        const marker = new Marker({rotationAlignment: 'map'})
            .setLngLat([0, 0])
            .addTo(map);

        const rotationRegex = /rotateZ\(-?([0-9]+)deg\)/;
        const initialRotation = marker.getElement().style.transform.match(rotationRegex)[1];

        map.setBearing(map.getBearing() + 180);

        const finalRotation = marker.getElement().style.transform.match(rotationRegex)[1];
        expect(initialRotation).not.toBe(finalRotation);

        map.remove();
    });

    test('Marker transforms pitch with the map', () => {
        const map = createMap();
        const marker = new Marker({pitchAlignment: 'map'})
            .setLngLat([0, 0])
            .addTo(map);

        map.setPitch(0);

        const rotationRegex = /rotateX\(-?([0-9]+)deg\)/;
        const initialPitch = marker.getElement().style.transform.match(rotationRegex)[1];

        map.setPitch(45);

        const finalPitch = marker.getElement().style.transform.match(rotationRegex)[1];
        expect(initialPitch).not.toBe(finalPitch);

        map.remove();
    });

    test('Marker pitchAlignment when set to auto defaults to rotationAlignment', () => {
        const map = createMap();
        const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'auto'})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.getRotationAlignment()).toBe(marker.getPitchAlignment());

        map.remove();
    });

    test('Marker pitchAlignment when set to auto defaults to rotationAlignment (setter/getter)', () => {
        const map = createMap();
        const marker = new Marker({pitchAlignment: 'map'})
            .setLngLat([0, 0])
            .addTo(map);

        expect(marker.getPitchAlignment()).toBe('map');
        marker.setRotationAlignment('viewport');
        marker.setPitchAlignment('auto');
        expect(marker.getRotationAlignment()).toBe(marker.getPitchAlignment());

        map.remove();
    });

    test('Marker removed after update when terrain is on should clear timeout', () => {
        jest.spyOn(global, 'setTimeout');
        jest.spyOn(global, 'clearTimeout');
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        map.style.terrain = {
            getElevation: () => 0
        } as any as Terrain;

        marker.setOffset([10, 10]);

        expect(setTimeout).toHaveBeenCalled();
        marker.remove();
        expect(clearTimeout).toHaveBeenCalled();

        map.remove();
    });
});
