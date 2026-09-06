/**
 * The part of `bidi-js` the bidirectional text support uses.
 *
 * The package ships no types of its own, and only the entry points named here are relied on, so the
 * rest of its surface is deliberately left undeclared.
 */
declare module 'bidi-js' {
    export type EmbeddingLevels = {
        levels: Uint8Array;
        paragraphs: Array<{start: number; end: number; level: number}>;
    };

    export type Bidi = {
        /** Runs the bidirectional algorithm, giving every code unit the level it is read at. */
        getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): EmbeddingLevels;
        /** The Unicode bidi category of a character, as the short name the standard gives it. */
        getBidiCharTypeName(character: string): string;
        /** The character this one is drawn as when it is read right to left, if it has one. */
        getMirroredCharacter(character: string): string | null;
    };

    const bidiFactory: () => Bidi;
    export default bidiFactory;
}
