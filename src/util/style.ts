import {SpriteSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * Takes a SpriteSpecification value and returns it in its array form. If `undefined` is passed as an input value, an
 * empty array is returned.
 * duplicated entries with identical id/url will be removed in returned array
 * @param sprite - optional sprite to coerce
 * @returns an empty array in case `undefined` is passed; id-url pairs otherwise
 */
export function coerceSpriteToArray(sprite?: SpriteSpecification): {id: string; url: string}[] {
    const resultArray: {id: string; url: string}[]  = [];

    if (typeof sprite === 'string') {
        resultArray.push({id: 'default', url: sprite});
    } else if (sprite && sprite.length > 0) {
        const dedupArray: string[] = [];
        for (const {id, url} of sprite) {
            const key = `${id}${url}`;
            if (dedupArray.indexOf(key) === -1) {
                dedupArray.push(key);
                resultArray.push({id, url});
            }
        }
    }

    return resultArray;

}
