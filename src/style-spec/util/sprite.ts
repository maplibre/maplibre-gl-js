/**
 * An array of `{id: string, url: string}` objects which represents all the sprites and their reference names.
 * For backwards-compatibility, the main generator-method `Sprite.parse` also accepts a plain string value that gets
 * converted into `[{id: "default", url: <input string>}]`.
 *
 * @private
 */
class Sprite {
    constructor(values: {id: string; url: string}[]) {
        this.values = values;
    }

    values: {id: string; url: string}[];

    /**
     * Stringy sprite value or an array of id-url pairs.
     *
     * @returns A `Sprite` instance, or `undefined` if the input is not a valid sprite value.
     */
    static parse(input?: (string | {id: string; url: string}[]) | Sprite | null): Sprite | void {
        if (input instanceof Sprite) return input;

        // Backwards compatibility: plain string is treated the same as an array with a single `{id: "default", url: <input string>}` value.
        if (typeof input === 'string') return new Sprite([{id: 'default', url: input}]);

        if (!Array.isArray(input)) return undefined;

        for (const val of input) {
            if (!('id' in val) || !('url' in val)) return undefined;
        }

        return new Sprite(input);
    }

    toString(): string {
        return JSON.stringify(this.values);
    }
}

export default Sprite;
