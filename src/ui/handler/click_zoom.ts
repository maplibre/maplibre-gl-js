import type Point from '@mapbox/point-geometry';
import type Map from '../map';
import TransformProvider from './transform-provider';
import {Handler} from '../handler_manager';

export default class ClickZoomHandler implements Handler {

    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;

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
