import {createLayout} from '../../util/struct_array';

export const dashAttributes = createLayout([
    // [tl.x, tl.y, br.x, br.y] - coordinates for dasharray texture lookup
    {name: 'a_dasharray_from', components: 4, type: 'Uint16'},
    {name: 'a_dasharray_to', components: 4, type: 'Uint16'}
]);
