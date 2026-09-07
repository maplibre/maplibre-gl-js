import {describe, test, expect, beforeEach, vi, afterEach} from 'vitest';
import {Canvas} from 'canvas';
import {beforeMapTest, createMap as globalCreateMap} from './test/util.ts';
import {browser} from './browser.ts';
import {AbortError} from './abort_error.ts';

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
            for (const {callback} of pending) {
                callback(performance.now());
            }
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
            expect(callArg).toBeTypeOf('number');

            expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
            expect(reject).not.toHaveBeenCalled();

            // cleanup leftover listeners
            expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
            expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), false);
        });

        test('when AbortController is aborted before frame fires, calls cancelAnimationFrame and reject', () => {
            // We override the default mock so that the callback is NOT called immediately
            // giving us time to abort.
            (vi.mocked(window.requestAnimationFrame)).mockReturnValue(
                42
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
            await expect(promise).rejects.toThrow(AbortError);
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
        expect(browser.hardwareConcurrency).toBeTypeOf('number');
    });

    describe('getImageCanvasContext', () => {
        const originalCreateElement = window.document.createElement;

        /** An `OffscreenCanvas` that rasterises and reads back for real, standing in for a browser that behaves. */
        const WorkingOffscreenCanvas = vi.fn(function (width: number, height: number) {
            return new Canvas(width, height);
        });

        /** An `OffscreenCanvas` that hands back pixels other than the ones written, the way fingerprinting defences do (see #3185). */
        const DistortingOffscreenCanvas = vi.fn(function (width: number, height: number) {
            return {
                getContext: () => ({
                    fillRect: () => {},
                    getImageData: () => ({data: new Uint8ClampedArray(width * height * 4)})
                })
            };
        });

        /**
         * A 4x3 image with a different colour in every pixel, so a read-back that loses or shifts
         * pixels cannot pass. `drawImage` takes it the way it takes an `ImageBitmap`, so it is
         * typed as both and callers hand it straight to `getImageCanvasContext`.
         */
        function createSourceImage(): Canvas & ImageBitmap {
            const canvas = new Canvas(4, 3);
            const context = canvas.getContext('2d');
            for (let i = 0; i < 4 * 3; i++) {
                context.fillStyle = `rgb(${i * 20},${255 - i * 20},${i * 5})`;
                context.fillRect(i % 4, Math.floor(i / 4), 1, 1);
            }
            return canvas as unknown as Canvas & ImageBitmap;
        }

        /** Reads a whole 4x3 image out of a 2d context, as a plain array so mismatches print readably. */
        function readPixels(context: {getImageData: (x: number, y: number, width: number, height: number) => {data: Uint8ClampedArray}}): number[] {
            return Array.from(context.getImageData(0, 0, 4, 3).data);
        }

        /**
         * Re-imports `browser.ts` so the two `OffscreenCanvas` probes behind `getImageCanvasContext`,
         * which cache their answer in module scope, run again against the globals the test installed.
         */
        async function importBrowserWithFreshProbes() {
            vi.resetModules();
            return (await import('./browser.ts')).browser;
        }

        beforeEach(() => {
            WorkingOffscreenCanvas.mockClear();
            DistortingOffscreenCanvas.mockClear();
            // The probes only check that this is a function; nothing awaits what it returns.
            vi.stubGlobal('createImageBitmap', vi.fn());
            // jsdom's canvas cannot rasterise, so give the document canvas path a real one too.
            vi.spyOn(window.document, 'createElement').mockImplementation((tagName) => (tagName === 'canvas' ?
                new Canvas(0, 0) as unknown as HTMLElement :
                originalCreateElement.call(window.document, tagName)));
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
            // Leave the registry clean, so a later test spying on the `browser` imported at the top
            // of this file is not silently watching a different copy of the module.
            vi.resetModules();
        });

        test('draws into an OffscreenCanvas when the browser has one that reads back faithfully', async () => {
            vi.stubGlobal('OffscreenCanvas', WorkingOffscreenCanvas);

            const browserUnderTest = await importBrowserWithFreshProbes();
            browserUnderTest.getImageCanvasContext(createSourceImage());

            expect(WorkingOffscreenCanvas).toHaveBeenCalledWith(4, 3);
            expect(window.document.createElement).not.toHaveBeenCalledWith('canvas');
        });

        test('reads the pixels back out of the OffscreenCanvas unchanged', async () => {
            vi.stubGlobal('OffscreenCanvas', WorkingOffscreenCanvas);
            const image = createSourceImage();

            const browserUnderTest = await importBrowserWithFreshProbes();
            const context = browserUnderTest.getImageCanvasContext(image);

            expect(readPixels(context)).toEqual(readPixels(image.getContext('2d')));
        });

        test('falls back to a document canvas when the browser has no OffscreenCanvas', async () => {
            vi.stubGlobal('OffscreenCanvas', undefined);

            const browserUnderTest = await importBrowserWithFreshProbes();
            browserUnderTest.getImageCanvasContext(createSourceImage());

            expect(window.document.createElement).toHaveBeenCalledWith('canvas');
        });

        test('falls back to a document canvas when the OffscreenCanvas distorts pixels', async () => {
            vi.stubGlobal('OffscreenCanvas', DistortingOffscreenCanvas);

            const browserUnderTest = await importBrowserWithFreshProbes();
            browserUnderTest.getImageCanvasContext(createSourceImage());

            expect(window.document.createElement).toHaveBeenCalledWith('canvas');
            // The probes construct their own small canvases; the image itself must not go through one.
            expect(DistortingOffscreenCanvas).not.toHaveBeenCalledWith(4, 3);
        });

        test('sizes the document canvas fallback to the image', async () => {
            vi.stubGlobal('OffscreenCanvas', undefined);

            const browserUnderTest = await importBrowserWithFreshProbes();
            const context = browserUnderTest.getImageCanvasContext(createSourceImage());

            expect(context.canvas.width).toBe(4);
            expect(context.canvas.height).toBe(3);
        });

        test('reads the pixels back out of the document canvas fallback unchanged', async () => {
            vi.stubGlobal('OffscreenCanvas', undefined);
            const image = createSourceImage();

            const browserUnderTest = await importBrowserWithFreshProbes();
            const context = browserUnderTest.getImageCanvasContext(image);

            expect(readPixels(context)).toEqual(readPixels(image.getContext('2d')));
        });
    });
});
