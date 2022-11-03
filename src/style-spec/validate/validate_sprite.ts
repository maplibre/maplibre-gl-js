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
