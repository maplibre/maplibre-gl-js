import * as fs from 'fs';
import * as regenerate from 'regenerate';

/**
 * The heuristics in the functions below are based on this version of the
 * Unicode Standard. This constant should match the `@unicode/unicode-*` package
 * in package.json.
 *
 * When upgrading to a new version of the standard, consider any new scripts,
 * blocks, and characters that may require different script detection.
 */
const unicodeVersion = '17.0.0';

async function createSet(blocks: string[], scripts: string[]): Promise<regenerate.regenerate> {
    const set = regenerate.default();

    for (const block of blocks) {
        const slug = block.replace(/[- ]/g, '_');
        set.add((await import(`@unicode/unicode-${unicodeVersion}/Block/${slug}/code-points.js`)).default);
    }

    for (const script of scripts) {
        const slug = script.replace(/[- ]/g, '_');
        set.add((await import(`@unicode/unicode-${unicodeVersion}/Script/${slug}/code-points.js`)).default);
    }

    return set;
}

async function usesLocalIdeographFontFamily(): Promise<string> {
    // Local rendering is preferred for Unicode code blocks that represent
    // writing systems for which TinySDF produces optimal results and greatly
    // reduces bandwidth consumption. In general, TinySDF is best for any
    // writing system typically set in a monospaced font. With more than 99,000
    // codepoints accessed essentially at random, Hanzi/Kanji/Hanja (from the
    // CJK Unified Ideographs blocks) is the canonical example of wasteful
    // bandwidth consumption when rendered remotely. For visual consistency
    // within CJKV text, even relatively small CJKV and other siniform code
    // blocks prefer local rendering.
    const set = await createSet([
        'CJK Compatibility Forms',
        'CJK Compatibility',
        'CJK Radicals Supplement',
        'CJK Strokes',
        'CJK Unified Ideographs',
        'Enclosed CJK Letters And Months',
        'Enclosed Ideographic Supplement',
        'Halfwidth And Fullwidth Forms',
        'Hangul Syllables',
        'Hiragana',
        'Ideographic Symbols And Punctuation',
        'Kana Extended-A',
        'Kana Extended-B',
        'Kana Supplement',
        'Kangxi Radicals',
        'Katakana', // includes "ー"
        'Katakana Phonetic Extensions',
        // memo: these symbols are not all. others could be added if needed.
        'CJK Symbols And Punctuation', // 、。〃〄々〆〇〈〉《》「...
        'Halfwidth And Fullwidth Forms',
        'Small Kana Extension',
        'Vertical Forms',
    ], [
        'Bopomofo',
        'Han',
        'Hangul',
        'Hiragana',
        'Katakana',
        'Khitan Small Script',
        'Nushu',
        'Tangut',
        'Yi',
    ]);

    set.add((await import(`@unicode/unicode-${unicodeVersion}/Binary_Property/Ideographic/code-points.js`)).default);

    return set.toString();
}

async function allowsIdeographicBreaking(): Promise<string> {
    // Unicode only considers CJKV to be ideographic, but some other scripts mix
    // with CJKV so can also have ideographic line breaking.
    const set = await createSet([
        'CJK Compatibility Forms',
        'CJK Compatibility',
        'CJK Radicals Supplement',
        'CJK Strokes',
        'CJK Symbols And Punctuation',
        'Enclosed CJK Letters And Months',
        'Enclosed Ideographic Supplement',
        'Halfwidth And Fullwidth Forms',
        'Ideographic Description Characters',
        'Ideographic Symbols And Punctuation',
        'Kana Extended-A',
        'Kana Extended-B',
        'Kana Supplement',
        'Kangxi Radicals',
        'Katakana Phonetic Extensions',
        'Small Kana Extension',
        'Vertical Forms',
    ], [
        'Bopomofo',
        'Han',
        'Hiragana',
        'Katakana',
        'Khitan Small Script',
        'Nushu',
        'Tangut',
        'Yi',
    ]);

    return set.toString();
}

// The following logic comes from
// <https://www.unicode.org/Public/17.0.0/ucd/VerticalOrientation.txt>.
// Keep it synchronized with
// <https://www.unicode.org/Public/UCD/latest/ucd/VerticalOrientation.txt>.
// The data file denotes with “U” or “Tu” any codepoint that may be drawn
// upright in vertical text but does not distinguish between upright and
// “neutral” characters.

async function hasUprightVerticalOrientation(): Promise<string> {
    const set = await createSet([
        'Alchemical Symbols',
        'Anatolian Hieroglyphs',
        'Byzantine Musical Symbols',
        'Chess Symbols',
        'CJK Compatibility Forms',
        'CJK Compatibility',
        'CJK Strokes',
        'CJK Symbols And Punctuation',
        'Counting Rod Numerals',
        'Domino Tiles',
        'Emoticons',
        'Enclosed Alphanumeric Supplement',
        'Enclosed CJK Letters And Months',
        'Geometric Shapes Extended',
        'Halfwidth And Fullwidth Forms',
        'Ideographic Description Characters',
        'Kanbun',
        'Katakana',
        'Mahjong Tiles',
        'Mayan Numerals',
        'Meroitic Hieroglyphs',
        'Miscellaneous Symbols And Pictographs',
        'Miscellaneous Symbols Supplement',
        'Musical Symbols',
        'Ornamental Dingbats',
        'Playing Cards',
        'Siddham',
        'Small Form Variants',
        'Small Kana Extension',
        'Soyombo',
        'Supplemental Symbols And Pictographs',
        'Sutton SignWriting',
        'Symbols And Pictographs Extended-A',
        'Tai Xuan Jing Symbols',
        'Transport And Map Symbols',
        'Vertical Forms',
        'Yijing Hexagram Symbols',
        'Zanabazar Square',
        'Znamenny Musical Notation',
    ], [
        'Bopomofo',
        'Canadian Aboriginal',
        'Han',
        'Hangul',
        'Hiragana',
        'Katakana',
        'Khitan Small Script',
        'Nushu',
        'Tangut',
        'Yi',
    ]);

    set.add(0x02EA /* modifier letter yin departing tone mark */);
    set.add(0x02EB /* modifier letter yang departing tone mark */);

    // Exceptions to CJK Compatibility Forms
    set.removeRange(0xFE49 /* dashed overline */, 0xFE4F /* wavy low line */);

    // Exceptions to CJK Symbols and Punctuation
    set.removeRange(0x3008 /* left angle bracket */, 0x3011 /* right black lenticular bracket */);
    set.removeRange(0x3014 /* left tortoise shell bracket */, 0x301F /* low double prime quotation mark */);
    set.remove(0x3030 /* wavy dash */);

    // Exceptions to Katakana
    set.remove(0x30FC /* katakana-hiragana prolonged sound mark */);

    // Exceptions to Halfwidth and Fullwidth Forms
    set.remove(0xFF08 /* fullwidth left parenthesis */);
    set.remove(0xFF09 /* fullwidth right parenthesis */);
    set.remove(0xFF0D /* fullwidth hyphen-minus */);
    set.removeRange(0xFF1A /* fullwidth colon */, 0xFF1E /* fullwidth greater-than sign */);
    set.remove(0xFF3B /* fullwidth left square bracket */);
    set.remove(0xFF3D /* fullwidth right square bracket */);
    set.remove(0xFF3F /* fullwidth low line */);
    set.removeRange(0xFF5B /* fullwidth left curly bracket */, 0xFFDF);
    set.remove(0xFFE3 /* fullwidth macron */);
    set.removeRange(0xFFE8 /* halfwidth forms light vertical */, 0xFFEF);

    // Exceptions to Small Form Variants
    set.removeRange(0xFE58 /* small em dash */, 0xFE5E /* small right tortoise shell bracket */);
    set.removeRange(0xFE63 /* small hyphen-minus */, 0xFE66 /* small equals sign */);

    return set.toString();
}

async function hasNeutralVerticalOrientation(): Promise<string> {
    const set = await createSet([
        'CJK Compatibility Forms',
        'CJK Symbols And Punctuation',
        'Control Pictures',
        'Enclosed Alphanumerics',
        'Geometric Shapes',
        'Halfwidth And Fullwidth Forms',
        'Katakana',
        'Letterlike Symbols',
        'Miscellaneous Symbols',
        'Number Forms',
        'Optical Character Recognition',
        'Private Use Area',
        'Small Form Variants',
        'Supplementary Private Use Area-A',
        'Supplementary Private Use Area-B',
    ], []);

    // Latin-1 Supplement
    set.add(0x00A7 /* section sign */);
    set.add(0x00A9 /* copyright sign */);
    set.add(0x00AE /* registered sign */);
    set.add(0x00B1 /* plus-minus sign */);
    set.add(0x00BC /* vulgar fraction one quarter */);
    set.add(0x00BD /* vulgar fraction one half */);
    set.add(0x00BE /* vulgar fraction three quarters */);
    set.add(0x00D7 /* multiplication sign */);
    set.add(0x00F7 /* division sign */);

    // General Punctuation
    set.add(0x2016 /* double vertical line */);
    set.add(0x2020 /* dagger */);
    set.add(0x2021 /* double dagger */);
    set.add(0x2030 /* per mille sign */);
    set.add(0x2031 /* per ten thousand sign */);
    set.add(0x203B /* reference mark */);
    set.add(0x203C /* double exclamation mark */);
    set.add(0x2042 /* asterism */);
    set.add(0x2047 /* double question mark */);
    set.add(0x2048 /* question exclamation mark */);
    set.add(0x2049 /* exclamation question mark */);
    set.add(0x2051 /* two asterisks aligned vertically */);

    // Miscellaneous Technical
    set.addRange(0x2300 /* diameter sign */, 0x2307 /* wavy line */);
    set.addRange(0x230C /* bottom right crop */, 0x231F /* bottom right corner */);
    set.addRange(0x2324 /* up arrowhead between two horizontal bars */, 0x2328 /* keyboard */);
    set.add(0x232B /* erase to the left */);
    set.addRange(0x237D /* shouldered open box */, 0x239A /* clear screen symbol */);
    set.addRange(0x23BE /* dentistry symbol light vertical and top right */, 0x23CD /* square foot */);
    set.add(0x23CF /* eject symbol */);
    set.addRange(0x23D1 /* metrical breve */, 0x23DB /* fuse */);
    set.addRange(0x23E2 /* white trapezium */, 0x23FF);

    // Exceptions to Control Pictures
    set.remove(0x2423 /* open box */);

    // Exceptions to Miscellaneous Symbols
    set.removeRange(0x261A /* black left pointing index */, 0x261F /* white down pointing index */);

    // Miscellaneous Symbols and Arrows
    set.addRange(0x2B12 /* square with top half black */, 0x2B2F /* white vertical ellipse */);
    set.addRange(0x2B50 /* white medium star */, 0x2B59 /* heavy circled saltire */);
    set.addRange(0x2BB8 /* upwards white arrow from bar with horizontal bar */, 0x2BEB);

    set.add(0x221E /* infinity */);
    set.add(0x2234 /* therefore */);
    set.add(0x2235 /* because */);
    set.addRange(0x2700 /* black safety scissors */, 0x2767 /* rotated floral heart bullet */);
    set.addRange(0x2776 /* dingbat negative circled digit one */, 0x2793 /* dingbat negative circled sans-serif number ten */);
    set.add(0xFFFC /* object replacement character */);
    set.add(0xFFFD /* replacement character */);

    return set.toString();
}

async function requiresComplexTextShaping(): Promise<string> {
    // This is a rough heuristic: whether we "can render" a script
    // actually depends on the properties of the font being used
    // and whether differences from the ideal rendering are considered
    // semantically significant.

    // These blocks cover common scripts that require
    // complex text shaping, based on unicode script metadata:
    // https://www.unicode.org/repos/cldr/trunk/common/properties/scriptMetadata.txt
    // where "Web Rank <= 32" "Shaping Required = YES"
    const set = await createSet([
        'Bengali',
        'Devanagari',
        'Gujarati',
        'Gurmukhi',
        'Kannada',
        'Khmer',
        'Malayalam',
        'Myanmar',
        'Oriya',
        'Tamil',
        'Telugu',
        'Tibetan',
        'Sinhala',
    ], []);

    return set.toString();
}

/**
 * Returns a character class matching every character that can take part in a grapheme cluster of
 * more than one codepoint.
 *
 * These are the characters the grapheme break rules of UAX #29 join to their neighbours: combining
 * marks, the joiners, the Hangul jamo that build a syllable, the regional indicators that pair into
 * a flag, and the carriage return that pairs with a line feed. Text with none of them has one
 * cluster per codepoint, and does not need segmenting at all.
 */
async function canFormGraphemeCluster(): Promise<string> {
    const set = regenerate.default();
    for (const category of ['CR', 'Extend', 'L', 'LV', 'LVT', 'Prepend', 'Regional_Indicator', 'SpacingMark', 'T', 'V', 'ZWJ']) {
        set.add((await import(`@unicode/unicode-${unicodeVersion}/Grapheme_Cluster_Break/${category}/code-points.js`)).default);
    }

    return set.toString();
}

/**
 * Returns a character class matching the scripts that do not put spaces between words.
 *
 * Text in these has no punctuation to break a line at, so the only way to wrap it is to ask the
 * browser's word segmenter where the words are. Elsewhere the segmenter is the wrong tool: it
 * isolates a comma as a word of its own, and a line must not begin with one.
 */
async function isWrittenWithoutSpaces(): Promise<string> {
    const set = await createSet([], [
        'Balinese',
        'Javanese',
        'Khmer',
        'Lao',
        'Myanmar',
        'Thai',
        'Tibetan',
    ]);

    return set.toString();
}

/**
 * Returns a character class matching the characters that join the grapheme cluster they end to the
 * one after it.
 *
 * An invisible stacker -- a virama and its equivalents in other scripts -- joins the consonant
 * before it to the one after it, and a zero-width joiner does the same for emoji. `Intl.Segmenter`
 * puts a cluster boundary after both, so the two halves have to be put back together.
 */
async function joinsToTheFollowingGrapheme(): Promise<string> {
    const set = regenerate.default();
    set.add((await import(`@unicode/unicode-${unicodeVersion}/Indic_Syllabic_Category/Invisible_Stacker/code-points.js`)).default);
    set.add(0x200d);

    return set.toString();
}

fs.writeFileSync('src/util/unicode_properties.g.ts',
    `// This file is generated. Edit build/generate-unicode-data.ts, then run \`npm run generate-unicode-data\`.

/**
 * Returns whether the fallback fonts specified by the
 * \`localIdeographFontFamily\` map option apply to the given codepoint. 
 */
export function codePointUsesLocalIdeographFontFamily(codePoint: number): boolean {
    return /${await usesLocalIdeographFontFamily()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns whether the given codepoint participates in ideographic line
 * breaking.
 */
export function codePointAllowsIdeographicBreaking(codePoint: number): boolean {
    return /${await allowsIdeographicBreaking()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns true if the given Unicode codepoint identifies a character with
 * upright orientation.
 *
 * A character has upright orientation if it is drawn upright (unrotated)
 * whether the line is oriented horizontally or vertically, even if both
 * adjacent characters can be rotated. For example, a Chinese character is
 * always drawn upright. An uprightly oriented character causes an adjacent
 * “neutral” character to be drawn upright as well.
 */
export function codePointHasUprightVerticalOrientation(codePoint: number): boolean {
    return /${await hasUprightVerticalOrientation()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns true if the given Unicode codepoint identifies a character with
 * neutral orientation.
 *
 * A character has neutral orientation if it may be drawn rotated or unrotated
 * when the line is oriented vertically, depending on the orientation of the
 * adjacent characters. For example, along a vertically oriented line, the
 * vulgar fraction ½ is drawn upright among Chinese characters but rotated among
 * Latin letters. A neutrally oriented character does not influence whether an
 * adjacent character is drawn upright or rotated.
 */
export function codePointHasNeutralVerticalOrientation(codePoint: number): boolean {
    return /${await hasNeutralVerticalOrientation()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns whether the give codepoint is likely to require complex text shaping.
 */
export function codePointRequiresComplexTextShaping(codePoint: number): boolean {
    return /${await requiresComplexTextShaping()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns whether the text could hold a grapheme cluster of more than one codepoint, and so is worth
 * segmenting. A negative answer means every codepoint of it stands alone.
 */
export function textCanContainGraphemeClusters(text: string): boolean {
    return /${await canFormGraphemeCluster()}/.test(text);
}

/**
 * Returns whether the given codepoint belongs to a script that does not put spaces between words,
 * and so can only be wrapped by asking the word segmenter where its words are.
 */
export function codePointIsWrittenWithoutSpaces(codePoint: number): boolean {
    return /${await isWrittenWithoutSpaces()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns whether two grapheme clusters found by \`Intl.Segmenter\` are really one unit of writing,
 * and so have to be measured and drawn as a whole.
 *
 * The segmenter follows the tailored rules CLDR uses for stepping a cursor through text, which put a
 * boundary after an invisible stacker and before a spacing mark. Laying text out wants the untailored
 * rules of UAX #29 instead: \`လ\`, \`ာ\` and \`း\` are one Burmese syllable, not three.
 */
export function canCombineGraphemes(former: string, latter: string): boolean {
    return /(?:${await joinsToTheFollowingGrapheme()})$/.test(former) || /^\\p{gc=Mc}/u.test(latter);
}
`);
