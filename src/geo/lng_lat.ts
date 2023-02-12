
import LngLatBounds from './lng_lat_bounds';
import LngLat from './lng_lat_partial';

/** Actual body of toBounds
 * @param {number} [radius=0] Distance in meters from the coordinates to extend the bounds.
 * @returns {LngLatBounds} A new `LngLatBounds` object representing the coordinates extended by the `radius`.
 */
LngLat.prototype.toBounds = function (radius: number = 0) {

    const earthCircumferenceInMetersAtEquator = 40075017;
    const latAccuracy = 360 * radius / earthCircumferenceInMetersAtEquator,
        lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

    return new LngLatBounds(new LngLat(this.lng - lngAccuracy, this.lat - latAccuracy),
        new LngLat(this.lng + lngAccuracy, this.lat + latAccuracy));
};

export default LngLat;
