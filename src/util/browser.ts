import {AbortError} from './abort_error';
import {subscribe} from './util';

let linkEl;

let reducedMotionQuery: MediaQueryList;
let reducedMotionOverride: boolean | undefined;

/** */
export const browser = {
    /**
     * Schedules a callback to be invoked on the next animation frame.
     * @param abortController - Controller to abort the scheduled frame.
     * @param fn - Callback to invoke with the paint start timestamp.
     * @param reject - Callback to invoke if the frame is aborted.
     * @param targetWindow - Optional window to use for requestAnimationFrame.
     *   When the map is rendered in a popup window or iframe, pass the owning
     *   window to ensure animation frames continue even when the main window
     *   is not focused.
     */
    frame(abortController: AbortController, fn: (paintStartTimestamp: number) => void, reject: (error: Error) => void, targetWindow?: Window): void {
        const win = targetWindow || window;
        const frameId = win.requestAnimationFrame((paintStartTimestamp)=>{
            unsubscribe();
            fn(paintStartTimestamp);
        });

        const {unsubscribe} = subscribe(abortController.signal, 'abort', () => {
            unsubscribe();
            win.cancelAnimationFrame(frameId);
            reject(new AbortError(abortController.signal.reason));
        }, false);
    },

    /**
     * Returns a promise that resolves on the next animation frame.
     * @param abortController - Controller to abort the scheduled frame.
     * @param targetWindow - Optional window to use for requestAnimationFrame.
     * @see {@link browser.frame}
     */
    frameAsync(abortController: AbortController, targetWindow?: Window): Promise<number> {
        return new Promise((resolve, reject) => {
            this.frame(abortController, resolve, reject, targetWindow);
        });
    },

    getImageData(img:  HTMLImageElement | ImageBitmap, padding: number = 0): ImageData {
        const context = this.getImageCanvasContext(img);
        return context.getImageData(-padding, -padding, img.width as number + 2 * padding, img.height as number + 2 * padding);
    },

    getImageCanvasContext(img: HTMLImageElement | ImageBitmap): CanvasRenderingContext2D {
        const canvas = window.document.createElement('canvas') as HTMLCanvasElement;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        if (!context) {
            throw new Error('failed to create canvas 2d context');
        }
        canvas.width = img.width as number;
        canvas.height = img.height as number;
        context.drawImage(img, 0, 0, img.width as number, img.height as number);
        return context;
    },

    resolveURL(path: string) {
        if (!linkEl) linkEl = document.createElement('a');
        linkEl.href = path;
        return linkEl.href;
    },

    hardwareConcurrency: typeof navigator !== 'undefined' && navigator.hardwareConcurrency || 4,

    get prefersReducedMotion(): boolean {
        if (reducedMotionOverride !== undefined) return reducedMotionOverride;
        // In case your test crashes when checking matchMedia, call setMatchMedia from 'src/util/test/util'
        if (!matchMedia) return false;
        //Lazily initialize media query
        if (reducedMotionQuery == null) {
            reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
        }
        return reducedMotionQuery.matches;
    },

    set prefersReducedMotion(value: boolean) {
        reducedMotionOverride = value;
    }
};
