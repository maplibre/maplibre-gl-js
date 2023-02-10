
import LngLatBounds from './lng_lat_bounds';
import {LngLat} from './lng_lat';

declare module './lng_lat' {
    interface LngLat {
        toBounds: (radius?: number) => LngLatBounds;
    }
}

/**
 * Actual body
 *
 * @param {number} [radius=0] Distance in meters from the coordinates to extend the bounds.
 * @returns {LngLatBounds} A new `LngLatBounds` object representing the coordinates extended by the `radius`.
 * @example
 * var ll = new maplibregl.LngLat(-73.9749, 40.7736);
 * ll.toBounds(100).toArray(); // = [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]
 */
LngLat.prototype.toBounds = function (radius: number = 0) {

    const earthCircumferenceInMetersAtEquator = 40075017;
    const latAccuracy = 360 * radius / earthCircumferenceInMetersAtEquator,
        lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

    return new LngLatBounds(new LngLat(this.lng - lngAccuracy, this.lat - latAccuracy),
        new LngLat(this.lng + lngAccuracy, this.lat + latAccuracy));
};

