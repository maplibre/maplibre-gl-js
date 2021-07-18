import {
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    ObjectType,
    ValueType,
    ErrorType,
    CollatorType,
    array,
    toString as typeToString,
} from '../types';

import type {Type} from '../types';

import {typeOf, Color, validateRGBA, toString as valueToString} from '../values';
import CompoundExpression from '../compound_expression';
import RuntimeError from '../runtime_error';
import Let from './let';
import Var from './var';
import Literal from './literal';
import Assertion from './assertion';
import Coercion from './coercion';
import At from './at';
import In from './in';
import IndexOf from './index_of';
import Match from './match';
import Case from './case';
import Slice from './slice';
import Step from './step';
import Interpolate from './interpolate';
import Coalesce from './coalesce';
import {
    Equals,
    NotEquals,
    LessThan,
    GreaterThan,
    LessThanOrEqual,
    GreaterThanOrEqual
} from './comparison';
import CollatorExpression from './collator';
import NumberFormat from './number_format';
import FormatExpression from './format';
import ImageExpression from './image';
import Length from './length';
import Within from './within';

import type {Varargs} from '../compound_expression';
import type {ExpressionRegistry} from '../expression';

const expressions: ExpressionRegistry = {
    // special forms
    '==': Equals,
    '!=': NotEquals,
    '>': GreaterThan,
    '<': LessThan,
    '>=': GreaterThanOrEqual,
    '<=': LessThanOrEqual,
    'array': Assertion,
    'at': At,
    'boolean': Assertion,
    'case': Case,
    'coalesce': Coalesce,
    'collator': CollatorExpression,
    'format': FormatExpression,
    'image': ImageExpression,
    'in': In,
    'index-of': IndexOf,
    'interpolate': Interpolate,
    'interpolate-hcl': Interpolate,
    'interpolate-lab': Interpolate,
    'length': Length,
    'let': Let,
    'literal': Literal,
    'match': Match,
    'number': Assertion,
    'number-format': NumberFormat,
    'object': Assertion,
    'slice': Slice,
    'step': Step,
    'string': Assertion,
    'to-boolean': Coercion,
    'to-color': Coercion,
    'to-number': Coercion,
    'to-string': Coercion,
    'var': Var,
    'within': Within
};

function rgba(ctx, [r, g, b, a]) {
    r = r.evaluate(ctx);
    g = g.evaluate(ctx);
    b = b.evaluate(ctx);
    const alpha = a ? a.evaluate(ctx) : 1;
    const error = validateRGBA(r, g, b, alpha);
    if (error) throw new RuntimeError(error);
    return new Color(r / 255 * alpha, g / 255 * alpha, b / 255 * alpha, alpha);
}

function has(key, obj) {
    return key in obj;
}

function get(key, obj) {
    const v = obj[key];
    return typeof v === 'undefined' ? null : v;
}

function binarySearch(v, a, i, j) {
    while (i <= j) {
        const m = (i + j) >> 1;
        if (a[m] === v)
            return true;
        if (a[m] > v)
            j = m - 1;
        else
            i = m + 1;
    }
    return false;
}

function varargs(type: Type): Varargs {
    return {type};
}

CompoundExpression.register(expressions, {
    'error': [
        ErrorType as Type,
        [StringType as Type],
        (ctx, [v]) => { throw new RuntimeError(v.evaluate(ctx)); }
    ],
    'typeof': [
        StringType as Type,
        [ValueType as Type],
        (ctx, [v]) => typeToString(typeOf(v.evaluate(ctx)))
    ],
    'to-rgba': [
        array(NumberType as Type, 4),
        [ColorType as Type],
        (ctx, [v]) => {
            return v.evaluate(ctx).toArray();
        }
    ],
    'rgb': [
        ColorType as Type,
        [NumberType as Type, NumberType as Type, NumberType as Type],
        rgba
    ],
    'rgba': [
        ColorType as Type,
        [NumberType as Type, NumberType as Type, NumberType as Type, NumberType as Type],
        rgba
    ],
    'has': {
        type: (BooleanType as Type),
        overloads: [
            [
                [StringType as Type],
                (ctx, [key]) => has(key.evaluate(ctx), ctx.properties())
            ], [
                [StringType as Type, ObjectType as Type],
                (ctx, [key, obj]) => has(key.evaluate(ctx), obj.evaluate(ctx))
            ]
        ]
    },
    'get': {
        type: (ValueType as Type),
        overloads: [
            [
                [StringType as Type],
                (ctx, [key]) => get(key.evaluate(ctx), ctx.properties())
            ], [
                [StringType as Type, ObjectType as Type],
                (ctx, [key, obj]) => get(key.evaluate(ctx), obj.evaluate(ctx))
            ]
        ]
    },
    'feature-state': [
        ValueType as Type,
        [StringType as Type],
        (ctx, [key]) => get(key.evaluate(ctx), ctx.featureState || {})
    ],
    'properties': [
        ObjectType as Type,
        [],
        (ctx) => ctx.properties()
    ],
    'geometry-type': [
        StringType as Type,
        [],
        (ctx) => ctx.geometryType()
    ],
    'id': [
        ValueType as Type,
        [],
        (ctx) => ctx.id()
    ],
    'zoom': [
        NumberType as Type,
        [],
        (ctx) => ctx.globals.zoom
    ],
    'heatmap-density': [
        NumberType as Type,
        [],
        (ctx) => ctx.globals.heatmapDensity || 0
    ],
    'line-progress': [
        NumberType as Type,
        [],
        (ctx) => ctx.globals.lineProgress || 0
    ],
    'accumulated': [
        ValueType as Type,
        [],
        (ctx) => ctx.globals.accumulated === undefined ? null : ctx.globals.accumulated
    ],
    '+': [
        NumberType as Type,
        varargs(NumberType as Type),
        (ctx, args) => {
            let result = 0;
            for (const arg of args) {
                result += arg.evaluate(ctx);
            }
            return result;
        }
    ],
    '*': [
        NumberType as Type,
        varargs(NumberType as Type),
        (ctx, args) => {
            let result = 1;
            for (const arg of args) {
                result *= arg.evaluate(ctx);
            }
            return result;
        }
    ],
    '-': {
        type: (NumberType as Type),
        overloads: [
            [
                [NumberType as Type, NumberType as Type],
                (ctx, [a, b]) => a.evaluate(ctx) - b.evaluate(ctx)
            ], [
                [NumberType as Type],
                (ctx, [a]) => -a.evaluate(ctx)
            ]
        ]
    },
    '/': [
        NumberType as Type,
        [NumberType as Type, NumberType as Type],
        (ctx, [a, b]) => a.evaluate(ctx) / b.evaluate(ctx)
    ],
    '%': [
        NumberType as Type,
        [NumberType as Type, NumberType as Type],
        (ctx, [a, b]) => a.evaluate(ctx) % b.evaluate(ctx)
    ],
    'ln2': [
        NumberType as Type,
        [],
        () => Math.LN2
    ],
    'pi': [
        NumberType as Type,
        [],
        () => Math.PI
    ],
    'e': [
        NumberType as Type,
        [],
        () => Math.E
    ],
    '^': [
        NumberType as Type,
        [NumberType as Type, NumberType as Type],
        (ctx, [b, e]) => Math.pow(b.evaluate(ctx), e.evaluate(ctx))
    ],
    'sqrt': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [x]) => Math.sqrt(x.evaluate(ctx))
    ],
    'log10': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN10
    ],
    'ln': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.log(n.evaluate(ctx))
    ],
    'log2': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN2
    ],
    'sin': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.sin(n.evaluate(ctx))
    ],
    'cos': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.cos(n.evaluate(ctx))
    ],
    'tan': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.tan(n.evaluate(ctx))
    ],
    'asin': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.asin(n.evaluate(ctx))
    ],
    'acos': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.acos(n.evaluate(ctx))
    ],
    'atan': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.atan(n.evaluate(ctx))
    ],
    'min': [
        NumberType as Type,
        varargs(NumberType as Type),
        (ctx, args) => Math.min(...args.map(arg => arg.evaluate(ctx)))
    ],
    'max': [
        NumberType as Type,
        varargs(NumberType as Type),
        (ctx, args) => Math.max(...args.map(arg => arg.evaluate(ctx)))
    ],
    'abs': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.abs(n.evaluate(ctx))
    ],
    'round': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => {
            const v = n.evaluate(ctx);
            // Javascript's Math.round() rounds towards +Infinity for halfway
            // values, even when they're negative. It's more common to round
            // away from 0 (e.g., this is what python and C++ do)
            return v < 0 ? -Math.round(-v) : Math.round(v);
        }
    ],
    'floor': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.floor(n.evaluate(ctx))
    ],
    'ceil': [
        NumberType as Type,
        [NumberType as Type],
        (ctx, [n]) => Math.ceil(n.evaluate(ctx))
    ],
    'filter-==': [
        BooleanType as Type,
        [StringType as Type, ValueType as Type],
        (ctx, [k, v]) => ctx.properties()[(k as any).value] === (v as any).value
    ],
    'filter-id-==': [
        BooleanType as Type,
        [ValueType as Type],
        (ctx, [v]) => ctx.id() === (v as any).value
    ],
    'filter-type-==': [
        BooleanType as Type,
        [StringType as Type],
        (ctx, [v]) => ctx.geometryType() === (v as any).value
    ],
    'filter-<': [
        BooleanType as Type,
        [StringType as Type, ValueType as Type],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k as any).value];
            const b = (v as any).value;
            return typeof a === typeof b && a < b;
        }
    ],
    'filter-id-<': [
        BooleanType as Type,
        [ValueType as Type],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v as any).value;
            return typeof a === typeof b && a < b;
        }
    ],
    'filter->': [
        BooleanType as Type,
        [StringType as Type, ValueType as Type],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k as any).value];
            const b = (v as any).value;
            return typeof a === typeof b && a > b;
        }
    ],
    'filter-id->': [
        BooleanType as Type,
        [ValueType as Type],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v as any).value;
            return typeof a === typeof b && a > b;
        }
    ],
    'filter-<=': [
        BooleanType as Type,
        [StringType as Type, ValueType as Type],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k as any).value];
            const b = (v as any).value;
            return typeof a === typeof b && a <= b;
        }
    ],
    'filter-id-<=': [
        BooleanType as Type,
        [ValueType as Type],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v as any).value;
            return typeof a === typeof b && a <= b;
        }
    ],
    'filter->=': [
        BooleanType as Type,
        [StringType as Type, ValueType as Type],
        (ctx, [k, v]) => {
            const a = ctx.properties()[(k as any).value];
            const b = (v as any).value;
            return typeof a === typeof b && a >= b;
        }
    ],
    'filter-id->=': [
        BooleanType as Type,
        [ValueType as Type],
        (ctx, [v]) => {
            const a = ctx.id();
            const b = (v as any).value;
            return typeof a === typeof b && a >= b;
        }
    ],
    'filter-has': [
        BooleanType as Type,
        [ValueType as Type],
        (ctx, [k]) => (k as any).value in ctx.properties()
    ],
    'filter-has-id': [
        BooleanType as Type,
        [],
        (ctx) => (ctx.id() !== null && ctx.id() !== undefined)
    ],
    'filter-type-in': [
        BooleanType as Type,
        [array(StringType as Type)],
        (ctx, [v]) => (v as any).value.indexOf(ctx.geometryType()) >= 0
    ],
    'filter-id-in': [
        BooleanType as Type,
        [array(ValueType as Type)],
        (ctx, [v]) => (v as any).value.indexOf(ctx.id()) >= 0
    ],
    'filter-in-small': [
        BooleanType as Type,
        [StringType as Type, array(ValueType as Type)],
        // assumes v is an array literal
        (ctx, [k, v]) => (v as any).value.indexOf(ctx.properties()[(k as any).value]) >= 0
    ],
    'filter-in-large': [
        BooleanType as Type,
        [StringType as Type, array(ValueType as Type)],
        // assumes v is a array literal with values sorted in ascending order and of a single type
        (ctx, [k, v]) => binarySearch(ctx.properties()[(k as any).value], (v as any).value, 0, (v as any).value.length - 1)
    ],
    'all': {
        type: (BooleanType as Type),
        overloads: [
            [
                [BooleanType as Type, BooleanType as Type],
                (ctx, [a, b]) => a.evaluate(ctx) && b.evaluate(ctx)
            ],
            [
                varargs(BooleanType as Type),
                (ctx, args) => {
                    for (const arg of args) {
                        if (!arg.evaluate(ctx))
                            return false;
                    }
                    return true;
                }
            ]
        ]
    },
    'any': {
        type: (BooleanType as Type),
        overloads: [
            [
                [BooleanType as Type, BooleanType as Type],
                (ctx, [a, b]) => a.evaluate(ctx) || b.evaluate(ctx)
            ],
            [
                varargs(BooleanType as Type),
                (ctx, args) => {
                    for (const arg of args) {
                        if (arg.evaluate(ctx))
                            return true;
                    }
                    return false;
                }
            ]
        ]
    },
    '!': [
        BooleanType as Type,
        [BooleanType as Type],
        (ctx, [b]) => !b.evaluate(ctx)
    ],
    'is-supported-script': [
        BooleanType as Type,
        [StringType as Type],
        // At parse time this will always return true, so we need to exclude this expression with isGlobalPropertyConstant
        (ctx, [s]) => {
            const isSupportedScript = ctx.globals && ctx.globals.isSupportedScript;
            if (isSupportedScript) {
                return isSupportedScript(s.evaluate(ctx));
            }
            return true;
        }
    ],
    'upcase': [
        StringType as Type,
        [StringType as Type],
        (ctx, [s]) => s.evaluate(ctx).toUpperCase()
    ],
    'downcase': [
        StringType as Type,
        [StringType as Type],
        (ctx, [s]) => s.evaluate(ctx).toLowerCase()
    ],
    'concat': [
        StringType as Type,
        varargs(ValueType as Type),
        (ctx, args) => args.map(arg => valueToString(arg.evaluate(ctx))).join('')
    ],
    'resolved-locale': [
        StringType as Type,
        [CollatorType as Type],
        (ctx, [collator]) => collator.evaluate(ctx).resolvedLocale()
    ]
});

export default expressions;
