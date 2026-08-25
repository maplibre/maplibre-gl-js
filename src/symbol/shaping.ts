import {
    codePointHasUprightVerticalOrientation
} from '../util/unicode_properties.g.ts';
import {
    charIsWhitespace,
    charInComplexShapingScript
} from '../util/script_detection.ts';
import {rtlWorkerPlugin} from '../source/rtl_text_plugin_worker.ts';
import {verticalizedCharacterMap} from '../util/verticalize_punctuation.ts';
import ONE_EM from './one_em.ts';

import {TaggedString, type TextSectionOptions, type ImageSectionOptions} from './tagged_string.ts';
import type {StyleGlyph, GlyphMetrics} from '../style/style_glyph.ts';
import {GLYPH_PBF_BORDER} from '../style/parse_glyph_pbf.ts';
import {TextFit} from '../style/style_image.ts';
import type {ImagePosition} from '../render/image_atlas.ts';
import {IMAGE_PADDING} from '../render/image_atlas.ts';
import type {Rect, GlyphPosition} from '../render/glyph_atlas.ts';
import type {Formatted, VerticalAlign} from '@maplibre/maplibre-gl-style-spec';

enum WritingMode {
    none = 0,
    horizontal = 1,
    vertical = 2,
    horizontalOnly = 3
}

const SHAPING_DEFAULT_OFFSET = -17;
export {shapeText, shapeIcon, applyTextFit, fitIconToText, getAnchorAlignment, WritingMode, SHAPING_DEFAULT_OFFSET};

// The position of a glyph relative to the text's anchor point.
export type PositionedGlyph = {
    glyph: number;
    imageName: string | null;
    x: number;
    y: number;
    vertical: boolean;
    scale: number;
    fontStack: string;
    sectionIndex: number;
    metrics: GlyphMetrics;
    rect: Rect | null;
};

export type PositionedLine = {
    positionedGlyphs: PositionedGlyph[];
    lineOffset: number;
};

// A collection of positioned glyphs and some metadata
export type Shaping = {
    positionedLines: PositionedLine[];
    top: number;
    bottom: number;
    left: number;
    right: number;
    writingMode: WritingMode.horizontal | WritingMode.vertical;
    text: string;
    iconsInText: boolean;
    verticalizable: boolean;
};

type ShapingSectionAttributes = {
    rect: Rect | null;
    metrics: GlyphMetrics;
    baselineOffset: number;
    imageOffset?: number;
};

type LineShapingSize = {
    verticalLineContentWidth: number;
    horizontalLineContentHeight: number;
};

function isEmpty(positionedLines: PositionedLine[]) {
    for (const line of positionedLines) {
        if (line.positionedGlyphs.length !== 0) {
            return false;
        }
    }
    return true;
}

export type SymbolAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TextJustify = 'left' | 'center' | 'right';

function breakLines(input: TaggedString, lineBreakPoints: number[]): TaggedString[] {
    const lines = [];
    let start = 0;
    for (const lineBreak of lineBreakPoints) {
        lines.push(input.substring(start, lineBreak));
        start = lineBreak;
    }

    if (start < input.length()) {
        lines.push(input.substring(start, input.length()));
    }
    return lines;
}

function shapeText(
    text: Formatted,
    glyphMap: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    },
    glyphPositions: {
        [_: string]: {
            [_: number]: GlyphPosition;
        };
    },
    imagePositions: {[_: string]: ImagePosition},
    defaultFontStack: string,
    maxWidth: number,
    lineHeight: number,
    textAnchor: SymbolAnchor,
    textJustify: TextJustify,
    spacing: number,
    translate: [number, number],
    writingMode: WritingMode.horizontal | WritingMode.vertical,
    allowVerticalPlacement: boolean,
    layoutTextSize: number,
    layoutTextSizeThisZoom: number
): Shaping | false {
    const logicalInput = TaggedString.fromFeature(text, defaultFontStack);

    if (writingMode === WritingMode.vertical) {
        logicalInput.verticalizePunctuation();
    }

    let lines: TaggedString[];

    let lineBreaks = logicalInput.determineLineBreaks(spacing, maxWidth, glyphMap, imagePositions, layoutTextSize);
    const {processBidirectionalText, processStyledBidirectionalText} = rtlWorkerPlugin;
    if (processBidirectionalText && logicalInput.sections.length === 1) {
        // Bidi doesn't have to be style-aware
        lines = [];
        // ICU operates on code units.
        lineBreaks = lineBreaks.map(index => logicalInput.toCodeUnitIndex(index));
        const untaggedLines =
            processBidirectionalText(logicalInput.toString(), lineBreaks);
        for (const line of untaggedLines) {
            const sectionIndex = [...line].map(() => 0);
            lines.push(new TaggedString(line, logicalInput.sections, sectionIndex));
        }
    } else if (processStyledBidirectionalText) {
        // Need version of mapbox-gl-rtl-text with style support for combining RTL text
        // with formatting
        lines = [];
        // ICU operates on code units.
        lineBreaks = lineBreaks.map(index => logicalInput.toCodeUnitIndex(index));

        // Convert character-based section index to be based on code units.
        let i = 0;
        const sectionIndex = [];
        for (const char of logicalInput.text) {
            sectionIndex.push(...Array(char.length).fill(logicalInput.sectionIndex[i]));
            i++;
        }

        const processedLines =
            processStyledBidirectionalText(logicalInput.text, sectionIndex, lineBreaks);
        for (const line of processedLines) {
            const sectionIndex = [];
            let elapsedChars = '';
            for (const char of line[0]) {
                sectionIndex.push(line[1][elapsedChars.length]);
                elapsedChars += char;
            }
            lines.push(new TaggedString(line[0], logicalInput.sections, sectionIndex));
        }
    } else {
        lines = breakLines(logicalInput, lineBreaks);
    }

    const positionedLines = [];
    const shaping = {
        positionedLines,
        text: logicalInput.toString(),
        top: translate[1],
        bottom: translate[1],
        left: translate[0],
        right: translate[0],
        writingMode,
        iconsInText: false,
        verticalizable: false
    };

    shapeLines(shaping, glyphMap, glyphPositions, imagePositions, lines, lineHeight, textAnchor, textJustify, writingMode, spacing, allowVerticalPlacement, layoutTextSizeThisZoom);
    if (isEmpty(positionedLines)) return false;

    return shaping;
}

function getAnchorAlignment(anchor: SymbolAnchor): {horizontalAlign: number; verticalAlign: number} {
    let horizontalAlign = 0.5, verticalAlign = 0.5;

    switch (anchor) {
        case 'right':
        case 'top-right':
        case 'bottom-right':
            horizontalAlign = 1;
            break;
        case 'left':
        case 'top-left':
        case 'bottom-left':
            horizontalAlign = 0;
            break;
    }

    switch (anchor) {
        case 'bottom':
        case 'bottom-right':
        case 'bottom-left':
            verticalAlign = 1;
            break;
        case 'top':
        case 'top-right':
        case 'top-left':
            verticalAlign = 0;
            break;
    }

    return {horizontalAlign, verticalAlign};
}

function calculateLineContentSize(
    imagePositions: {[_: string]: ImagePosition},
    line: TaggedString,
    layoutTextSizeFactor: number
): LineShapingSize {
    const maxGlyphSize = line.getMaxScale() * ONE_EM;
    const {maxImageWidth, maxImageHeight} = line.getMaxImageSize(imagePositions);

    const horizontalLineContentHeight = Math.max(maxGlyphSize, maxImageHeight * layoutTextSizeFactor);
    const verticalLineContentWidth = Math.max(maxGlyphSize, maxImageWidth * layoutTextSizeFactor);

    return {verticalLineContentWidth, horizontalLineContentHeight};
}

function getVerticalAlignFactor(
    verticalAlign: VerticalAlign
) {
    switch (verticalAlign) {
        case 'top':
            return 0;
        case 'center':
            return 0.5;
        default:
            return 1;
    }
}

function getRectAndMetrics(
    glyphPosition: GlyphPosition,
    glyphMap: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    },
    section: TextSectionOptions,
    codePoint: number
): GlyphPosition | null {
    if (glyphPosition?.rect) {
        return glyphPosition;
    }

    const glyphs = glyphMap[section.fontStack];
    const glyph = glyphs?.[codePoint];
    if (!glyph) return null;

    const metrics = glyph.metrics;
    return {rect: null, metrics};
}

function isLineVertical(
    writingMode: WritingMode.horizontal | WritingMode.vertical,
    allowVerticalPlacement: boolean,
    codePoint: number
): boolean {
    return !(writingMode === WritingMode.horizontal ||
        // Don't verticalize glyphs that have no upright orientation if vertical placement is disabled.
        (!allowVerticalPlacement && !codePointHasUprightVerticalOrientation(codePoint)) ||
        // If vertical placement is enabled, don't verticalize glyphs that
        // are from complex text layout script, or whitespaces.
        (allowVerticalPlacement && (charIsWhitespace(codePoint) || charInComplexShapingScript(codePoint))));
}

/** Returns whether the codepoint is a decimal digit of any script (`\p{Nd}`). */
function charIsDecimalDigit(codePoint: number): boolean {
    return /\p{Nd}/u.test(String.fromCodePoint(codePoint));
}

/** Returns whether the codepoint is an uppercase letter of any script (`\p{Lu}`). */
function charIsUppercaseLetter(codePoint: number): boolean {
    return /\p{Lu}/u.test(String.fromCodePoint(codePoint));
}

/** Returns whether the codepoint is a punctuation or symbol character (`\p{P}` or `\p{S}`). */
function charIsSymbolOrPunctuation(codePoint: number): boolean {
    return /[\p{P}\p{S}]/u.test(String.fromCodePoint(codePoint));
}

/**
 * Uppercase runs longer than this are words (e.g. “ISHIKAWA” in a dual name),
 * which read better lying along the line; shorter runs are codes (“JR”, “A1”).
 */
const MAX_UPRIGHT_LETTER_RUN = 3;

/**
 * Returns whether a run qualifies for upright treatment: numbers of any length,
 * optionally combined with symbols (“21”, “1-2”), and codes of up to
 * {@link MAX_UPRIGHT_LETTER_RUN} uppercase letters and digits (“JR”, “A1”).
 */
function runIsUpright(run: number[]): boolean {
    const isNumber = run.some(charIsDecimalDigit) &&
        run.every(codePoint => charIsDecimalDigit(codePoint) || charIsSymbolOrPunctuation(codePoint));
    const isShortUppercaseCode = run.length <= MAX_UPRIGHT_LETTER_RUN &&
        run.every(codePoint => charIsUppercaseLetter(codePoint) || charIsDecimalDigit(codePoint));
    return isNumber || isShortUppercaseCode;
}

/**
 * Returns whether a letter or digit in a qualifying run is drawn upright.
 * Punctuation and symbols are handled separately by
 * {@link verticalizeSurroundedPunctuation}; complex-shaping scripts keep
 * following the line.
 */
function charIsUprightInRun(codePoint: number): boolean {
    return (charIsDecimalDigit(codePoint) || charIsUppercaseLetter(codePoint)) &&
        !charInComplexShapingScript(codePoint);
}

/**
 * Replaces punctuation surrounded by upright characters with its vertical
 * presentation form (“-” in “1-2” becomes “︲”) and marks it upright.
 * `verticalizePunctuation` cannot do this earlier: it doesn't know which
 * characters {@link determineLineVerticals} draws upright.
 *
 * Returns whether anything in `chars` was replaced.
 */
function verticalizeSurroundedPunctuation(chars: string[], verticals: boolean[]): boolean {
    let replaced = false;
    for (let i = 0; i < chars.length; i++) {
        if (verticals[i]) continue;
        const verticalizedChar = verticalizedCharacterMap[chars[i]];
        if (!verticalizedChar) continue;
        if ((i === 0 || verticals[i - 1]) && (i === chars.length - 1 || verticals[i + 1])) {
            chars[i] = verticalizedChar;
            verticals[i] = true;
            replaced = true;
        }
    }
    return replaced;
}

/**
 * Returns, for each character of a vertically laid out line label, whether
 * its glyph is drawn upright rather than lying along the line, and updates
 * `line` with vertical presentation forms of punctuation.
 *
 * A run passed to {@link runIsUpright} is a maximal sequence of non-upright
 * characters that are neither whitespace nor inline images.
 */
function determineLineVerticals(line: TaggedString): boolean[] {
    const chars = [...line.text];
    const codePoints = chars.map(char => char.codePointAt(0));
    const verticals = codePoints.map(codePointHasUprightVerticalOrientation);

    const isRunCharacter = (i: number): boolean =>
        !verticals[i] && !charIsWhitespace(codePoints[i]) && !('imageName' in line.getSection(i));

    for (let start = 0; start < codePoints.length; start++) {
        if (!isRunCharacter(start)) continue;
        let end = start;
        while (end + 1 < codePoints.length && isRunCharacter(end + 1)) end++;

        if (runIsUpright(codePoints.slice(start, end + 1))) {
            for (let i = start; i <= end; i++) {
                verticals[i] = charIsUprightInRun(codePoints[i]);
            }
        }
        start = end;
    }

    if (verticalizeSurroundedPunctuation(chars, verticals)) {
        line.text = chars.join('');
    }

    return verticals;
}

function shapeLines(shaping: Shaping,
    glyphMap: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    },
    glyphPositions: {
        [_: string]: {
            [_: number]: GlyphPosition;
        };
    },
    imagePositions: {[_: string]: ImagePosition},
    lines: TaggedString[],
    lineHeight: number,
    textAnchor: SymbolAnchor,
    textJustify: TextJustify,
    writingMode: WritingMode.horizontal | WritingMode.vertical,
    spacing: number,
    allowVerticalPlacement: boolean,
    layoutTextSizeThisZoom: number) {

    let x = 0;
    let y = 0;

    let maxLineLength = 0;
    let maxLineHeight = 0;

    const justify =
        textJustify === 'right' ? 1 :
            textJustify === 'left' ? 0 : 0.5;
    const layoutTextSizeFactor = ONE_EM / layoutTextSizeThisZoom;

    let lineIndex = 0;
    for (const line of lines) {
        line.trim();

        const lineMaxScale = line.getMaxScale();
        const positionedLine = {positionedGlyphs: [], lineOffset: 0};
        shaping.positionedLines[lineIndex] = positionedLine;
        const positionedGlyphs = positionedLine.positionedGlyphs;
        let imageOffset = 0.0;

        if (!line.length()) {
            y += lineHeight; // Still need a line feed after empty line
            ++lineIndex;
            continue;
        }

        const lineShapingSize = calculateLineContentSize(imagePositions, line, layoutTextSizeFactor);
        const lineVerticals = writingMode === WritingMode.vertical && !allowVerticalPlacement ?
            determineLineVerticals(line) : null;

        let i = -1;
        for (const char of line.text) {
            i++;
            const section = line.getSection(i);
            const codePoint = char.codePointAt(0);
            const vertical = lineVerticals ? lineVerticals[i] : isLineVertical(writingMode, allowVerticalPlacement, codePoint);
            const positionedGlyph: PositionedGlyph = {
                glyph: codePoint,
                imageName: null,
                x,
                y: y + SHAPING_DEFAULT_OFFSET,
                vertical,
                scale: 1,
                fontStack: '',
                sectionIndex: line.getSectionIndex(i),
                metrics: null,
                rect: null
            };

            let sectionAttributes: ShapingSectionAttributes;
            if ('fontStack' in section) {
                sectionAttributes = shapeTextSection(section, codePoint, vertical, lineShapingSize, glyphMap, glyphPositions);
                if (!sectionAttributes) continue;
                positionedGlyph.fontStack = section.fontStack;
            } else {
                shaping.iconsInText = true;
                // If needed, allow to set scale factor for an image using
                // alias "image-scale" that could be alias for "font-scale"
                // when FormattedSection is an image section.
                section.scale *= layoutTextSizeFactor;

                sectionAttributes = shapeImageSection(section, vertical, lineMaxScale, lineShapingSize, imagePositions);
                if (!sectionAttributes) continue;
                imageOffset = Math.max(imageOffset, sectionAttributes.imageOffset);
                positionedGlyph.imageName = section.imageName;
            }

            const {rect, metrics, baselineOffset} = sectionAttributes;
            positionedGlyph.y += baselineOffset;
            positionedGlyph.scale = section.scale;
            positionedGlyph.metrics = metrics;
            positionedGlyph.rect = rect;
            positionedGlyphs.push(positionedGlyph);

            if (!vertical) {
                x += metrics.advance * section.scale + spacing;
            } else {
                shaping.verticalizable = true;
                const verticalAdvance = 'imageName' in section ? metrics.advance : ONE_EM;
                x += verticalAdvance * section.scale + spacing;
            }
        }

        // Only justify if we placed at least one glyph
        if (positionedGlyphs.length !== 0) {
            const lineLength = x - spacing;
            maxLineLength = Math.max(lineLength, maxLineLength);
            justifyLine(positionedGlyphs, 0, positionedGlyphs.length - 1, justify);
        }

        x = 0;
        const maxLineOffset = (lineMaxScale - 1) * ONE_EM;
        positionedLine.lineOffset = Math.max(imageOffset, maxLineOffset);
        const currentLineHeight = lineHeight * lineMaxScale + imageOffset;
        y += currentLineHeight;
        maxLineHeight = Math.max(currentLineHeight, maxLineHeight);
        ++lineIndex;
    }

    // Calculate the bounding box and justify / align text block.
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(textAnchor);
    align(shaping.positionedLines, justify, horizontalAlign, verticalAlign, maxLineLength, maxLineHeight, lineHeight, y, lines.length);

    // Calculate the bounding box
    // shaping.top & shaping.left already include text offset (text-radial-offset or text-offset)
    shaping.top += -verticalAlign * y;
    shaping.bottom = shaping.top + y;
    shaping.left += -horizontalAlign * maxLineLength;
    shaping.right = shaping.left + maxLineLength;
}

function shapeTextSection(
    section: TextSectionOptions,
    codePoint: number,
    vertical: boolean,
    lineShapingSize: LineShapingSize,
    glyphMap: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    },
    glyphPositions: {
        [_: string]: {
            [_: number]: GlyphPosition;
        };
    },
): ShapingSectionAttributes | null {
    const positions = glyphPositions[section.fontStack];
    const glyphPosition = positions?.[codePoint];

    const rectAndMetrics = getRectAndMetrics(glyphPosition, glyphMap, section, codePoint);

    if (rectAndMetrics === null) return null;

    let baselineOffset: number;
    if (vertical) {
        baselineOffset = lineShapingSize.verticalLineContentWidth - section.scale * ONE_EM;
    } else {
        const verticalAlignFactor = getVerticalAlignFactor(section.verticalAlign);
        baselineOffset = (lineShapingSize.horizontalLineContentHeight - section.scale * ONE_EM) * verticalAlignFactor;
    }

    return {
        rect: rectAndMetrics.rect,
        metrics: rectAndMetrics.metrics,
        baselineOffset
    };
}

function shapeImageSection(
    section: ImageSectionOptions,
    vertical: boolean,
    lineMaxScale: number,
    lineShapingSize: LineShapingSize,
    imagePositions: {[_: string]: ImagePosition},
): ShapingSectionAttributes | null {
    const imagePosition = imagePositions[section.imageName];
    if (!imagePosition) return null;
    const rect = imagePosition.paddedRect;
    const size = imagePosition.displaySize;

    const metrics = {width: size[0],
        height: size[1],
        left: IMAGE_PADDING,
        top: -GLYPH_PBF_BORDER,
        advance: vertical ? size[1] : size[0]};

    let baselineOffset: number;
    if (vertical) {
        baselineOffset = lineShapingSize.verticalLineContentWidth - size[1] * section.scale;
    } else {
        const verticalAlignFactor = getVerticalAlignFactor(section.verticalAlign);
        baselineOffset = (lineShapingSize.horizontalLineContentHeight - size[1] * section.scale) * verticalAlignFactor;
    }

    // Difference between height of an image and one EM at max line scale.
    // Pushes current line down if an image size is over 1 EM at max line scale.
    const imageOffset = (vertical ? size[0] : size[1]) * section.scale - ONE_EM * lineMaxScale;

    return {rect, metrics, baselineOffset, imageOffset};
}

// justify right = 1, left = 0, center = 0.5
function justifyLine(positionedGlyphs: PositionedGlyph[],
    start: number,
    end: number,
    justify: 1 | 0 | 0.5) {
    if (justify === 0)
        return;

    const lastPositionedGlyph = positionedGlyphs[end];
    const lastAdvance = lastPositionedGlyph.metrics.advance * lastPositionedGlyph.scale;
    const lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

    for (let j = start; j <= end; j++) {
        positionedGlyphs[j].x -= lineIndent;
    }
}

/**
 * Aligns the lines based on horizontal and vertical alignment.
 */
function align(positionedLines: PositionedLine[],
    justify: number,
    horizontalAlign: number,
    verticalAlign: number,
    maxLineLength: number,
    maxLineHeight: number,
    lineHeight: number,
    blockHeight: number,
    lineCount: number) {
    const shiftX = (justify - horizontalAlign) * maxLineLength;
    let shiftY = 0;

    if (maxLineHeight !== lineHeight) {
        shiftY = -blockHeight * verticalAlign - SHAPING_DEFAULT_OFFSET;
    } else {
        shiftY = -verticalAlign * lineCount * lineHeight + 0.5 * lineHeight;
    }

    for (const line of positionedLines) {
        for (const positionedGlyph of line.positionedGlyphs) {
            positionedGlyph.x += shiftX;
            positionedGlyph.y += shiftY;
        }
    }
}

export type PositionedIcon = {
    image: ImagePosition;
    top: number;
    bottom: number;
    left: number;
    right: number;
    collisionPadding?: [number, number, number, number];
};

function shapeIcon(
    image: ImagePosition,
    iconOffset: [number, number],
    iconAnchor: SymbolAnchor
): PositionedIcon {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(iconAnchor);
    const dx = iconOffset[0];
    const dy = iconOffset[1];
    const x1 = dx - image.displaySize[0] * horizontalAlign;
    const x2 = x1 + image.displaySize[0];
    const y1 = dy - image.displaySize[1] * verticalAlign;
    const y2 = y1 + image.displaySize[1];
    return {image, top: y1, bottom: y2, left: x1, right: x2};
}

export type Box = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

/**
 * Called after a PositionedIcon has already been run through fitIconToText,
 * but needs further adjustment to apply textFitWidth and textFitHeight.
 * @param shapedIcon - The icon that will be adjusted.
 * @returns Extents of the shapedIcon with text fit adjustments if necessary.
 */
function applyTextFit(shapedIcon: PositionedIcon): Box {
    // Assume shapedIcon.image is set or this wouldn't be called.
    // Size of the icon after it was adjusted using stretchX and Y
    let iconLeft = shapedIcon.left;
    let iconTop = shapedIcon.top;
    let iconWidth = shapedIcon.right - iconLeft;
    let iconHeight = shapedIcon.bottom - iconTop;
    // Size of the original content area
    const contentWidth = shapedIcon.image.content[2] - shapedIcon.image.content[0];
    const contentHeight = shapedIcon.image.content[3] - shapedIcon.image.content[1];
    const textFitWidth = shapedIcon.image.textFitWidth ?? TextFit.stretchOrShrink;
    const textFitHeight = shapedIcon.image.textFitHeight ?? TextFit.stretchOrShrink;
    const contentAspectRatio = contentWidth / contentHeight;
    // Scale to the proportional axis first note that height takes precedence if
    // both axes are set to proportional.
    if (textFitHeight === TextFit.proportional) {
        if ((textFitWidth === TextFit.stretchOnly && iconWidth / iconHeight < contentAspectRatio) || textFitWidth === TextFit.proportional) {
            // Push the width of the icon back out to match the content aspect ratio
            const newIconWidth = Math.ceil(iconHeight * contentAspectRatio);
            iconLeft *= newIconWidth / iconWidth;
            iconWidth = newIconWidth;
        }
    } else if (textFitWidth === TextFit.proportional) {
        if (textFitHeight === TextFit.stretchOnly && contentAspectRatio !== 0 && iconWidth / iconHeight > contentAspectRatio) {
            // Push the height of the icon back out to match the content aspect ratio
            const newIconHeight = Math.ceil(iconWidth / contentAspectRatio);
            iconTop *= newIconHeight / iconHeight;
            iconHeight = newIconHeight;
        }
    } else {
        // If neither textFitHeight nor textFitWidth are proportional then
        // there is no effect since the content rectangle should be precisely
        // matched to the content
    }
    return {x1: iconLeft, y1: iconTop, x2: iconLeft + iconWidth, y2: iconTop + iconHeight};
}

function fitIconToText(
    shapedIcon: PositionedIcon,
    shapedText: Shaping,
    textFit: string,
    padding: [number, number, number, number],
    iconOffset: [number, number],
    fontScale: number
): PositionedIcon {

    const image = shapedIcon.image;

    let collisionPadding;
    if (image.content) {
        const content = image.content;
        const pixelRatio = image.pixelRatio || 1;
        collisionPadding = [
            content[0] / pixelRatio,
            content[1] / pixelRatio,
            image.displaySize[0] - content[2] / pixelRatio,
            image.displaySize[1] - content[3] / pixelRatio
        ];
    }

    // We don't respect the icon-anchor, because icon-text-fit is set. Instead,
    // the icon will be centered on the text, then stretched in the given
    // dimensions.

    const textLeft = shapedText.left * fontScale;
    const textRight = shapedText.right * fontScale;

    let top, right, bottom, left;
    if (textFit === 'width' || textFit === 'both') {
        // Stretched horizontally to the text width
        left = iconOffset[0] + textLeft - padding[3];
        right = iconOffset[0] + textRight + padding[1];
    } else {
        // Centered on the text
        left = iconOffset[0] + (textLeft + textRight - image.displaySize[0]) / 2;
        right = left + image.displaySize[0];
    }

    const textTop = shapedText.top * fontScale;
    const textBottom = shapedText.bottom * fontScale;
    if (textFit === 'height' || textFit === 'both') {
        // Stretched vertically to the text height
        top = iconOffset[1] + textTop - padding[0];
        bottom = iconOffset[1] + textBottom + padding[2];
    } else {
        // Centered on the text
        top = iconOffset[1] + (textTop + textBottom - image.displaySize[1]) / 2;
        bottom = top + image.displaySize[1];
    }

    return {image, top, right, bottom, left, collisionPadding};
}
