// @flow

import {test} from '../../util/test';

import throttle from '../../../rollup/build/tsc/util/throttle';

test('throttle', (t) => {

    t.test('does not execute unthrottled function unless throttled function is invoked', (t) => {
        let executionCount = 0;
        throttle(() => { executionCount++; }, 0);
        expect(executionCount).toBe(0);
        t.end();
    });

    t.test('executes unthrottled function once per tick when period is 0', (t) => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 0);
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(1);
        setTimeout(() => {
            throttledFunction();
            throttledFunction();
            expect(executionCount).toBe(2);
            t.end();
        }, 0);
    });

    t.test('executes unthrottled function immediately once when period is > 0', (t) => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(1);
        t.end();
    });

    t.test('queues exactly one execution of unthrottled function when period is > 0', (t) => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        setTimeout(() => {
            expect(executionCount).toBe(2);
            t.end();
        }, 10);
    });

    t.end();
});
