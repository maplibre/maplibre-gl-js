import {TapRecognizer} from './tap_recognizer.ts';
import {evaluateZoomSnap} from '../../util/util.ts';

import type Point from '@mapbox/point-geometry';
import type {ProposedCameraProvider} from './proposed-camera-provider.ts';
import type {Handler, HandlerResult} from '../handler_manager.ts';

/**
 * A `TapZoomHandler` allows the user to zoom the map at a point by double tapping
 */
export class TapZoomHandler implements Handler {
    _tr: ProposedCameraProvider;
    _enabled: boolean;
    _active: boolean;
    _zoomIn: TapRecognizer;
    _zoomOut: TapRecognizer;

    constructor(transformProvider: ProposedCameraProvider) {
        this._tr = transformProvider;
        this._zoomIn = new TapRecognizer({
            numTouches: 1,
            numTaps: 2
        });

        this._zoomOut = new TapRecognizer({
            numTouches: 2,
            numTaps: 1
        });

        this.reset();
    }

    reset(): void {
        this._active = false;
        this._zoomIn.reset();
        this._zoomOut.reset();
    }

    touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]): void {
        this._zoomIn.touchstart(e, points, mapTouches);
        this._zoomOut.touchstart(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Point[], mapTouches: Touch[]): void {
        this._zoomIn.touchmove(e, points, mapTouches);
        this._zoomOut.touchmove(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Point[], mapTouches: Touch[]): HandlerResult | void {
        const zoomInPoint = this._zoomIn.touchend(e, points, mapTouches);
        const zoomOutPoint = this._zoomOut.touchend(e, points, mapTouches);
        const tr = this._tr;

        if (zoomInPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                easeTo: {
                    duration: 300,
                    zoom: evaluateZoomSnap(tr.zoom + 1, tr.zoomSnap),
                    around: tr.isPointOnMapSurface(zoomInPoint) ? tr.unproject(zoomInPoint) : undefined
                }
            };
        } else if (zoomOutPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                easeTo: {
                    duration: 300,
                    zoom: evaluateZoomSnap(tr.zoom - 1, tr.zoomSnap),
                    around: tr.isPointOnMapSurface(zoomOutPoint) ? tr.unproject(zoomOutPoint) : undefined
                }
            };
        }
    }

    touchcancel(): void {
        this.reset();
    }

    enable(): void {
        this._enabled = true;
    }

    disable(): void {
        this._enabled = false;
        this.reset();
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    isActive(): boolean {
        return this._active;
    }
}
