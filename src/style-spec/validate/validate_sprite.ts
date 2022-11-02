import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validateString from './validate_string';

export default function validateSprite(options) {
    const key = options.key;
    const value = options.value;
    const type = getType(value);

    if (type === 'array') {

        const errors = [];

        // const sprite = Sprite.parse(value);
        // if (!sprite) errors.push(new ValidationError(key, value, 'bad sprite'));

        return errors;
    } else {
        return validateString({
            key,
            value,
            valueSpec: {}
        });
    }
}
