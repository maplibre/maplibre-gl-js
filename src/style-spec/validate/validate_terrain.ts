import ValidationError from '../error/validation_error';
import getType from '../util/get_type';
import type {StyleSpecification, TerrainSpecification} from '../types.g';
import v8 from '../reference/v8.json' assert {type: 'json'};

export default function validateTerrain(
    options: {value: TerrainSpecification; styleSpec: typeof v8; style: StyleSpecification; validateSpec: Function}
): ValidationError[] {

    const terrain = options.value;
    const styleSpec = options.styleSpec;
    const terrainSpec = styleSpec.terrain;
    const style = options.style;

    let errors = [];

    const rootType = getType(terrain);
    if (terrain === undefined) {
        return errors;
    } else if (rootType !== 'object') {
        errors = errors.concat([new ValidationError('terrain', terrain, `object expected, ${rootType} found`)]);
        return errors;
    }

    for (const key in terrain) {
        if (terrainSpec[key]) {
            errors = errors.concat(options.validateSpec({
                key,
                value: terrain[key],
                valueSpec: terrainSpec[key],
                validateSpec: options.validateSpec,
                style,
                styleSpec
            }));
        } else {
            errors = errors.concat([new ValidationError(key, terrain[key], `unknown property "${key}"`)]);
        }
    }

    return errors;
}
