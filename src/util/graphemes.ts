import {canCombineGraphemes, textCanContainGraphemeClusters} from './unicode_properties.g.ts';

const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;

/**
 * Decides where the grapheme clusters are, following the rules CLDR tailors for stepping a cursor
 * through text -- not quite the same question as where the units of writing are, which is what
 * {@link canCombineGraphemes} corrects for.
 *
 * Built once: constructing a segmenter is expensive relative to using one, and this is reached for
 * every label of every tile.
 */
const graphemeSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null;

/**
 * Decides where the words are, drawing on the browser's own dictionaries. Built once, for the same
 * reason as {@link graphemeSegmenter}.
 */
const wordSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, {granularity: 'word'}) : null;

/**
 * Whether this environment can tell where the grapheme clusters are. Where it cannot, everything
 * falls back to one codepoint at a time, which is what MapLibre has always done.
 */
export const supportsGraphemeSegmentation: boolean = graphemeSegmenter !== null;

/**
 * Splits text into grapheme clusters, or into codepoints where the environment cannot do better.
 *
 * A codepoint is not a unit of writing. `שְׁ` is a letter with two vowel points under it, `दि` is a
 * consonant with a vowel sign written *before* it, and `ल्ली` is three consonants fused into one
 * shape. Laid out a codepoint at a time, each of those comes apart; laid out -- and drawn -- a
 * cluster at a time, each holds together, because the browser's text engine shapes the cluster
 * correctly when it is handed the whole of it.
 *
 * Clusters the segmenter separates but a font draws as one shape are put back together first: see
 * {@link canCombineGraphemes}.
 *
 * Text that holds none of the characters a cluster can be built from skips the segmenter, which
 * costs far more than the one test that rules it out. Most labels are of that kind.
 */
export function toGraphemes(text: string): string[] {
    if (!graphemeSegmenter || !textCanContainGraphemeClusters(text)) return [...text];

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
