import {createLayout, type StructArrayLayout, type StructArrayMember} from '../../util/struct_array.ts';

/**
 * Per vertex, how much longer the `line-offset` line is than the line itself up to that vertex, for an offset
 * of one unit of line distance. Dashes add `line-offset` times this to the distance along the line.
 */
export const lineLayoutAttributesOffset: StructArrayLayout = createLayout([
    {name: 'a_offset_distance', components: 1, type: 'Float32'}
]);

export const members: StructArrayMember[] = lineLayoutAttributesOffset.members;
export const size: number = lineLayoutAttributesOffset.size;
export const alignment: number = lineLayoutAttributesOffset.alignment;
