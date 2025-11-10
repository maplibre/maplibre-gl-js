import type {Formatted, FormattedSection, VerticalAlign} from '@maplibre/maplibre-gl-style-spec';

import ONE_EM from './one_em';
import type {ImagePosition} from '../render/image_atlas';
import type {StyleGlyph} from '../style/style_glyph';
import {verticalizePunctuation} from '../util/verticalize_punctuation';
import {charIsWhitespace} from '../util/script_detection';
import {codePointAllowsIdeographicBreaking} from '../util/unicode_properties.g';
import {warnOnce} from '../util/util';

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
    codePoint: number,
    section: SectionOptions,
    glyphMap: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    },
    imagePositions: {[_: string]: ImagePosition},
    spacing: number,
    layoutTextSize: number
): number {
    if ('fontStack' in section) {
        const positions = glyphMap[section.fontStack];
        const glyph = positions && positions[codePoint];
        if (!glyph) return 0;
        return glyph.metrics.advance * section.scale + spacing;
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

function calculatePenalty(codePoint: number, nextCodePoint: number, penalizableIdeographicBreak: boolean) {
    let penalty = 0;
    // Force break on newline
    if (codePoint === 0x0a) {
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
    potentialBreaks: Array<Break>,
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

function leastBadBreaks(lastLineBreak?: Break | null): Array<number> {
    if (!lastLineBreak) {
        return [];
    }
    return leastBadBreaks(lastLineBreak.priorBreak).concat(lastLineBreak.index);
}

export class TaggedString {
    text: string;
    sections: Array<SectionOptions>;
    /** Maps each character in `text` to its corresponding entry in `sections`. */
    sectionIndex: Array<number>;
    imageSectionID: number | null;

    constructor(text: string = '', sections: Array<SectionOptions> = [], sectionIndex: Array<number> = []) {
        this.text = text;
        this.sections = sections;
        this.sectionIndex = sectionIndex;
        this.imageSectionID = null;
    }

    static fromFeature(text: Formatted, defaultFontStack: string) {
        const result = new TaggedString();
        for (let i = 0; i < text.sections.length; i++) {
            const section = text.sections[i];
            if (!section.image) {
                result.addTextSection(section, defaultFontStack);
            } else {
                result.addImageSection(section);
            }
        }
        return result;
    }

    length(): number {
        return [...this.text].length;
    }

    getSection(index: number): SectionOptions {
        return this.sections[this.sectionIndex[index]];
    }

    getSectionIndex(index: number): number {
        return this.sectionIndex[index];
    }

    verticalizePunctuation() {
        this.text = verticalizePunctuation(this.text);
    }

    /**
     * Returns whether the text contains zero-width spaces.
     *
     * Some tilesets such as Mapbox Streets insert ZWSPs as hints for line
     * breaking in CJK text.
     */
    hasZeroWidthSpaces(): boolean {
        return this.text.includes('\u200b');
    }

    trim() {
        const leadingWhitespace = this.text.match(/^\s*/);
        const leadingLength = leadingWhitespace ? leadingWhitespace[0].length : 0;
        // Require a preceding non-space character to avoid overlapping leading and trailing matches.
        const trailingWhitespace = this.text.match(/\S\s*$/);
        const trailingLength = trailingWhitespace ? trailingWhitespace[0].length - 1 : 0;
        this.text = this.text.substring(leadingLength, this.text.length - trailingLength);
        this.sectionIndex = this.sectionIndex.slice(leadingLength, this.sectionIndex.length - trailingLength);
    }

    substring(start: number, end: number): TaggedString {
        const text = [...this.text].slice(start, end).join('');
        const sectionIndex = this.sectionIndex.slice(start, end);
        return new TaggedString(text, this.sections, sectionIndex);
    }

    /**
     * Converts a UTF-16 character index to a UTF-16 code unit (JavaScript character index).
     */
    toCodeUnitIndex(unicodeIndex: number): number {
        return [...this.text].slice(0, unicodeIndex).join('').length;
    }

    toString(): string {
        return this.text;
    }

    getMaxScale() {
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

    addTextSection(section: FormattedSection, defaultFontStack: string) {
        this.text += section.text;
        this.sections.push({
            scale: section.scale || 1,
            verticalAlign: section.verticalAlign || 'bottom',
            fontStack: section.fontStack || defaultFontStack,
        } as TextSectionOptions);
        const index = this.sections.length - 1;
        this.sectionIndex.push(...[...section.text].map(() => index));
    }

    addImageSection(section: FormattedSection) {
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
        this.sections.push({
            scale: 1,
            verticalAlign: section.verticalAlign || 'bottom',
            imageName,
        } as ImageSectionOptions);
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
                [_: number]: StyleGlyph;
            };
        },
        imagePositions: {[_: string]: ImagePosition},
        layoutTextSize: number
    ): Array<number> {
        const potentialLineBreaks = [];
        const targetWidth = this.determineAverageLineWidth(spacing, maxWidth, glyphMap, imagePositions, layoutTextSize);

        const hasZeroWidthSpaces = this.hasZeroWidthSpaces();

        let currentX = 0;

        let i = 0;
        const chars = this.text[Symbol.iterator]();
        let char = chars.next();
        const nextChars = this.text[Symbol.iterator]();
        nextChars.next();
        let nextChar = nextChars.next();
        const nextNextChars = this.text[Symbol.iterator]();
        nextNextChars.next();
        nextNextChars.next();
        let nextNextChar = nextNextChars.next();

        while (!char.done) {
            const section = this.getSection(i);
            const codePoint = char.value.codePointAt(0);
            if (!charIsWhitespace(codePoint)) currentX += getGlyphAdvance(codePoint, section, glyphMap, imagePositions, spacing, layoutTextSize);

            // Ideographic characters, spaces, and word-breaking punctuation that often appear without
            // surrounding spaces.
            if (!nextChar.done) {
                const ideographicBreak = codePointAllowsIdeographicBreaking(codePoint);
                const nextCodePoint = nextChar.value.codePointAt(0);
                if (breakable[codePoint] || ideographicBreak || 'imageName' in section || (!nextNextChar.done && breakableBefore[nextCodePoint])) {

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
            i++;
            char = chars.next();
            nextChar = nextChars.next();
            nextNextChar = nextNextChars.next();
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
                [_: number]: StyleGlyph;
            };
        },
        imagePositions: {[_: string]: ImagePosition},
        layoutTextSize: number) {
        let totalWidth = 0;

        let index = 0;
        for (const char of this.text) {
            const section = this.getSection(index);
            totalWidth += getGlyphAdvance(char.codePointAt(0), section, glyphMap, imagePositions, spacing, layoutTextSize);
            index++;
        }

        const lineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
        return totalWidth / lineCount;
    }
}
