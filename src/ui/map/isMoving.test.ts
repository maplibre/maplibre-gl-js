import '../../../stub_loader';
import {test} from '../../../util/test';
import browser from '../../../../rollup/build/tsc/src/util/browser';
import Map from '../../../../rollup/build/tsc/src/ui/map';
import DOM from '../../../../rollup/build/tsc/src/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)});
}

// MouseEvent.buttons
const buttons = 1;

test('Map#isMoving returns false by default', (t) => {
    const map = createMap(t);
    expect(map.isMoving()).toBe(false);
    map.remove();
    t.end();
});

test('Map#isMoving returns true during a camera zoom animation', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        expect(map.isMoving()).toBe(true);
    });

    map.on('zoomend', () => {
        expect(map.isMoving()).toBe(false);
        map.remove();
        t.end();
    });

    map.zoomTo(5, {duration: 0});
});

test('Map#isMoving returns true when drag panning', (t) => {
    const map = createMap(t);

    map.on('movestart', () => {
        expect(map.isMoving()).toBe(true);
    });
    map.on('dragstart', () => {
        expect(map.isMoving()).toBe(true);
    });

    map.on('dragend', () => {
        expect(map.isMoving()).toBe(false);
    });
    map.on('moveend', () => {
        expect(map.isMoving()).toBe(false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when drag rotating', (t) => {
    const map = createMap(t);

    // Prevent inertial rotation.
    t.stub(browser, 'now').returns(0);

    map.on('movestart', () => {
        expect(map.isMoving()).toBe(true);
    });
    map.on('rotatestart', () => {
        expect(map.isMoving()).toBe(true);
    });

    map.on('rotateend', () => {
        expect(map.isMoving()).toBe(false);
    });
    map.on('moveend', () => {
        expect(map.isMoving()).toBe(false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when scroll zooming', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        expect(map.isMoving()).toBe(true);
    });

    map.on('zoomend', () => {
        expect(map.isMoving()).toBe(false);
        map.remove();
        t.end();
    });

    const browserNow = t.stub(browser, 'now');
    let now = 0;
    browserNow.callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    setTimeout(() => {
        map._renderTaskQueue.run();
    }, 400);
});

test('Map#isMoving returns true when drag panning and scroll zooming interleave', (t) => {
    const map = createMap(t);

    map.on('dragstart', () => {
        expect(map.isMoving()).toBe(true);
    });

    map.on('zoomstart', () => {
        expect(map.isMoving()).toBe(true);
    });

    map.on('zoomend', () => {
        expect(map.isMoving()).toBe(true);
        simulate.mouseup(map.getCanvas());
        setTimeout(() => {
            map._renderTaskQueue.run();
        });
    });

    map.on('dragend', () => {
        expect(map.isMoving()).toBe(false);
        map.remove();
        t.end();
    });

    // The following should trigger the above events, where a zoomstart/zoomend
    // pair is nested within a dragstart/dragend pair.

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    const browserNow = t.stub(browser, 'now');
    let now = 0;
    browserNow.callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    setTimeout(() => {
        map._renderTaskQueue.run();
    }, 400);
});
