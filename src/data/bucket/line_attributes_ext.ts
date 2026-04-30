import {createLayout, type StructArrayLayout, type StructArrayMember} from '../../util/struct_array';

export const lineLayoutAttributesExt: StructArrayLayout = createLayout([
    {name: 'a_uv_x', components: 1, type: 'Float32'},
    {name: 'a_split_index', components: 1, type: 'Float32'},
]);

export const members: StructArrayMember[] = lineLayoutAttributesExt.members;
export const size: number = lineLayoutAttributesExt.size;
export const alignment: number = lineLayoutAttributesExt.alignment;
