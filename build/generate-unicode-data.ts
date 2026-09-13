import * as fs from 'fs';
import * as regenerate from 'regenerate';

/**
 * The heuristics in the functions below are based on this version of the
 * Unicode Standard. This constant should match the `@unicode/unicode-*` package
 * in package.json, and the vendored extracts in `build/unicode`.
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

/**
 * Returns a character class matching the scripts that are written cursively, and so cannot have
 * their letters spaced apart without coming apart.
 *
 * A script is one of them when its letters have a joining type, which says they are drawn joined to
 * what stands beside them. Duployan is written joined up as well, by a rule the character database
 * does not state as a joining type, so it is named here.
 */
async function isInCursiveScript(): Promise<string> {
    const joiningTypes = await readJoiningTypes();
    const joins = (codePoint: number) => ['D', 'L', 'R', 'C'].includes(joiningTypes.get(codePoint));

    const set = await createSet([], ['Duployan']);
    const scripts = (await import(`@unicode/unicode-${unicodeVersion}/index.js`)).default.Script;
    for (const script of scripts) {
        if (script === 'Common' || script === 'Inherited') continue;
        const codePoints = (await import(`@unicode/unicode-${unicodeVersion}/Script/${script}/code-points.js`)).default;
        if (codePoints.some(joins)) set.add(codePoints);
    }

    return set.toString();
}

/**
 * Returns a character class matching the scripts that are written horizontally from right to left.
 *
 * A script is one of them when the bidirectional algorithm reads its letters from right to left. The
 * whole script is taken, the marks and digits written with it included, so that a word keeps all its
 * parts. `Common` is left out: it holds the characters every script shares, a handful of which are
 * read right to left while the rest of it is not.
 */
async function isInRTLScript(): Promise<string> {
    const readRightToLeft = new Set<number>();
    for (const bidiClass of ['Right_To_Left', 'Arabic_Letter']) {
        const codePoints = (await import(`@unicode/unicode-${unicodeVersion}/Bidi_Class/${bidiClass}/code-points.js`)).default;
        for (const codePoint of codePoints) readRightToLeft.add(codePoint);
    }

    const scripts = (await import(`@unicode/unicode-${unicodeVersion}/index.js`)).default.Script;
    const set = regenerate.default();
    for (const script of scripts) {
        if (script === 'Common') continue;
        const codePoints = (await import(`@unicode/unicode-${unicodeVersion}/Script/${script}/code-points.js`)).default;
        if (codePoints.some((codePoint: number) => readRightToLeft.has(codePoint))) set.add(codePoints);
    }

    return set.toString();
}

/**
 * Returns a character class matching the blocks whose glyphs are drawn locally by TinySDF.
 *
 * These are the writing systems TinySDF draws well and cheaply: in general, any system typically set
 * in a monospaced font. Hanzi, Kanji and Hanja, from the CJK Unified Ideographs blocks, are the
 * clearest case, with more than 99,000 codepoints reached essentially at random, which is a great
 * deal of bandwidth to spend on a glyph server. The smaller CJKV and other siniform blocks are drawn
 * locally too, so that text mixing them looks of a piece.
 */
async function usesLocalIdeographFontFamily(): Promise<string> {
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

/**
 * Returns a character class matching the characters drawn upright in vertical text.
 *
 * `Vertical_Orientation` names every character that may be drawn upright, without saying which of
 * them stand upright in their own right and which only follow the characters beside them. Those that
 * follow are taken out, being the ones {@link neutralVerticalOrientationSet} names, and the blocks
 * added back below are the ones read both ways: upright standing alone, neutral in company. What is
 * removed after that is a character that block reads the other way.
 */
async function hasUprightVerticalOrientation(): Promise<string> {
    const set = regenerate.default();
    for (const orientation of ['U', 'Tu']) {
        set.add((await import(`@unicode/unicode-${unicodeVersion}/Vertical_Orientation/${orientation}/code-points.js`)).default);
    }
    set.remove(await neutralVerticalOrientationSet());
    set.add(await createSet([
        'CJK Compatibility Forms',
        'CJK Symbols And Punctuation',
        'Halfwidth And Fullwidth Forms',
        'Katakana',
        'Small Form Variants',
    ], []));

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
    return (await neutralVerticalOrientationSet()).toString();
}

/**
 * The characters drawn upright in vertical text only because the characters beside them are.
 *
 * `Vertical_Orientation` does not draw this distinction, naming both these and the characters that
 * stand upright in their own right, so which of them merely follow their neighbours is settled here.
 */
async function neutralVerticalOrientationSet(): Promise<regenerate.regenerate> {
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

    return set;
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
 *
 * `Line_Break` names the South East Asian scripts that need a dictionary to be broken into lines.
 * The three scripts added to them are written without spaces as well, and are broken by the same
 * means, but the standard gives them a line breaking class of their own.
 */
async function isWrittenWithoutSpaces(): Promise<string> {
    const set = regenerate.default();
    set.add((await import(`@unicode/unicode-${unicodeVersion}/Line_Break/Complex_Context/code-points.js`)).default);

    return set.add(await createSet([], [
        'Balinese',
        'Javanese',
        'Tibetan',
    ])).toString();
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

const downloadedRows = new Map<string, Promise<string[][]>>();
/**
 * The rows of one file of the Unicode Character Database, each split into its fields, with the
 * comments and blank lines dropped. A file is downloaded from unicode.org and parsed once, and kept
 * for the rest of the run.
 */
function unicodeDataRows(file: string): Promise<string[][]> {
    if (!downloadedRows.has(file)) {
        downloadedRows.set(file, (async () => {
            const url = `https://www.unicode.org/Public/${unicodeVersion}/ucd/${file}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
            }
            return (await response.text())
                .split('\n')
                .map(line => line.split('#')[0])
                .filter(line => line.trim())
                .map(line => line.split(';').map(field => field.trim()));
        })());
    }
    return downloadedRows.get(file);
}

/**
 * The blocks the Arabic script is written from, plus the two joiners that steer it.
 *
 * Only Arabic is tabulated. A cursive script outside these blocks has no presentation forms, and so
 * no code point by which MapLibre could name a shaped glyph.
 */
const arabicBlocks: Array<[number, number]> = [
    [0x0600, 0x06ff],
    [0x0750, 0x077f],
    [0x0870, 0x089f],
    [0x08a0, 0x08ff],
    [0xfb50, 0xfdff],
    [0xfe70, 0xfeff],
    [0x200c, 0x200d],
];

function isArabic(codePoint: number): boolean {
    return arabicBlocks.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/**
 * How a character joins to the ones beside it: `R` to the character before it, `L` to the one after
 * it, `D` to both, `C` without being written itself, `T` not at all while letting the two around it
 * join through it, and `U` not at all.
 */
type JoiningType = 'R' | 'L' | 'D' | 'C' | 'U' | 'T';

/**
 * The joining type of every character: which side, if any, it joins the letters beside it on.
 *
 * `DerivedJoiningType.txt` states the property for every code point, the combining marks and format
 * characters that join through included.
 */
async function readJoiningTypes(): Promise<Map<number, JoiningType>> {
    const joiningTypes = new Map<number, JoiningType>();

    for (const [codePoints, type] of await unicodeDataRows('extracted/DerivedJoiningType.txt')) {
        const [first, last] = codePoints.split('..').map(hex => parseInt(hex, 16));
        for (let codePoint = first; codePoint <= (last ?? first); codePoint++) {
            joiningTypes.set(codePoint, type as JoiningType);
        }
    }

    return joiningTypes;
}

/** The four shapes a cursive script writes a letter in. */
type PresentationForms = {isolated: number; final: number; initial: number; medial: number};

/**
 * Tatweel, the stroke a word is stretched along, and the space a mark is shown over on its own.
 *
 * A mark has no shape without a letter under it, so the database gives its presentation forms as
 * decompositions onto one of these: `<medial> 0640 064B` is "fathatan, as written over a letter
 * mid-word", and `<isolated> 0020 064B` is the same mark standing by itself.
 */
const markCarriers = new Set([0x0020, 0x0640]);

/**
 * The Presentation Forms shape of each Arabic letter, and the two shapes of each lam-alef ligature.
 *
 * The shapes come from the compatibility decompositions of the presentation blocks: `<final> 0628`
 * is what says U+FE90 is the final form of beh.
 *
 * Of the two-character decompositions only lam-alef is taken. It is the one ligature Arabic shaping
 * is required to form; the rest of the presentation blocks are typographic ligatures, which a font
 * offers and the text is free to do without.
 */
async function readPresentationForms(): Promise<{
    forms: Map<number, PresentationForms>;
    ligatures: Map<string, {isolated: number; final: number}>;
}> {
    const forms = new Map<number, PresentationForms>();
    const ligatures = new Map<string, {isolated: number; final: number}>();

    for (const row of await unicodeDataRows('UnicodeData.txt')) {
        const codePoint = parseInt(row[0], 16);
        if (codePoint < 0xfb50 || codePoint > 0xfeff) continue;

        const match = /^<(isolated|final|initial|medial)>\s+(.+)$/.exec(row[5]);
        if (!match) continue;

        const shape = match[1] as keyof PresentationForms;
        const bases = match[2].split(/\s+/).map(base => parseInt(base, 16));
        const carried = bases.length === 2 && markCarriers.has(bases[0]);

        if (bases.length === 1 || carried) {
            const base = carried ? bases[1] : bases[0];
            const existing = forms.get(base) ?? {isolated: 0, final: 0, initial: 0, medial: 0};
            existing[shape] = codePoint;
            forms.set(base, existing);
        } else if (codePoint >= 0xfef5 && codePoint <= 0xfefc) {
            const pair = String.fromCodePoint(...bases);
            const existing = ligatures.get(pair) ?? {isolated: 0, final: 0};
            existing[shape as 'isolated' | 'final'] = codePoint;
            ligatures.set(pair, existing);
        }
    }

    return {forms, ligatures};
}

/**
 * Packs a sorted list of code points into `start,length` pairs, delta-encoded in base 36.
 *
 * The joining types run in long unbroken stretches, so the ranges take a fraction of the space the
 * code points would.
 */
function encodeCodePointRanges(codePoints: number[]): string {
    const ranges: number[][] = [];
    for (const codePoint of codePoints.sort((a, b) => a - b)) {
        const last = ranges[ranges.length - 1];
        if (last && last[0] + last[1] === codePoint) {
            last[1]++;
        } else {
            ranges.push([codePoint, 1]);
        }
    }

    let previousEnd = 0;
    return ranges
        .map(([start, length]) => {
            const encoded = `${(start - previousEnd).toString(36)},${length.toString(36)}`;
            previousEnd = start + length;
            return encoded;
        })
        .join(';');
}

/** The joining types, as one encoded set of ranges per type, ready to print as an object literal. */
async function encodedJoiningTypes(): Promise<string> {
    const byType = new Map<JoiningType, number[]>();
    for (const [codePoint, type] of await readJoiningTypes()) {
        if (type === 'U' || !isArabic(codePoint)) continue;
        byType.set(type, (byType.get(type) ?? []).concat(codePoint));
    }

    return [...byType]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, codePoints]) => `    ${type}: '${encodeCodePointRanges(codePoints)}',`)
        .join('\n');
}

/** Each Arabic letter's four presentation forms, ready to print as an object literal. */
async function encodedPresentationForms(): Promise<string> {
    return [...(await readPresentationForms()).forms]
        .sort(([a], [b]) => a - b)
        .map(([base, {isolated, final, initial, medial}]) =>
            `    ${base}: [${isolated}, ${final}, ${initial}, ${medial}],`)
        .join('\n');
}

/** The lam-alef ligatures, ready to print as an object literal. */
async function encodedLigatures(): Promise<string> {
    return [...(await readPresentationForms()).ligatures]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pair, {isolated, final}]) => {
            const escaped = [...pair]
                .map(character => `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`)
                .join('');
            return `    '${escaped}': [${isolated}, ${final}],`;
        })
        .join('\n');
}

fs.writeFileSync('src/util/unicode_properties.g.ts',
    `// This file is generated. Edit build/generate-unicode-data.ts, then run \`npm run generate-unicode-data\`.

/**
 * Returns whether the given codepoint belongs to a script that is written cursively, whose letters
 * therefore cannot be spaced apart.
 */
export function codePointIsInCursiveScript(codePoint: number): boolean {
    return /${await isInCursiveScript()}/gim.test(String.fromCodePoint(codePoint));
}

/**
 * Returns whether the given codepoint belongs to a script that is written horizontally from right
 * to left.
 */
export function codePointIsInRTLScript(codePoint: number): boolean {
    return /${await isInRTLScript()}/gim.test(String.fromCodePoint(codePoint));
}

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

/**
 * The joining type of each Arabic character, as \`start,length\` code point ranges delta-encoded in
 * base 36, one entry per type. Anything absent from all of them is non-joining.
 */
export const ENCODED_JOINING_TYPES: Record<string, string> = {
${await encodedJoiningTypes()}
};

/**
 * Each Arabic letter's Presentation Forms code points, as \`[isolated, final, initial, medial]\`.
 * A shape the letter is not written in is 0.
 */
export const PRESENTATION_FORMS: Record<number, [number, number, number, number]> = {
${await encodedPresentationForms()}
};

/** The lam-alef ligatures, keyed by the pair of letters they replace, as \`[isolated, final]\`. */
export const LIGATURES: Record<string, [number, number]> = {
${await encodedLigatures()}
};
`);
