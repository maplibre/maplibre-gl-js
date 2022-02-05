import simulate from '../../../test/unit/lib/simulate_interaction';
import {setMatchMedia, setPerformance, setWebGlContext} from '../../util/test/util';
import Map, {MapOptions} from '../map';

function createMap() {
    return new Map({container: window.document.createElement('div')} as any as MapOptions);
}

function simulateDoubleTap(map, delay = 100) {
    const canvas = map.getCanvas();
    return new Promise(resolve => {
        simulate.touchstart(canvas, {touches: [{target: canvas, clientX: 0, clientY: 0}]});
        simulate.touchend(canvas);
        setTimeout(() => {
            simulate.touchstart(canvas, {touches: [{target: canvas, clientX: 0, clientY: 0}]});
            simulate.touchend(canvas);
            map._renderTaskQueue.run();
            resolve(undefined);
        }, delay);
    });
}

beforeEach(() => {
    setPerformance();
    setWebGlContext();
    setMatchMedia();
});

describe('dbclick_zoom', () => {
    test('DoubleClickZoomHandler zooms on dblclick event', () => {
        const map = createMap();

        const zoom = jest.fn();
        map.on('zoomstart', zoom);

        simulate.dblclick(map.getCanvas());
        map._renderTaskQueue.run();

        expect(zoom).toHaveBeenCalled();

        map.remove();
    });

    test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', () => {
        const map = createMap();

        map.on('dblclick', e => e.preventDefault());

        const zoom = jest.fn();
        map.on('zoomstart', zoom);

        simulate.dblclick(map.getCanvas());
        map._renderTaskQueue.run();

        expect(zoom).not.toHaveBeenCalled();

        map.remove();
    });

    test('DoubleClickZoomHandler zooms on double tap if touchstart events are < 300ms apart', done => {
        const map = createMap();

        const zoom = jest.fn();
        map.on('zoomstart', zoom);

        simulateDoubleTap(map, 100).then(() => {
            expect(zoom).toHaveBeenCalled();

            map.remove();
            done();
        });

    });

    test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are > 500ms apart', done => {
        const map = createMap();

        const zoom = jest.fn();
        map.on('zoom', zoom);

        simulateDoubleTap(map, 500).then(() => {
            expect(zoom).not.toHaveBeenCalled();

            map.remove();
            done();
        });

    });

    test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are in different locations', done => {
        const map = createMap();

        const zoom = jest.fn();
        map.on('zoom', zoom);

        const canvas = map.getCanvas();

        const simulateTwoDifferentTaps = () => {
            return new Promise(resolve => {
                simulate.touchstart(canvas, {touches: [{clientX: 0, clientY: 0}]});
                simulate.touchend(canvas);
                setTimeout(() => {
                    simulate.touchstart(canvas, {touches: [{clientX: 30.5, clientY: 30.5}]});
                    simulate.touchend(canvas);
                    map._renderTaskQueue.run();
                    resolve(undefined);
                }, 100);
            });
        };

        simulateTwoDifferentTaps().then(() => {
            expect(zoom).not.toHaveBeenCalled();

            map.remove();
            done();
        });

    });

    test('DoubleClickZoomHandler zooms on the second touchend event of a double tap', () => {
        const map = createMap();

        const zoom = jest.fn();
        map.on('zoomstart', zoom);

        const canvas = map.getCanvas();
        const touchOptions = {touches: [{target: canvas, clientX: 0.5, clientY: 0.5}]};

        simulate.touchstart(canvas, touchOptions);
        simulate.touchend(canvas);
        simulate.touchstart(canvas, touchOptions);
        map._renderTaskQueue.run();
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();

        simulate.touchcancel(canvas);
        simulate.touchend(canvas);
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();

        simulate.touchstart(canvas, touchOptions);
        simulate.touchend(canvas);
        simulate.touchstart(canvas, touchOptions);
        map._renderTaskQueue.run();
        expect(zoom).not.toHaveBeenCalled();

        simulate.touchend(canvas);
        map._renderTaskQueue.run();

        expect(zoom).toHaveBeenCalled();

    });

    test('DoubleClickZoomHandler does not zoom on double tap if second touchend is >300ms after first touchstart', done => {
        const map = createMap();

        const zoom = jest.fn();
        map.on('zoom', zoom);

        const canvas = map.getCanvas();

        const simulateSlowSecondTap = () => {
            return new Promise(resolve => {
                simulate.touchstart(canvas);
                simulate.touchend(canvas);
                simulate.touchstart(canvas);
                setTimeout(() => {
                    simulate.touchend(canvas);
                    map._renderTaskQueue.run();
                    resolve(undefined);
                }, 300);
            });
        };

        simulateSlowSecondTap().then(() => {
            expect(zoom).not.toHaveBeenCalled();

            done();
        });
    });
});
