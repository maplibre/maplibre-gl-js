/**
 * Splitting text into the units that get drawn, and into the words they can be wrapped at.
 *
 * A codepoint is not a unit of writing. `שְׁ` is a letter with two vowel points under it, `दि` is a
 * consonant with a vowel sign written *before* it, and `ल्ली` is three consonants fused into one
 * shape. Laid out a codepoint at a time, each of those comes apart. Laid out a grapheme cluster at a
 * time — and drawn a cluster at a time — each of them holds together, because the browser's own text
 * engine draws the cluster correctly when it is handed the whole cluster.
 *
 * `Intl.Segmenter` is what decides where the clusters and the words are. Its cluster rules are the
 * ones CLDR tailors for stepping a cursor through text, which is not quite the same question as
 * where the units of writing are, so {@link canCombineGraphemes} puts back the boundaries that
 * tailoring introduces.
 */

import {canCombineGraphemes} from './unicode_properties.g.ts';

/**
 * Built once: constructing a segmenter is expensive relative to using one, and these are called for
 * every label of every tile.
 */
const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;
const graphemeSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null;
const wordSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, {granularity: 'word'}) : null;

/**
 * Whether this environment can tell where the grapheme clusters are. Where it cannot, everything
 * falls back to one codepoint at a time, which is what MapLibre has always done.
 */
export const supportsGraphemeSegmentation: boolean = graphemeSegmenter !== null;

/**
 * Splits text into grapheme clusters, or into codepoints where the environment cannot do better.
 *
 * Clusters the segmenter separates but a font draws as one shape are put back together first: see
 * {@link canCombineGraphemes}.
 */
export function toGraphemes(text: string): string[] {
    if (!graphemeSegmenter) return [...text];

    const graphemes: string[] = [];
    for (const {segment} of graphemeSegmenter.segment(text)) {
        const last = graphemes.length - 1;
        if (last >= 0 && canCombineGraphemes(graphemes[last], segment)) {
            graphemes[last] += segment;
        } else {
            graphemes.push(segment);
        }
    }
    return graphemes;
}

/**
 * The offsets, counted in UTF-16 code units, at which a word begins.
 *
 * These are the places a line may be broken. Leaving it to the segmenter rather than to a table of
 * punctuation brings word wrapping to writing systems that do not put spaces between words, such as
 * Thai and Khmer, because the browser has the dictionaries needed to find the words. It also keeps
 * CJK compounds together, and honours the zero-width space hints some tilesets insert, without
 * either having to be spelled out here.
 *
 * Without a segmenter, this falls back to the boundaries a regular expression can find: where a word
 * character meets a non-word one, and before each ideograph, so that a run of them can still wrap.
 */
export function wordBoundaries(text: string): Set<number> {
    const boundaries = new Set<number>();

    if (wordSegmenter) {
        for (const {index} of wordSegmenter.segment(text)) {
            boundaries.add(index);
        }
        return boundaries;
    }

    let index = 0;
    for (const part of text.split(/\b|(?=\p{Ideo})/u)) {
        boundaries.add(index);
        index += part.length;
    }
    return boundaries;
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
