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

import {warnOnce} from '../../util/util.ts';

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

export const isSymbolStyleLayer = (layer: StyleLayer): layer is SymbolStyleLayer => layer.type === 'symbol';

export class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<SymbolLayoutProps>;
    layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<SymbolPaintProps>;
    _transitioningPaint: Transitioning<SymbolPaintProps>;
    paint: PossiblyEvaluated<SymbolPaintProps, SymbolPaintPropsPossiblyEvaluated>;

    /** Whether this layer uses per-vertex icon rotation alignment. */
    hasDataDrivenIconRotationAlignment: boolean;

    /** What `icon-rotation-alignment: auto` stands for in this layer, see {@link recalculate}. */
    _autoIconRotationAlignment: 'map' | 'viewport';

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);
    }

    recalculate(parameters: EvaluationParameters, availableImages: string[]): void {
        super.recalculate(parameters, availableImages);

        // `auto` is resolved against `symbol-placement`, which is never data-driven, so the value it
        // stands for is the same for every feature even when the property itself is a data
        // expression.
        this._autoIconRotationAlignment = this.layout.get('symbol-placement') !== 'point' ? 'map' : 'viewport';

        const iconRotationAlignment = this.layout.get('icon-rotation-alignment');
        if (iconRotationAlignment.constantOr(null) === 'auto') {
            this.layout._values['icon-rotation-alignment'] = new PossiblyEvaluatedPropertyValue(
                iconRotationAlignment.property,
                {kind: 'constant', value: this._autoIconRotationAlignment},
                iconRotationAlignment.parameters);
        }

        if (this.layout.get('text-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                this.layout._values['text-rotation-alignment'] = 'map';
            } else {
                this.layout._values['text-rotation-alignment'] = 'viewport';
            }
        }

        // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
        if (this.layout.get('text-pitch-alignment') === 'auto') {
            this.layout._values['text-pitch-alignment'] = this.layout.get('text-rotation-alignment') === 'map' ? 'map' : 'viewport';
        }
        if (this.layout.get('icon-pitch-alignment') === 'auto') {
            // `icon-pitch-alignment` is not data-driven, so it cannot inherit a data expression.
            // Such layers fall back to `viewport`, which is also the only pitch alignment that
            // per-feature rotation alignment is supported with.
            this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment').constantOr('viewport');
        }

        this.hasDataDrivenIconRotationAlignment = this._supportsDataDrivenIconRotationAlignment();

        if (this.layout.get('symbol-placement') === 'point') {
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

    /**
     * A data-driven `icon-rotation-alignment` is realised by rotating each symbol in the vertex
     * shader, which is only how alignment is expressed for point symbols drawn in the viewport
     * plane. Along a line the angle comes from the CPU-side line projection, and with
     * `icon-pitch-alignment: map` it is baked into the label plane matrix. Both are per-layer. Such
     * layers keep the old behaviour, using the constant fallback for the whole layer.
     */
    _supportsDataDrivenIconRotationAlignment(): boolean {
        if (this.layout.get('icon-rotation-alignment').isConstant()) {
            return false;
        }
        if (this.layout.get('symbol-placement') !== 'point') {
            warnOnce(`${this.id}: data-driven "icon-rotation-alignment" is only supported with "symbol-placement": "point".`);
            return false;
        }
        if (this.layout.get('icon-pitch-alignment') === 'map') {
            warnOnce(`${this.id}: data-driven "icon-rotation-alignment" is not supported with "icon-pitch-alignment": "map".`);
            return false;
        }
        return true;
    }

    /** Resolves the feature alignment to whether the icon rotates with the map. */
    getIconRotateWithMap(feature: Feature, canonical: CanonicalTileID): boolean {
        const alignment = this.layout.get('icon-rotation-alignment').evaluate(feature, {}, canonical);
        return (alignment === 'auto' ? this._autoIconRotationAlignment : alignment) === 'map';
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
