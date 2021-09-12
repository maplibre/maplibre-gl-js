import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../../../rollup/build/tsc/ui/map';
import DOM from '../../../../rollup/build/tsc/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)});
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
            resolve();
        }, delay);
    });
}

test('DoubleClickZoomHandler zooms on dblclick event', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoomstart', zoom);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    expect(zoom.called).toBeTruthy();

    map.remove();
    t.end();
});

test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', (t) => {
    const map = createMap(t);

    map.on('dblclick', e => e.preventDefault());

    const zoom = t.spy();
    map.on('zoomstart', zoom);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    expect(zoom.callCount).toBe(0);

    map.remove();
    t.end();
});

test('DoubleClickZoomHandler zooms on double tap if touchstart events are < 300ms apart', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoomstart', zoom);

    simulateDoubleTap(map, 100).then(() => {
        expect(zoom.called).toBeTruthy();

        map.remove();
        t.end();
    });

});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are > 500ms apart', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    simulateDoubleTap(map, 500).then(() => {
        expect(zoom.callCount).toBe(0);

        map.remove();
        t.end();
    });

});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are in different locations', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
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
                resolve();
            }, 100);
        });
    };

    simulateTwoDifferentTaps().then(() => {
        expect(zoom.callCount).toBe(0);

        map.remove();
        t.end();
    });

});

test('DoubleClickZoomHandler zooms on the second touchend event of a double tap', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoomstart', zoom);

    const canvas = map.getCanvas();
    const touchOptions = {touches: [{target: canvas, clientX: 0.5, clientY: 0.5}]};

    simulate.touchstart(canvas, touchOptions);
    simulate.touchend(canvas);
    simulate.touchstart(canvas, touchOptions);
    map._renderTaskQueue.run();
    map._renderTaskQueue.run();
    expect(zoom.called).toBeFalsy();

    simulate.touchcancel(canvas);
    simulate.touchend(canvas);
    map._renderTaskQueue.run();
    expect(zoom.called).toBeFalsy();

    simulate.touchstart(canvas, touchOptions);
    simulate.touchend(canvas);
    simulate.touchstart(canvas, touchOptions);
    map._renderTaskQueue.run();
    expect(zoom.called).toBeFalsy();

    simulate.touchend(canvas);
    map._renderTaskQueue.run();

    expect(zoom.called).toBeTruthy();

    t.end();
});

test('DoubleClickZoomHandler does not zoom on double tap if second touchend is >300ms after first touchstart', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
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
                resolve();
            }, 300);
        });
    };

    simulateSlowSecondTap().then(() => {
        expect(zoom.called).toBeFalsy();

        t.end();
    });
});
