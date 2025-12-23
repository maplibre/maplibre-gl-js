import {describe, beforeEach, test, expect, vi} from 'vitest';
import {Map} from '../../ui/map';
import {DOM} from '../../util/dom';
import simulate from '../../../test/unit/lib/simulate_interaction';
import {extend} from '../../util/util';
import {beforeMapTest} from '../../util/test/util';

function createMap(options?) {
    return new Map(extend({
        container: DOM.create('div', '', window.document.body),
    }, options));
}

beforeEach(() => {
    beforeMapTest();
});

describe('keyboard', () => {
    test('KeyboardHandler responds to keydown events', () => {
        const map = createMap();
        const h = map.keyboard;
        const spy = vi.spyOn(h, 'keydown');

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(h.keydown).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].keyCode).toBe(32);
    });

    test('KeyboardHandler pans map in response to arrow keys', () => {
        const map = createMap({zoom: 10, center: [0, 0]});
        const spy = vi.spyOn(map, 'easeTo');

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(map.easeTo).not.toHaveBeenCalled();

        simulate.keydown(map.getCanvas(), {keyCode: 37, key: 'ArrowLeft'});
        expect(map.easeTo).toHaveBeenCalled();
        let easeToArgs = spy.mock.calls[0][0];
        expect(easeToArgs.offset[0]).toBe(100);
        expect(easeToArgs.offset[1]).toBe(-0);

        simulate.keydown(map.getCanvas(), {keyCode: 39, key: 'ArrowRight'});
        expect(spy).toHaveBeenCalledTimes(2);
        easeToArgs = spy.mock.calls[1][0];
        expect(easeToArgs.offset[0]).toBe(-100);
        expect(easeToArgs.offset[1]).toBe(-0);

        simulate.keydown(map.getCanvas(), {keyCode: 40, key: 'ArrowDown'});
        expect(spy).toHaveBeenCalledTimes(3);
        easeToArgs = spy.mock.calls[2][0];
        expect(easeToArgs.offset[0]).toBe(-0);
        expect(easeToArgs.offset[1]).toBe(-100);

        simulate.keydown(map.getCanvas(), {keyCode: 38, key: 'ArrowUp'});
        expect(spy).toHaveBeenCalledTimes(4);
        easeToArgs = spy.mock.calls[3][0];
        expect(easeToArgs.offset[0]).toBe(-0);
        expect(easeToArgs.offset[1]).toBe(100);

    });

    test('KeyboardHandler pans map in response to arrow keys when disableRotation has been called', () => {
        const map = createMap({zoom: 10, center: [0, 0]});
        const spy = vi.spyOn(map, 'easeTo');
        map.keyboard.disableRotation();

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(map.easeTo).not.toHaveBeenCalled();

        simulate.keydown(map.getCanvas(), {keyCode: 37, key: 'ArrowLeft'});
        expect(map.easeTo).toHaveBeenCalled();
        let easeToArgs = spy.mock.calls[0][0];
        expect(easeToArgs.offset[0]).toBe(100);
        expect(easeToArgs.offset[1]).toBe(-0);

        simulate.keydown(map.getCanvas(), {keyCode: 39, key: 'ArrowRight'});
        expect(spy).toHaveBeenCalledTimes(2);
        easeToArgs = spy.mock.calls[1][0];
        expect(easeToArgs.offset[0]).toBe(-100);
        expect(easeToArgs.offset[1]).toBe(-0);

        simulate.keydown(map.getCanvas(), {keyCode: 40, key: 'ArrowDown'});
        expect(spy).toHaveBeenCalledTimes(3);
        easeToArgs = spy.mock.calls[2][0];
        expect(easeToArgs.offset[0]).toBe(-0);
        expect(easeToArgs.offset[1]).toBe(-100);

        simulate.keydown(map.getCanvas(), {keyCode: 38, key: 'ArrowUp'});
        expect(spy).toHaveBeenCalledTimes(4);
        easeToArgs = spy.mock.calls[3][0];
        expect(easeToArgs.offset[0]).toBe(-0);
        expect(easeToArgs.offset[1]).toBe(100);

    });

    test('KeyboardHandler rotates map in response to Shift+left/right arrow keys', async () => {
        const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
        const spy = vi.spyOn(map, 'easeTo');

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(map.easeTo).not.toHaveBeenCalled();

        simulate.keydown(map.getCanvas(), {keyCode: 37, key: 'ArrowLeft', shiftKey: true});
        expect(map.easeTo).toHaveBeenCalled();
        let easeToArgs = spy.mock.calls[0][0];
        expect(easeToArgs.bearing).toBe(-15);
        expect(easeToArgs.offset[0]).toBe(-0);

        map.setBearing(0);
        simulate.keydown(map.getCanvas(), {keyCode: 39, key: 'ArrowRight', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(2);
        easeToArgs = spy.mock.calls[1][0];
        expect(easeToArgs.bearing).toBe(15);
        expect(easeToArgs.offset[0]).toBe(-0);

    });

    test('KeyboardHandler does not rotate map in response to Shift+left/right arrow keys when disableRotation has been called', async () => {
        const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
        const spy = vi.spyOn(map, 'easeTo');
        map.keyboard.disableRotation();

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(map.easeTo).not.toHaveBeenCalled();

        simulate.keydown(map.getCanvas(), {keyCode: 37, key: 'ArrowLeft', shiftKey: true});
        expect(map.easeTo).toHaveBeenCalled();
        let easeToArgs = spy.mock.calls[0][0];
        expect(easeToArgs.bearing).toBe(0);
        expect(easeToArgs.offset[0]).toBe(-0);

        map.setBearing(0);
        simulate.keydown(map.getCanvas(), {keyCode: 39, key: 'ArrowRight', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(2);
        easeToArgs = spy.mock.calls[1][0];
        expect(easeToArgs.bearing).toBe(0);
        expect(easeToArgs.offset[0]).toBe(-0);

    });

    test('KeyboardHandler pitches map in response to Shift+up/down arrow keys', async () => {
        const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
        const spy = vi.spyOn(map, 'easeTo');

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(map.easeTo).not.toHaveBeenCalled();

        simulate.keydown(map.getCanvas(), {keyCode: 40, key: 'ArrowDown', shiftKey: true});
        expect(map.easeTo).toHaveBeenCalled();
        let easeToArgs = spy.mock.calls[0][0];
        expect(easeToArgs.pitch).toBe(20);
        expect(easeToArgs.offset[1]).toBe(-0);

        map.setPitch(30);
        simulate.keydown(map.getCanvas(), {keyCode: 38, key: 'ArrowUp', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(2);
        easeToArgs = spy.mock.calls[1][0];
        expect(easeToArgs.pitch).toBe(40);
        expect(easeToArgs.offset[1]).toBe(-0);

    });

    test('KeyboardHandler does not pitch map in response to Shift+up/down arrow keys when disableRotation has been called', async () => {
        const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
        const spy = vi.spyOn(map, 'easeTo');
        map.keyboard.disableRotation();

        simulate.keydown(map.getCanvas(), {keyCode: 32, key: ' '});
        expect(map.easeTo).not.toHaveBeenCalled();

        simulate.keydown(map.getCanvas(), {keyCode: 40, key: 'ArrowDown', shiftKey: true});
        expect(map.easeTo).toHaveBeenCalled();
        let easeToArgs = spy.mock.calls[0][0];
        expect(easeToArgs.pitch).toBe(30);
        expect(easeToArgs.offset[1]).toBe(-0);

        map.setPitch(30);
        simulate.keydown(map.getCanvas(), {keyCode: 38, key: 'ArrowUp', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(2);
        easeToArgs = spy.mock.calls[1][0];
        expect(easeToArgs.pitch).toBe(30);
        expect(easeToArgs.offset[1]).toBe(-0);

    });

    test('KeyboardHandler zooms map in response to -/+ keys', () => {
        const map = createMap({zoom: 10, center: [0, 0]});
        const spy = vi.spyOn(map, 'easeTo');

        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal'});
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].zoom).toBe(11);

        map.setZoom(10);
        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0].zoom).toBe(12);

        map.setZoom(10);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus'});
        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy.mock.calls[2][0].zoom).toBe(9);

        map.setZoom(10);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls[3][0].zoom).toBe(8);

    });

    test('KeyboardHandler zooms map in response to -/+ keys when disableRotation has been called', () => {
        const map = createMap({zoom: 10, center: [0, 0]});
        const spy = vi.spyOn(map, 'easeTo');
        map.keyboard.disableRotation();

        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal'});
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].zoom).toBe(11);

        map.setZoom(10);
        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0].zoom).toBe(12);

        map.setZoom(10);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus'});
        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy.mock.calls[2][0].zoom).toBe(9);

        map.setZoom(10);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls[3][0].zoom).toBe(8);

    });

    test('KeyboardHandler rounds fractional zoom before incrementing when legacyZoom is false', () => {
        // This verifies the rounding behavior that matches the zoom button control
        let testZoom = 14.6;
        const map = createMap({zoom: testZoom, center: [0, 0], legacyZoom: false});
        const spy = vi.spyOn(map, 'easeTo');

        // Zoom in: 14.6 rounds to 16
        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal'});
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].zoom).toBe(16);

        // Zoom out: 14.6 rounds to 14
        map.setZoom(testZoom);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus'});
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy.mock.calls[1][0].zoom).toBe(14);

        // Zoom in: 14.3 rounds to 15
        testZoom = 14.3;
        map.setZoom(testZoom);
        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal'});
        expect(spy).toHaveBeenCalledTimes(3);
        expect(spy.mock.calls[2][0].zoom).toBe(15);

        // Zoom out: 14.3 rounds to 13
        map.setZoom(testZoom);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus'});
        expect(spy).toHaveBeenCalledTimes(4);
        expect(spy.mock.calls[3][0].zoom).toBe(13);

        // Shift + zoom in: 14.3 rounds to 16
        map.setZoom(testZoom);
        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(5);
        expect(spy.mock.calls[4][0].zoom).toBe(16);

        // Shift + zoom out: 14.3 rounds down to 12
        map.setZoom(testZoom);
        simulate.keydown(map.getCanvas(), {keyCode: 189, key: 'Minus', shiftKey: true});
        expect(spy).toHaveBeenCalledTimes(6);
        expect(spy.mock.calls[5][0].zoom).toBe(12);
    });

    test('KeyboardHandler uses standard rounding when legacyZoom is true (default)', () => {
        const map = createMap({zoom: 14.5, center: [0, 0]}); // legacyZoom defaults to true
        const spy = vi.spyOn(map, 'easeTo');

        simulate.keydown(map.getCanvas(), {keyCode: 187, key: 'Equal'});
        expect(spy.mock.calls[0][0].zoom).toBe(16); // Math.round(14.5) + 1 = 15 + 1 = 16
    });
});
