import {createLayout} from '../util/struct_array';

export default createLayout([
    {name: 'a_pos3d', type: 'Float32', components: 3},
    {name: 'a_texcoord', type: 'Uint16', components: 2},
]);
