import {AbortError} from './abort_error';
import {subscribe} from './util';

let linkEl;

let reducedMotionQuery: MediaQueryList;
let reducedMotionOverride: boolean | undefined;

/** */
export const browser = {
    frame(abortController: AbortController, fn: (paintStartTimestamp: number) => void, reject: (error: Error) => void): void {
        const frameId = requestAnimationFrame((paintStartTimestamp)=>{
            unsubscribe();
            fn(paintStartTimestamp);
        });

        const {unsubscribe} = subscribe(abortController.signal, 'abort', () => {
            unsubscribe();
            cancelAnimationFrame(frameId);
            reject(new AbortError(abortController.signal.reason));
        }, false);
    },

    frameAsync(abortController: AbortController): Promise<number> {
        return new Promise((resolve, reject) => {
            this.frame(abortController, resolve, reject);
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
