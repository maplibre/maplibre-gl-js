import type Point from '@mapbox/point-geometry';
import type Map from '../map';
import HandlerBase from './handler-base';

export default class ClickZoomHandler extends HandlerBase {

    _enabled: boolean;
    _active: boolean;

    constructor(map: Map) {
        super(map);
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
                    zoom: this.getZoom() + (e.shiftKey ? -1 : 1),
                    around: this.unproject(point)
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
