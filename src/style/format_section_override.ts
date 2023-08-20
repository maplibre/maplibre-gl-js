import type {Expression, EvaluationContext, Type, ZoomConstantExpression} from '@maplibre/maplibre-gl-style-spec';
import {NullType} from '@maplibre/maplibre-gl-style-spec';
import {PossiblyEvaluatedPropertyValue} from './properties';
import {register} from '../util/web_worker_transfer';

// This is an internal expression class. It is only used in GL JS and
// has GL JS dependencies which can break the standalone style-spec module
export class FormatSectionOverride<T> implements Expression {
    type: Type;
    defaultValue: PossiblyEvaluatedPropertyValue<T>;

    constructor(defaultValue: PossiblyEvaluatedPropertyValue<T>) {
        if (defaultValue.property.overrides === undefined) throw new Error('overrides must be provided to instantiate FormatSectionOverride class');
        this.type = defaultValue.property.overrides ? defaultValue.property.overrides.runtimeType : NullType;
        this.defaultValue = defaultValue;
    }

    evaluate(ctx: EvaluationContext) {
        if (ctx.formattedSection) {
            const overrides = this.defaultValue.property.overrides;
            if (overrides && overrides.hasOverride(ctx.formattedSection)) {
                return overrides.getOverride(ctx.formattedSection);
            }
        }

        if (ctx.feature && ctx.featureState) {
            return this.defaultValue.evaluate(ctx.feature, ctx.featureState);
        }

        return this.defaultValue.property.specification.default;
    }

    eachChild(fn: (_: Expression) => void) {
        if (!this.defaultValue.isConstant()) {
            const expr: ZoomConstantExpression<'source'> = (this.defaultValue.value as any);
            fn(expr._styleExpression.expression);
        }
    }

    // Cannot be statically evaluated, as the output depends on the evaluation context.
    outputDefined() {
        return false;
    }

    serialize() {
        return null;
    }
}

register('FormatSectionOverride', FormatSectionOverride, {omit: ['defaultValue']});
