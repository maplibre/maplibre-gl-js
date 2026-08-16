import {
    codePointAllowsIdeographicBreaking,
    codePointHasUprightVerticalOrientation,
    codePointHasNeutralVerticalOrientation,
    codePointIsInCursiveScript,
    codePointIsInRTLScript,
    codePointRequiresComplexTextShaping
} from '../util/unicode_properties.g.ts';

export function charIsWhitespace(char: number): boolean {
    return /\s/u.test(String.fromCodePoint(char));
}

export function allowsIdeographicBreaking(chars: string): boolean {
    for (const char of chars) {
        if (!codePointAllowsIdeographicBreaking(char.codePointAt(0))) return false;
    }
    return true;
}

export function allowsVerticalWritingMode(chars: string): boolean {
    for (const char of chars) {
        if (codePointHasUprightVerticalOrientation(char.codePointAt(0))) return true;
    }
    return false;
}

export function allowsLetterSpacing(chars: string): boolean {
    for (const char of chars) {
        if (!charAllowsLetterSpacing(char.codePointAt(0))) return false;
    }
    return true;
}

export function charAllowsLetterSpacing(char: number): boolean {
    return !codePointIsInCursiveScript(char);
}

/**
 * Returns true if the given Unicode codepoint identifies a character with
 * rotated orientation.
 *
 * A character has rotated orientation if it is drawn rotated when the line is
 * oriented vertically, even if both adjacent characters are upright. For
 * example, a Latin letter is drawn rotated along a vertical line. A rotated
 * character causes an adjacent “neutral” character to be drawn rotated as well.
 */
export function charHasRotatedVerticalOrientation(char: number): boolean {
    return !(codePointHasUprightVerticalOrientation(char) ||
             codePointHasNeutralVerticalOrientation(char));
}

export function charInComplexShapingScript(char: number): boolean {
    return /\p{sc=Arab}/u.test(String.fromCodePoint(char));
}

export function charInRTLScript(char: number): boolean {
    return codePointIsInRTLScript(char);
}

export function charInSupportedScript(char: number, canRenderRTL: boolean): boolean {
    // This is a rough heuristic: whether we "can render" a script
    // actually depends on the properties of the font being used
    // and whether differences from the ideal rendering are considered
    // semantically significant.

    // Even in Latin script, we "can't render" combinations such as the fi
    // ligature, but we don't consider that semantically significant.
    if (!canRenderRTL && charInRTLScript(char)) {
        return false;
    }
    return !codePointRequiresComplexTextShaping(char);

}

export function stringContainsRTLText(chars: string): boolean {
    for (const char of chars) {
        if (charInRTLScript(char.codePointAt(0))) {
            return true;
        }
    }
    return false;
}

export function isStringInSupportedScript(chars: string, canRenderRTL: boolean): boolean {
    for (const char of chars) {
        if (!charInSupportedScript(char.codePointAt(0), canRenderRTL)) {
            return false;
        }
    }
    return true;
}
