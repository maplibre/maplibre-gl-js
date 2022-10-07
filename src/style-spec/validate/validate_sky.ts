import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validate from './validate';

export default function validateSky(options) {
    const sky = options.value;
    const styleSpec = options.styleSpec;
    const skySpec = styleSpec.sky;
    const style = options.style;

    const rootType = getType(sky);
    if (sky === undefined) {
        return [];
    } else if (rootType !== 'object') {
        return [new ValidationError('sky', sky, `object expected, ${rootType} found`)];
    }

    let errors = [];
    for (const key in sky) {
        if (skySpec[key]) {
            errors = errors.concat(validate({
                key,
                value: sky[key],
                valueSpec: skySpec[key],
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, sky[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
