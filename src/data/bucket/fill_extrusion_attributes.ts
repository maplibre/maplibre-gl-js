import {createLayout, type StructArrayLayout, type StructArrayMember} from '../../util/struct_array';

const layout: StructArrayLayout = createLayout([
    {name: 'a_pos',          components: 2, type: 'Int16'},
    {name: 'a_normal_ed',    components: 4, type: 'Int16'},
], 4);

export const centroidAttributes: StructArrayLayout = createLayout([
    {name: 'a_centroid', components: 2, type: 'Int16'}
], 4);

export default layout;
export const members: StructArrayMember[] = layout.members;
export const size: number = layout.size;
export const alignment: number = layout.alignment;
