import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validateNumber from './validate_number';

export default function validatePadding(options) {
    const key = options.key;
    const value = options.value;
    const type = getType(value);

    if (type === 'array') {
        if (value.length < 1 || value.length > 4) {
            return [new ValidationError(key, value, `padding requires 1 to 4 values; ${value.length} values found`)];
        }

        const arrayElementSpec = {
            type: 'number'
        };

        let errors = [];
        for (let i = 0; i < value.length; i++) {
            errors = errors.concat(options.validateSpec({
                key: `${key}[${i}]`,
                value: value[i],
                validateSpec: options.validateSpec,
                valueSpec: arrayElementSpec
            }));
        }
        return errors;
    } else {
        return validateNumber({
            key,
            value,
            valueSpec: {}
        });
    }
}
