import {evaluateZoomSnap} from '../../util/util.ts';
import {locationOnMapAt} from './handler_util.ts';

import type Point from '@mapbox/point-geometry';
import type {Camera} from '../camera.ts';
import type {Handler, HandlerResult} from '../handler_manager.ts';

/**
 * The `ClickZoomHandler` allows the user to zoom the map at a point by double clicking
 * It is used by other handlers
 */
export class ClickZoomHandler implements Handler {

    _camera: Camera;
    _enabled: boolean;
    _active: boolean;

    /** @internal */
    constructor(camera: Camera) {
        this._camera = camera;
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
                zoom: evaluateZoomSnap(this._camera.proposedTransform.zoom + (e.shiftKey ? -1 : 1), this._camera.getZoomSnap()),
                around: locationOnMapAt(this._camera, point)
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
