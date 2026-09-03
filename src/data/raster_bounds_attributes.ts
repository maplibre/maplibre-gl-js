import {createLayout, type StructArrayLayout} from '../util/struct_array.ts';

const rasterBoundsAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos', type: 'Int16', components: 2},
    {name: 'a_texture_pos', type: 'Int16', components: 2}
]);

export default rasterBoundsAttributes;
