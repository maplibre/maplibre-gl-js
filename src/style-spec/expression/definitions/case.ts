import assert from 'assert';

import {BooleanType} from '../types';

import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {Type} from '../types';

type Branches = Array<[Expression, Expression]>;

class Case implements Expression {
    type: Type;

    branches: Branches;
    otherwise: Expression;

    constructor(type: Type, branches: Branches, otherwise: Expression) {
        this.type = type;
        this.branches = branches;
        this.otherwise = otherwise;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression {
        if (args.length < 4)
            return context.error(`Expected at least 3 arguments, but found only ${args.length - 1}.`) as null;
        if (args.length % 2 !== 0)
            return context.error('Expected an odd number of arguments.') as null;

        let outputType: Type;
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }

        const branches = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            const test = context.parse(args[i], i, BooleanType);
            if (!test) return null;

            const result = context.parse(args[i + 1], i + 1, outputType);
            if (!result) return null;

            branches.push([test, result]);

            outputType = outputType || result.type;
        }

        const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
        if (!otherwise) return null;

        assert(outputType);
        return new Case((outputType as any), branches, otherwise);
    }

    evaluate(ctx: EvaluationContext) {
        for (const [test, expression] of this.branches) {
            if (test.evaluate(ctx)) {
                return expression.evaluate(ctx);
            }
        }
        return this.otherwise.evaluate(ctx);
    }

    eachChild(fn: (_: Expression) => void) {
        for (const [test, expression] of this.branches) {
            fn(test);
            fn(expression);
        }
        fn(this.otherwise);
    }

    outputDefined(): boolean {
        return this.branches.every(([_, out]) => out.outputDefined()) && this.otherwise.outputDefined();
    }

    serialize() {
        const serialized = ['case' as unknown];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Case;
