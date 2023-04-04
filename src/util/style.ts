import {SpriteSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * Takes a SpriteSpecification value and returns it in its array form. If `undefined` is passed as an input value, an
 * empty array is returned.
 *
 * @param [sprite] {SpriteSpecification} optional sprite to coerce
 * @returns {Array} an empty array in case `undefined` is passed; id-url pairs otherwise
 */
export function coerceSpriteToArray(sprite?: SpriteSpecification): {id: string; url: string}[] {
    return typeof sprite === 'string' ? [{id: 'default', url: sprite}] : (sprite ?? []);
}
