/**
 * Splitting text into the units that get drawn.
 *
 * A codepoint is not a unit of writing. `שְׁ` is a letter with two vowel points under it, `दि` is a
 * consonant with a vowel sign written *before* it, and `ल्ली` is three consonants fused into one
 * shape. Laid out a codepoint at a time, each of those comes apart. Laid out a grapheme cluster at a
 * time — and drawn a cluster at a time — each of them holds together, because the browser's own text
 * engine draws the cluster correctly when it is handed the whole cluster.
 *
 * `Intl.Segmenter` is what decides where the clusters are. It follows the Unicode text segmentation
 * rules, including the ones added for Indic conjuncts, and every engine agrees on the answer.
 */

/**
 * Built once: constructing a segmenter is expensive relative to using one, and this is called for
 * every label of every tile.
 */
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ?
    new Intl.Segmenter(undefined, {granularity: 'grapheme'}) :
    null;

/**
 * Whether this environment can tell where the grapheme clusters are. Where it cannot, everything
 * falls back to one codepoint at a time, which is what MapLibre has always done.
 */
export const supportsGraphemeSegmentation: boolean = segmenter !== null;

/**
 * Splits text into grapheme clusters, or into codepoints where the environment cannot do better.
 */
export function toGraphemes(text: string): string[] {
    if (!segmenter) return [...text];

    const graphemes: string[] = [];
    for (const {segment} of segmenter.segment(text)) {
        graphemes.push(segment);
    }
    return graphemes;
}

/**
 * Whether a grapheme is made of more than one codepoint, and so is a cluster that has to be drawn as
 * a whole rather than a character that can be drawn on its own.
 *
 * Written without allocating: this runs over every grapheme of every label.
 */
export function isCluster(grapheme: string): boolean {
    const first = grapheme.codePointAt(0);
    return grapheme.length > (first > 0xffff ? 2 : 1);
}
