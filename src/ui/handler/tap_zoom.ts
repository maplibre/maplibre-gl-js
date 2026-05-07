import {TapRecognizer} from './tap_recognizer.ts';
import type Point from '@mapbox/point-geometry';
import type {Map} from '../map.ts';
import {TransformProvider} from './transform-provider.ts';
import {type Handler} from '../handler_manager.ts';
import {evaluateZoomSnap} from '../../util/util.ts';

/**
 * A `TapZoomHandler` allows the user to zoom the map at a point by double tapping
 */
export class TapZoomHandler implements Handler {
    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;
    _zoomIn: TapRecognizer;
    _zoomOut: TapRecognizer;

    constructor(map: Map) {
        this._tr = new TransformProvider(map);
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

    touchend(e: TouchEvent, points: Point[], mapTouches: Touch[]): {cameraAnimation: (map: Map) => Map} | void {
        const zoomInPoint = this._zoomIn.touchend(e, points, mapTouches);
        const zoomOutPoint = this._zoomOut.touchend(e, points, mapTouches);
        const tr = this._tr;

        if (zoomInPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map: Map) => map.easeTo({
                    duration: 300,
                    zoom: evaluateZoomSnap(tr.zoom + 1, map.getZoomSnap()),
                    around: tr.unproject(zoomInPoint)
                }, {originalEvent: e})
            };
        } else if (zoomOutPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map: Map) => map.easeTo({
                    duration: 300,
                    zoom: evaluateZoomSnap(tr.zoom - 1, map.getZoomSnap()),
                    around: tr.unproject(zoomOutPoint)
                }, {originalEvent: e})
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
