import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {DOM} from '../util/dom.ts';
import {beforeMapTest} from '../util/test/util.ts';
import {restoreNow, setNow} from '../util/time_control.ts';
import {Map} from './map.ts';
import type {EaseToOptions} from './camera.ts';
import {HandlerInertia} from './handler_inertia.ts';

type PanGesture = {
    /**
     * The pixels panned in each recorded frame, oldest first. `null` records a frame without
     * any delta, which is what a terrain gesture does while the camera is not moving.
     */
    frames: Array<number | null>;
    /**
     * The milliseconds between the recorded frames.
     */
    frameTime?: number;
    /**
     * The milliseconds the gesture is held still between the last recorded frame and the release.
     */
    holdTime?: number;
};

/**
 * Records a horizontal pan gesture and returns the inertial ease it produces, if any.
 */
function panAndRelease(inertia: HandlerInertia, {frames, frameTime = 16, holdTime = 0}: PanGesture) {
    let time = 1000;
    setNow(time);
    for (const pixels of frames) {
        setNow(time += frameTime);
        inertia.record(pixels === null ? {} : {panDelta: new Point(pixels, 0)});
    }
    setNow(time + holdTime);
    return inertia._onMoveEnd();
}

/**
 * Returns the horizontal distance the map keeps panning after the gesture ended.
 */
function panOnDistance(ease: EaseToOptions) {
    return (ease.offset as Point).x;
}

describe('HandlerInertia', () => {
    let map: Map;
    let inertia: HandlerInertia;

    beforeEach(() => {
        beforeMapTest();
        map = new Map({container: DOM.create('div', '', window.document.body)});
        inertia = new HandlerInertia(map);
    });

    afterEach(() => {
        restoreNow();
        map.remove();
    });

    test('pans on when the gesture is released while still moving', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, 20, 20]});

        expect(panOnDistance(ease)).toBeGreaterThan(50);
    });

    test('barely pans on when the gesture is held still before being released', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, 20, 20], holdTime: 100});

        expect(Math.abs(panOnDistance(ease))).toBeLessThan(5);
    });

    test('pans on at frame rates too low for two frames to fit into the velocity window', () => {
        const ease = panAndRelease(inertia, {frames: [80, 80, 80], frameTime: 80});

        expect(panOnDistance(ease)).toBeGreaterThan(20);
    });

    test('does not pan on when a single frame was recorded, twice in a row', () => {
        expect(panAndRelease(inertia, {frames: [20]})).toBeUndefined();
        // the frame left over by the first gesture must not be measured as part of the second
        expect(panAndRelease(inertia, {frames: [20]})).toBeUndefined();
    });

    test('does not ease when the recorded frames hold no movement', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, null, null, null, null]});

        expect(ease).toBeUndefined();
    });
});
