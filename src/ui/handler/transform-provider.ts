import type {Map} from '../map.ts';
import type {PointLike} from '../camera.ts';
import type {Transform} from '../../geo/transform.ts';
import Point from '@mapbox/point-geometry';
import {LngLat} from '../../geo/lng_lat.ts';

/**
 * @internal
 * Shared utilities for the Handler classes to access the correct camera state.
 * If Camera.transformCameraUpdate is specified, the "desired state" of camera may differ from the state used for rendering.
 * The handlers need the "desired state" to track accumulated changes.
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
