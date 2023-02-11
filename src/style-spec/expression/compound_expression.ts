import {toString} from './types';

import ParsingContext from './parsing_context';
import EvaluationContext from './evaluation_context';

import CollatorExpression from './definitions/collator';
import Within from './definitions/within';
import Literal from './definitions/literal';
import Assertion from './definitions/assertion';
import Coercion from './definitions/coercion';
import Var from './definitions/var';

import type {Expression, ExpressionRegistry} from './expression';
import type {Type} from './types';
import type {Value} from './values';

export type Varargs = {
    type: Type;
};
type Signature = Array<Type> | Varargs;
type Evaluate = (b: EvaluationContext, a: Array<Expression>) => Value;

type Definition = [Type, Signature, Evaluate] | {
    type: Type;
    overloads: Array<[Signature, Evaluate]>;
};

class CompoundExpression implements Expression {
    name: string;
    type: Type;
    _evaluate: Evaluate;
    args: Array<Expression>;

    static definitions: {[_: string]: Definition};

    constructor(name: string, type: Type, evaluate: Evaluate, args: Array<Expression>) {
        this.name = name;
        this.type = type;
        this._evaluate = evaluate;
        this.args = args;
    }

    evaluate(ctx: EvaluationContext) {
        return this._evaluate(ctx, this.args);
    }

    eachChild(fn: (_: Expression) => void) {
        this.args.forEach(fn);
    }

    outputDefined() {
        return false;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Expression {
        const op: string = (args[0] as any);
        const definition = CompoundExpression.definitions[op];
        if (!definition) {
            return context.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0) as null;
        }

        // Now check argument types against each signature
        const type = Array.isArray(definition) ?
            definition[0] : definition.type;

        const availableOverloads = Array.isArray(definition) ?
            [[definition[1], definition[2]]] :
            definition.overloads;

        const overloads = availableOverloads.filter(([signature]) => (
            !Array.isArray(signature) || // varags
            signature.length === args.length - 1 // correct param count
        ));

        let signatureContext: ParsingContext = null;

        for (const [params, evaluate] of overloads) {
            // Use a fresh context for each attempted signature so that, if
            // we eventually succeed, we haven't polluted `context.errors`.
            signatureContext = new ParsingContext(context.registry, isExpressionConstant, context.path, null, context.scope);

            // First parse all the args, potentially coercing to the
            // types expected by this overload.
            const parsedArgs: Array<Expression> = [];
            let argParseFailed = false;
            for (let i = 1; i < args.length; i++) {
                const arg = args[i];
                const expectedType = Array.isArray(params) ?
                    params[i - 1] :
                    (params as Varargs).type;

                const parsed = signatureContext.parse(arg, 1 + parsedArgs.length, expectedType);
                if (!parsed) {
                    argParseFailed = true;
                    break;
                }
                parsedArgs.push(parsed);
            }
            if (argParseFailed) {
                // Couldn't coerce args of this overload to expected type, move
                // on to next one.
                continue;
            }

            if (Array.isArray(params)) {
                if (params.length !== parsedArgs.length) {
                    signatureContext.error(`Expected ${params.length} arguments, but found ${parsedArgs.length} instead.`);
                    continue;
                }
            }

            for (let i = 0; i < parsedArgs.length; i++) {
                const expected = Array.isArray(params) ? params[i] : (params as Varargs).type;
                const arg = parsedArgs[i];
                signatureContext.concat(i + 1).checkSubtype(expected, arg.type);
            }

            if (signatureContext.errors.length === 0) {
                return new CompoundExpression(op, type, evaluate as Evaluate, parsedArgs);
            }
        }

        if (overloads.length === 1) {
            context.errors.push(...signatureContext.errors);
        } else {
            const expected = overloads.length ? overloads : availableOverloads;
            const signatures = expected
                .map(([params]) => stringifySignature(params as Signature))
                .join(' | ');

            const actualTypes = [];
            // For error message, re-parse arguments without trying to
            // apply any coercions
            for (let i = 1; i < args.length; i++) {
                const parsed = context.parse(args[i], 1 + actualTypes.length);
                if (!parsed) return null;
                actualTypes.push(toString(parsed.type));
            }
            context.error(`Expected arguments of type ${signatures}, but found (${actualTypes.join(', ')}) instead.`);
        }

        return null;
    }

    static register(
        registry: ExpressionRegistry,
        definitions: {[_: string]: Definition}
    ) {
        CompoundExpression.definitions = definitions;
        for (const name in definitions) {
            registry[name] = CompoundExpression;
        }
    }
}

function stringifySignature(signature: Signature): string {
    if (Array.isArray(signature)) {
        return `(${signature.map(toString).join(', ')})`;
    } else {
        return `(${toString(signature.type)}...)`;
    }
}

function isExpressionConstant(expression: Expression) {
    if (expression instanceof Var) {
        return isExpressionConstant(expression.boundExpression);
    } else if (expression instanceof CompoundExpression && expression.name === 'error') {
        return false;
    } else if (expression instanceof CollatorExpression) {
        // Although the results of a Collator expression with fixed arguments
        // generally shouldn't change between executions, we can't serialize them
        // as constant expressions because results change based on environment.
        return false;
    } else if (expression instanceof Within) {
        return false;
    }

    const isTypeAnnotation = expression instanceof Coercion ||
        expression instanceof Assertion;

    let childrenConstant = true;
    expression.eachChild(child => {
        // We can _almost_ assume that if `expressions` children are constant,
        // they would already have been evaluated to Literal values when they
        // were parsed.  Type annotations are the exception, because they might
        // have been inferred and added after a child was parsed.

        // So we recurse into isConstant() for the children of type annotations,
        // but otherwise simply check whether they are Literals.
        if (isTypeAnnotation) {
            childrenConstant = childrenConstant && isExpressionConstant(child);
        } else {
            childrenConstant = childrenConstant && child instanceof Literal;
        }
    });
    if (!childrenConstant) {
        return false;
    }

    return isFeatureConstant(expression) &&
           isGlobalPropertyConstant(expression,
               ['zoom', 'heatmap-density', 'line-progress', 'accumulated', 'is-supported-script']);
}

function isFeatureConstant(e: Expression) {
    if (e instanceof CompoundExpression) {
        if (e.name === 'get' && e.args.length === 1) {
            return false;
        } else if (e.name === 'feature-state') {
            return false;
        } else if (e.name === 'has' && e.args.length === 1) {
            return false;
        } else if (
            e.name === 'properties' ||
            e.name === 'geometry-type' ||
            e.name === 'id'
        ) {
            return false;
        } else if (/^filter-/.test(e.name)) {
            return false;
        }
    }

    if (e instanceof Within) {
        return false;
    }

    let result = true;
    e.eachChild(arg => {
        if (result && !isFeatureConstant(arg)) { result = false; }
    });
    return result;
}

function isStateConstant(e: Expression) {
    if (e instanceof CompoundExpression) {
        if (e.name === 'feature-state') {
            return false;
        }
    }
    let result = true;
    e.eachChild(arg => {
        if (result && !isStateConstant(arg)) { result = false; }
    });
    return result;
}

function isGlobalPropertyConstant(e: Expression, properties: Array<string>) {
    if (e instanceof CompoundExpression && properties.indexOf(e.name) >= 0) { return false; }
    let result = true;
    e.eachChild((arg) => {
        if (result && !isGlobalPropertyConstant(arg, properties)) { result = false; }
    });
    return result;
}

export {isFeatureConstant, isGlobalPropertyConstant, isStateConstant, isExpressionConstant};
export default CompoundExpression;
