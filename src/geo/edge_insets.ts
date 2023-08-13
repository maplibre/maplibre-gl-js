import {interpolates} from '@maplibre/maplibre-gl-style-spec';
import Point from '@mapbox/point-geometry';
import {clamp} from '../util/util';

/**
 * An `EdgeInset` object represents screen space padding applied to the edges of the viewport.
 * This shifts the apprent center or the vanishing point of the map. This is useful for adding floating UI elements
 * on top of the map and having the vanishing point shift as UI elements resize.
 *
 * @group Geography and Geometry
 */
export class EdgeInsets {
    /**
     * @defaultValue 0
     */
    top: number;
    /**
     * @defaultValue 0
     */
    bottom: number;
    /**
     * @defaultValue 0
     */
    left: number;
    /**
     * @defaultValue 0
     */
    right: number;

    constructor(top: number = 0, bottom: number = 0, left: number = 0, right: number = 0) {
        if (isNaN(top) || top < 0 ||
            isNaN(bottom) || bottom < 0 ||
            isNaN(left) || left < 0 ||
            isNaN(right) || right < 0
        ) {
            throw new Error('Invalid value for edge-insets, top, bottom, left and right must all be numbers');
        }

        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    /**
     * Interpolates the inset in-place.
     * This maintains the current inset value for any inset not present in `target`.
     * @param start - interpolation start
     * @param target - interpolation target
     * @param t - interpolation step/weight
     * @returns the insets
     */
    interpolate(start: PaddingOptions | EdgeInsets, target: PaddingOptions, t: number): EdgeInsets {
        if (target.top != null && start.top != null) this.top = interpolates.number(start.top, target.top, t);
        if (target.bottom != null && start.bottom != null) this.bottom = interpolates.number(start.bottom, target.bottom, t);
        if (target.left != null && start.left != null) this.left = interpolates.number(start.left, target.left, t);
        if (target.right != null && start.right != null) this.right = interpolates.number(start.right, target.right, t);

        return this;
    }

    /**
     * Utility method that computes the new apprent center or vanishing point after applying insets.
     * This is in pixels and with the top left being (0.0) and +y being downwards.
     *
     * @param width - the width
     * @param height - the height
     * @returns the point
     */
    getCenter(width: number, height: number): Point {
        // Clamp insets so they never overflow width/height and always calculate a valid center
        const x = clamp((this.left + width - this.right) / 2, 0, width);
        const y = clamp((this.top + height - this.bottom) / 2, 0, height);

        return new Point(x, y);
    }

    equals(other: PaddingOptions): boolean {
        return this.top === other.top &&
            this.bottom === other.bottom &&
            this.left === other.left &&
            this.right === other.right;
    }

    clone(): EdgeInsets {
        return new EdgeInsets(this.top, this.bottom, this.left, this.right);
    }

    /**
     * Returns the current state as json, useful when you want to have a
     * read-only representation of the inset.
     *
     * @returns state as json
     */
    toJSON(): PaddingOptions {
        return {
            top: this.top,
            bottom: this.bottom,
            left: this.left,
            right: this.right
        };
    }
}

/**
 * Options for setting padding on calls to methods such as {@link Map#fitBounds}, {@link Map#fitScreenCoordinates}, and {@link Map#setPadding}. Adjust these options to set the amount of padding in pixels added to the edges of the canvas. Set a uniform padding on all edges or individual values for each edge. All properties of this object must be
 * non-negative integers.
 *
 * @group Geography and Geometry
 *
 * @example
 * ```ts
 * let bbox = [[-79, 43], [-73, 45]];
 * map.fitBounds(bbox, {
 *   padding: {top: 10, bottom:25, left: 15, right: 5}
 * });
 * ```
 *
 * @example
 * ```ts
 * let bbox = [[-79, 43], [-73, 45]];
 * map.fitBounds(bbox, {
 *   padding: 20
 * });
 * ```
 * @see [Fit to the bounds of a LineString](https://maplibre.org/maplibre-gl-js/docs/examples/zoomto-linestring/)
 * @see [Fit a map to a bounding box](https://maplibre.org/maplibre-gl-js/docs/examples/fitbounds/)
 */
export type PaddingOptions = {
    /**
     * Padding in pixels from the top of the map canvas.
     */
    top: number;
    /**
     * Padding in pixels from the bottom of the map canvas.
     */
    bottom: number;
    /**
     * Padding in pixels from the left of the map canvas.
     */
    right: number;
    /**
     * Padding in pixels from the right of the map canvas.
     */
    left: number;
};
