import type {Formatted, FormattedSection, VerticalAlign} from '@maplibre/maplibre-gl-style-spec';

import ONE_EM from './one_em.ts';
import type {ImagePosition} from '../render/image_atlas.ts';
import type {StyleGlyph} from '../style/style_glyph.ts';
import {verticalizePunctuation} from '../util/verticalize_punctuation.ts';
import {toGraphemes, wordBoundaries} from '../util/graphemes.ts';
import {charIsWhitespace} from '../util/script_detection.ts';
import {codePointAllowsIdeographicBreaking, codePointIsWrittenWithoutSpaces} from '../util/unicode_properties.g.ts';
import {warnOnce} from '../util/util.ts';

export type TextSectionOptions = {
    scale: number;
    verticalAlign: VerticalAlign;
    fontStack: string;
};

export type ImageSectionOptions = {
    scale: number;
    verticalAlign: VerticalAlign;
    imageName: string;
};

export type SectionOptions = TextSectionOptions | ImageSectionOptions;

// Max number of images in label is 6401 U+E000–U+F8FF that covers
// Basic Multilingual Plane Unicode Private Use Area (PUA).
const PUAbegin = 0xE000;
const PUAend = 0xF8FF;

type Break = {
    index: number;
    x: number;
    priorBreak: Break;
    badness: number;
};

// using computed properties due to https://github.com/facebook/flow/issues/380
/* eslint no-useless-computed-key: 0 */

/**
 * Characters a line may end on.
 */
const breakable: Record<number, boolean> = {
    [0x0a]: true, // newline
    [0x0d]: true, // carriage return, on its own or starting a CRLF cluster
    [0x20]: true, // space
    [0x26]: true, // ampersand
    [0x29]: true, // right parenthesis
    [0x2b]: true, // plus sign
    [0x2d]: true, // hyphen-minus
    [0x2f]: true, // solidus
    [0xad]: true, // soft hyphen
    [0xb7]: true, // middle dot
    [0x200b]: true, // zero-width space
    [0x2010]: true, // hyphen
    [0x2013]: true, // en dash
    [0x2027]: true  // interpunct
    // Many other characters may be reasonable breakpoints
    // Consider "neutral orientation" characters in codePointHasNeutralVerticalOrientation in unicode_properties
    // See https://github.com/mapbox/mapbox-gl-js/issues/3658
};

/**
 * Characters a line may begin with, whatever precedes them.
 */
const breakableBefore: Record<number, boolean> = {
    [0x28]: true, // left parenthesis
};

/**
 * Returns how far a grapheme cluster advances the pen, including any letter spacing after it.
 *
 * Where a font file covers the cluster it advances as the one shape it is drawn as. Where none does
 * it is drawn a codepoint at a time, and has to be measured the same way. See `shapeLines`.
 */
function getGlyphAdvance(
    grapheme: string,
    section: SectionOptions,
    glyphMap: Record<string, Record<string, StyleGlyph>>,
    imagePositions: Record<string, ImagePosition>,
    spacing: number,
    layoutTextSize: number
): number {
    if ('fontStack' in section) {
        const positions = glyphMap[section.fontStack];
        const glyph = positions?.[grapheme];
        if (glyph) return glyph.metrics.advance * section.scale + spacing;

        let advance = 0;
        for (const char of grapheme) {
            const fallback = positions?.[char];
            if (fallback) advance += fallback.metrics.advance * section.scale + spacing;
        }
        return advance;
    } else {
        const imagePosition = imagePositions[section.imageName];
        if (!imagePosition) return 0;
        return imagePosition.displaySize[0] * section.scale * ONE_EM / layoutTextSize + spacing;
    }
}

function calculateBadness(lineWidth: number,
    targetWidth: number,
    penalty: number,
    isLastBreak: boolean) {
    const raggedness = Math.pow(lineWidth - targetWidth, 2);
    if (isLastBreak) {
        // Favor finals lines shorter than average over longer than average
        if (lineWidth < targetWidth) {
            return raggedness / 2;
        } else {
            return raggedness * 2;
        }
    }

    return raggedness + Math.abs(penalty) * penalty;
}

/**
 * Whether a grapheme cluster is entirely whitespace, and so can be trimmed off the end of a line.
 */
function isWhitespaceGrapheme(grapheme: string): boolean {
    return /^\s+$/u.test(grapheme);
}

/**
 * Scores a candidate break, lower being better: a newline is one the text asked for, an opening
 * bracket left at the end of a line is merely allowed.
 *
 * `codePoint` and `nextCodePoint` are the first codepoints of the clusters either side, which is
 * what decides how a cluster breaks -- a CRLF is one cluster, so a newline is seen as its CR.
 *
 * @param penalizableIdeographicBreak - whether this falls between ideographs in text that also
 * carries zero-width space hints, which are the better places to break
 */
function calculatePenalty(codePoint: number, nextCodePoint: number, penalizableIdeographicBreak: boolean) {
    let penalty = 0;
    if (codePoint === 0x0a || codePoint === 0x0d) {
        penalty -= 10000;
    }
    if (penalizableIdeographicBreak) {
        penalty += 150;
    }
    if (codePoint === 0x28 || codePoint === 0xff08) {
        penalty += 50;
    }
    if (nextCodePoint === 0x29 || nextCodePoint === 0xff09) {
        penalty += 50;
    }
    return penalty;
}

function evaluateBreak(
    breakIndex: number,
    breakX: number,
    targetWidth: number,
    potentialBreaks: Break[],
    penalty: number,
    isLastBreak: boolean
): Break {
    // We could skip evaluating breaks where the line length (breakX - priorBreak.x) > maxWidth
    //  ...but in fact we allow lines longer than maxWidth (if there's no break points)
    //  ...and when targetWidth and maxWidth are close, strictly enforcing maxWidth can give
    //     more lopsided results.

    let bestPriorBreak: Break = null;
    let bestBreakBadness = calculateBadness(breakX, targetWidth, penalty, isLastBreak);

    for (const potentialBreak of potentialBreaks) {
        const lineWidth = breakX - potentialBreak.x;
        const breakBadness =
            calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) + potentialBreak.badness;
        if (breakBadness <= bestBreakBadness) {
            bestPriorBreak = potentialBreak;
            bestBreakBadness = breakBadness;
        }
    }

    return {
        index: breakIndex,
        x: breakX,
        priorBreak: bestPriorBreak,
        badness: bestBreakBadness
    };
}

function leastBadBreaks(lastLineBreak?: Break | null): number[] {
    if (!lastLineBreak) {
        return [];
    }
    return leastBadBreaks(lastLineBreak.priorBreak).concat(lastLineBreak.index);
}

export class TaggedString {
    text: string;
    sections: SectionOptions[];
    /** Maps each grapheme cluster in `text` to its corresponding entry in `sections`. */
    sectionIndex: number[];
    imageSectionID: number | null;
    /**
     * `text` split into the units it is laid out in. Derived from `text`, so anything that changes
     * `text` clears it.
     */
    _graphemes: string[] | null;

    constructor(text: string = '', sections: SectionOptions[] = [], sectionIndex: number[] = []) {
        this.text = text;
        this.sections = sections;
        this.sectionIndex = sectionIndex;
        this.imageSectionID = null;
        this._graphemes = null;
    }

    /**
     * The units this text is laid out in: grapheme clusters, so that a letter and the marks that
     * belong to it stay together.
     */
    graphemes(): string[] {
        this._graphemes ??= toGraphemes(this.text);
        return this._graphemes;
    }

    static fromFeature(text: Formatted, defaultFontStack: string): TaggedString {
        const result = new TaggedString();
        for (const section of text.sections) {
            if (!section.image) {
                result.addTextSection(section, defaultFontStack);
            } else {
                result.addImageSection(section);
            }
        }
        return result;
    }

    length(): number {
        return this.graphemes().length;
    }

    getSection(index: number): SectionOptions {
        return this.sections[this.sectionIndex[index]];
    }

    getSectionIndex(index: number): number {
        return this.sectionIndex[index];
    }

    verticalizePunctuation(): void {
        this.text = verticalizePunctuation(this.text);
        this._graphemes = null;
    }

    /**
     * Returns whether the text contains zero-width spaces.
     *
     * Some tilesets such as Streets insert ZWSPs as hints for line
     * breaking in CJK text.
     */
    hasZeroWidthSpaces(): boolean {
        return this.text.includes('\u200b');
    }

    /**
     * Drops the whitespace at each end of the line.
     *
     * Counted in clusters, which is what `sectionIndex` is indexed by: a CRLF is one cluster of two
     * code units, so counting code units would leave the sections short of the text.
     */
    trim(): void {
        const graphemes = this.graphemes();
        let start = 0;
        while (start < graphemes.length && isWhitespaceGrapheme(graphemes[start])) start++;
        let end = graphemes.length;
        while (end > start && isWhitespaceGrapheme(graphemes[end - 1])) end--;

        this.text = graphemes.slice(start, end).join('');
        this.sectionIndex = this.sectionIndex.slice(start, end);
        this._graphemes = null;
    }

    substring(start: number, end: number): TaggedString {
        const text = this.graphemes().slice(start, end).join('');
        const sectionIndex = this.sectionIndex.slice(start, end);
        return new TaggedString(text, this.sections, sectionIndex);
    }

    /**
     * Converts a grapheme cluster index to a UTF-16 code unit (JavaScript character index).
     */
    toCodeUnitIndex(graphemeIndex: number): number {
        return this.graphemes().slice(0, graphemeIndex).join('').length;
    }

    toString(): string {
        return this.text;
    }

    getMaxScale(): number {
        return this.sectionIndex.reduce((max, index) => Math.max(max, this.sections[index].scale), 0);
    }

    getMaxImageSize(imagePositions: Record<string, ImagePosition>): {
        maxImageWidth: number;
        maxImageHeight: number;
    } {
        let maxImageWidth = 0;
        let maxImageHeight = 0;
        for (let i = 0; i < this.length(); i++) {
            const section = this.getSection(i);
            if ('imageName' in section) {
                const imagePosition = imagePositions[section.imageName];
                if (!imagePosition) continue;
                const size = imagePosition.displaySize;
                maxImageWidth = Math.max(maxImageWidth, size[0]);
                maxImageHeight = Math.max(maxImageHeight, size[1]);
            }
        }
        return {maxImageWidth, maxImageHeight};
    }

    /**
     * Appends one section's text, recording which section each cluster it adds belongs to.
     *
     * A cluster belongs to the section its first character came from, so a section that only joins
     * the cluster before it -- an accent given its own formatting -- adds none of its own. Only the
     * last cluster and the new text are segmented, not the label from the start.
     */
    _appendSection(text: string, sectionIndex: number): void {
        const graphemes = this.graphemes();
        const tail = graphemes.length > 0 ? graphemes[graphemes.length - 1] : '';
        const joined = toGraphemes(tail + text);

        this.text += text;
        this._graphemes = graphemes.slice(0, tail ? -1 : undefined).concat(joined);

        const added = joined.length - (tail ? 1 : 0);
        for (let i = 0; i < added; i++) {
            this.sectionIndex.push(sectionIndex);
        }
    }

    addTextSection(section: FormattedSection, defaultFontStack: string): void {
        this.sections.push({
            scale: section.scale || 1,
            verticalAlign: section.verticalAlign || 'bottom',
            fontStack: section.fontStack || defaultFontStack,
        });
        this._appendSection(section.text, this.sections.length - 1);
    }

    addImageSection(section: FormattedSection): void {
        const imageName = section.image ? section.image.name : '';
        if (imageName.length === 0) {
            warnOnce('Can\'t add FormattedSection with an empty image.');
            return;
        }

        const nextImageSectionCharCode = this.getNextImageSectionCharCode();
        if (!nextImageSectionCharCode) {
            warnOnce(`Reached maximum number of images ${PUAend - PUAbegin + 2}`);
            return;
        }

        this.sections.push({
            scale: 1,
            verticalAlign: section.verticalAlign || 'bottom',
            imageName,
        });
        this._appendSection(String.fromCharCode(nextImageSectionCharCode), this.sections.length - 1);
    }

    getNextImageSectionCharCode(): number | null {
        if (!this.imageSectionID) {
            this.imageSectionID = PUAbegin;
            return this.imageSectionID;
        }

        if (this.imageSectionID >= PUAend) return null;
        return ++this.imageSectionID;
    }

    /**
     * Returns the cluster indices to break at for lines of roughly `maxWidth`, weighing each
     * candidate by how ragged it leaves the line.
     *
     * Breaks fall between clusters, never inside one, at a character or image a line may end on --
     * plus, in scripts that do not space their words and so offer no such character, wherever the
     * word segmenter finds a word. It is not consulted elsewhere, isolating a comma as a word of its
     * own, nor until such a script turns up, costing more than the rest of this put together.
     */
    determineLineBreaks(
        spacing: number,
        maxWidth: number,
        glyphMap: Record<string, Record<string, StyleGlyph>>,
        imagePositions: Record<string, ImagePosition>,
        layoutTextSize: number
    ): number[] {
        const potentialLineBreaks = [];
        const targetWidth = this.determineAverageLineWidth(spacing, maxWidth, glyphMap, imagePositions, layoutTextSize);

        const hasZeroWidthSpaces = this.hasZeroWidthSpaces();

        const graphemes = this.graphemes();
        let wordStarts: Set<number> | null = null;

        let currentX = 0;
        let codeUnit = 0;

        for (let i = 0; i < graphemes.length; i++) {
            const grapheme = graphemes[i];

            if (i > 0) {
                const previousCodePoint = graphemes[i - 1].codePointAt(0);
                const codePoint = grapheme.codePointAt(0);
                const ideographicBreak = codePointAllowsIdeographicBreaking(previousCodePoint);
                const withinAWordlessScript = codePointIsWrittenWithoutSpaces(previousCodePoint) &&
                    codePointIsWrittenWithoutSpaces(codePoint);

                if (breakable[previousCodePoint] ||
                    ideographicBreak ||
                    'imageName' in this.getSection(i - 1) ||
                    (graphemes[i + 1] !== undefined && breakableBefore[codePoint]) ||
                    (withinAWordlessScript && (wordStarts ??= wordBoundaries(this.text)).has(codeUnit))) {
                    potentialLineBreaks.push(
                        evaluateBreak(
                            i,
                            currentX,
                            targetWidth,
                            potentialLineBreaks,
                            calculatePenalty(previousCodePoint, codePoint, ideographicBreak && hasZeroWidthSpaces),
                            false));
                }
            }

            const codePoint = grapheme.codePointAt(0);
            if (!charIsWhitespace(codePoint)) {
                currentX += getGlyphAdvance(grapheme, this.getSection(i), glyphMap, imagePositions, spacing, layoutTextSize);
            }
            codeUnit += grapheme.length;
        }

        return leastBadBreaks(
            evaluateBreak(
                this.length(),
                currentX,
                targetWidth,
                potentialLineBreaks,
                0,
                true));
    }

    determineAverageLineWidth(
        spacing: number,
        maxWidth: number,
        glyphMap: Record<string, Record<string, StyleGlyph>>,
        imagePositions: Record<string, ImagePosition>,
        layoutTextSize: number): number {
        let totalWidth = 0;

        let index = 0;
        for (const grapheme of this.graphemes()) {
            const section = this.getSection(index);
            totalWidth += getGlyphAdvance(grapheme, section, glyphMap, imagePositions, spacing, layoutTextSize);
            index++;
        }

        const lineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
        return totalWidth / lineCount;
    }
}
