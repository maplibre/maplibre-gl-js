import {canCombineGraphemes, textCanContainGraphemeClusters} from './unicode_properties.g.ts';

const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;

/**
 * Decides where the grapheme clusters are. Built on first use, being reached for by every label of
 * every tile, and corrected by {@link canCombineGraphemes} where CLDR's cursor rules split a unit of
 * writing.
 *
 * Constructing the first `Intl.Segmenter` makes the engine load and initialize its ICU break rules,
 * which takes several milliseconds on the main thread. Only text shaping needs a segmenter, and that
 * runs in the workers, so building it while the module is evaluated would charge every page that
 * imports MapLibre for work it may never do. It is built lazily instead.
 */
let graphemeSegmenter: Intl.Segmenter | null | undefined;

/**
 * Decides where the words are, drawing on the browser's own dictionaries. Built on first use, see
 * {@link graphemeSegmenter}.
 */
let wordSegmenter: Intl.Segmenter | null | undefined;

function getGraphemeSegmenter(): Intl.Segmenter | null {
    if (graphemeSegmenter === undefined) {
        graphemeSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null;
    }
    return graphemeSegmenter;
}

function getWordSegmenter(): Intl.Segmenter | null {
    if (wordSegmenter === undefined) {
        wordSegmenter = hasSegmenter ? new Intl.Segmenter(undefined, {granularity: 'word'}) : null;
    }
    return wordSegmenter;
}

/**
 * Whether this environment can find grapheme clusters. Without it everything falls back to
 * codepoints, as MapLibre always did.
 */
export const supportsGraphemeSegmentation: boolean = hasSegmenter;

/**
 * Splits text into grapheme clusters, or into codepoints where the environment cannot do better.
 *
 * A codepoint is not a unit of writing: `שְׁ` is a letter with two vowel points under it, which comes
 * apart when drawn a codepoint at a time and holds together when drawn as one cluster.
 *
 * Text holding none of the characters a cluster can be built from skips the segmenter, which costs
 * far more than the test that rules it out.
 */
export function toGraphemes(text: string): string[] {
    if (!hasSegmenter || !textCanContainGraphemeClusters(text)) return [...text];

    const graphemes: string[] = [];
    for (const {segment} of getGraphemeSegmenter().segment(text)) {
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
 * The offsets, in UTF-16 code units, at which a word begins.
 *
 * Only scripts that do not space their words ask for these, having no punctuation to break a line
 * at. Without a segmenter, falls back to the boundaries a regular expression can find.
 */
export function wordBoundaries(text: string): Set<number> {
    const boundaries = new Set<number>();

    const wordSegmenter = getWordSegmenter();
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
 * Whether a grapheme is more than one codepoint, and so has to be drawn as a whole.
 *
 * Written without allocating: this runs over every grapheme of every label.
 */
export function isCluster(grapheme: string): boolean {
    const first = grapheme.codePointAt(0);
    return grapheme.length > (first > 0xffff ? 2 : 1);
}
