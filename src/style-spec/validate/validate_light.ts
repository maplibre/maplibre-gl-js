import ValidationError from '../error/validation_error';
import getType from '../util/get_type';

export default function validateLight(options) {
    const light = options.value;
    const styleSpec = options.styleSpec;
    const lightSpec = styleSpec.light;
    const style = options.style;

    let errors = [];

    const rootType = getType(light);
    if (light === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('light', light, `object expected, ${rootType} found`)]);
        return errors;
    }

    for (const key in light) {
        const transitionMatch = key.match(/^(.*)-transition$/);

        if (transitionMatch && lightSpec[transitionMatch[1]] && lightSpec[transitionMatch[1]].transition) {
            errors = errors.concat(options.validateSpec({
                key,
                value: light[key],
                valueSpec: styleSpec.transition,
                validateSpec: options.validateSpec,
                style,
                styleSpec
            }));
        } else if (lightSpec[key]) {
            errors = errors.concat(options.validateSpec({
                key,
                value: light[key],
                valueSpec: lightSpec[key],
                validateSpec: options.validateSpec,
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, light[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
