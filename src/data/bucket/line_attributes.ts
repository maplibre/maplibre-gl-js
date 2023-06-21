import {createLayout} from '../../util/struct_array';

export const lineLayoutAttributes = createLayout([
    {name: 'a_pos_normal', components: 2, type: 'Int16'},
    {name: 'a_data', components: 4, type: 'Uint8'}
], 4);

export const {members, size, alignment} = lineLayoutAttributes;
