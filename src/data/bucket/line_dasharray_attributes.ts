import {createLayout} from '../../util/struct_array';

export const lineDasharrayAttributes = createLayout([
    // [height, width, y]
    {name: 'a_tex_from', components: 3, type: 'Uint16'},
    {name: 'a_tex_to', components: 3, type: 'Uint16'},
]);
