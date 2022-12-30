import validateObject from './validate_object';
import validateString from './validate_string';
import ValidationError from '../error/validation_error';

interface ValidateSpriteOptions {
    key: 'sprite';
    value: unknown; // we don't know how the user defined the "sprite"
    validateSpec: Function;
}

export default function validateSprite(options: ValidateSpriteOptions) {
    let errors = [];

    const sprite = options.value;
    const key = options.key;

    if (!Array.isArray(sprite)) {
        return validateString({
            key,
            value: sprite
        });

    } else {
        const allSpriteIds = [];
        const allSpriteURLs = [];

        for (const i in sprite) {
            if (sprite[i].id && allSpriteIds.includes(sprite[i].id)) errors.push(new ValidationError(key, sprite, `all the sprites' ids must be unique, but ${sprite[i].id} is duplicated`));
            allSpriteIds.push(sprite[i].id);

            if (sprite[i].url && allSpriteURLs.includes(sprite[i].url)) errors.push(new ValidationError(key, sprite, `all the sprites' URLs must be unique, but ${sprite[i].url} is duplicated`));
            allSpriteURLs.push(sprite[i].url);

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
                key: `${key}[${i}]`,
                value: sprite[i],
                valueSpec: pairSpec,
                validateSpec: options.validateSpec,
            }));
        }

        return errors;
    }
}
