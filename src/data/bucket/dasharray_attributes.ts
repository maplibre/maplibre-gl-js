import {createLayout} from '../../util/struct_array';

export const dasharrayAttributes = createLayout([
    // [tl.x, tl.y, br.x, br.y] - coordinates for dasharray texture lookup
    {name: 'a_dasharray_from', components: 4, type: 'Uint16'},
    {name: 'a_dasharray_to', components: 4, type: 'Uint16'},
    {name: 'a_dash_pixel_ratio_from', components: 1, type: 'Uint16'},
    {name: 'a_dash_pixel_ratio_to', components: 1, type: 'Uint16'},
]);
