import {type Feature, type GeoJsonProperties, type Point, type Polygon} from 'geojson';
import {polygon} from './turf-helpers';
import {destination} from './destination';

/**
 * Takes a {@link Point} and calculates the circle polygon given a radius in degrees, radians, miles, or kilometers; and steps for precision.
 *
 * @function
 * @param {Feature<Point>|number[]} center center point
 * @param {number} radius radius of the circle
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.steps=64] number of steps
 * @param {string} [options.units='kilometers'] miles, kilometers, degrees, or radians
 * @param {Object} [options.properties={}] properties
 * @returns {Feature<Polygon>} circle polygon
 * @example
 * var center = [-75.343, 39.984];
 * var radius = 5;
 * var options = {steps: 10, units: 'kilometers', properties: {foo: 'bar'}};
 * var circle = turf.circle(center, radius, options);
 *
 * //addToMap
 * var addToMap = [turf.point(center), circle]
 */
export function circle<P extends GeoJsonProperties = GeoJsonProperties>(
    center: number[] | Point | Feature<Point, P>,
    radius: number,
    options: {
        steps?: number;
        units?: 'meters';
        properties?: P;
    } = {}
): Feature<Polygon, P> {
    // default params
    const steps = options.steps || 64;
    const properties: any = options.properties
        ? options.properties
        : !Array.isArray(center) && center.type === 'Feature' && center.properties
            ? center.properties
            : {};

    // main
    const coordinates = [];
    for (let i = 0; i < steps; i++) {
        coordinates.push(
            destination(center, radius, (i * -360) / steps, options).geometry
                .coordinates
        );
    }
    coordinates.push(coordinates[0]);

    return polygon([coordinates], properties);
}
