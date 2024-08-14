import type {Map} from '../map';
import type {PointLike} from '../camera';
import type {Transform} from '../../geo/transform';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../../geo/lng_lat';

/**
 * @internal
 * Shared utilities for the Handler classes to access the correct camera state.
 * If Camera.transformCameraUpdate is specified or terrain is enabled, the
 * "desired state" of camera may differ from the state used for rendering. The
 * handlers need the "desired state" to track accumulated changes.
 */
export class TransformProvider {
    _map: Map;

    constructor(map: Map) {
        this._map = map;
    }

    get transform(): Transform {
        return this._map._requestedCameraState || this._map.transform;
    }

    get center() {
        return {lng: this.transform.center.lng, lat: this.transform.center.lat};
    }

    get zoom() {
        return this.transform.zoom;
    }

    get pitch() {
        return this.transform.pitch;
    }

    get bearing() {
        return this.transform.bearing;
    }

    unproject(point: PointLike): LngLat {
        return this.transform.pointLocation(Point.convert(point), this._map.terrain);
    }
}
