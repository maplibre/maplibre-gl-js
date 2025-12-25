import {describe, test, expect, beforeEach, vi, afterEach, type Mock} from 'vitest';
import {beforeMapTest, createMap as globalCreateMap} from './test/util';
import {browser} from './browser';

describe('browser', () => {
    describe('frame',() => {
        let originalRAF: typeof window.requestAnimationFrame;
        let originalCAF: typeof window.cancelAnimationFrame;
        let rafCallbacks: Array<{id: number; callback: FrameRequestCallback}> = [];
        let rafIdCounter = 0;

        /** Mimic scheduling RAFs for later */
        function flushAllRAFs() {
            const pending = [...rafCallbacks];
            rafCallbacks = [];
            pending.forEach(({callback}) => callback(performance.now()));
        }

        beforeEach(() => {
            originalRAF = window.requestAnimationFrame;
            originalCAF = window.cancelAnimationFrame;
            rafCallbacks = [];
            rafIdCounter = 0;
            vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
                rafIdCounter++;
                const id = rafIdCounter;
                rafCallbacks.push({id, callback: cb});
                return id;
            });
            vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
                rafCallbacks = rafCallbacks.filter(entry => entry.id !== id);
            });
        });

        afterEach(() => {
            window.requestAnimationFrame = originalRAF;
            window.cancelAnimationFrame = originalCAF;
            vi.restoreAllMocks();
        });

        test('calls requestAnimationFrame and invokes fn callback with timestamp', () => {
            const abortController = new AbortController();
            const addListenerSpy = vi.spyOn(abortController.signal, 'addEventListener');
            const removeListenerSpy = vi.spyOn(abortController.signal, 'removeEventListener');

            const fn = vi.fn();
            const reject = vi.fn();

            browser.frame(abortController, fn, reject);

            expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

            flushAllRAFs();

            expect(fn).toHaveBeenCalledTimes(1);
            const callArg = fn.mock.calls[0][0];
            expect(typeof callArg).toBe('number');

            expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
            expect(reject).not.toHaveBeenCalled();

            // cleanup leftover listeners
            expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
            expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
        });

        test('when AbortController is aborted before frame fires, calls cancelAnimationFrame and reject', () => {
            // We override the default mock so that the callback is NOT called immediately
            // giving us time to abort.
            (window.requestAnimationFrame as Mock).mockImplementation(
                () => {
                    // Return ID but do not invoke cb
                    return 42;
                }
            );

            const abortController = new AbortController();
            const addListenerSpy = vi.spyOn(abortController.signal, 'addEventListener');
            const removeListenerSpy = vi.spyOn(abortController.signal, 'removeEventListener');

            const fn = vi.fn();
            const reject = vi.fn();

            browser.frame(abortController, fn, reject);

            abortController.abort();

            // Now we expect cancelAnimationFrame to be called with the ID 42
            expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
            expect(window.cancelAnimationFrame).toHaveBeenCalledWith(42);

            // Expect reject to be called
            expect(reject).toHaveBeenCalledTimes(1);
            const errorArg = reject.mock.calls[0][0];
            expect(errorArg).toBeInstanceOf(Error);
            expect(errorArg.message).toMatch(/abort/i);

            // fn should never have been called because we never triggered the RAF callback
            expect(fn).not.toHaveBeenCalled();

            // cleanup leftover listeners
            expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
            expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
        });

        test('when AbortController is aborted after frame fires, fn is invoked anyway', () => {
            const abortController = new AbortController();
            const addListenerSpy = vi.spyOn(abortController.signal, 'addEventListener');
            const removeListenerSpy = vi.spyOn(abortController.signal, 'removeEventListener');

            const fn = vi.fn();
            const reject = vi.fn();

            browser.frame(abortController, fn, reject);

            flushAllRAFs();

            // The callback should have already been called
            expect(fn).toHaveBeenCalledTimes(1);

            // The callback runs immediately in our default mock
            // so if we abort now, it's too late to cancel the frame
            abortController.abort();

            // Because callback already fired, there's no need to cancel
            expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
            // And reject shouldn't be called either
            expect(reject).not.toHaveBeenCalled();

            // cleanup leftover listeners
            expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
            expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
        });
    });

    describe('frameAsync',()=>{
        test('expect RAF to be called and receive RAF id', async () => {
            const id = await browser.frameAsync(new AbortController());
            expect(id).toBeTruthy();
        });

        test('throw error when abort is called', async () => {
            const abortController = new AbortController();
            const promise = browser.frameAsync(abortController);
            abortController.abort();
            await expect(promise).rejects.toThrow();
        });
    });

    describe('reduceMotion', () => {
        const createMap = (options: {reduceMotion?: boolean}) => {
            beforeMapTest();
            const container = window.document.createElement('div');
            window.document.body.appendChild(container);
            Object.defineProperty(container, 'clientWidth', {value: 512});
            Object.defineProperty(container, 'clientHeight', {value: 512});
            return globalCreateMap({container, ...options});
        };

        test('reduceMotion set to true', () => {
            createMap({reduceMotion: true});
            expect(browser.prefersReducedMotion).toBe(true);
        });

        test('reduceMotion set to false', () => {
            createMap({reduceMotion: false});
            expect(browser.prefersReducedMotion).toBe(false);
        });

        test('reduceMotion set to undefined', () => {
            const browserDefault = matchMedia('(prefers-reduced-motion: reduce)').matches;
            createMap({});
            expect(browser.prefersReducedMotion).toBe(browserDefault);
        });
    });

    test('hardwareConcurrency', () => {
        expect(typeof browser.hardwareConcurrency).toBe('number');
    });
});
