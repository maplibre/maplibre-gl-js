import '../../../stub_loader';
import {test} from '../../../util/test';
import Map from '../../../../rollup/build/tsc/src/ui/map';
import DOM from '../../../../rollup/build/tsc/src/util/dom';
import simulate from '../../../util/simulate_interaction';
import {extend} from '../../../../rollup/build/tsc/src/util/util';

function createMap(options) {
    return new Map(extend({
        container: DOM.create('div', '', window.document.body),
    }, options));
}

test('KeyboardHandler responds to keydown events', (t) => {
    const map = createMap();
    const h = map.keyboard;
    t.spy(h, 'keydown');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(h.keydown.called).toBeTruthy();
    expect(h.keydown.getCall(0).args[0].keyCode).toBe(32);
    t.end();
});

test('KeyboardHandler pans map in response to arrow keys', (t) => {
    const map = createMap({zoom: 10, center: [0, 0]});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo.called).toBeFalsy();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo.called).toBeTruthy();
    let easeToArgs = map.easeTo.getCall(0).args[0];
    expect(easeToArgs.offset[0]).toBe(100);
    expect(easeToArgs.offset[1]).toBe(0);

    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    expect(map.easeTo.callCount === 2).toBeTruthy();
    easeToArgs = map.easeTo.getCall(1).args[0];
    expect(easeToArgs.offset[0]).toBe(-100);
    expect(easeToArgs.offset[1]).toBe(0);

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    expect(map.easeTo.callCount === 3).toBeTruthy();
    easeToArgs = map.easeTo.getCall(2).args[0];
    expect(easeToArgs.offset[0]).toBe(0);
    expect(easeToArgs.offset[1]).toBe(-100);

    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo.callCount === 4).toBeTruthy();
    easeToArgs = map.easeTo.getCall(3).args[0];
    expect(easeToArgs.offset[0]).toBe(0);
    expect(easeToArgs.offset[1]).toBe(100);

    t.end();
});

test('KeyboardHandler pans map in response to arrow keys when disableRotation has been called', (t) => {
    const map = createMap({zoom: 10, center: [0, 0]});
    t.spy(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo.called).toBeFalsy();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo.called).toBeTruthy();
    let easeToArgs = map.easeTo.getCall(0).args[0];
    expect(easeToArgs.offset[0]).toBe(100);
    expect(easeToArgs.offset[1]).toBe(0);

    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    expect(map.easeTo.callCount === 2).toBeTruthy();
    easeToArgs = map.easeTo.getCall(1).args[0];
    expect(easeToArgs.offset[0]).toBe(-100);
    expect(easeToArgs.offset[1]).toBe(0);

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    expect(map.easeTo.callCount === 3).toBeTruthy();
    easeToArgs = map.easeTo.getCall(2).args[0];
    expect(easeToArgs.offset[0]).toBe(0);
    expect(easeToArgs.offset[1]).toBe(-100);

    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo.callCount === 4).toBeTruthy();
    easeToArgs = map.easeTo.getCall(3).args[0];
    expect(easeToArgs.offset[0]).toBe(0);
    expect(easeToArgs.offset[1]).toBe(100);

    t.end();
});

test('KeyboardHandler rotates map in response to Shift+left/right arrow keys', async (t) => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo.called).toBeFalsy();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    expect(map.easeTo.called).toBeTruthy();
    let easeToArgs = map.easeTo.getCall(0).args[0];
    expect(easeToArgs.bearing).toBe(-15);
    expect(easeToArgs.offset[0]).toBe(0);

    map.setBearing(0);
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo.callCount === 2).toBeTruthy();
    easeToArgs = map.easeTo.getCall(1).args[0];
    expect(easeToArgs.bearing).toBe(15);
    expect(easeToArgs.offset[0]).toBe(0);

    t.end();
});

test('KeyboardHandler does not rotate map in response to Shift+left/right arrow keys when disableRotation has been called', async (t) => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    t.spy(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo.called).toBeFalsy();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    expect(map.easeTo.called).toBeTruthy();
    let easeToArgs = map.easeTo.getCall(0).args[0];
    expect(easeToArgs.bearing).toBe(0);
    expect(easeToArgs.offset[0]).toBe(0);

    map.setBearing(0);
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo.callCount === 2).toBeTruthy();
    easeToArgs = map.easeTo.getCall(1).args[0];
    expect(easeToArgs.bearing).toBe(0);
    expect(easeToArgs.offset[0]).toBe(0);

    t.end();
});

test('KeyboardHandler pitches map in response to Shift+up/down arrow keys', async (t) => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo.called).toBeFalsy();

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo.called).toBeTruthy();
    let easeToArgs = map.easeTo.getCall(0).args[0];
    expect(easeToArgs.pitch).toBe(20);
    expect(easeToArgs.offset[1]).toBe(0);

    map.setPitch(30);
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    expect(map.easeTo.callCount === 2).toBeTruthy();
    easeToArgs = map.easeTo.getCall(1).args[0];
    expect(easeToArgs.pitch).toBe(40);
    expect(easeToArgs.offset[1]).toBe(0);

    t.end();
});

test('KeyboardHandler does not pitch map in response to Shift+up/down arrow keys when disableRotation has been called', async (t) => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    t.spy(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo.called).toBeFalsy();

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo.called).toBeTruthy();
    let easeToArgs = map.easeTo.getCall(0).args[0];
    expect(easeToArgs.pitch).toBe(30);
    expect(easeToArgs.offset[1]).toBe(0);

    map.setPitch(30);
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    expect(map.easeTo.callCount === 2).toBeTruthy();
    easeToArgs = map.easeTo.getCall(1).args[0];
    expect(easeToArgs.pitch).toBe(30);
    expect(easeToArgs.offset[1]).toBe(0);

    t.end();
});

test('KeyboardHandler zooms map in response to -/+ keys', (t) => {
    const map = createMap({zoom: 10, center: [0, 0]});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo.callCount).toBe(1);
    expect(map.easeTo.getCall(0).args[0].zoom).toBe(11);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    expect(map.easeTo.callCount).toBe(2);
    expect(map.easeTo.getCall(1).args[0].zoom).toBe(12);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo.callCount).toBe(3);
    expect(map.easeTo.getCall(2).args[0].zoom).toBe(9);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    expect(map.easeTo.callCount).toBe(4);
    expect(map.easeTo.getCall(3).args[0].zoom).toBe(8);

    t.end();
});

test('KeyboardHandler zooms map in response to -/+ keys when disableRotation has been called', (t) => {
    const map = createMap({zoom: 10, center: [0, 0]});
    t.spy(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo.callCount).toBe(1);
    expect(map.easeTo.getCall(0).args[0].zoom).toBe(11);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    expect(map.easeTo.callCount).toBe(2);
    expect(map.easeTo.getCall(1).args[0].zoom).toBe(12);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo.callCount).toBe(3);
    expect(map.easeTo.getCall(2).args[0].zoom).toBe(9);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    expect(map.easeTo.callCount).toBe(4);
    expect(map.easeTo.getCall(3).args[0].zoom).toBe(8);

    t.end();
});
