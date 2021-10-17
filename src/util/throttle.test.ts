// @flow


import throttle from '../util/throttle';

describe('throttle', done => {

    test('does not execute unthrottled function unless throttled function is invoked', done => {
        let executionCount = 0;
        throttle(() => { executionCount++; }, 0);
        expect(executionCount).toBe(0);
        done();
    });

    test('executes unthrottled function once per tick when period is 0', done => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 0);
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(1);
        setTimeout(() => {
            throttledFunction();
            throttledFunction();
            expect(executionCount).toBe(2);
            done();
        }, 0);
    });

    test('executes unthrottled function immediately once when period is > 0', done => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        expect(executionCount).toBe(1);
        done();
    });

    test('queues exactly one execution of unthrottled function when period is > 0', done => {
        let executionCount = 0;
        const throttledFunction = throttle(() => { executionCount++; }, 5);
        throttledFunction();
        throttledFunction();
        throttledFunction();
        setTimeout(() => {
            expect(executionCount).toBe(2);
            done();
        }, 10);
    });

    done();
});
