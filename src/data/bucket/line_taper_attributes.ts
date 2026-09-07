import {createLayout, type StructArrayLayout, type StructArrayMember} from '../../util/struct_array.ts';

/*
 * Per-vertex line taper attribute.

 * `a_taper` stores, depending on the active taper mode:
 *   - the normalized position of a vertex along its line (0.0 = line start,
 *     1.0 = line end) for `line-width-start`/`line-width-end`:
 *         width = mix(widthStart, widthEnd, a_taper)
 *   - the absolute width at the vertex for `line-widths`
 *   - a multiplier of `line-width` at the vertex for `line-width-factors`

 * The attribute lives in its own vertex buffer which is only created and bound
 * when a line style layer uses one of the taper properties, so regular lines
 * pay zero extra memory or upload cost.
 */
export const lineTaperAttributes: StructArrayLayout = createLayout([
    {name: 'a_taper', components: 1, type: 'Float32'}
], 4);

export const members: StructArrayMember[] = lineTaperAttributes.members;
export const size: number = lineTaperAttributes.size;
export const alignment: number = lineTaperAttributes.alignment;