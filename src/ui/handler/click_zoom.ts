import {evaluateZoomSnap} from '../../util/util.ts';
import type Point from '@mapbox/point-geometry';
import type {Map} from '../map.ts';
import type {TransformProvider} from './transform-provider.ts';
import type {Handler} from '../handler_manager.ts';

/**
 * The `ClickZoomHandler` allows the user to zoom the map at a point by double clicking
 * It is used by other handlers
 */
export class ClickZoomHandler implements Handler {

    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;

    /** @internal */
    constructor(map: Map, transformProvider: TransformProvider) {
        this._tr = transformProvider;
        this.reset();
    }

    reset(): void {
        this._active = false;
    }

    dblclick(e: MouseEvent, point: Point): {cameraAnimation: (map: Map) => void} {
        e.preventDefault();
        return {
            cameraAnimation: (map: Map): void => {
                map.easeTo({
                    duration: 300,
                    zoom: evaluateZoomSnap(this._tr.zoom + (e.shiftKey ? -1 : 1), map.getZoomSnap()),
                    around: this._tr.unproject(point)
                }, {originalEvent: e});
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
