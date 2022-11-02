import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import validateString from './validate_string';
import validateSpec from './validate';

export default function validateSprite(options) {
    const errors = [];

    const sprite = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;

    console.log('HERE');
    console.log(sprite);
    console.log(key);
    console.log(style);
    console.log(styleSpec);

    return validateSpec({
        key: `${key}.type`,
        value: sprite,
        valueSpec: styleSpec.sprite,
        style: options.style,
        styleSpec: options.styleSpec,
        object: sprite,
        objectKey: 'type'
    });

    // if (sprite === 'array') {
    //
    //     // const sprite = Sprite.parse(value);
    //     // if (!sprite) errors.push(new ValidationError(key, value, 'bad sprite'));
    //
    //     return errors;
    // } else {
    //     return validateString({
    //         key,
    //         sprite,
    //         valueSpec: {}
    //     });
    // }
}
