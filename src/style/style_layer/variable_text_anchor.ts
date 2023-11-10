import {VariableAnchorOffsetCollection, VariableAnchorOffsetCollectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import {SymbolFeature} from '../../data/bucket/symbol_bucket';
import {CanonicalTileID} from '../../source/tile_id';
import ONE_EM from '../../symbol/one_em';
import {SymbolStyleLayer} from './symbol_style_layer';

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
        const hypotenuse = radialOffset / Math.SQRT2;
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
export function getTextVariableAnchorOffset(layer: SymbolStyleLayer, feature: SymbolFeature, canonical: CanonicalTileID): VariableAnchorOffsetCollection | null {
    const layout = layer.layout;
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
        const unevaluatedLayout = layer._unevaluatedLayout;

        // The style spec says don't use `text-offset` and `text-radial-offset` together
        // but doesn't actually specify what happens if you use both. We go with the radial offset.
        if (unevaluatedLayout.getValue('text-radial-offset') !== undefined) {
            textOffset = [layout.get('text-radial-offset').evaluate(feature, {}, canonical) * ONE_EM, INVALID_TEXT_OFFSET];
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
