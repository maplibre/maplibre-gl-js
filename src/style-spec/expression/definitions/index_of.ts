import {
    BooleanType,
    StringType,
    ValueType,
    NullType,
    toString,
    NumberType,
    isValidType,
    isValidNativeType,
} from '../types';
import RuntimeError from '../runtime_error';
import {typeOf} from '../values';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

class IndexOf implements Expression {
    type: Type;
    needle: Expression;
    haystack: Expression;
    fromIndex: Expression;

    constructor(needle: Expression, haystack: Expression, fromIndex?: Expression) {
        this.type = NumberType;
        this.needle = needle;
        this.haystack = haystack;
        this.fromIndex = fromIndex;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression {
        if (args.length <= 2 ||  args.length >= 5) {
            return context.error(`Expected 3 or 4 arguments, but found ${args.length - 1} instead.`) as null;
        }

        const needle = context.parse(args[1], 1, ValueType);

        const haystack = context.parse(args[2], 2, ValueType);

        if (!needle || !haystack) return null;
        if (!isValidType(needle.type, [BooleanType, StringType, NumberType, NullType, ValueType])) {
            return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${toString(needle.type)} instead`) as null;
        }

        if (args.length === 4) {
            const fromIndex = context.parse(args[3], 3, NumberType);
            if (!fromIndex) return null;
            return new IndexOf(needle, haystack, fromIndex);
        } else {
            return new IndexOf(needle, haystack);
        }
    }

    evaluate(ctx: EvaluationContext) {
        const needle = (this.needle.evaluate(ctx) as any);
        const haystack = (this.haystack.evaluate(ctx) as any);

        if (!isValidNativeType(needle, ['boolean', 'string', 'number', 'null'])) {
            throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${toString(typeOf(needle))} instead.`);
        }

        if (!isValidNativeType(haystack, ['string', 'array'])) {
            throw new RuntimeError(`Expected second argument to be of type array or string, but found ${toString(typeOf(haystack))} instead.`);
        }

        if (this.fromIndex) {
            const fromIndex = (this.fromIndex.evaluate(ctx) as number);
            return haystack.indexOf(needle, fromIndex);
        }

        return haystack.indexOf(needle);
    }

    eachChild(fn: (_: Expression) => void) {
        fn(this.needle);
        fn(this.haystack);
        if (this.fromIndex) {
            fn(this.fromIndex);
        }
    }

    outputDefined() {
        return false;
    }
}

export default IndexOf;
