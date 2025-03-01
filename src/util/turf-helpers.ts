import {
    type BBox,
    type Feature,
    type Geometry,
    type GeometryObject,
    type Point,
    type Polygon,
    type Position,
    type GeoJsonProperties,
} from 'geojson';

/**
 * @module helpers
 */

// TurfJS Combined Types
export type Coord = Feature<Point> | Point | Position;

type Id = string | number;

/**
 * Linear measurement units.
 *
 * ⚠️ Warning. Be aware of the implications of using radian or degree units to
 * measure distance. The distance represented by a degree of longitude *varies*
 * depending on latitude.
 *
 * See https://www.thoughtco.com/degree-of-latitude-and-longitude-distance-4070616
 * for an illustration of this behaviour.
 *
 * @typedef
 */
export type Units =
    | 'meters'
    | 'metres'
    | 'kilometers'
    | 'kilometres'
    | 'degrees';

/**
 * The Earth radius in kilometers. Used by Turf modules that model the Earth as a sphere. The {@link https://en.wikipedia.org/wiki/Earth_radius#Arithmetic_mean_radius mean radius} was selected because it is {@link https://rosettacode.org/wiki/Haversine_formula#:~:text=This%20value%20is%20recommended recommended } by the Haversine formula (used by turf/distance) to reduce error.
 *
 * @constant
 */
export const earthRadius = 6371008.8;

/**
 * Unit of measurement factors based on earthRadius.
 *
 * Keys are the name of the unit, values are the number of that unit in a single radian
 *
 * @constant
 */
export const factors: Record<Units, number> = {
    degrees: 360 / (2 * Math.PI),
    kilometers: earthRadius / 1000,
    kilometres: earthRadius / 1000,
    meters: earthRadius,
    metres: earthRadius,
};

/**
 * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
 *
 * @function
 * @param {GeometryObject} geometry input geometry
 * @param {GeoJsonProperties} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {BBox} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {Id} [options.id] Identifier associated with the Feature
 * @returns {Feature<GeometryObject, GeoJsonProperties>} a GeoJSON Feature
 * @example
 * var geometry = {
 *   "type": "Point",
 *   "coordinates": [110, 50]
 * };
 *
 * var feature = turf.feature(geometry);
 *
 * //=feature
 */
export function feature<
    G extends GeometryObject = Geometry,
    P extends GeoJsonProperties = GeoJsonProperties,
>(
    geom: G | null,
    properties?: P,
    options: { bbox?: BBox; id?: Id } = {}
): Feature<G, P> {
    const feat: any = {type: 'Feature'};
    if (options.id === 0 || options.id) {
        feat.id = options.id;
    }
    if (options.bbox) {
        feat.bbox = options.bbox;
    }
    feat.properties = properties || {};
    feat.geometry = geom;
    return feat;
}

/**
 * Creates a {@link Point} {@link Feature} from a Position.
 *
 * @function
 * @param {Position} coordinates longitude, latitude position (each in decimal degrees)
 * @param {GeoJsonProperties} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {BBox} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {Id} [options.id] Identifier associated with the Feature
 * @returns {Feature<Point, GeoJsonProperties>} a Point feature
 * @example
 * var point = turf.point([-75.343, 39.984]);
 *
 * //=point
 */
export function point<P extends GeoJsonProperties = GeoJsonProperties>(
    coordinates: Position,
    properties?: P,
    options: { bbox?: BBox; id?: Id } = {}
): Feature<Point, P> {
    if (!coordinates) {
        throw new Error('coordinates is required');
    }
    if (!Array.isArray(coordinates)) {
        throw new Error('coordinates must be an Array');
    }
    if (coordinates.length < 2) {
        throw new Error('coordinates must be at least 2 numbers long');
    }
    if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
        throw new Error('coordinates must contain numbers');
    }

    const geom: Point = {
        type: 'Point',
        coordinates,
    };
    return feature(geom, properties, options);
}

/**
 * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
 *
 * @function
 * @param {Position[][]} coordinates an array of LinearRings
 * @param {GeoJsonProperties} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {BBox} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {Id} [options.id] Identifier associated with the Feature
 * @returns {Feature<Polygon, GeoJsonProperties>} Polygon Feature
 * @example
 * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
 *
 * //=polygon
 */
export function polygon<P extends GeoJsonProperties = GeoJsonProperties>(
    coordinates: Position[][],
    properties?: P,
    options: { bbox?: BBox; id?: Id } = {}
): Feature<Polygon, P> {
    for (const ring of coordinates) {
        if (ring.length < 4) {
            throw new Error(
                'Each LinearRing of a Polygon must have 4 or more Positions.'
            );
        }

        if (ring[ring.length - 1].length !== ring[0].length) {
            throw new Error('First and last Position are not equivalent.');
        }

        for (let j = 0; j < ring[ring.length - 1].length; j++) {
            // Check if first point of Polygon contains two numbers
            if (ring[ring.length - 1][j] !== ring[0][j]) {
                throw new Error('First and last Position are not equivalent.');
            }
        }
    }
    const geom: Polygon = {
        type: 'Polygon',
        coordinates,
    };
    return feature(geom, properties, options);
}

/**
 * Round number to precision
 *
 * @function
 * @param {number} num Number
 * @param {number} [precision=0] Precision
 * @returns {number} rounded number
 * @example
 * turf.round(120.4321)
 * //=120
 *
 * turf.round(120.4321, 2)
 * //=120.43
 */
export function round(num: number, precision = 0): number {
    if (precision && !(precision >= 0)) {
        throw new Error('precision must be a positive number');
    }
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(num * multiplier) / multiplier;
}

/**
 * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @function
 * @param {number} distance in real units
 * @param {Units} [units="kilometers"] can be degrees, radians, miles, inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} radians
 */
export function lengthToRadians(
    distance: number,
    units: Units = 'kilometers'
): number {
    const factor = factors[units];
    if (!factor) {
        throw new Error(`${units} units is invalid`);
    }
    return distance / factor;
}

/**
 * Converts an angle in radians to degrees
 *
 * @function
 * @param {number} radians angle in radians
 * @returns {number} degrees between 0 and 360 degrees
 */
export function radiansToDegrees(radians: number): number {
    // % (2 * Math.PI) radians in case someone passes value > 2π
    const normalisedRadians = radians % (2 * Math.PI);
    return (normalisedRadians * 180) / Math.PI;
}

/**
 * Converts an angle in degrees to radians
 *
 * @function
 * @param {number} degrees angle between 0 and 360 degrees
 * @returns {number} angle in radians
 */
export function degreesToRadians(degrees: number): number {
    // % 360 degrees in case someone passes value > 360
    const normalisedDegrees = degrees % 360;
    return (normalisedDegrees * Math.PI) / 180;
}

/**
 * isNumber
 *
 * @function
 * @param {any} num Number to validate
 * @returns {boolean} true/false
 * @example
 * turf.isNumber(123)
 * //=true
 * turf.isNumber('foo')
 * //=false
 */
export function isNumber(num: any): boolean {
    return !isNaN(num) && num !== null && !Array.isArray(num);
}
