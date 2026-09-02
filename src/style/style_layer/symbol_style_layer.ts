import {StyleLayer} from '../style_layer.ts';

import {SymbolBucket, type SymbolFeature} from '../../data/bucket/symbol_bucket.ts';
import {resolveTokens} from '../../util/resolve_tokens.ts';
import properties, {type SymbolLayoutPropsPossiblyEvaluated, type SymbolPaintPropsPossiblyEvaluated} from './symbol_style_layer_properties.g.ts';

import {
    type Transitionable,
    type Transitioning,
    type Layout,
    type PossiblyEvaluated,
    PossiblyEvaluatedPropertyValue,
    type PropertyValue
} from '../properties.ts';

import {
    isExpression,
    StyleExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    FormattedType,
    typeOf,
    Formatted,
    FormatExpression,
    Literal} from '@maplibre/maplibre-gl-style-spec';

import type {BucketParameters} from '../../data/bucket.ts';
import type {SymbolLayoutProps, SymbolPaintProps} from './symbol_style_layer_properties.g.ts';
import type {EvaluationParameters} from '../evaluation_parameters.ts';
import type {Expression, Feature, SourceExpression, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {CanonicalTileID} from '../../tile/tile_id.ts';
import {FormatSectionOverride} from '../format_section_override.ts';
import {warnOnce} from '../../util/util.ts';

export const isSymbolStyleLayer = (layer: StyleLayer): layer is SymbolStyleLayer => layer.type === 'symbol';

export class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<SymbolLayoutProps>;
    layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<SymbolPaintProps>;
    _transitioningPaint: Transitioning<SymbolPaintProps>;
    paint: PossiblyEvaluated<SymbolPaintProps, SymbolPaintPropsPossiblyEvaluated>;
    _autoIconRotationAlignment: 'map' | 'viewport';
    hasDataDrivenIconRotationAlignment: boolean;

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
    }

    recalculate(parameters: EvaluationParameters, availableImages: string[]): void {
        super.recalculate(parameters, availableImages);

        const symbolPlacement = this.layout.get('symbol-placement');
        const iconPitchAlignment = this.layout.get('icon-pitch-alignment');
        this._autoIconRotationAlignment = symbolPlacement === 'point' ? 'viewport' : 'map';

        let iconRotationAlignment = this.layout.get('icon-rotation-alignment');
        const hasDataDrivenIconRotationAlignment = iconRotationAlignment.value.kind !== 'constant';
        if (iconRotationAlignment.value.kind === 'constant' && iconRotationAlignment.value.value === 'auto') {
            this.layout._values['icon-rotation-alignment'] = new PossiblyEvaluatedPropertyValue(
                iconRotationAlignment.property,
                {kind: 'constant', value: this._autoIconRotationAlignment},
                iconRotationAlignment.parameters);
            iconRotationAlignment = this.layout.get('icon-rotation-alignment');
        }

        this.hasDataDrivenIconRotationAlignment = hasDataDrivenIconRotationAlignment &&
            symbolPlacement === 'point' && iconPitchAlignment !== 'map';
        if (hasDataDrivenIconRotationAlignment && !this.hasDataDrivenIconRotationAlignment) {
            if (symbolPlacement !== 'point') {
                warnOnce(`${this.id}: data-driven "icon-rotation-alignment" is only supported with "symbol-placement": "point".`);
            }
            if (iconPitchAlignment === 'map') {
                warnOnce(`${this.id}: data-driven "icon-rotation-alignment" is not supported with "icon-pitch-alignment": "map".`);
            }
            this.layout._values['icon-rotation-alignment'] = new PossiblyEvaluatedPropertyValue(
                iconRotationAlignment.property,
                {kind: 'constant', value: this._autoIconRotationAlignment},
                iconRotationAlignment.parameters);
        }

        if (this.layout.get('text-rotation-alignment') === 'auto') {
            if (symbolPlacement !== 'point') {
                this.layout._values['text-rotation-alignment'] = 'map';
            } else {
                this.layout._values['text-rotation-alignment'] = 'viewport';
            }
        }

        // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
        if (this.layout.get('text-pitch-alignment') === 'auto') {
            this.layout._values['text-pitch-alignment'] = this.layout.get('text-rotation-alignment') === 'map' ? 'map' : 'viewport';
        }
        if (iconPitchAlignment === 'auto') {
            this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment').constantOr('viewport');
        }

        if (symbolPlacement === 'point') {
            const writingModes = this.layout.get('text-writing-mode');
            if (writingModes) {
                // remove duplicates, preserving order
                const deduped = [];
                for (const m of writingModes) {
                    if (!deduped.includes(m)) deduped.push(m);
                }
                this.layout._values['text-writing-mode'] = deduped;
            } else {
                this.layout._values['text-writing-mode'] = ['horizontal'];
            }
        }

        this._setPaintOverrides();
    }

    iconRotatesWithMap(feature: SymbolFeature, canonical: CanonicalTileID): boolean {
        const alignment = this.layout.get('icon-rotation-alignment').evaluate(feature, {}, canonical);
        return alignment === 'map' || (alignment === 'auto' && this._autoIconRotationAlignment === 'map');
    }

    getValueAndResolveTokens(name: any, feature: Feature, canonical: CanonicalTileID, availableImages: string[]): any {
        const value = this.layout.get(name).evaluate(feature, {}, canonical, availableImages);
        const unevaluated = this._unevaluatedLayout._values[name];
        if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value) && value) {
            return resolveTokens(feature.properties, value);
        }

        return value;
    }

    createBucket(parameters: BucketParameters<any>): SymbolBucket {
        return new SymbolBucket(parameters);
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        throw new Error('Should take a different path in FeatureIndex');
    }

    _setPaintOverrides(): void {
        for (const overridable of properties.paint.overridableProperties) {
            if (!SymbolStyleLayer.hasPaintOverride(this.layout, overridable)) {
                continue;
            }
            const overridden = this.paint.get(overridable as keyof SymbolPaintPropsPossiblyEvaluated) as PossiblyEvaluatedPropertyValue<number>;
            const override = new FormatSectionOverride(overridden);
            const styleExpression = new StyleExpression(override, `layers[${this.id}].paint.${overridden.property.name}`, overridden.property.specification);
            let expression = null;
            if (overridden.value.kind === 'constant' || overridden.value.kind === 'source') {
                expression = new ZoomConstantExpression('source', styleExpression) as SourceExpression;
            } else {
                expression = new ZoomDependentExpression('composite',
                    styleExpression,
                    overridden.value.zoomStops);
            }
            this.paint._values[overridable] = new PossiblyEvaluatedPropertyValue(overridden.property,
                expression,
                overridden.parameters);
        }
    }

    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (!this.layout || oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        return SymbolStyleLayer.hasPaintOverride(this.layout, name);
    }

    static hasPaintOverride(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, propertyName: string): boolean {
        const textField = layout.get('text-field');
        const property = properties.paint.properties[propertyName];
        let hasOverrides = false;

        const checkSections = (sections) => {
            for (const section of sections) {
                if (property.overrides?.hasOverride(section)) {
                    hasOverrides = true;
                    return;
                }
            }
        };

        if (textField.value.kind === 'constant' && textField.value.value instanceof Formatted) {
            checkSections(textField.value.value.sections);
        } else if (textField.value.kind === 'source' || textField.value.kind === 'composite') {

            const checkExpression = (expression: Expression) => {
                if (hasOverrides) return;

                if (expression instanceof Literal && typeOf(expression.value) === FormattedType) {
                    const formatted: Formatted = (expression.value as any);
                    checkSections(formatted.sections);
                } else if (expression instanceof FormatExpression) {
                    checkSections(expression.sections);
                } else {
                    expression.eachChild(checkExpression);
                }
            };

            const expr: ZoomConstantExpression<'source'> = (textField.value as any);
            if (expr._styleExpression) {
                checkExpression(expr._styleExpression.expression);
            }
        }

        return hasOverrides;
    }
}

export type SymbolPadding = [number, number, number, number];

export function getIconPadding(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, feature: SymbolFeature, canonical: CanonicalTileID, pixelRatio = 1): SymbolPadding {
    // Support text-padding in addition to icon-padding? Unclear how to apply asymmetric text-padding to the radius for collision circles.
    const result = layout.get('icon-padding').evaluate(feature, {}, canonical);
    const values = result?.values;

    return [
        values[0] * pixelRatio,
        values[1] * pixelRatio,
        values[2] * pixelRatio,
        values[3] * pixelRatio,
    ];
}
