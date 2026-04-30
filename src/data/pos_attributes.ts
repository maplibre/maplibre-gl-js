import {createLayout, type StructArrayLayout} from '../util/struct_array';

const posAttributes: StructArrayLayout = createLayout([
    {name: 'a_pos', type: 'Int16', components: 2}
]);

export default posAttributes;
