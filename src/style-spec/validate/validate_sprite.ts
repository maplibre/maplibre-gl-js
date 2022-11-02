import getType from '../util/get_type';
import validate from './validate';
import validateString from './validate_string';

export default function validateSprite(options) {
    const key = options.key;
    const value = options.value;
    const type = getType(value);

    console.log(options);

    if (type === 'array') {
        const arrayElementSpec = {
            type: 'number'
        };

        let errors = [];
        for (let i = 0; i < value.length; i++) {
            errors = errors.concat(validate({
                key: `${key}[${i}]`,
                value: value[i],
                valueSpec: arrayElementSpec
            }));
        }
        return errors;
    } else {
        return validateString({
            key,
            value,
            valueSpec: {}
        });
    }
}
