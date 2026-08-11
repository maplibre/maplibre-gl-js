import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {DOM} from '../util/dom.ts';
import {beforeMapTest} from '../util/test/util.ts';
import {restoreNow, setNow} from '../util/time_control.ts';
import {Map} from './map.ts';
import type {EaseToOptions} from './camera.ts';
import {HandlerInertia} from './handler_inertia.ts';

function createMap() {
    return new Map({container: DOM.create('div', '', window.document.body)});
}

type PanGesture = {
    /**
     * Pixels panned in each recorded frame, oldest first. `null` records a frame without any
     * delta, which is what a terrain gesture does while the camera is not moving.
     */
    frames: Array<number | null>;
    /**
     * Milliseconds between the recorded frames.
     */
    frameTime?: number;
    /**
     * Milliseconds the gesture is held still between the last recorded frame and the release.
     */
    holdTime?: number;
    /**
     * Milliseconds passing between the previous gesture and this one.
     */
    gap?: number;
};

/**
 * The clock the recorded gestures run on, so that consecutive gestures share a timeline.
 */
let clock: number;

/**
 * Records a horizontal pan gesture and returns the inertial ease it produces, if any.
 */
function panAndRelease(inertia: HandlerInertia, {frames, frameTime = 16, holdTime = 0, gap = 0}: PanGesture) {
    clock += gap;
    setNow(clock);
    for (const pixels of frames) {
        clock += frameTime;
        setNow(clock);
        inertia.record(pixels === null ? {} : {panDelta: new Point(pixels, 0)});
    }
    clock += holdTime;
    setNow(clock);
    return inertia._onMoveEnd();
}

/**
 * The horizontal distance the map keeps panning after the gesture ended.
 */
function panOnDistance(ease: EaseToOptions) {
    return (ease.offset as Point).x;
}

describe('HandlerInertia', () => {
    let map: Map;
    let inertia: HandlerInertia;

    beforeEach(() => {
        beforeMapTest();
        map = createMap();
        inertia = new HandlerInertia(map);
        clock = 1000;
    });

    afterEach(() => {
        restoreNow();
        map.remove();
    });

    test('pans on when the gesture is released while still moving', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, 20, 20]});

        expect(panOnDistance(ease)).toBeGreaterThan(50);
        expect(ease.duration).toBeGreaterThan(0);
    });

    test('barely pans on when the gesture is held still before being released', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, 20, 20], holdTime: 100});

        expect(Math.abs(panOnDistance(ease))).toBeLessThan(5);
    });

    test('does not pan on when the gesture is held still for longer than the buffer cutoff', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, 20, 20], holdTime: 200});

        expect(ease).toBeUndefined();
    });

    test('measures the velocity the gesture ended with, not the one it started with', () => {
        const slowdown = panAndRelease(inertia, {frames: [40, 40, 40, 30, 20, 10, 3]});
        const steady = panAndRelease(inertia, {frames: [40, 40, 40, 40, 40, 40, 40]});

        expect(panOnDistance(slowdown)).toBeLessThan(0.25 * panOnDistance(steady));
    });

    test('pans on at frame rates too low for two frames to fit into the velocity window', () => {
        const ease = panAndRelease(inertia, {frames: [80, 80, 80], frameTime: 80});

        expect(panOnDistance(ease)).toBeGreaterThan(20);
    });

    test('does not pan on when a single frame was recorded', () => {
        const ease = panAndRelease(inertia, {frames: [20]});

        expect(ease).toBeUndefined();
    });

    test('does not ease when the recorded frames hold no movement', () => {
        const ease = panAndRelease(inertia, {frames: [20, 20, 20, null, null, null, null]});

        expect(ease).toBeUndefined();
    });

    test('does not measure a gesture from the frames left over by the previous one', () => {
        // A gesture too short to be eased must not leave a frame behind which the next
        // gesture is then measured from.
        expect(panAndRelease(inertia, {frames: [20]})).toBeUndefined();
        expect(panAndRelease(inertia, {frames: [20], gap: 100})).toBeUndefined();
    });
});
