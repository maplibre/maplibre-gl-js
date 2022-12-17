
import validateConstants from './validate/validate_constants';
import validate from './validate/validate';
import latestStyleSpec from './reference/latest';
import validateGlyphsURL from './validate/validate_glyphs_url';

import validateSource from './validate/validate_source';
import validateLight from './validate/validate_light';
import validateTerrain from './validate/validate_terrain';
import validateLayer from './validate/validate_layer';
import validateFilter from './validate/validate_filter';
import validatePaintProperty from './validate/validate_paint_property';
import validateLayoutProperty from './validate/validate_layout_property';
import type {StyleSpecification} from './types.g';

/**
 * Validate a MapLibre GL style against the style specification. This entrypoint,
 * `maplibre-gl-style-spec/lib/validate_style.min`, is designed to produce as
 * small a browserify bundle as possible by omitting unnecessary functionality
 * and legacy style specifications.
 *
 * @private
 * @param {Object} style The style to be validated.
 * @param {Object} [styleSpec] The style specification to validate against.
 *     If omitted, the latest style spec is used.
 * @returns {Array<ValidationError>}
 * @example
 *   var validate = require('maplibre-gl-style-spec/lib/validate_style.min');
 *   var errors = validate(style);
 */
function validateStyleMin(style: StyleSpecification, styleSpec = latestStyleSpec) {

    let errors = [];

    errors = errors.concat(validate({
        key: '',
        value: style,
        valueSpec: styleSpec.$root,
        styleSpec,
        style,
        objectElementValidators: {
            glyphs: validateGlyphsURL,
            '*'() {
                return [];
            }
        }
    }));

    if (style['constants']) {
        errors = errors.concat(validateConstants({
            key: 'constants',
            value: style['constants'],
            style,
            styleSpec,
            validateSpec: validate,
        }));
    }

    return sortErrors(errors);
}

validateStyleMin.source = wrapCleanErrors(injectValidateSpec(validateSource));
validateStyleMin.light = wrapCleanErrors(injectValidateSpec(validateLight));
validateStyleMin.terrain = wrapCleanErrors(injectValidateSpec(validateTerrain));
validateStyleMin.layer = wrapCleanErrors(injectValidateSpec(validateLayer));
validateStyleMin.filter = wrapCleanErrors(injectValidateSpec(validateFilter));
validateStyleMin.paintProperty = wrapCleanErrors(injectValidateSpec(validatePaintProperty));
validateStyleMin.layoutProperty = wrapCleanErrors(injectValidateSpec(validateLayoutProperty));

function injectValidateSpec(validator: (options: object) => any) {
    return function(options) {
        return validator({
            ...options,
            validateSpec: validate,
        });
    };
}

function sortErrors(errors) {
    return [].concat(errors).sort((a, b) => {
        return a.line - b.line;
    });
}

function wrapCleanErrors(inner) {
    return function(...args) {
        return sortErrors(inner.apply(this, args));
    };
}

export default validateStyleMin;
