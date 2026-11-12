import {evaluateZoomSnap} from '../../util/util.ts';

import type Point from '@mapbox/point-geometry';
import type {ProposedCameraProvider} from './proposed-camera-provider.ts';
import type {Handler, HandlerResult} from '../handler_manager.ts';

/**
 * The `ClickZoomHandler` allows the user to zoom the map at a point by double clicking
 * It is used by other handlers
 */
export class ClickZoomHandler implements Handler {

    _tr: ProposedCameraProvider;
    _enabled: boolean;
    _active: boolean;

    /** @internal */
    constructor(transformProvider: ProposedCameraProvider) {
        this._tr = transformProvider;
        this.reset();
    }

    reset(): void {
        this._active = false;
    }

    dblclick(e: MouseEvent, point: Point): HandlerResult | void {
        e.preventDefault();
        return {
            easeTo: {
                duration: 300,
                zoom: evaluateZoomSnap(this._tr.zoom + (e.shiftKey ? -1 : 1), this._tr.zoomSnap),
                around: this._tr.isPointOnMapSurface(point) ? this._tr.unproject(point) : undefined
            }
        };
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
