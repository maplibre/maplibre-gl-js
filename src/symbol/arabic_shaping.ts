import {ENCODED_JOINING_TYPES, LIGATURES, PRESENTATION_FORMS} from '../util/unicode_properties.g.ts';

/**
 * How a character joins to the ones beside it.
 *
 * `D` joins on both sides, `R` only to the character before it, `L` only to the one after it, `C`
 * joins without being written itself, `T` is skipped over entirely, and `U` does not join at all.
 */
type JoiningType = 'R' | 'L' | 'D' | 'C' | 'U' | 'T';

/** The shape a letter takes, as an index into its entry in {@link PRESENTATION_FORMS}. */
const enum Form {
    Isolated = 0,
    Final = 1,
    Initial = 2,
    Medial = 3,
}

/**
 * Unpacks the `start,length` ranges of one joining type into the code points they stand for.
 *
 * The ranges are delta-encoded against the end of the range before them, so each is read relative to
 * where the last one stopped.
 */
function decodeRanges(encoded: string, type: JoiningType, into: Map<number, JoiningType>): void {
    let previousEnd = 0;
    for (const range of encoded.split(';')) {
        const [delta, length] = range.split(',').map(value => parseInt(value, 36));
        const start = previousEnd + delta;
        for (let codePoint = start; codePoint < start + length; codePoint++) {
            into.set(codePoint, type);
        }
        previousEnd = start + length;
    }
}

const joiningTypes = new Map<number, JoiningType>();
for (const [type, encoded] of Object.entries(ENCODED_JOINING_TYPES)) {
    decodeRanges(encoded, type as JoiningType, joiningTypes);
}

/** Anything the Unicode database does not give a joining type stands on its own. */
function joiningType(codePoint: number): JoiningType {
    return joiningTypes.get(codePoint) ?? 'U';
}

/** Whether the character before this one reaches forward to touch it. */
function joinsForward(type: JoiningType): boolean {
    return type === 'D' || type === 'L' || type === 'C';
}

/** Whether the character after this one reaches back to touch it. */
function joinsBackward(type: JoiningType): boolean {
    return type === 'D' || type === 'R' || type === 'C';
}

/**
 * The shape a letter takes given what it can reach on either side.
 *
 * A dual-joining letter takes all four shapes, while one that joins on a single side only ever
 * stands alone or closes a word. A letter that never joins is left as it was written: it has one
 * shape, so naming it by a presentation form would say nothing the code point does not already say.
 */
function formFor(type: JoiningType, joinedBefore: boolean, joinedAfter: boolean): Form | null {
    if (type === 'D') {
        if (joinedBefore && joinedAfter) return Form.Medial;
        if (joinedBefore) return Form.Final;
        if (joinedAfter) return Form.Initial;
        return Form.Isolated;
    }
    if (type === 'R') return joinedBefore ? Form.Final : Form.Isolated;
    if (type === 'L') return joinedAfter ? Form.Initial : Form.Isolated;
    return null;
}

/** One character of the text, with the shape the joining rules gave it. */
type ShapedCharacter = {
    codePoint: number;
    type: JoiningType;
    form: Form | null;
};

/** Splits text into characters, noting the joining type of each. */
function toCharacters(text: string): ShapedCharacter[] {
    return [...text].map(character => {
        const codePoint = character.codePointAt(0);
        return {codePoint, type: joiningType(codePoint), form: null};
    });
}

/**
 * Works out the shape of every letter in the text.
 *
 * Transparent characters are looked straight through, so a letter joins to its neighbour across any
 * vowel points written between them.
 */
function assignLetterForms(characters: ShapedCharacter[]): void {
    const visible = characters.filter(character => character.type !== 'T');

    for (let i = 0; i < visible.length; i++) {
        const character = visible[i];
        const joinedBefore = i > 0 && joinsForward(visible[i - 1].type);
        const joinedAfter = i + 1 < visible.length && joinsBackward(visible[i + 1].type);
        character.form = formFor(character.type, joinedBefore, joinedAfter);
    }
}

/**
 * Gives each vowel point the shape it takes over the letter it is written on.
 *
 * A mark sits higher and narrower over a letter that carries on into the next one than it does over
 * one that ends a word, so it takes its shape from whether its letter joins forwards.
 */
function assignMarkForms(characters: ShapedCharacter[]): void {
    let letterJoinsForward = false;

    for (const character of characters) {
        if (character.type === 'T') {
            character.form = letterJoinsForward ? Form.Medial : Form.Isolated;
        } else {
            letterJoinsForward = character.form === Form.Initial || character.form === Form.Medial;
        }
    }
}

/** Lam, which is the only letter that has to be written as a ligature with the letter after it. */
const LAM = 0x0644;

/**
 * Replaces each lam followed by an alef with the single character the pair is written as.
 *
 * The ligature closes a word when the lam it was made from reached back to the letter before it, and
 * otherwise stands alone. Vowel points written between the two letters are kept, and follow the
 * ligature they belong to.
 */
function applyLigatures(characters: ShapedCharacter[]): ShapedCharacter[] {
    const result: ShapedCharacter[] = [];

    for (let i = 0; i < characters.length; i++) {
        const lam = characters[i];
        if (lam.codePoint !== LAM) {
            result.push(lam);
            continue;
        }

        let next = i + 1;
        while (next < characters.length && characters[next].type === 'T') next++;

        const alef = characters[next];
        const ligature = alef && LIGATURES[String.fromCodePoint(LAM, alef.codePoint)];
        if (!ligature) {
            result.push(lam);
            continue;
        }

        const joinedBefore = lam.form === Form.Medial || lam.form === Form.Final;
        result.push({codePoint: ligature[joinedBefore ? 1 : 0], type: 'R', form: Form.Isolated});
        result.push(...characters.slice(i + 1, next));
        i = next;
    }

    return result;
}

/**
 * The presentation form of this character, or the character itself where there is none to use.
 *
 * Not every shape exists to be asked for: a dammatan is only ever encoded as it looks on its own,
 * so a dammatan written over a joined letter falls back to that one shape rather than to the
 * unshaped mark, which is what the letters around it have already been shaped to expect.
 */
function toPresentationForm(character: ShapedCharacter): number {
    if (character.form === null) return character.codePoint;
    const forms = PRESENTATION_FORMS[character.codePoint];
    if (!forms) return character.codePoint;
    return forms[character.form] || forms[Form.Isolated] || character.codePoint;
}

/**
 * The blocks the Arabic script is written from, which is what makes shaping worth doing at all.
 *
 * Arabic proper, then its supplement and two extensions, then the two blocks of shapes this file
 * rewrites letters into, so that text already shaped is recognised as needing to be looked at again.
 */
const ARABIC = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/;

/**
 * Rewrites Arabic letters as the shape they take in the word they sit in.
 *
 * Arabic is cursive: a letter is written differently depending on whether the letters beside it
 * reach out to touch it. MapLibre draws one glyph at a time and asks for each by code point, so the
 * shape has to be chosen here and named by the Presentation Forms-B code point that stands for it.
 *
 * Text with no Arabic in it is returned unchanged.
 */
export function applyArabicShaping(text: string): string {
    if (!ARABIC.test(text)) {
        return text;
    }

    const characters = toCharacters(text);
    assignLetterForms(characters);
    assignMarkForms(characters);
    return applyLigatures(characters)
        .map(character => String.fromCodePoint(toPresentationForm(character)))
        .join('');
}
