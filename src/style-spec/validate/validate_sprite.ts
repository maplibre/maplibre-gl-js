import validateObject from './validate_object';
import validateString from './validate_string';

export default function validateSprite(options) {
    let errors = [];

    const sprite = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;

    if (Array.isArray(sprite)) {
        for (const pair of sprite) {
            const pairSpec = {
                id: {
                    type: 'string',
                    required: true,
                },
                url: {
                    type: 'string',
                    required: true,
                }
            };

            errors = errors.concat(validateObject({
                key,
                value: pair,
                valueSpec: pairSpec,
                style,
                styleSpec
            }));
        }

        return errors;
    } else {
        return validateString({
            key,
            value: sprite
        });
    }
}
