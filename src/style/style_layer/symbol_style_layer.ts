import {StyleLayer} from '../style_layer';

import {SymbolBucket, SymbolFeature} from '../../data/bucket/symbol_bucket';
import {resolveTokens} from '../../util/resolve_tokens';
import properties, {SymbolLayoutPropsPossiblyEvaluated, SymbolPaintPropsPossiblyEvaluated} from './symbol_style_layer_properties.g';
import ONE_EM from '../../symbol/one_em';

import {
    Transitionable,
    Transitioning,
    Layout,
    PossiblyEvaluated,
    PossiblyEvaluatedPropertyValue,
    PropertyValue
} from '../properties';

import {
    isExpression,
    StyleExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    FormattedType,
    typeOf,
    Formatted,
    FormatExpression,
    Literal,
    VariableAnchorOffsetCollection} from '@maplibre/maplibre-gl-style-spec';

import type {BucketParameters} from '../../data/bucket';
import type {SymbolLayoutProps, SymbolPaintProps} from './symbol_style_layer_properties.g';
import type {EvaluationParameters} from '../evaluation_parameters';
import type {Expression, Feature, SourceExpression, LayerSpecification, VariableAnchorOffsetCollectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {CanonicalTileID} from '../../source/tile_id';
import {FormatSectionOverride} from '../format_section_override';

export class SymbolStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<SymbolLayoutProps>;
    layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>;

    _transitionablePaint: Transitionable<SymbolPaintProps>;
    _transitioningPaint: Transitioning<SymbolPaintProps>;
    paint: PossiblyEvaluated<SymbolPaintProps, SymbolPaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        super.recalculate(parameters, availableImages);

        if (this.layout.get('icon-rotation-alignment') === 'auto') {
            if (this.layout.get('symbol-placement') !== 'point') {
                this.layout._values['icon-rotation-alignment'] = 'map';
            } else {
                this.layout._values['icon-rotation-alignment'] = 'viewport';
            }
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
            this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment');
        }

        if (this.layout.get('symbol-placement') === 'point') {
            const writingModes = this.layout.get('text-writing-mode');
            if (writingModes) {
                // remove duplicates, preserving order
                const deduped = [];
                for (const m of writingModes) {
                    if (deduped.indexOf(m) < 0) deduped.push(m);
                }
                this.layout._values['text-writing-mode'] = deduped;
            } else {
                this.layout._values['text-writing-mode'] = ['horizontal'];
            }
        }

        this._setPaintOverrides();
    }

    getValueAndResolveTokens(name: any, feature: Feature, canonical: CanonicalTileID, availableImages: Array<string>) {
        const value = this.layout.get(name).evaluate(feature, {}, canonical, availableImages);
        const unevaluated = this._unevaluatedLayout._values[name];
        if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value) && value) {
            return resolveTokens(feature.properties, value);
        }

        return value;
    }

    createBucket(parameters: BucketParameters<any>) {
        return new SymbolBucket(parameters);
    }

    queryRadius(): number {
        return 0;
    }

    queryIntersectsFeature(): boolean {
        throw new Error('Should take a different path in FeatureIndex');
    }

    _setPaintOverrides() {
        for (const overridable of properties.paint.overridableProperties) {
            if (!SymbolStyleLayer.hasPaintOverride(this.layout, overridable)) {
                continue;
            }
            const overriden = this.paint.get(overridable as keyof SymbolPaintPropsPossiblyEvaluated) as PossiblyEvaluatedPropertyValue<number>;
            const override = new FormatSectionOverride(overriden);
            const styleExpression = new StyleExpression(override, overriden.property.specification);
            let expression = null;
            if (overriden.value.kind === 'constant' || overriden.value.kind === 'source') {
                expression = new ZoomConstantExpression('source', styleExpression) as SourceExpression;
            } else {
                expression = new ZoomDependentExpression('composite',
                    styleExpression,
                    overriden.value.zoomStops);
            }
            this.paint._values[overridable] = new PossiblyEvaluatedPropertyValue(overriden.property,
                expression,
                overriden.parameters);
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
                if (property.overrides && property.overrides.hasOverride(section)) {
                    hasOverrides = true;
                    return;
                }
            }
        };

        if (textField.value.kind === 'constant' && textField.value.value instanceof Formatted) {
            checkSections(textField.value.value.sections);
        } else if (textField.value.kind === 'source') {

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
    const values = result && result.values;

    return [
        values[0] * pixelRatio,
        values[1] * pixelRatio,
        values[2] * pixelRatio,
        values[3] * pixelRatio,
    ];
}

export enum TextAnchorEnum {
    'center' = 1,
    'left' = 2,
    'right' = 3,
    'top' = 4,
    'bottom' = 5,
    'top-left' = 6,
    'top-right' = 7,
    'bottom-left' = 8,
    'bottom-right' = 9
}

export type TextAnchor = keyof typeof TextAnchorEnum;

// The radial offset is to the edge of the text box
// In the horizontal direction, the edge of the text box is where glyphs start
// But in the vertical direction, the glyphs appear to "start" at the baseline
// We don't actually load baseline data, but we assume an offset of ONE_EM - 17
// (see "yOffset" in shaping.js)
const baselineOffset = 7;
export const INVALID_TEXT_OFFSET = Number.POSITIVE_INFINITY;

export function evaluateVariableOffset(anchor: TextAnchor, offset: [number, number]): [number, number] {

    function fromRadialOffset(anchor: TextAnchor, radialOffset: number): [number, number] {
        let x = 0, y = 0;
        if (radialOffset < 0) radialOffset = 0; // Ignore negative offset.
        // solve for r where r^2 + r^2 = radialOffset^2
        const hypotenuse = radialOffset / Math.sqrt(2);
        switch (anchor) {
            case 'top-right':
            case 'top-left':
                y = hypotenuse - baselineOffset;
                break;
            case 'bottom-right':
            case 'bottom-left':
                y = -hypotenuse + baselineOffset;
                break;
            case 'bottom':
                y = -radialOffset + baselineOffset;
                break;
            case 'top':
                y = radialOffset - baselineOffset;
                break;
        }

        switch (anchor) {
            case 'top-right':
            case 'bottom-right':
                x = -hypotenuse;
                break;
            case 'top-left':
            case 'bottom-left':
                x = hypotenuse;
                break;
            case 'left':
                x = radialOffset;
                break;
            case 'right':
                x = -radialOffset;
                break;
        }

        return [x, y];
    }

    function fromTextOffset(anchor: TextAnchor, offsetX: number, offsetY: number): [number, number] {
        let x = 0, y = 0;
        // Use absolute offset values.
        offsetX = Math.abs(offsetX);
        offsetY = Math.abs(offsetY);

        switch (anchor) {
            case 'top-right':
            case 'top-left':
            case 'top':
                y = offsetY - baselineOffset;
                break;
            case 'bottom-right':
            case 'bottom-left':
            case 'bottom':
                y = -offsetY + baselineOffset;
                break;
        }

        switch (anchor) {
            case 'top-right':
            case 'bottom-right':
            case 'right':
                x = -offsetX;
                break;
            case 'top-left':
            case 'bottom-left':
            case 'left':
                x = offsetX;
                break;
        }

        return [x, y];
    }

    return (offset[1] !== INVALID_TEXT_OFFSET) ? fromTextOffset(anchor, offset[0], offset[1]) : fromRadialOffset(anchor, offset[0]);
}

// Helper to support both text-variable-anchor and text-variable-anchor-offset. Offset values converted from EMs to PXs
export function getTextVariableAnchorOffset(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, feature: SymbolFeature, canonical: CanonicalTileID): VariableAnchorOffsetCollection | null {
    // If style specifies text-variable-anchor-offset, just return it
    const variableAnchorOffset = layout.get('text-variable-anchor-offset')?.evaluate(feature, {}, canonical);

    if (variableAnchorOffset) {
        const sourceValues = variableAnchorOffset.values;
        const destValues: VariableAnchorOffsetCollectionSpecification = [];

        // Convert offsets from EM to PX, and apply baseline shift
        for (let i = 0; i < sourceValues.length; i += 2) {
            const anchor = destValues[i] = sourceValues[i] as TextAnchor;
            const offset = (sourceValues[i + 1] as [number, number]).map(t => t * ONE_EM) as [number, number];

            if (anchor.startsWith('top')) {
                offset[1] -= baselineOffset;
            } else if (anchor.startsWith('bottom')) {
                offset[1] += baselineOffset;
            }

            destValues[i + 1] = offset;
        }

        return new VariableAnchorOffsetCollection(destValues);
    }

    // If style specifies text-variable-anchor, convert to the new format
    const variableAnchor = layout.get('text-variable-anchor');

    if (variableAnchor) {
        let textOffset: [number, number];
        const radialOffset = layout.get('text-radial-offset').evaluate(feature, {}, canonical);

        if (radialOffset) {
            textOffset = [radialOffset * ONE_EM, INVALID_TEXT_OFFSET];
        } else {
            textOffset = layout.get('text-offset').evaluate(feature, {}, canonical).map(t => t * ONE_EM) as [number, number];
        }

        const anchorOffsets: VariableAnchorOffsetCollectionSpecification = [];

        for (const anchor of variableAnchor) {
            anchorOffsets.push(anchor, evaluateVariableOffset(anchor, textOffset));
        }

        return new VariableAnchorOffsetCollection(anchorOffsets);
    }

    return null;
}
