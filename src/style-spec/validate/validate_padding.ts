import ValidationError from '../error/validation_error';
import getType from '../util/get_type';

export default function validatePadding(options) {
    const key = options.key;
    const value = options.value;
    const type = getType(value);

    if (type !== 'number' && type !== 'array') {
        return [new ValidationError(key, value, `padding expected, ${type} found`)];
    }

    if (type === 'array') {
        if (value.length < 1 || value.length > 4) {
            return [new ValidationError(key, value, `padding requires 1 to 4 values; ${value.length} values found`)];
        }

        for (const val of value) {
            if (typeof val !== 'number') {
                return [new ValidationError(key, value, `padding required numeric values; ${JSON.stringify(value)} found`)];
            }
        }
    }

    return [];
}
