import {TapRecognizer} from './tap_recognizer';
import type Point from '@mapbox/point-geometry';
import type {Map} from '../map';
import {TransformProvider} from './transform-provider';
import {Handler} from '../handler_manager';

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

    reset() {
        this._active = false;
        this._zoomIn.reset();
        this._zoomOut.reset();
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._zoomIn.touchstart(e, points, mapTouches);
        this._zoomOut.touchstart(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._zoomIn.touchmove(e, points, mapTouches);
        this._zoomOut.touchmove(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
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
                    zoom: tr.zoom + 1,
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
                    zoom: tr.zoom - 1,
                    around: tr.unproject(zoomOutPoint)
                }, {originalEvent: e})
            };
        }
    }

    touchcancel() {
        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
