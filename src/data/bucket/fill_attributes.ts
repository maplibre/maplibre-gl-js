import {createLayout} from '../../util/struct_array';

export const layout = createLayout([
    {name: 'a_pos', components: 2, type: 'Int16'}
], 4);

export const layoutPreprojected = createLayout([
    {name: 'a_pos_preprojected', components: 3, type: 'Float32'},
    {name: 'a_pos', components: 2, type: 'Int16'}
], 4);
