import {LngLat} from './lng_lat';
import type {LngLatLike} from './lng_lat';

/**
 * A {@link LngLatBounds} object, an array of {@link LngLatLike} objects in [sw, ne] order,
 * or an array of numbers in [west, south, east, north] order.
 *
 * @group Geography and Geometry
 *
 * @example
 * ```ts
 * let v1 = new LngLatBounds(
 *   new LngLat(-73.9876, 40.7661),
 *   new LngLat(-73.9397, 40.8002)
 * );
 * let v2 = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002])
 * let v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 * ```
 */
export type LngLatBoundsLike = LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number];

/**
 * A `LngLatBounds` object represents a geographical bounding box,
 * defined by its southwest and northeast points in longitude and latitude.
 *
 * If no arguments are provided to the constructor, a `null` bounding box is created.
 *
 * Note that any Mapbox GL method that accepts a `LngLatBounds` object as an argument or option
 * can also accept an `Array` of two {@link LngLatLike} constructs and will perform an implicit conversion.
 * This flexible type is documented as {@link LngLatBoundsLike}.
 *
 * @group Geography and Geometry
 *
 * @example
 * ```ts
 * let sw = new LngLat(-73.9876, 40.7661);
 * let ne = new LngLat(-73.9397, 40.8002);
 * let llb = new LngLatBounds(sw, ne);
 * ```
 */
export class LngLatBounds {
    _ne: LngLat;
    _sw: LngLat;

    /**
     * @param sw - The southwest corner of the bounding box.
     * OR array of 4 numbers in the order of  west, south, east, north
     * OR array of 2 LngLatLike: [sw,ne]
     * @param ne - The northeast corner of the bounding box.
     * @example
     * ```ts
     * let sw = new LngLat(-73.9876, 40.7661);
     * let ne = new LngLat(-73.9397, 40.8002);
     * let llb = new LngLatBounds(sw, ne);
     * ```
     * OR
     * ```ts
     * let llb = new LngLatBounds([-73.9876, 40.7661, -73.9397, 40.8002]);
     * ```
     * OR
     * ```ts
     * let llb = new LngLatBounds([sw, ne]);
     * ```
     */
    constructor(sw?: LngLatLike | [number, number, number, number] | [LngLatLike, LngLatLike], ne?: LngLatLike) {
        if (!sw) {
            // noop
        } else if (ne) {
            this.setSouthWest(<LngLatLike>sw).setNorthEast(ne);
        } else if (Array.isArray(sw)) {
            if (sw.length === 4) {
            // 4 element array: west, south, east, north
                this.setSouthWest([sw[0], sw[1]]).setNorthEast([sw[2], sw[3]]);
            } else {
                this.setSouthWest(sw[0] as LngLatLike).setNorthEast(sw[1] as LngLatLike);
            }
        }
    }

    /**
     * Set the northeast corner of the bounding box
     *
     * @param ne - a {@link LngLatLike} object describing the northeast corner of the bounding box.
     */
    setNorthEast(ne: LngLatLike): this {
        this._ne = ne instanceof LngLat ? new LngLat(ne.lng, ne.lat) : LngLat.convert(ne);
        return this;
    }

    /**
     * Set the southwest corner of the bounding box
     *
     * @param sw - a {@link LngLatLike} object describing the southwest corner of the bounding box.
     */
    setSouthWest(sw: LngLatLike): this {
        this._sw = sw instanceof LngLat ? new LngLat(sw.lng, sw.lat) : LngLat.convert(sw);
        return this;
    }

    /**
     * Extend the bounds to include a given LngLatLike or LngLatBoundsLike.
     *
     * @param obj - object to extend to
     */
    extend(obj: LngLatLike | LngLatBoundsLike): this {
        const sw = this._sw,
            ne = this._ne;
        let sw2, ne2;

        if (obj instanceof LngLat) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LngLatBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else {
            if (Array.isArray(obj)) {
                if (obj.length === 4 || (obj as any[]).every(Array.isArray)) {
                    const lngLatBoundsObj = (obj as any as LngLatBoundsLike);
                    return this.extend(LngLatBounds.convert(lngLatBoundsObj));
                } else {
                    const lngLatObj = (obj as any as LngLatLike);
                    return this.extend(LngLat.convert(lngLatObj));
                }

            } else if (obj && ('lng' in obj || 'lon' in obj) && 'lat' in obj) {
                return this.extend(LngLat.convert(obj));
            }

            return this;
        }

        if (!sw && !ne) {
            this._sw = new LngLat(sw2.lng, sw2.lat);
            this._ne = new LngLat(ne2.lng, ne2.lat);

        } else {
            sw.lng = Math.min(sw2.lng, sw.lng);
            sw.lat = Math.min(sw2.lat, sw.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
        }

        return this;
    }

    /**
     * Returns the geographical coordinate equidistant from the bounding box's corners.
     *
     * @returns The bounding box's center.
     * @example
     * ```ts
     * let llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
     * ```
     */
    getCenter(): LngLat {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    }

    /**
     * Returns the southwest corner of the bounding box.
     *
     * @returns The southwest corner of the bounding box.
     */
    getSouthWest(): LngLat { return this._sw; }

    /**
     * Returns the northeast corner of the bounding box.
     *
     * @returns The northeast corner of the bounding box.
     */
    getNorthEast(): LngLat { return this._ne; }

    /**
     * Returns the northwest corner of the bounding box.
     *
     * @returns The northwest corner of the bounding box.
     */
    getNorthWest(): LngLat { return new LngLat(this.getWest(), this.getNorth()); }

    /**
     * Returns the southeast corner of the bounding box.
     *
     * @returns The southeast corner of the bounding box.
     */
    getSouthEast(): LngLat { return new LngLat(this.getEast(), this.getSouth()); }

    /**
     * Returns the west edge of the bounding box.
     *
     * @returns The west edge of the bounding box.
     */
    getWest(): number { return this._sw.lng; }

    /**
     * Returns the south edge of the bounding box.
     *
     * @returns The south edge of the bounding box.
     */
    getSouth(): number { return this._sw.lat; }

    /**
     * Returns the east edge of the bounding box.
     *
     * @returns The east edge of the bounding box.
     */
    getEast(): number { return this._ne.lng; }

    /**
     * Returns the north edge of the bounding box.
     *
     * @returns The north edge of the bounding box.
     */
    getNorth(): number { return this._ne.lat; }

    /**
     * Returns the bounding box represented as an array.
     *
     * @returns The bounding box represented as an array, consisting of the
     * southwest and northeast coordinates of the bounding represented as arrays of numbers.
     * @example
     * ```ts
     * let llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
     * ```
     */
    toArray() {
        return [this._sw.toArray(), this._ne.toArray()];
    }

    /**
     * Return the bounding box represented as a string.
     *
     * @returns The bounding box represents as a string of the format
     * `'LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))'`.
     * @example
     * ```ts
     * let llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
     * ```
     */
    toString() {
        return `LngLatBounds(${this._sw.toString()}, ${this._ne.toString()})`;
    }

    /**
     * Check if the bounding box is an empty/`null`-type box.
     *
     * @returns True if bounds have been defined, otherwise false.
     */
    isEmpty() {
        return !(this._sw && this._ne);
    }

    /**
     * Check if the point is within the bounding box.
     *
     * @param lnglat - geographic point to check against.
     * @returns `true` if the point is within the bounding box.
     * @example
     * ```ts
     * let llb = new LngLatBounds(
     *   new LngLat(-73.9876, 40.7661),
     *   new LngLat(-73.9397, 40.8002)
     * );
     *
     * let ll = new LngLat(-73.9567, 40.7789);
     *
     * console.log(llb.contains(ll)); // = true
     * ```
     */
    contains(lnglat: LngLatLike) {
        const {lng, lat} = LngLat.convert(lnglat);

        const containsLatitude = this._sw.lat <= lat && lat <= this._ne.lat;
        let containsLongitude = this._sw.lng <= lng && lng <= this._ne.lng;
        if (this._sw.lng > this._ne.lng) { // wrapped coordinates
            containsLongitude = this._sw.lng >= lng && lng >= this._ne.lng;
        }

        return containsLatitude && containsLongitude;
    }

    /**
     * Converts an array to a `LngLatBounds` object.
     *
     * If a `LngLatBounds` object is passed in, the function returns it unchanged.
     *
     * Internally, the function calls `LngLat#convert` to convert arrays to `LngLat` values.
     *
     * @param input - An array of two coordinates to convert, or a `LngLatBounds` object to return.
     * @returns A new `LngLatBounds` object, if a conversion occurred, or the original `LngLatBounds` object.
     * @example
     * ```ts
     * let arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
     * let llb = LngLatBounds.convert(arr); // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
     * ```
     */
    static convert(input: LngLatBoundsLike | null): LngLatBounds {
        if (input instanceof LngLatBounds) return input;
        if (!input) return input as null;
        return new LngLatBounds(input);
    }

    /**
     * Returns a `LngLatBounds` from the coordinates extended by a given `radius`. The returned `LngLatBounds` completely contains the `radius`.
     *
     * @param center - center coordinates of the new bounds.
     * @param radius - Distance in meters from the coordinates to extend the bounds.
     * @returns A new `LngLatBounds` object representing the coordinates extended by the `radius`.
     * @example
     * ```ts
     * let center = new LngLat(-73.9749, 40.7736);
     * LngLatBounds.fromLngLat(100).toArray(); // = [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]
     * ```
     */
    static fromLngLat(center: LngLat, radius:number = 0): LngLatBounds {
        const earthCircumferenceInMetersAtEquator = 40075017;
        const latAccuracy = 360 * radius / earthCircumferenceInMetersAtEquator,
            lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * center.lat);

        return new LngLatBounds(new LngLat(center.lng - lngAccuracy, center.lat - latAccuracy),
            new LngLat(center.lng + lngAccuracy, center.lat + latAccuracy));
    }

    /**
     * Adjusts the given bounds to handle the case where the bounds cross the 180th meridian (antimeridian).
     *
     * @returns The adjusted LngLatBounds
     * @example
     * ```ts
     * let bounds = new LngLatBounds([175.813127, -20.157768], [-178. 340903, -15.449124]);
     * let adjustedBounds = bounds.adjustAntiMeridian();
     * // adjustedBounds will be: [[175.813127, -20.157768], [181.659097, -15.449124]]
     * ```
     */
    adjustAntiMeridian(): LngLatBounds {
        const sw = new LngLat(this._sw.lng, this._sw.lat);
        const ne = new LngLat(this._ne.lng, this._ne.lat);

        if (sw.lng > ne.lng) {
            return new LngLatBounds(
                sw,
                new LngLat(ne.lng + 360, ne.lat)
            );
        }

        return new LngLatBounds(sw, ne);
    }

}
