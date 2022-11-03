import validateObject from './validate_object';
import validateString from './validate_string';
import ValidationError from '../error/validation_error';

export default function validateSprite(options) {
    let errors = [];

    const sprite = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;

    if (Array.isArray(sprite)) {
        const allSpriteIds = [];
        const allSpriteURLs = [];

        for (const pair of sprite) {
            if (allSpriteIds.includes(pair.id)) errors.push(new ValidationError(key, sprite, `all the sprites' ids must be unique, but ${pair.id} is duplicated`));
            allSpriteIds.push(pair.id);

            if (allSpriteURLs.includes(pair.url)) errors.push(new ValidationError(key, sprite, `all the sprites' URLs must be unique, but ${pair.url} is duplicated`));
            allSpriteURLs.push(pair.url);

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
