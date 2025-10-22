import {describe, test, expect, afterEach} from 'vitest';
import {now, setNow, restoreNow, isTimeFrozen} from './time_control';

/**
 * Helper to wait for real time to advance by at least the specified duration.
 * Uses busy-wait to ensure real time passes even when test time is frozen.
 */
function waitForRealTime(ms: number): void {
    const realPerformanceNow = typeof performance !== 'undefined' && performance && performance.now ?
        performance.now.bind(performance) :
        Date.now.bind(Date);

    const start = realPerformanceNow();
    while (realPerformanceNow() - start < ms) {
        // busy wait
    }
}

describe('time_control', () => {

    afterEach(() => {
        // Clean up: restore normal time flow after each test
        restoreNow();
    });

    describe('now()', () => {
        test('returns a valid number when not frozen', () => {
            const currentTime = now();
            expect(typeof currentTime).toBe('number');
            expect(currentTime).toBeGreaterThanOrEqual(0);
        });

        test('advances over time when not frozen', () => {
            const timeBeforeDelay = now();

            const minimalDelayMs = 1;
            waitForRealTime(minimalDelayMs);

            const timeAfterDelay = now();
            expect(timeAfterDelay).toBeGreaterThanOrEqual(timeBeforeDelay);
        });

        test('returns frozen time when time is set', () => {
            const frozenTime = 123456.789;
            setNow(frozenTime);

            const time1 = now();
            expect(time1).toBe(frozenTime);

            const realTimeDelayMs = 10;
            waitForRealTime(realTimeDelayMs);

            const time2 = now();
            expect(time2).toBe(frozenTime);
        });

        test('handles multiple freeze/unfreeze cycles', () => {
            const frozenTime1 = 1000;
            const frozenTime2 = 2000;

            // First freeze
            setNow(frozenTime1);
            expect(now()).toBe(frozenTime1);

            // Second freeze (override)
            setNow(frozenTime2);
            expect(now()).toBe(frozenTime2);

            // Unfreeze
            restoreNow();
            const unfrozenTime = now();
            expect(unfrozenTime).not.toBe(frozenTime2);
            expect(unfrozenTime).toBeGreaterThanOrEqual(0);

            // Freeze again
            setNow(frozenTime1);
            expect(now()).toBe(frozenTime1);
        });
    });

    describe('setNow()', () => {
        test('freezes time at specified timestamp', () => {
            const timestamp = 99999.123;
            setNow(timestamp);

            expect(now()).toBe(timestamp);
            expect(isTimeFrozen()).toBe(true);
        });

        test('freezes time at zero', () => {
            setNow(0);
            expect(now()).toBe(0);
            expect(isTimeFrozen()).toBe(true);
        });

        test('freezes time at negative values', () => {
            const negativeTime = -123.456;
            setNow(negativeTime);
            expect(now()).toBe(negativeTime);
            expect(isTimeFrozen()).toBe(true);
        });
    });

    describe('restoreNow()', () => {
        test('unfreezes time and returns to real time', () => {
            // Freeze time
            const frozenTime = 5000;
            setNow(frozenTime);
            expect(now()).toBe(frozenTime);
            expect(isTimeFrozen()).toBe(true);

            // Unfreeze
            restoreNow();
            expect(isTimeFrozen()).toBe(false);

            // Time should now be real and advance
            const time1 = now();
            expect(time1).not.toBe(frozenTime);
            expect(time1).toBeGreaterThanOrEqual(0);

            // Small delay
            waitForRealTime(1);

            const time2 = now();
            expect(time2).toBeGreaterThanOrEqual(time1);
        });

        test('is safe to call multiple times', () => {
            restoreNow();
            expect(isTimeFrozen()).toBe(false);

            restoreNow();
            expect(isTimeFrozen()).toBe(false);

            const time = now();
            expect(typeof time).toBe('number');
            expect(time).toBeGreaterThanOrEqual(0);
        });
    });

    describe('isTimeFrozen()', () => {
        test('correctly tracks frozen state', () => {
            const initialFrozenState = isTimeFrozen();
            expect(initialFrozenState).toBe(false);

            setNow(12345);
            const frozenStateAfterSet = isTimeFrozen();
            expect(frozenStateAfterSet).toBe(true);

            restoreNow();
            const frozenStateAfterRestore = isTimeFrozen();
            expect(frozenStateAfterRestore).toBe(false);
        });
    });

    describe('integration scenarios', () => {
        test('simulates frame-by-frame video recording', () => {
            const fps = 60;
            const frameTime = 1000 / fps; // ~16.67ms per frame

            // Capture three frames at precise intervals
            setNow(0);
            const frame1 = now();

            setNow(frameTime);
            const frame2 = now();

            setNow(frameTime * 2);
            const frame3 = now();

            // Verify frame times are precisely spaced
            expect(frame1).toBe(0);
            expect(frame2).toBeCloseTo(16.67, 2);
            expect(frame3).toBeCloseTo(33.33, 2);
            expect(frame2 - frame1).toBeCloseTo(frameTime, 2);
            expect(frame3 - frame2).toBeCloseTo(frameTime, 2);

            // Restore time
            restoreNow();
            expect(isTimeFrozen()).toBe(false);
        });

        test('handles animation playback control', () => {
            // Pause animation at specific time
            const pauseTime = 1500;
            setNow(pauseTime);

            // Animation should stay at pause time
            expect(now()).toBe(pauseTime);
            expect(now()).toBe(pauseTime);
            expect(now()).toBe(pauseTime);

            // Resume animation
            restoreNow();
            const resumeTime1 = now();
            expect(resumeTime1).not.toBe(pauseTime);

            // Time should advance normally
            waitForRealTime(1);
            const resumeTime2 = now();
            expect(resumeTime2).toBeGreaterThan(resumeTime1);
        });
    });
});