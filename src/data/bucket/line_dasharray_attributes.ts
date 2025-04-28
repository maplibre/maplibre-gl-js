import {createLayout} from '../../util/struct_array';

export const lineDasharrayAttributes = createLayout([
    // [y, height, width]
    {name: 'a_dasharray_from', components: 3, type: 'Uint16'},
    {name: 'a_dasharray_to', components: 3, type: 'Uint16'},
]);
