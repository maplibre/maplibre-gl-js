import {describe, test, expect} from 'vitest';
import {sleep} from './test/util';
import {throttle} from './throttle';

describe('throttle', () => {

    test('does not execute unthrottled function unless throttled function is invoked', () => {
        let executionCount = 0;
        throttle(() => { executionCount++; }, 0);
        expect(executionCount).toBe(0);
    });

    test('executes unthrottled function once per tick when period is 0', async () => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 0);
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(1);
        await sleep(0);
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(2);
    });

    test('executes unthrottled function immediately once when period is > 0', () => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(1);
    });

    test('queues exactly one execution of unthrottled function when period is > 0', async () => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        await sleep(10);
        expect(executionCount).toBe(2);
    });
});
