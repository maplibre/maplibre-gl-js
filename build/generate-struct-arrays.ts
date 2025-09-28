/*
 * Generates the following:
 *  - data/array_types.js, which consists of:
 *    - StructArrayLayout_* subclasses, one for each underlying memory layout we need
 *    - Named exports mapping each conceptual array type (e.g., CircleLayoutArray) to its corresponding StructArrayLayout class
 *    - Particular, named StructArray subclasses, when fancy struct accessors are needed (e.g. CollisionBoxArray)
 */

'use strict';

import * as fs from 'fs';
import * as util from '../src/util/util';
import {createLayout, viewTypes} from '../src/util/struct_array';
import type {ViewType, StructArrayLayout} from '../src/util/struct_array';

import posAttributes from '../src/data/pos_attributes';
import pos3dAttributes from '../src/data/pos3d_attributes';
import rasterBoundsAttributes from '../src/data/raster_bounds_attributes';
import circleAttributes from '../src/data/bucket/circle_attributes';
import fillAttributes from '../src/data/bucket/fill_attributes';
import fillExtrusionAttributes from '../src/data/bucket/fill_extrusion_attributes';
import {lineLayoutAttributes} from '../src/data/bucket/line_attributes';
import {lineLayoutAttributesExt} from '../src/data/bucket/line_attributes_ext';
import {patternAttributes} from '../src/data/bucket/pattern_attributes';
import {dashAttributes} from '../src/data/bucket/dash_attributes';
// symbol layer specific arrays
import {
    symbolLayoutAttributes,
    dynamicLayoutAttributes,
    placementOpacityAttributes,
    collisionBox,
    collisionBoxLayout,
    collisionCircleLayout,
    collisionVertexAttributes,
    quadTriangle,
    placement,
    symbolInstance,
    glyphOffset,
    lineVertex,
    textAnchorOffset
} from '../src/data/bucket/symbol_attributes';

const typeAbbreviations = {
    'Int8': 'b',
    'Uint8': 'ub',
    'Int16': 'i',
    'Uint16': 'ui',
    'Int32': 'l',
    'Uint32': 'ul',
    'Float32': 'f'
};

const arraysWithStructAccessors = [];
const arrayTypeEntries = new Set();
const layoutCache = {};

function normalizeMembers(members, usedTypes) {
    return members.map((member) => {
        if (usedTypes && !usedTypes.has(member.type)) {
            usedTypes.add(member.type);
        }

        return util.extend(member, {
            size: sizeOf(member.type),
            view: member.type.toLowerCase()
        });
    });
}

// - If necessary, write the StructArrayLayout_* class for the given layout
// - If `includeStructAccessors`, write the fancy subclass
// - Add an entry for `name` in the array type registry
function createStructArrayType(name: string, layout: StructArrayLayout, includeStructAccessors: boolean = false) {
    const hasAnchorPoint = layout.members.some(m => m.name === 'anchorPointX');

    // create the underlying StructArrayLayout class exists
    const layoutClass = createStructArrayLayoutType(layout);
    const arrayClass = `${camelize(name)}Array`;

    if (includeStructAccessors) {
        const usedTypes = new Set(['Uint8']);
        const members = normalizeMembers(layout.members, usedTypes);
        arraysWithStructAccessors.push({
            arrayClass,
            members,
            size: layout.size,
            usedTypes,
            hasAnchorPoint,
            layoutClass,
            includeStructAccessors
        });
    } else {
        arrayTypeEntries.add(`export class ${arrayClass} extends ${layoutClass} {}`);
    }
}

function createStructArrayLayoutType({members, size, alignment}) {
    const usedTypes = new Set(['Uint8']);
    members = normalizeMembers(members, usedTypes);

    // combine consecutive 'members' with same underlying type, summing their
    // component counts
    if (!alignment || alignment === 1) members = members.reduce((memo, member) => {
        if (memo.length > 0 && memo[memo.length - 1].type === member.type) {
            const last = memo[memo.length - 1];
            return memo.slice(0, -1).concat(util.extend({}, last, {
                components: last.components + member.components,
            }));
        }
        return memo.concat(member);
    }, []);

    const key = `${members.map(m => `${m.components}${typeAbbreviations[m.type]}`).join('')}${size}`;
    const className = `StructArrayLayout${key}`;

    if (!layoutCache[key]) {
        layoutCache[key] = {
            className,
            members,
            size,
            usedTypes
        };
    }

    return className;
}

function sizeOf(type: ViewType): number {
    return viewTypes[type].BYTES_PER_ELEMENT;
}

function camelize (str) {
    return str.replace(/(?:^|[-_])(.)/g, (_, x) => {
        return /^[0-9]$/.test(x) ? _ : x.toUpperCase();
    });
}

createStructArrayType('pos', posAttributes);
createStructArrayType('pos3d', pos3dAttributes);
createStructArrayType('raster_bounds', rasterBoundsAttributes);

// layout vertex arrays
const layoutAttributes = {
    circle: circleAttributes,
    fill: fillAttributes,
    'fill-extrusion': fillExtrusionAttributes,
    heatmap: circleAttributes,
    line: lineLayoutAttributes,
    lineExt: lineLayoutAttributesExt,
    pattern: patternAttributes,
    dash: dashAttributes
};
for (const name in layoutAttributes) {
    createStructArrayType(`${name.replace(/-/g, '_')}_layout`, layoutAttributes[name]);
}

createStructArrayType('symbol_layout', symbolLayoutAttributes);
createStructArrayType('symbol_dynamic_layout', dynamicLayoutAttributes);
createStructArrayType('symbol_opacity', placementOpacityAttributes);
createStructArrayType('collision_box', collisionBox, true);
createStructArrayType('collision_box_layout', collisionBoxLayout);
createStructArrayType('collision_circle_layout', collisionCircleLayout);
createStructArrayType('collision_vertex', collisionVertexAttributes);
createStructArrayType('quad_triangle', quadTriangle);
createStructArrayType('placed_symbol', placement, true);
createStructArrayType('symbol_instance', symbolInstance, true);
createStructArrayType('glyph_offset', glyphOffset, true);
createStructArrayType('symbol_line_vertex', lineVertex, true);
createStructArrayType('text_anchor_offset', textAnchorOffset, true);

// feature index array
createStructArrayType('feature_index', createLayout([
    // the index of the feature in the original vectortile
    {type: 'Uint32', name: 'featureIndex'},
    // the source layer the feature appears in
    {type: 'Uint16', name: 'sourceLayerIndex'},
    // the bucket the feature appears in
    {type: 'Uint16', name: 'bucketIndex'}
]), true);

// triangle index array
createStructArrayType('triangle_index', createLayout([
    {type: 'Uint16', name: 'vertices', components: 3}
]));

// line index array
createStructArrayType('line_index', createLayout([
    {type: 'Uint16', name: 'vertices', components: 2}
]));

// line strip index array
createStructArrayType('line_strip_index', createLayout([
    {type: 'Uint16', name: 'vertices', components: 1}
]));

// paint vertex arrays

// used by SourceBinder for float properties
createStructArrayLayoutType(createLayout([{
    name: 'dummy name (unused for StructArrayLayout)',
    type: 'Float32',
    components: 1
}], 4));

// used by SourceBinder for color properties and CompositeBinder for float properties
createStructArrayLayoutType(createLayout([{
    name: 'dummy name (unused for StructArrayLayout)',
    type: 'Float32',
    components: 2
}], 4));

// used by CompositeBinder for color properties
createStructArrayLayoutType(createLayout([{
    name: 'dummy name (unused for StructArrayLayout)',
    type: 'Float32',
    components: 4
}], 4));

const layouts = Object.keys(layoutCache).map(k => layoutCache[k]);

function emitStructArrayLayout(locals) {
    const output = [];
    const {
        className,
        members,
        size,
        usedTypes
    } = locals;
    const structArrayLayoutClass = className;

    output.push(
        `/**
 * @internal
 * Implementation of the StructArray layout:`);

    for (const member of members) {
        output.push(
            ` * [${member.offset}] - ${member.type}[${member.components}]`);
    }

    output.push(
        ` *
 */
class ${structArrayLayoutClass} extends StructArray {`);

    for (const type of usedTypes) {
        output.push(
            `    ${type.toLowerCase()}: ${type}Array;`);
    }

    output.push(`
    _refreshViews() {`);

    for (const type of usedTypes) {
        output.push(
            `        this.${type.toLowerCase()} = new ${type}Array(this.arrayBuffer);`);
    }

    output.push(
        '    }');

    // prep for emplaceBack: collect type sizes and count the number of arguments
    // we'll need
    const bytesPerElement = size;
    const usedTypeSizes = [];
    const argNames = [];
    const argNamesTyped = [];

    for (const member of members) {
        if (usedTypeSizes.indexOf(member.size) < 0) {
            usedTypeSizes.push(member.size);
        }
        for (let c = 0; c < member.components; c++) {
            // arguments v0, v1, v2, ... are, in order, the components of
            // member 0, then the components of member 1, etc.
            const name = `v${argNames.length}`;
            argNames.push(name);
            argNamesTyped.push(`${name}: number`);
        }
    }

    output.push(
        `
    public emplaceBack(${argNamesTyped.join(', ')}) {
        const i = this.length;
        this.resize(i + 1);
        return this.emplace(i, ${argNames.join(', ')});
    }

    public emplace(i: number, ${argNamesTyped.join(', ')}) {`);

    for (const size of usedTypeSizes) {
        output.push(
            `        const o${size.toFixed(0)} = i * ${(bytesPerElement / size).toFixed(0)};`);
    }

    let argIndex = 0;
    for (const member of members) {
        for (let c = 0; c < member.components; c++) {
            // The index for `member` component `c` into the appropriate type array is:
            // this.{TYPE}[o{SIZE} + MEMBER_OFFSET + {c}] = v{X}
            // where MEMBER_OFFSET = ROUND(member.offset / size) is the per-element
            // offset of this member into the array
            const index = `o${member.size.toFixed(0)} + ${(member.offset / member.size + c).toFixed(0)}`;

            output.push(
                `        this.${member.view}[${index}] = v${argIndex++};`);
        }
    }

    output.push(
        `        return i;
    }
}

${structArrayLayoutClass}.prototype.bytesPerElement = ${size};
register('${structArrayLayoutClass}', ${structArrayLayoutClass});
`);

    return output.join('\n');
}

function emitStructArray(locals) {
    const output = [];
    const {
        arrayClass,
        members,
        size,
        hasAnchorPoint,
        layoutClass,
        includeStructAccessors
    } = locals;

    const structTypeClass = arrayClass.replace('Array', 'Struct');
    const structArrayClass = arrayClass;
    const structArrayLayoutClass = layoutClass;

    // collect components
    const components = [];
    for (const member of members) {
        for (let c = 0; c < member.components; c++) {
            let name = member.name;
            if (member.components > 1) {
                name += c;
            }
            components.push({name, member, component: c});
        }
    }

    // exceptions for which we generate accessors on the array rather than a separate struct for performance
    const useComponentGetters = structArrayClass === 'GlyphOffsetArray' || structArrayClass === 'SymbolLineVertexArray';

    if (includeStructAccessors && !useComponentGetters) {
        output.push(
            `/** @internal */
class ${structTypeClass} extends Struct {
    _structArray: ${structArrayClass};`);

        for (const {name, member, component} of components) {
            const elementOffset = `this._pos${member.size.toFixed(0)}`;
            const componentOffset = (member.offset / member.size + component).toFixed(0);
            const index = `${elementOffset} + ${componentOffset}`;
            const componentAccess = `this._structArray.${member.view}[${index}]`;

            output.push(
                `    get ${name}() { return ${componentAccess}; }`);

            // generate setters for properties that are updated during runtime symbol placement; others are read-only
            if (name === 'crossTileID' || name === 'placedOrientation' || name === 'hidden') {
                output.push(
                    `    set ${name}(x: number) { ${componentAccess} = x; }`);
            }
        }

        // Special case used for the CollisionBoxArray type
        if (hasAnchorPoint) {
            output.push(
                '    get anchorPoint() { return new Point(this.anchorPointX, this.anchorPointY); }');
        }

        output.push(
            `}

${structTypeClass}.prototype.size = ${size};

export type ${structTypeClass.replace('Struct', '')} = ${structTypeClass};
`);
    } // end 'if (includeStructAccessors)'

    output.push(
        `/** @internal */
export class ${structArrayClass} extends ${structArrayLayoutClass} {`);

    if (useComponentGetters) {
        for (const member of members) {
            for (let c = 0; c < member.components; c++) {
                if (!includeStructAccessors) continue;
                let name = `get${member.name}`;
                if (member.components > 1) {
                    name += c;
                }
                const componentOffset = (member.offset / member.size + c).toFixed(0);
                const componentStride = size / member.size;
                output.push(
                    `    ${name}(index: number) { return this.${member.view}[index * ${componentStride} + ${componentOffset}]; }`);
            }
        }
    } else if (includeStructAccessors) { // get(i)
        output.push(
            `    /**
     * Return the ${structTypeClass} at the given location in the array.
     * @param index - The index of the element.
     */
    get(index: number): ${structTypeClass} {
        return new ${structTypeClass}(this, index);
    }`);
    }
    output.push(
        `}

register('${structArrayClass}', ${structArrayClass});
`);

    return output.join('\n');
}

fs.writeFileSync('src/data/array_types.g.ts',
    `// This file is generated. Edit build/generate-struct-arrays.ts, then run \`npm run codegen\`.

import {Struct, StructArray} from '../util/struct_array';
import {register} from '../util/web_worker_transfer';
import Point from '@mapbox/point-geometry';

${layouts.map(emitStructArrayLayout).join('\n')}
${arraysWithStructAccessors.map(emitStructArray).join('\n')}
${[...arrayTypeEntries].join('\n')}
export {
    ${layouts.map(layout => layout.className).join(',\n    ')}
};
`);
