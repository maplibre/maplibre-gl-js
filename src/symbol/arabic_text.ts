/**
 * The blocks Arabic is written in, as the inside of a character class. The two blocks of
 * presentation forms are left out: text in them was already rewritten, by a plugin, into shapes
 * that are drawn as they stand.
 */
const arabicBlocks = '\\u0600-\\u06ff\\u0750-\\u077f\\u0870-\\u089f\\u08a0-\\u08ff';

const arabicCharacter = new RegExp(`[${arabicBlocks}]`);
const adjacentArabicCharacters = new RegExp(`(?<=[${arabicBlocks}])(?=[${arabicBlocks}])`, 'gu');
const joinerBetweenArabicCharacters = new RegExp(`(?<=[${arabicBlocks}])\\u200d(?=[${arabicBlocks}])`, 'gu');

/** Zero width joiner, which holds the characters on either side of it in one cluster. */
const ZERO_WIDTH_JOINER = '\u200d';

/** Whether a code point is in the blocks Arabic is written in. */
export function isArabicCodePoint(codePoint: number): boolean {
    return arabicCharacter.test(String.fromCodePoint(codePoint));
}

/**
 * Keeps each word of Arabic together as the one cluster it is written as, so that it is drawn whole,
 * in the shapes the font gives its letters, and not a code point at a time.
 *
 * A zero width joiner is written between each pair of adjacent Arabic characters, and the text is
 * otherwise left as it was written. A zero width non-joiner ends a word, as it ends the joining of
 * the letters on either side of it.
 */
export function joinArabicWords(text: string): string {
    return arabicCharacter.test(text) ? text.replace(adjacentArabicCharacters, ZERO_WIDTH_JOINER) : text;
}

/**
 * The text of a cluster as the font should shape it. The joiners that {@link joinArabicWords} writes
 * would be read by the font as a request to join, which stops it forming the lam-alef ligature and
 * the shapes a letter takes beside a mark.
 */
export function withoutArabicJoiners(cluster: string): string {
    return cluster.replace(joinerBetweenArabicCharacters, '');
}
