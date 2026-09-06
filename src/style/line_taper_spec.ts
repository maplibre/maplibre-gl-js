import {latest} from '@maplibre/maplibre-gl-style-spec';
import type {StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

/*
 * Single source of truth for the extra line paint properties implemented by
 * MapLibre GL JS itself, which are not part of the published maplibre-style-spec
 * package (yet).
 *
 * `line-width-start` and `line-width-end` implement tapered lines: the line width
 * is interpolated between the two values along the length of each line. The default
 * of `-1` means "not set" — the line vertex shader then falls back to `line-width`,
 * and the line bucket skips the per-vertex taper buffer entirely.
 *
 * `line-widths` implements per-vertex widths: a data-driven array of numbers, one
 * per vertex of the line, which the bucket writes directly into the per-vertex
 * buffer. It takes precedence over `line-width-start`/`line-width-end`. The
 * default of `[]` means "not set".
 *
 * `line-width-factors` implements per-vertex width FACTORS: a data-driven array of
 * multipliers (one per vertex of the line), each applied to the (zoom-composited)
 * `line-width` value. Unlike `line-widths` the base width keeps its normal paint
 * semantics (including zoom interpolation), so zoom-live tapered lines are possible
 * without rebuilding geometry. It takes precedence over `line-widths`. The default
 * of `[]` means "not set"; a feature without a value renders at `line-width`.
 */
export const lineTaperPaintSpecs: {[name: string]: StylePropertySpecification} = {
    'line-width-start': {
        type: 'number',
        default: -1,
        transition: true,
        'property-type': 'data-driven',
        expression: {interpolated: true, parameters: ['zoom', 'feature']}
    },
    'line-width-end': {
        type: 'number',
        default: -1,
        transition: true,
        'property-type': 'data-driven',
        expression: {interpolated: true, parameters: ['zoom', 'feature']}
    },
    'line-widths': {
        type: 'array',
        value: 'number',
        default: [],
        transition: false,
        'property-type': 'data-driven',
        expression: {interpolated: false, parameters: ['zoom', 'feature']}
    },
    'line-width-factors': {
        type: 'array',
        value: 'number',
        default: [],
        transition: false,
        'property-type': 'data-driven',
        expression: {interpolated: false, parameters: ['zoom', 'feature']}
    }
};

/**
 * Makes the style validators accept the extra properties by patching the
 * style-spec `latest` entry the validators read from. Idempotent, and a no-op
 * once the properties land in the published spec.
 */
export function extendStyleSpecWithLineTaper(): void {
    const paintLine = latest.paint_line as Record<string, unknown>;
    for (const name of Object.keys(lineTaperPaintSpecs)) {
        if (!(name in paintLine)) {
            paintLine[name] = lineTaperPaintSpecs[name];
        }
    }
}