import {createLayout, type StructArrayLayout, type StructArrayMember} from '../../util/struct_array.ts';

/**
 * The corners that `fill-rounded-corner-distance` rounds within one triangle of a fill, repeated on each
 * of the triangle's three vertices so the shader can pass them on unchanged to every fragment.
 *
 * Each slot holds a corner, the vertex before it and the vertex after it, in tile units. The vertices
 * after the corners share two attributes so the layout stays within WebGL's attribute limit, and the
 * last one carries how many slots are in use and whether the triangle adds the arc's area rather than
 * cutting it away. Ring vertices that only draw the outline carry zeros.
 */
const layout: StructArrayLayout = createLayout([
    {name: 'a_corner0', components: 4, type: 'Int16'},
    {name: 'a_corner1', components: 4, type: 'Int16'},
    {name: 'a_corner2', components: 4, type: 'Int16'},
    {name: 'a_corner_next01', components: 4, type: 'Int16'},
    {name: 'a_corner_next2', components: 4, type: 'Int16'}
], 4);

export default layout;
export const members: StructArrayMember[] = layout.members;
