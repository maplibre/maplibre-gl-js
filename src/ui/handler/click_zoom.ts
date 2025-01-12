import type Point from '@mapbox/point-geometry';
import type {Map} from '../map';
import {TransformProvider} from './transform-provider';
import {type Handler} from '../handler_manager';

/**
 * The `ClickZoomHandler` allows the user to zoom the map at a point by double clicking
 * It is used by other handlers
 */
export class ClickZoomHandler implements Handler {

    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;

    /** @internal */
    constructor(map: Map) {
        this._tr = new TransformProvider(map);
        this.reset();
    }

    reset() {
        this._active = false;
    }

    dblclick(e: MouseEvent, point: Point) {
        e.preventDefault();
        return {
            cameraAnimation: (map: Map) => {
                map.easeTo({
                    duration: 300,
                    zoom: this._tr.zoom + (e.shiftKey ? -1 : 1),
                    around: this._tr.unproject(point)
                }, {originalEvent: e});
            }
        };
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
