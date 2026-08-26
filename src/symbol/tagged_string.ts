import type {Formatted, FormattedSection, VerticalAlign} from '@maplibre/maplibre-gl-style-spec';

import ONE_EM from './one_em.ts';
import type {ImagePosition} from '../render/image_atlas.ts';
import type {StyleGlyph} from '../style/style_glyph.ts';
import {verticalizePunctuation} from '../util/verticalize_punctuation.ts';
import {toGraphemes} from '../util/graphemes.ts';
import {charIsWhitespace} from '../util/script_detection.ts';
import {codePointAllowsIdeographicBreaking} from '../util/unicode_properties.g.ts';
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

const breakable: {
    [_: number]: boolean;
} = {
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

// Allow breaks depending on the following character
const breakableBefore: {
    [_: number]: boolean;
} = {
    [0x28]: true, // left parenthesis
};

function getGlyphAdvance(
    grapheme: string,
    section: SectionOptions,
    glyphMap: {
        [_: string]: {
            [_: string]: StyleGlyph;
        };
    },
    imagePositions: {[_: string]: ImagePosition},
    spacing: number,
    layoutTextSize: number
): number {
    if ('fontStack' in section) {
        const positions = glyphMap[section.fontStack];
        const glyph = positions?.[grapheme];
        if (glyph) return glyph.metrics.advance * section.scale + spacing;

        // No glyph for the cluster as a whole, so it will be drawn a codepoint at a time and has to
        // be measured the same way. See `shapeLines`.
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

function calculatePenalty(codePoint: number, nextCodePoint: number, penalizableIdeographicBreak: boolean) {
    let penalty = 0;
    // Force break on newline. A CRLF is one grapheme cluster, so what is seen here is its first
    // codepoint, the carriage return.
    if (codePoint === 0x0a || codePoint === 0x0d) {
        penalty -= 10000;
    }
    // Penalize breaks between characters that allow ideographic breaking because
    // they are less preferable than breaks at spaces (or zero width spaces).
    if (penalizableIdeographicBreak) {
        penalty += 150;
    }

    // Penalize open parenthesis at end of line
    if (codePoint === 0x28 || codePoint === 0xff08) {
        penalty += 50;
    }

    // Penalize close parenthesis at beginning of line
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

    trim(): void {
        // Counted in grapheme clusters rather than code units, because that is what `sectionIndex`
        // is indexed by. A CRLF is one cluster of two code units, so counting code units here would
        // take one section too many off the end and leave the sections short of the text.
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

    getMaxImageSize(imagePositions: {[_: string]: ImagePosition}): {
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

    addTextSection(section: FormattedSection, defaultFontStack: string): void {
        this.text += section.text;
        this._graphemes = null;
        this.sections.push({
            scale: section.scale || 1,
            verticalAlign: section.verticalAlign || 'bottom',
            fontStack: section.fontStack || defaultFontStack,
        });
        const index = this.sections.length - 1;
        this.sectionIndex.push(...toGraphemes(section.text).map(() => index));
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

        this.text += String.fromCharCode(nextImageSectionCharCode);
        this._graphemes = null;
        this.sections.push({
            scale: 1,
            verticalAlign: section.verticalAlign || 'bottom',
            imageName,
        });
        this.sectionIndex.push(this.sections.length - 1);
    }

    getNextImageSectionCharCode(): number | null {
        if (!this.imageSectionID) {
            this.imageSectionID = PUAbegin;
            return this.imageSectionID;
        }

        if (this.imageSectionID >= PUAend) return null;
        return ++this.imageSectionID;
    }

    determineLineBreaks(
        spacing: number,
        maxWidth: number,
        glyphMap: {
            [_: string]: {
                [_: string]: StyleGlyph;
            };
        },
        imagePositions: {[_: string]: ImagePosition},
        layoutTextSize: number
    ): number[] {
        const potentialLineBreaks = [];
        const targetWidth = this.determineAverageLineWidth(spacing, maxWidth, glyphMap, imagePositions, layoutTextSize);

        const hasZeroWidthSpaces = this.hasZeroWidthSpaces();

        let currentX = 0;

        // Breaks fall between grapheme clusters, never inside one: a line cannot start with the
        // vowel point of a letter left at the end of the line before it.
        const graphemes = this.graphemes();

        for (let i = 0; i < graphemes.length; i++) {
            const section = this.getSection(i);
            const grapheme = graphemes[i];
            // Which character a cluster breaks on is decided by the one it starts with; the marks
            // after it are part of the same unit and never a break opportunity of their own.
            const codePoint = grapheme.codePointAt(0);
            if (!charIsWhitespace(codePoint)) currentX += getGlyphAdvance(grapheme, section, glyphMap, imagePositions, spacing, layoutTextSize);

            // Ideographic characters, spaces, and word-breaking punctuation that often appear without
            // surrounding spaces.
            const next = graphemes[i + 1];
            if (next !== undefined) {
                const ideographicBreak = codePointAllowsIdeographicBreaking(codePoint);
                const nextCodePoint = next.codePointAt(0);
                if (breakable[codePoint] || ideographicBreak || 'imageName' in section || (graphemes[i + 2] !== undefined && breakableBefore[nextCodePoint])) {

                    potentialLineBreaks.push(
                        evaluateBreak(
                            i + 1,
                            currentX,
                            targetWidth,
                            potentialLineBreaks,
                            calculatePenalty(codePoint, nextCodePoint, ideographicBreak && hasZeroWidthSpaces),
                            false));
                }
            }
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
        glyphMap: {
            [_: string]: {
                [_: string]: StyleGlyph;
            };
        },
        imagePositions: {[_: string]: ImagePosition},
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
