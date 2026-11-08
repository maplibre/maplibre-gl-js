import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import Point from '@mapbox/point-geometry';
import {DOM} from '../util/dom.ts';
import {beforeMapTest} from '../util/test/util.ts';
import {restoreNow, setNow} from '../util/time_control.ts';
import {Map} from './map.ts';
import {HandlerInertia} from './handler_inertia.ts';

import type {EaseToOptions} from './camera.ts';

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
 * Records a gesture that turns the bearing by `degrees` in each frame, 16 ms apart, and returns the
 * inertial ease it produces, if any.
 */
function turnAndRelease(inertia: HandlerInertia, frames: number[]) {
    let time = 1000;
    setNow(time);
    for (const degrees of frames) {
        setNow(time += 16);
        inertia.record({bearingDelta: degrees});
    }
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

    test('turns on under friction that halves the speed every 140 ms', () => {
        // 312.5°/s, which glides on for 0.2 s worth of that speed until it falls below 1°/s
        const ease = turnAndRelease(inertia, [5, 5, 5, 5, 5]);

        expect(ease.bearing).toBeCloseTo(62.9, 1);
        expect(ease.duration).toBeCloseTo(1160, -1);
        expect(ease.easing(1)).toBeCloseTo(1);
    });

    test('turns on at most as far as a gesture released at 1200°/s', () => {
        const ease = turnAndRelease(inertia, [90, 90, 90, 90, 90]);

        expect(ease.duration).toBeCloseTo(1432, -1);
    });

    test('does not turn on when the gesture turned slower than 60°/s', () => {
        expect(turnAndRelease(inertia, [0.5, 0.5, 0.5, 0.5, 0.5])).toBeUndefined();
    });
});
