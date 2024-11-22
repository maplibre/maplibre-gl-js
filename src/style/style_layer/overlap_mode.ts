import {SymbolLayoutPropsPossiblyEvaluated} from './symbol_style_layer_properties.g';
import type {SymbolLayoutProps} from './symbol_style_layer_properties.g';
import {PossiblyEvaluated} from '../properties';

/**
 * The overlap mode for properties like `icon-overlap`and `text-overlap`
 */
export type OverlapMode = 'never' | 'always' | 'cooperative';

export function getOverlapMode(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, overlapProp: 'icon-overlap', allowOverlapProp: 'icon-allow-overlap'): OverlapMode;
export function getOverlapMode(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, overlapProp: 'text-overlap', allowOverlapProp: 'text-allow-overlap'): OverlapMode;
export function getOverlapMode(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, overlapProp: 'icon-overlap' | 'text-overlap', allowOverlapProp: 'icon-allow-overlap' | 'text-allow-overlap'): OverlapMode {
    let result: OverlapMode = 'never';
    const overlap = layout.get(overlapProp);

    if (overlap) {
        // if -overlap is set, use it
        result = overlap;
    } else if (layout.get(allowOverlapProp)) {
        // fall back to -allow-overlap, with false='never', true='always'
        result = 'always';
    }

    return result;
}
