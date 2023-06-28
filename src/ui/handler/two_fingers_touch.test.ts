import {Map, MapOptions} from '../map';
import {Marker} from '../marker';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {beforeMapTest} from '../../util/test/util';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)} as any as MapOptions);
}

beforeEach(() => {
    beforeMapTest();
});

describe('touch zoom rotate', () => {

    test('TwoFingersTouchZoomRotateHandler fires zoomstart, zoom, and zoomend events at appropriate times in response to a pinch-zoom gesture', () => {
        const map = createMap();
        const target = map.getCanvas();

        const zoomstart = jest.fn();
        const zoom      = jest.fn();
        const zoomend   = jest.fn();

        map.handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -50}, {target, identifier: 2, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -100}, {target, identifier: 2, clientX: 0, clientY: 100}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -60}, {target, identifier: 2, clientX: 0, clientY: 60}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(2);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(2);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(3);
        expect(zoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a pinch-rotate gesture', () => {
        const map = createMap();
        const target = map.getCanvas();

        const rotatestart = jest.fn();
        const rotate      = jest.fn();
        const rotateend   = jest.fn();

        map.on('rotatestart', rotatestart);
        map.on('rotate',      rotate);
        map.on('rotateend',   rotateend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -50}, {target, identifier: 1, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(0);
        expect(rotate).toHaveBeenCalledTimes(0);
        expect(rotateend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: -50, clientY: 0}, {target, identifier: 1, clientX: 50, clientY: 0}]});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(1);
        expect(rotate).toHaveBeenCalledTimes(1);
        expect(rotateend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -50}, {target, identifier: 1, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(1);
        expect(rotate).toHaveBeenCalledTimes(2);
        expect(rotateend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();
        expect(rotatestart).toHaveBeenCalledTimes(1);
        expect(rotate).toHaveBeenCalledTimes(2);
        expect(rotateend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler does not begin a gesture if preventDefault is called on the touchstart event', () => {
        const map = createMap();
        const target = map.getCanvas();

        map.on('touchstart', e => e.preventDefault());

        const move = jest.fn();
        map.on('move', move);

        simulate.touchstart(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 5, clientY: 0}]});
        map._renderTaskQueue.run();

        simulate.touchmove(map.getCanvas(), {touches: [{target, clientX: 0, clientY: 0}, {target, clientX: 0, clientY: 5}]});
        map._renderTaskQueue.run();

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        expect(move).toHaveBeenCalledTimes(0);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler starts zoom immediately when rotation disabled', () => {
        const map = createMap();
        const target = map.getCanvas();
        map.touchZoomRotate.disableRotation();
        map.handlers._handlersById.tapZoom.disable();

        const zoomstart = jest.fn();
        const zoom      = jest.fn();
        const zoomend   = jest.fn();

        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 5}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 6}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 0, clientX: 0, clientY: -5}, {target, identifier: 2, clientX: 0, clientY: 4}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(2);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();
        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(2);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(3);
        expect(zoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler adds css class used for disabling default touch behavior in some browsers', () => {
        const map = createMap();

        const className = 'maplibregl-touch-zoom-rotate';
        expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
        map.touchZoomRotate.disable();
        expect(map.getCanvasContainer().classList.contains(className)).toBeFalsy();
        map.touchZoomRotate.enable();
        expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
    });

    test('TwoFingersTouchZoomRotateHandler zooms when touching two markers on the same map', () => {
        const map = createMap();

        const marker1 = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        const marker2 = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        const target1 = marker1.getElement();
        const target2 = marker2.getElement();

        const zoomstart = jest.fn();
        const zoom      = jest.fn();
        const zoomend   = jest.fn();

        map.handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}]});
        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}, {target: target2, identifier: 2, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -100}, {target: target2, identifier: 2, clientX: 0, clientY: 100}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(1);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -60}, {target: target2, identifier: 2, clientX: 0, clientY: 60}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(1);
        expect(zoom).toHaveBeenCalledTimes(2);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(2);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(3);
        expect(zoomend).toHaveBeenCalledTimes(1);

        map.remove();
    });

    test('TwoFingersTouchZoomRotateHandler does not zoom when touching an element not on the map', () => {
        const map = createMap();

        const marker1 = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        const marker2 = new Marker()
            .setLngLat([0, 0]);

        const target1 = marker1.getElement(); // on map
        const target2 = marker2.getElement(); // not on map

        const zoomstart = jest.fn();
        const zoom      = jest.fn();
        const zoomend   = jest.fn();

        map.handlers._handlersById.tapZoom.disable();
        map.touchPitch.disable();
        map.dragPan.disable();
        map.on('zoomstart', zoomstart);
        map.on('zoom',      zoom);
        map.on('zoomend',   zoomend);

        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}]});
        simulate.touchstart(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -50}, {target: target2, identifier: 2, clientX: 0, clientY: 50}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -100}, {target: target2, identifier: 2, clientX: 0, clientY: 100}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchmove(map.getCanvas(), {touches: [{target: target1, identifier: 1, clientX: 0, clientY: -60}, {target: target2, identifier: 2, clientX: 0, clientY: 60}]});
        map._renderTaskQueue.run();
        expect(zoomstart).toHaveBeenCalledTimes(0);
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        simulate.touchend(map.getCanvas(), {touches: []});
        map._renderTaskQueue.run();

        // incremented because inertia starts a second zoom
        expect(zoomstart).toHaveBeenCalledTimes(0);
        map._renderTaskQueue.run();
        expect(zoom).toHaveBeenCalledTimes(0);
        expect(zoomend).toHaveBeenCalledTimes(0);

        map.remove();
    });
});
