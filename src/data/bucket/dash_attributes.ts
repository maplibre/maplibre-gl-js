import {createLayout, type StructArrayLayout} from '../../util/struct_array.ts';

export const dashAttributes: StructArrayLayout = createLayout([
    // [0, y, height, width]
    {name: 'a_dasharray', components: 4, type: 'Uint16'},
]);
