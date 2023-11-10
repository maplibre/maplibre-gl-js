import {beforeMapTest} from '../../util/test/util';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {Map, MapOptions} from '../map';

function createMap() {
    return new Map({container: window.document.createElement('div')} as any as MapOptions);
}

function setupEvents(map: Map) {
    const zoomstart = jest.fn();
    map.on('zoomstart', zoomstart);

    const zoom = jest.fn();
    map.on('zoom', zoom);

    const zoomend = jest.fn();
    map.on('zoomend', zoomend);

    return {
        zoomstart,
        zoom,
        zoomend
    };
}

beforeEach(() => {
    beforeMapTest();
});

describe('tap_drag_zoom', () => {
    test('TapDragZoomHandler fires zoomstart, zoom, and zoomend at appropriate times in response to a double-tap and drag gesture', () => {
        const map = createMap();
        const target = map.getCanvas();

        const {zoomstart, zoom, zoomend} = setupEvents(map);

        const pointTouchOptions = {
            touches: [{target, clientX: 100, clientY: 100}]
        };

        simulate.touchstart(target, pointTouchOptions);
        simulate.touchend(target);
        simulate.touchstart(target, pointTouchOptions);
        map._renderTaskQueue.run();

        expect(zoomstart).not.toHaveBeenCalled();
        expect(zoom).not.toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();

        simulate.touchmove(target, {
            touches: [{target, clientX: 100, clientY: 110}]
        });
        map._renderTaskQueue.run();

        expect(zoomstart).toHaveBeenCalled();
        expect(zoom).toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();

        simulate.touchend(target);
        map._renderTaskQueue.run();
        expect(zoomend).toHaveBeenCalled();

    });

    test('TapDragZoomHandler does not fire zoom on tap and drag if touchstart events are > 500ms apart', done => {
        const map = createMap();
        const target = map.getCanvas();

        const {zoomstart, zoom, zoomend} = setupEvents(map);

        const pointTouchOptions = {
            touches: [{target, clientX: 100, clientY: 100}]
        };

        simulate.touchstart(target, pointTouchOptions);
        simulate.touchend(target);
        setTimeout(() => {
            simulate.touchstart(target, pointTouchOptions);
            simulate.touchmove(target, {
                touches: [{target, clientX: 100, clientY: 110}]
            });
            map._renderTaskQueue.run();

            expect(zoomstart).not.toHaveBeenCalled();
            expect(zoom).not.toHaveBeenCalled();
            expect(zoomend).not.toHaveBeenCalled();
            done();
        }, 510);
    });

    test('TapDragZoomHandler does not zoom on double-tap and drag if touchstart events are in different locations (>30px apart)', () => {
        const map = createMap();
        const target = map.getCanvas();

        const {zoomstart, zoom, zoomend} = setupEvents(map);

        simulate.touchstart(target, {
            touches: [{target, clientX: 100, clientY: 100}]
        });
        simulate.touchend(target);
        simulate.touchstart(target, {
            touches: [{target, clientX: 140, clientY: 100}]
        });
        simulate.touchmove(target, {
            touches: [{target, clientX: 140, clientY: 110}]
        });
        map._renderTaskQueue.run();

        expect(zoomstart).not.toHaveBeenCalled();
        expect(zoom).not.toHaveBeenCalled();
        expect(zoomend).not.toHaveBeenCalled();
    });
});
