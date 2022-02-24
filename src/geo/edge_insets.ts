import {number} from '../style-spec/util/interpolate';
import Point from '@mapbox/point-geometry';
import {clamp} from '../util/util';

/**
 * An `EdgeInset` object represents screen space padding applied to the edges of the viewport.
 * This shifts the apprent center or the vanishing point of the map. This is useful for adding floating UI elements
 * on top of the map and having the vanishing point shift as UI elements resize.
 *
 * @param {number} [top=0]
 * @param {number} [bottom=0]
 * @param {number} [left=0]
 * @param {number} [right=0]
 */
class EdgeInsets {
    top: number;
    bottom: number;
    left: number;
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
     * @param {PaddingOptions | EdgeInsets} start interpolation start
     * @param {PaddingOptions} target interpolation target
     * @param {number} t interpolation step/weight
     * @returns {EdgeInsets} the insets
     * @memberof EdgeInsets
     */
    interpolate(start: PaddingOptions | EdgeInsets, target: PaddingOptions, t: number): EdgeInsets {
        if (target.top != null && start.top != null) this.top = number(start.top, target.top, t);
        if (target.bottom != null && start.bottom != null) this.bottom = number(start.bottom, target.bottom, t);
        if (target.left != null && start.left != null) this.left = number(start.left, target.left, t);
        if (target.right != null && start.right != null) this.right = number(start.right, target.right, t);

        return this;
    }

    /**
     * Utility method that computes the new apprent center or vanishing point after applying insets.
     * This is in pixels and with the top left being (0.0) and +y being downwards.
     *
     * @param {number} width the width
     * @param {number} height the height
     * @returns {Point} the point
     * @memberof EdgeInsets
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
     * @returns {PaddingOptions} state as json
     * @memberof EdgeInsets
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
 * @example
 * var bbox = [[-79, 43], [-73, 45]];
 * map.fitBounds(bbox, {
 *   padding: {top: 10, bottom:25, left: 15, right: 5}
 * });
 *
 * @example
 * var bbox = [[-79, 43], [-73, 45]];
 * map.fitBounds(bbox, {
 *   padding: 20
 * });
 * @see [Fit to the bounds of a LineString](https://maplibre.org/maplibre-gl-js-docs/example/zoomto-linestring/)
 * @see [Fit a map to a bounding box](https://maplibre.org/maplibre-gl-js-docs/example/fitbounds/)
 */
export type PaddingOptions = {
    /**
     * @property {number} top Padding in pixels from the top of the map canvas.
     */
    top: number;
    /**
     * @property {number} bottom Padding in pixels from the bottom of the map canvas.
     */
    bottom: number;
    /**
     * @property {number} left Padding in pixels from the left of the map canvas.
     */
    right: number;
    /**
     * @property {number} right Padding in pixels from the right of the map canvas.
     */
    left: number;
};

export default EdgeInsets;
