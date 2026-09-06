import bidiFactory from 'bidi-js';
import {toGraphemes} from '../util/graphemes.ts';

const bidi = bidiFactory();

/**
 * The characters that steer the bidirectional algorithm without being written.
 *
 * They have done their work by the time the text has been reordered, and no font draws them, so
 * they are dropped rather than passed on to be looked up in a glyph atlas.
 */
const BIDI_CONTROLS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

/**
 * The character types rule L1 resets to the paragraph's own direction.
 *
 * Trailing spaces belong to the paragraph rather than to the run they follow, so a line of Hebrew
 * ending in a space does not put that space on the wrong end of the line.
 */
const NEUTRAL_AT_END_OF_LINE = new Set(['WS', 'FSI', 'LRI', 'RLI', 'PDI']);

/** The character types rule L1 resets wherever they appear, along with the whitespace before them. */
const ALWAYS_RESET = new Set(['S', 'B']);

/** One grapheme cluster of the text, with everything the reordering rules need to place it. */
type Cluster = {
    /** Where the cluster starts, in UTF-16 code units. */
    index: number;
    text: string;
    level: number;
};

/**
 * Splits a line into grapheme clusters, tagging each with the embedding level of its first character.
 *
 * Reordering whole clusters is what rule L3 asks for by another route: a letter and the marks
 * written on it move as one, so reversing a right-to-left run cannot leave the marks stranded before
 * their letter, and layout gets back the same units of writing it asked for glyphs for.
 */
function toClusters(text: string, levels: Uint8Array, start: number, end: number): Cluster[] {
    const clusters: Cluster[] = [];
    let index = start;
    for (const cluster of toGraphemes(text.slice(start, end))) {
        clusters.push({index, text: cluster, level: levels[index]});
        index += cluster.length;
    }
    return clusters;
}

/**
 * Applies rule L1, which hands whitespace at the end of a line back to the paragraph's direction.
 *
 * Without it a line of right-to-left text that ends in a space would be drawn with that space on
 * its left, where the reader does not expect it.
 */
function resetTrailingNeutrals(clusters: Cluster[], paragraphLevel: number): void {
    let trailing = true;
    for (let i = clusters.length - 1; i >= 0; i--) {
        const type = bidi.getBidiCharTypeName(clusters[i].text[0]);
        if (ALWAYS_RESET.has(type)) {
            clusters[i].level = paragraphLevel;
            trailing = true;
        } else if (trailing && NEUTRAL_AT_END_OF_LINE.has(type)) {
            clusters[i].level = paragraphLevel;
        } else {
            trailing = false;
        }
    }
}

/**
 * Applies rule L2, which turns embedding levels into the order the text is read on screen.
 *
 * Each level from the deepest down to the shallowest odd one reverses every run of characters at
 * that level or deeper, so nesting a quotation in one direction inside a sentence in the other comes
 * out right however far the nesting goes.
 */
function reorder(clusters: Cluster[], paragraphLevel: number): Cluster[] {
    let highest = paragraphLevel;
    let lowestOdd = Infinity;
    for (const {level} of clusters) {
        if (level > highest) highest = level;
        if ((level | 1) < lowestOdd) lowestOdd = level | 1;
    }

    const ordered = clusters.slice();
    for (let level = highest; level >= lowestOdd; level--) {
        for (let start = 0; start < ordered.length; start++) {
            if (ordered[start].level < level) continue;
            let end = start;
            while (end + 1 < ordered.length && ordered[end + 1].level >= level) end++;
            for (let i = start, j = end; i < j; i++, j--) {
                [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
            }
            start = end;
        }
    }
    return ordered;
}

/**
 * Swaps a bracket for its mirror image where it is read right to left.
 *
 * An opening parenthesis in Hebrew text is drawn as the shape that opens in that direction, which is
 * the one Unicode calls a closing parenthesis.
 */
function mirror(cluster: Cluster): string {
    if (cluster.level % 2 === 0) return cluster.text;
    return bidi.getMirroredCharacter(cluster.text) ?? cluster.text;
}

/** The paragraph a line falls in, which is what its direction is taken from. */
function paragraphLevelAt(paragraphs: Array<{ start: number; end: number; level: number }>, start: number): number {
    return paragraphs.find(paragraph => start >= paragraph.start && start <= paragraph.end)?.level ?? 0;
}

/** A line of a label, put into the order it is read and stripped of the characters nothing draws. */
type ReorderedLine = {
    text: string;
    /** The code unit of the original text each code unit of {@link ReorderedLine.text} came from. */
    sourceIndices: number[];
};

/**
 * Puts one line into visual order.
 *
 * Reordering happens a grapheme cluster at a time, so a letter and the marks written on it stay
 * together however the line is rearranged.
 */
function reorderLine(
    text: string,
    levels: Uint8Array,
    paragraphLevel: number,
    start: number,
    end: number
): ReorderedLine {
    const clusters = toClusters(text, levels, start, end);
    resetTrailingNeutrals(clusters, paragraphLevel);

    let reorderedText = '';
    const sourceIndices: number[] = [];
    for (const cluster of reorder(clusters, paragraphLevel)) {
        if (BIDI_CONTROLS.test(cluster.text)) continue;
        const mirrored = mirror(cluster);
        reorderedText += mirrored;
        sourceIndices.push(...Array(mirrored.length).fill(cluster.index));
    }
    return {text: reorderedText, sourceIndices};
}

/**
 * The `[start, end)` code unit range of each line, given every offset the label is to be broken at.
 *
 * The offsets are put in order and duplicates dropped, because a line asked to break where a
 * paragraph already ends should be one line rather than an empty one and a full one.
 */
function lineRanges(text: string, breakPoints: number[]): Array<[number, number]> {
    const inside = breakPoints.filter(point => point > 0 && point < text.length);
    const bounds = [...new Set([0, ...inside, text.length])].sort((a, b) => a - b);

    const ranges: Array<[number, number]> = [];
    for (let i = 0; i + 1 < bounds.length; i++) {
        ranges.push([bounds[i], bounds[i + 1]]);
    }
    return ranges;
}

/**
 * Reorders every line of a label, keeping where each code unit came from.
 *
 * A label is broken where it was asked to be broken and wherever a paragraph ends. The separators
 * that end a paragraph are the ones the bidirectional algorithm reads its direction afresh after,
 * so a line may not run across one however wide it is.
 */
function processLines(text: string, lineBreakPoints: number[]): ReorderedLine[] {
    const {levels, paragraphs} = bidi.getEmbeddingLevels(text);
    const breakPoints = lineBreakPoints.concat(paragraphs.map(paragraph => paragraph.start));

    return lineRanges(text, breakPoints).map(([start, end]) =>
        reorderLine(text, levels, paragraphLevelAt(paragraphs, start), start, end));
}

/**
 * Puts text into the order it is read on screen, and breaks it into lines.
 *
 * @param text - a whole label in logical order
 * @param lineBreakPoints - the code unit offsets the label is to be broken at
 * @returns one string per line, each in visual order
 */
export function processBidirectionalText(text: string, lineBreakPoints: number[]): string[] {
    return processLines(text, lineBreakPoints).map(line => line.text);
}

/**
 * The same as {@link processBidirectionalText}, carrying each code unit's formatting section with it
 * so that a label built out of several `format` sections keeps its styling once reordered.
 *
 * @param text - a whole label in logical order
 * @param styleIndices - the section each code unit of `text` belongs to
 * @param lineBreakPoints - the code unit offsets the label is to be broken at
 * @returns one `[line, styleIndices]` pair per line, each in visual order
 */
export function processStyledBidirectionalText(
    text: string,
    styleIndices: number[],
    lineBreakPoints: number[]
): Array<[string, number[]]> {
    return processLines(text, lineBreakPoints).map(line =>
        [line.text, line.sourceIndices.map(index => styleIndices[index] ?? 0)]);
}
