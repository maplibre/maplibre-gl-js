import {createLayout, type StructArrayLayout} from '../util/struct_array.ts';

const pos3dAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos3d', type: 'Int16', components: 3}
]);

export default pos3dAttributes;
