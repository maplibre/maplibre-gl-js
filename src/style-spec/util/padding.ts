/**
 * A set of four numbers representing padding around a box. Create instances from
 * bare arrays or numeric values using the static method `Padding.parse`.
 * @private
 */
class Padding {
    /** Padding values are in CSS order: top, right, bottom, left */
    values: [number, number, number, number];

    constructor(values: [number, number, number, number]) {
        this.values = values.slice() as [number, number, number, number];
    }

    /**
     * Numeric padding values
     * @returns A `Padding` instance, or `undefined` if the input is not a valid padding value.
     */
    static parse(input?: number | number[] | Padding | null): Padding | void {
        if (input instanceof Padding) {
            return input;
        }

        // Backwards compatibility: bare number is treated the same as array with single value.
        // Padding applies to all four sides.
        if (typeof input === 'number') {
            return new Padding([input, input, input, input]);
        }

        if (!Array.isArray(input)) {
            return undefined;
        }

        if (input.length < 1 || input.length > 4) {
            return undefined;
        }

        for (const val of input) {
            if (typeof val !== 'number') {
                return undefined;
            }
        }

        // Expand shortcut properties into explicit 4-sided values
        switch (input.length) {
            case 1:
                input = [input[0], input[0], input[0], input[0]];
                break;
            case 2:
                input = [input[0], input[1], input[0], input[1]];
                break;
            case 3:
                input = [input[0], input[1], input[2], input[1]];
                break;
        }

        return new Padding(input as [number, number, number, number]);
    }

    toString(): string {
        return JSON.stringify(this.values);
    }
}

export default Padding;
