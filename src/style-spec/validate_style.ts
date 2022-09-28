
import validateStyleMin from './validate_style.min';
import {v8, ValidationError} from './style-spec';
import readStyle from './read_style';
import type {StyleSpecification} from './types.g';

/**
 * Validate a Mapbox GL style against the style specification.
 *
 * @private
 * @alias validate
 * @param {StyleSpecification|string|Buffer} style The style to be validated. If a `String`
 *     or `Buffer` is provided, the returned errors will contain line numbers.
 * @param {Object} [styleSpec] The style specification to validate against.
 *     If omitted, the spec version is inferred from the stylesheet.
 * @returns {Array<ValidationError|ParsingError>}
 * @example
 *   var validate = require('maplibre-gl-style-spec').validate;
 *   var style = fs.readFileSync('./style.json', 'utf8');
 *   var errors = validate(style);
 */

export default function validateStyle(style: StyleSpecification | string | Buffer, styleSpec = v8): Array<ValidationError> {
    let s = style;

    try {
        s = readStyle(s);
    } catch (e) {
        return [e];
    }

    return validateStyleMin(s, styleSpec);
}

export const source = validateStyleMin.source;
export const light = validateStyleMin.light;
export const terrain = validateStyleMin.terrain;
export const layer = validateStyleMin.layer;
export const filter = validateStyleMin.filter;
export const paintProperty = validateStyleMin.paintProperty;
export const layoutProperty = validateStyleMin.layoutProperty;
