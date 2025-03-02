import {
    type Feature,
    type Point,
} from 'geojson';

/**
 * Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.
 *
 * @function
 * @param {Array<number>|Geometry<Point>|Feature<Point>} coord GeoJSON Point or an Array of numbers
 * @returns {Array<number>} coordinates
 * @example
 * var pt = turf.point([10, 10]);
 *
 * var coord = turf.getCoord(pt);
 * //= [10, 10]
 */
function getCoord(coord: Feature<Point> | Point | number[]): number[] {
    if (!coord) {
        throw new Error('coord is required');
    }

    if (!Array.isArray(coord)) {
        if (
            coord.type === 'Feature' &&
            coord.geometry !== null &&
            coord.geometry.type === 'Point'
        ) {
            return [...coord.geometry.coordinates];
        }
        if (coord.type === 'Point') {
            return [...coord.coordinates];
        }
    }
    if (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        !Array.isArray(coord[0]) &&
        !Array.isArray(coord[1])
    ) {
        return [...coord];
    }

    throw new Error('coord must be GeoJSON Point or an Array of numbers');
}

export {
    getCoord,
};
// No default export!
