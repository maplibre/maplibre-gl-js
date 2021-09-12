import '../../stub_loader';
import {test} from '../../util/test';
import {createMap as globalCreateMap} from '../../util';
import Marker from '../../../rollup/build/tsc/ui/marker';
import Popup from '../../../rollup/build/tsc/ui/popup';
import LngLat from '../../../rollup/build/tsc/geo/lng_lat';
import Point from '../../../rollup/build/tsc/util/point';
import simulate from '../../util/simulate_interaction';

function createMap(t, options = {}) {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: 512});
    Object.defineProperty(container, 'clientHeight', {value: 512});
    return globalCreateMap(t, {container, ...options});
}

test('Marker uses a default marker element with an appropriate offset', (t) => {
    const marker = new Marker();
    expect(marker.getElement()).toBeTruthy();
    expect(marker.getOffset().equals(new Point(0, -14))).toBeTruthy();
    t.end();
});

test('Marker uses a default marker element with custom color', (t) => {
    const marker = new Marker({color: '#123456'});
    expect(marker.getElement().innerHTML.includes('#123456')).toBeTruthy();
    t.end();
});

test('Marker uses a default marker element with custom scale', (t) => {
    const map = createMap(t);
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
        defaultMarker.getElement().firstChild.getAttribute('height').includes('41')
    ).toBeTruthy();
    expect(defaultMarker.getElement().firstChild.getAttribute('width').includes('27')).toBeTruthy();

    // (41 * 0.8) = 32.8, (27 * 0.8) = 21.6
    expect(
        smallerMarker.getElement().firstChild.getAttribute('height').includes(`32.8`)
    ).toBeTruthy();
    expect(
        smallerMarker.getElement().firstChild.getAttribute('width').includes(`21.6`)
    ).toBeTruthy();

    // (41 * 2) = 82, (27 * 2) = 54
    expect(largerMarker.getElement().firstChild.getAttribute('height').includes('82')).toBeTruthy();
    expect(largerMarker.getElement().firstChild.getAttribute('width').includes('54')).toBeTruthy();

    t.end();
});

test('Marker uses a default marker with custom offset', (t) => {
    const marker = new Marker({offset: [1, 2]});
    expect(marker.getElement()).toBeTruthy();
    expect(marker.getOffset().equals(new Point(1, 2))).toBeTruthy();
    t.end();
});

test('Marker uses the provided element', (t) => {
    const element = window.document.createElement('div');
    const marker = new Marker({element});
    expect(marker.getElement()).toBe(element);
    t.end();
});

test('Marker#addTo adds the marker element to the canvas container', (t) => {
    const map = createMap(t);
    new Marker()
        .setLngLat([-77.01866, 38.888])
        .addTo(map);

    expect(map.getCanvasContainer().querySelectorAll('.maplibregl-marker').length).toBe(1);

    map.remove();
    t.end();
});

test('Marker provides LngLat accessors', (t) => {
    expect(new Marker().getLngLat()).toBe(undefined);

    expect(new Marker().setLngLat([1, 2]).getLngLat() instanceof LngLat).toBeTruthy();
    expect(new Marker().setLngLat([1, 2]).getLngLat()).toEqual(new LngLat(1, 2));

    expect(new Marker().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat).toBeTruthy();
    expect(new Marker().setLngLat(new LngLat(1, 2)).getLngLat()).toEqual(new LngLat(1, 2));

    t.end();
});

test('Marker provides offset accessors', (t) => {
    expect(new Marker().setOffset([1, 2]).getOffset() instanceof Point).toBeTruthy();
    expect(new Marker().setOffset([1, 2]).getOffset()).toEqual(new Point(1, 2));

    expect(new Marker().setOffset(new Point(1, 2)).getOffset() instanceof Point).toBeTruthy();
    expect(new Marker().setOffset(new Point(1, 2)).getOffset()).toEqual(new Point(1, 2));

    t.end();
});

test('Marker#setPopup binds a popup', (t) => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup);
    expect(marker.getPopup()).toBe(popup);
    t.end();
});

test('Marker#setPopup unbinds a popup', (t) => {
    const marker = new Marker()
        .setPopup(new Popup())
        .setPopup();
    expect(!marker.getPopup()).toBeTruthy();
    t.end();
});

test('Marker#togglePopup opens a popup that was closed', (t) => {
    const map = createMap(t);
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup())
        .togglePopup();

    expect(marker.getPopup().isOpen()).toBeTruthy();

    map.remove();
    t.end();
});

test('Marker#togglePopup closes a popup that was open', (t) => {
    const map = createMap(t);
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup())
        .togglePopup()
        .togglePopup();

    expect(!marker.getPopup().isOpen()).toBeTruthy();

    map.remove();
    t.end();
});

test('Enter key on Marker opens a popup that was closed', (t) => {
    const map = createMap(t);
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
    t.end();
});

test('Space key on Marker opens a popup that was closed', (t) => {
    const map = createMap(t);
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
    t.end();
});

test('Marker#setPopup sets a tabindex', (t) => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup);
    expect(marker.getElement().getAttribute('tabindex')).toBe("0");
    t.end();
});

test('Marker#setPopup removes tabindex when unset', (t) => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup)
        .setPopup();
    expect(marker.getElement().getAttribute('tabindex')).toBeFalsy();
    t.end();
});

test('Marker#setPopup does not replace existing tabindex', (t) => {
    const element = window.document.createElement('div');
    element.setAttribute('tabindex', '5');
    const popup = new Popup();
    const marker = new Marker({element})
        .setPopup(popup);
    expect(marker.getElement().getAttribute('tabindex')).toBe("5");
    t.end();
});

test('Marker anchor defaults to center', (t) => {
    const map = createMap(t);
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getElement().classList.contains('maplibregl-marker-anchor-center')).toBeTruthy();
    t.match(marker.getElement().style.transform, /translate\(-50%,-50%\)/);

    map.remove();
    t.end();
});

test('Marker anchors as specified by the anchor option', (t) => {
    const map = createMap(t);
    const marker = new Marker({anchor: 'top'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getElement().classList.contains('maplibregl-marker-anchor-top')).toBeTruthy();
    t.match(marker.getElement().style.transform, /translate\(-50%,0\)/);

    map.remove();
    t.end();
});

test('Marker accepts backward-compatible constructor parameters', (t) => {
    const element = window.document.createElement('div');

    const m1 = new Marker(element);
    expect(m1.getElement()).toBe(element);

    const m2 = new Marker(element, {offset: [1, 2]});
    expect(m2.getElement()).toBe(element);
    expect(m2.getOffset().equals(new Point(1, 2))).toBeTruthy();
    t.end();
});

test('Popup offsets around default Marker', (t) => {
    const map = createMap(t);

    const marker = new Marker()
        .setLngLat([0, 0])
        .setPopup(new Popup().setText('Test'))
        .addTo(map);

    expect(marker.getPopup().options.offset.bottom[1] < 0).toBeTruthy();
    expect(marker.getPopup().options.offset.top[1] === 0).toBeTruthy();
    expect(marker.getPopup().options.offset.left[0] > 0).toBeTruthy();
    expect(marker.getPopup().options.offset.right[0] < 0).toBeTruthy();

    expect(marker.getPopup().options.offset['bottom-left'][0] > 0).toBeTruthy();
    expect(marker.getPopup().options.offset['bottom-left'][1] < 0).toBeTruthy();
    expect(marker.getPopup().options.offset['bottom-right'][0] < 0).toBeTruthy();
    expect(marker.getPopup().options.offset['bottom-right'][1] < 0).toBeTruthy();

    expect(marker.getPopup().options.offset['top-left']).toEqual([0, 0]);
    expect(marker.getPopup().options.offset['top-right']).toEqual([0, 0]);

    t.end();
});

test('Popup anchors around default Marker', (t) => {
    const map = createMap(t);

    const marker = new Marker()
        .setLngLat([0, 0])
        .setPopup(new Popup().setText('Test'))
        .addTo(map);

    // open the popup
    marker.togglePopup();

    const mapHeight = map.getContainer().clientHeight;
    const markerTop = -marker.getPopup().options.offset.bottom[1]; // vertical distance from tip of marker to the top in pixels
    const markerRight = -marker.getPopup().options.offset.right[0]; // horizontal distance from the tip of the marker to the right in pixels

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

    t.end();
});

test('Marker drag functionality can be added with drag option', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.isDraggable()).toBe(true);

    map.remove();
    t.end();
});

test('Marker#setDraggable adds drag functionality', (t) => {
    const map = createMap(t);
    const marker = new Marker()
        .setLngLat([0, 0])
        .setDraggable(true)
        .addTo(map);

    expect(marker.isDraggable()).toBe(true);

    map.remove();
    t.end();
});

test('Marker#setDraggable turns off drag functionality', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.isDraggable()).toBe(true);

    marker.setDraggable(false);

    expect(marker.isDraggable()).toBe(false);

    map.remove();
    t.end();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to mouse-triggered drag with map-inherited clickTolerance', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.mousedown(el, {clientX: 0, clientY: 0});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    simulate.mousemove(el, {clientX: 2.9, clientY: 0});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    // above map's click tolerance
    simulate.mousemove(el, {clientX: 3.1, clientY: 0});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.mousemove(el, {clientX: 0, clientY: 0});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.mouseup(el);
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(1);
    expect(el.style.pointerEvents).toBe('auto');

    map.remove();
    t.end();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to mouse-triggered drag with marker-specific clickTolerance', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true, clickTolerance: 4})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.mousedown(el, {clientX: 0, clientY: 0});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    simulate.mousemove(el, {clientX: 3.9, clientY: 0});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    // above map's click tolerance
    simulate.mousemove(el, {clientX: 4.1, clientY: 0});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.mousemove(el, {clientX: 0, clientY: 0});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.mouseup(el);
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(1);
    expect(el.style.pointerEvents).toBe('auto');

    map.remove();
    t.end();
});

test('Marker with draggable:false does not fire dragstart, drag, and dragend events in response to a mouse-triggered drag', (t) => {
    const map = createMap(t);
    const marker = new Marker({})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.mousedown(el, {clientX: 0, clientY: 0});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mousemove(el, {clientX: 3, clientY: 1});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.mouseup(el);
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    map.remove();
    t.end();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag with map-inherited clickTolerance', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.touchstart(el, {touches: [{clientX: 0, clientY: 0}]});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    simulate.touchmove(el, {touches: [{clientX: 2.9, clientY: 0}]});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    // above map's click tolerance
    simulate.touchmove(el, {touches: [{clientX: 3.1, clientY: 0}]});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.touchmove(el, {touches: [{clientX: 0, clientY: 0}]});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.touchend(el);
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(1);
    expect(el.style.pointerEvents).toBe('auto');

    map.remove();
    t.end();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag with marker-specific clickTolerance', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true, clickTolerance: 4})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.touchstart(el, {touches: [{clientX: 0, clientY: 0}]});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    simulate.touchmove(el, {touches: [{clientX: 3.9, clientY: 0}]});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('');

    // above map's click tolerance
    simulate.touchmove(el, {touches: [{clientX: 4.1, clientY: 0}]});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(1);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.touchmove(el, {touches: [{clientX: 0, clientY: 0}]});
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(0);
    expect(el.style.pointerEvents).toBe('none');

    simulate.touchend(el);
    expect(dragstart.callCount).toBe(1);
    expect(drag.callCount).toBe(2);
    expect(dragend.callCount).toBe(1);
    expect(el.style.pointerEvents).toBe('auto');

    map.remove();
    t.end();
});

test('Marker with draggable:false does not fire dragstart, drag, and dragend events in response to a touch-triggered drag', (t) => {
    const map = createMap(t);
    const marker = new Marker({})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.touchstart(el, {touches: [{clientX: 0, clientY: 0}]});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.touchmove(el, {touches: [{clientX: 0, clientY: 0}]});
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    simulate.touchend(el);
    expect(dragstart.callCount).toBe(0);
    expect(drag.callCount).toBe(0);
    expect(dragend.callCount).toBe(0);

    map.remove();
    t.end();
});

test('Marker with draggable:true moves to new position in response to a mouse-triggered drag', (t) => {
    const map = createMap(t);
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
    t.end();
});

test('Marker with draggable:false does not move to new position in response to a mouse-triggered drag', (t) => {
    const map = createMap(t);
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
    t.end();
});

test('Marker with draggable:true does not error if removed on mousedown', (t) => {
    const map = createMap(t);
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();
    simulate.mousedown(el);
    simulate.mousemove(el, {clientX: 10, clientY: 10});

    marker.remove();
    expect(map.fire('mouseup')).toBeTruthy();
    t.end();
});

test('Marker can set rotationAlignment and pitchAlignment', (t) => {
    const map = createMap(t);
    const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotationAlignment()).toBe('map');
    expect(marker.getPitchAlignment()).toBe('map');

    map.remove();
    t.end();
});

test('Marker can set and update rotation', (t) => {
    const map = createMap(t);
    const marker = new Marker({rotation: 45})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotation()).toBe(45);

    marker.setRotation(90);
    expect(marker.getRotation()).toBe(90);

    map.remove();
    t.end();
});

test('Marker transforms rotation with the map', (t) => {
    const map = createMap(t);
    const marker = new Marker({rotationAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);

    const rotationRegex = /rotateZ\(-?([0-9]+)deg\)/;
    const initialRotation = marker.getElement().style.transform.match(rotationRegex)[1];

    map.setBearing(map.getBearing() + 180);

    const finalRotation = marker.getElement().style.transform.match(rotationRegex)[1];
    expect(initialRotation).not.toBe(finalRotation);

    map.remove();
    t.end();
});

test('Marker transforms pitch with the map', (t) => {
    const map = createMap(t);
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
    t.end();
});

test('Marker pitchAlignment when set to auto defaults to rotationAlignment', (t) => {
    const map = createMap(t);
    const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'auto'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotationAlignment()).toBe(marker.getPitchAlignment());

    map.remove();
    t.end();
});

test('Marker pitchAlignment when set to auto defaults to rotationAlignment (setter/getter)', (t) => {
    const map = createMap(t);
    const marker = new Marker({pitchAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getPitchAlignment()).toBe('map');
    marker.setRotationAlignment('viewport');
    marker.setPitchAlignment('auto');
    expect(marker.getRotationAlignment()).toBe(marker.getPitchAlignment());

    map.remove();
    t.end();
});
