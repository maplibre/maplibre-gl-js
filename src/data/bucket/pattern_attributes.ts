import {createLayout, type StructArrayLayout} from '../../util/struct_array.ts';

export const patternAttributes: StructArrayLayout = createLayout([
    // [tl.x, tl.y, br.x, br.y]
    {name: 'a_pattern_from', components: 4, type: 'Uint16'},
    {name: 'a_pattern_to', components: 4, type: 'Uint16'},
    {name: 'a_pixel_ratio_from', components: 1, type: 'Uint16'},
    {name: 'a_pixel_ratio_to', components: 1, type: 'Uint16'},
]);
