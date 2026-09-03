import {createLayout, type StructArrayLayout} from '../../util/struct_array.ts';

export const dashAttributes: StructArrayLayout = createLayout([
    // [0, y, height, width]
    {name: 'a_dasharray_from', components: 4, type: 'Uint16'},
    {name: 'a_dasharray_to', components: 4, type: 'Uint16'},
]);
