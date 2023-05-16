import type Map from '../map';
import type {PointLike} from '../camera';
import type Transform from '../../geo/transform';
import Point from '@mapbox/point-geometry';
import LngLat from '../../geo/lng_lat';

/**
 * Shared utilities for the Handler classes to access the correct camera state
 */
class HandlerBase {
    _map: Map;

    constructor(map: Map) {
        this._map = map;
    }

    get transform(): Transform {
        return this._map._transformInProgress || this._map.transform;
    }

    getCenter() {
        return {lng: this.transform.center.lng, lat: this.transform.center.lat};
    }

    getZoom() {
        return this.transform.zoom;
    }

    getPitch() {
        return this.transform.pitch;
    }

    getBearing() {
        return this.transform.bearing;
    }

    unproject(point: PointLike): LngLat {
        return this.transform.pointLocation(Point.convert(point), this._map.terrain);
    }
}

export default HandlerBase;
