import {describe, test, expect, beforeEach, afterEach} from 'vitest';
import {now, setNow, restoreNow, isTimeFrozen} from './time_control';

describe('time_control', () => {
    // Store original performance.now to ensure we can verify real time advancement
    const realPerformanceNow = typeof performance !== 'undefined' && performance && performance.now ?
        performance.now.bind(performance) :
        Date.now.bind(Date);

    beforeEach(() => {
        // Ensure we start each test with unfrozen time
        restoreNow();
    });

    afterEach(() => {
        // Clean up after each test
        restoreNow();
    });

    describe('now()', () => {
        test('returns current time when not frozen', () => {
            const time1 = now();
            expect(typeof time1).toBe('number');
            expect(time1).toBeGreaterThanOrEqual(0);

            // Small delay to ensure time advances
            const startReal = realPerformanceNow();
            while (realPerformanceNow() - startReal < 1) {
                // busy wait
            }
            const time2 = now();

            // Time should advance (or at least not go backwards)
            expect(time2).toBeGreaterThanOrEqual(time1);
        });

        test('returns frozen time when time is set', () => {
            const frozenTime = 123456.789;
            setNow(frozenTime);

            const time1 = now();
            expect(time1).toBe(frozenTime);

            // Wait a bit to ensure real time advances
            const delay = 10;
            const startReal = realPerformanceNow();
            while (realPerformanceNow() - startReal < delay) {
                // busy wait
            }

            // Time should still be frozen
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

        test('can freeze time at 0', () => {
            setNow(0);
            expect(now()).toBe(0);
            expect(isTimeFrozen()).toBe(true);
        });

        test('can freeze time at negative values', () => {
            const negativeTime = -123.456;
            setNow(negativeTime);
            expect(now()).toBe(negativeTime);
            expect(isTimeFrozen()).toBe(true);
        });

        test('overwrites previous frozen time', () => {
            setNow(100);
            expect(now()).toBe(100);

            setNow(200);
            expect(now()).toBe(200);

            setNow(300);
            expect(now()).toBe(300);
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
            const startReal = realPerformanceNow();
            while (realPerformanceNow() - startReal < 1) {
                // busy wait
            }

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

        test('restores time after multiple freeze operations', () => {
            setNow(100);
            setNow(200);
            setNow(300);
            expect(now()).toBe(300);
            expect(isTimeFrozen()).toBe(true);

            restoreNow();
            expect(isTimeFrozen()).toBe(false);
            const realTime = now();
            expect(realTime).not.toBe(300);
        });
    });

    describe('isTimeFrozen()', () => {
        test('returns false when time is not frozen', () => {
            expect(isTimeFrozen()).toBe(false);
        });

        test('returns true when time is frozen', () => {
            setNow(12345);
            expect(isTimeFrozen()).toBe(true);
        });

        test('returns false after time is restored', () => {
            setNow(12345);
            expect(isTimeFrozen()).toBe(true);

            restoreNow();
            expect(isTimeFrozen()).toBe(false);
        });

        test('correctly reflects state through multiple operations', () => {
            expect(isTimeFrozen()).toBe(false);

            setNow(100);
            expect(isTimeFrozen()).toBe(true);

            setNow(200);
            expect(isTimeFrozen()).toBe(true);

            restoreNow();
            expect(isTimeFrozen()).toBe(false);

            setNow(300);
            expect(isTimeFrozen()).toBe(true);

            restoreNow();
            expect(isTimeFrozen()).toBe(false);
        });
    });

    describe('integration scenarios', () => {
        test('simulates frame-by-frame video recording', () => {
            const fps = 60;
            const frameTime = 1000 / fps; // ~16.67ms per frame
            const frames: number[] = [];

            // Start at time 0
            setNow(0);

            // Capture 10 frames
            for (let i = 0; i < 10; i++) {
                frames.push(now());
                setNow(now() + frameTime);
            }

            // Verify frame times
            expect(frames).toHaveLength(10);
            expect(frames[0]).toBe(0);

            for (let i = 1; i < frames.length; i++) {
                const delta = frames[i] - frames[i - 1];
                expect(delta).toBeCloseTo(frameTime, 2);
            }

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
            const startReal = realPerformanceNow();
            while (realPerformanceNow() - startReal < 1) {
                // busy wait
            }
            const resumeTime2 = now();
            expect(resumeTime2).toBeGreaterThan(resumeTime1);
        });

        test('supports deterministic testing', () => {
            // For deterministic tests, freeze time at a known value
            const testTime = 1000;
            setNow(testTime);

            // Simulate operations that depend on current time
            const operation1Time = now();
            const operation2Time = now();
            const operation3Time = now();

            // All operations should see the same time
            expect(operation1Time).toBe(testTime);
            expect(operation2Time).toBe(testTime);
            expect(operation3Time).toBe(testTime);

            // Clean up
            restoreNow();
        });
    });
});