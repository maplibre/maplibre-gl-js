'use strict';

import * as fs from 'fs';

import {v8} from '@maplibre/maplibre-gl-style-spec';

function camelCase(str: string): string {
    return str.replace(/-(.)/g, (_, x) => {
        return x.toUpperCase();
    });
}

function pascalCase(str: string): string {
    const almostCamelized = camelCase(str);
    return almostCamelized[0].toUpperCase() + almostCamelized.slice(1);
}

function nativeType(property) {
    switch (property.type) {
        case 'boolean':
            return 'boolean';
        case 'number':
            return 'number';
        case 'string':
            return 'string';
        case 'enum':
            return Object.keys(property.values).map(v => JSON.stringify(v)).join(' | ');
        case 'color':
            return 'Color';
        case 'padding':
            return 'Padding';
        case 'variableAnchorOffsetCollection':
            return 'VariableAnchorOffsetCollection';
        case 'sprite':
            return 'Sprite';
        case 'formatted':
            return 'Formatted';
        case 'resolvedImage':
            return 'ResolvedImage';
        case 'array':
            if (property.length) {
                return `[${new Array(property.length).fill(nativeType({type: property.value})).join(', ')}]`;
            } else {
                return `Array<${nativeType({type: property.value, values: property.values})}>`;
            }
        default: throw new Error(`unknown type "${property.type}" for "${property.name}"`);
    }
}

function possiblyEvaluatedType(property)  {
    const propType = nativeType(property);

    switch (property['property-type']) {
        case 'color-ramp':
            return 'ColorRampProperty';
        case 'cross-faded':
            return `CrossFaded<${propType}>`;
        case 'cross-faded-data-driven':
            return `PossiblyEvaluatedPropertyValue<CrossFaded<${propType}>>`;
        case 'data-driven':
            return `PossiblyEvaluatedPropertyValue<${propType}>`;
    }

    return propType;
}

function propertyType(property) {
    switch (property['property-type']) {
        case 'data-driven':
            return `DataDrivenProperty<${nativeType(property)}>`;
        case 'cross-faded':
            return `CrossFadedProperty<${nativeType(property)}>`;
        case 'cross-faded-data-driven':
            return `CrossFadedDataDrivenProperty<${nativeType(property)}>`;
        case 'color-ramp':
            return 'ColorRampProperty';
        case 'data-constant':
        case 'constant':
            return `DataConstantProperty<${nativeType(property)}>`;
        default:
            throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
}

function runtimeType(property) {
    switch (property.type) {
        case 'boolean':
            return 'BooleanType';
        case 'number':
            return 'NumberType';
        case 'string':
        case 'enum':
            return 'StringType';
        case 'color':
            return 'ColorType';
        case 'padding':
            return 'PaddingType';
        case 'variableAnchorOffsetCollection':
            return 'VariableAnchorOffsetCollectionType';
        case 'sprite':
            return 'SpriteType';
        case 'formatted':
            return 'FormattedType';
        case 'Image':
            return 'ImageType';
        case 'array':
            if (property.length) {
                return `array(${runtimeType({type: property.value})}, ${property.length})`;
            } else {
                return `array(${runtimeType({type: property.value})})`;
            }
        default: throw new Error(`unknown type "${property.type}" for "${property.name}"`);
    }
}

function overrides(property) {
    return `{ runtimeType: ${runtimeType(property)}, getOverride: (o) => o.${camelCase(property.name)}, hasOverride: (o) => !!o.${camelCase(property.name)} }`;
}

function propertyValue(property, type) {
    const propertyAsSpec = `styleSpec["${type}_${property.layerType}"]["${property.name}"] as any as StylePropertySpecification`;

    switch (property['property-type']) {
        case 'data-driven':
            if (property.overridable) {
                return `new DataDrivenProperty(${propertyAsSpec}, ${overrides(property)})`;
            } else {
                return `new DataDrivenProperty(${propertyAsSpec})`;
            }
        case 'cross-faded':
            return `new CrossFadedProperty(${propertyAsSpec})`;
        case 'cross-faded-data-driven':
            return `new CrossFadedDataDrivenProperty(${propertyAsSpec})`;
        case 'color-ramp':
            return `new ColorRampProperty(${propertyAsSpec})`;
        case 'data-constant':
        case 'constant':
            return `new DataConstantProperty(${propertyAsSpec})`;
        default:
            throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
}

const layers = Object.keys(v8.layer.type.values).map((type) => {
    const layoutProperties = Object.keys(v8[`layout_${type}`]).reduce((memo, name) => {
        if (name !== 'visibility') {
            v8[`layout_${type}`][name].name = name;
            v8[`layout_${type}`][name].layerType = type;
            memo.push(v8[`layout_${type}`][name]);
        }
        return memo;
    }, []);

    const paintProperties = Object.keys(v8[`paint_${type}`]).reduce((memo, name) => {
        v8[`paint_${type}`][name].name = name;
        v8[`paint_${type}`][name].layerType = type;
        memo.push(v8[`paint_${type}`][name]);
        return memo;
    }, []);

    return {type, layoutProperties, paintProperties};
});

function emitlayerProperties(locals) {
    const output = [];
    const layerType = pascalCase(locals.type);
    const {
        layoutProperties,
        paintProperties
    } = locals;

    output.push(
        `// This file is generated. Edit build/generate-style-code.ts, then run 'npm run codegen'.
/* eslint-disable */

import {latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedDataDrivenProperty,
    CrossFadedProperty,
    ColorRampProperty,
    PossiblyEvaluatedPropertyValue,
    CrossFaded
} from '../properties';

import type {Color, Formatted, Padding, ResolvedImage, VariableAnchorOffsetCollection} from '@maplibre/maplibre-gl-style-spec';
import {StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';
`);

    const overridables = paintProperties.filter(p => p.overridable);
    if (overridables.length) {
        const overridesArray = `import {
            ${overridables.reduce((imports, prop) => { imports.push(runtimeType(prop)); return imports; }, []).join(',\n    ')}
        } from '@maplibre/maplibre-gl-style-spec';
        `;
        output.push(overridesArray);
    }

    if (layoutProperties.length) {
        output.push(
            `export type ${layerType}LayoutProps = {`);

        for (const property of layoutProperties) {
            output.push(
                `    "${property.name}": ${propertyType(property)},`);
        }

        output.push(
            `};

export type ${layerType}LayoutPropsPossiblyEvaluated = {`);

        for (const property of layoutProperties) {
            output.push(
                `    "${property.name}": ${possiblyEvaluatedType(property)},`);
        }

        output.push(
            `};

let layout: Properties<${layerType}LayoutProps>;
const getLayout = () => layout = layout || new Properties({`);

        for (const property of layoutProperties) {
            output.push(
                `    "${property.name}": ${propertyValue(property, 'layout')},`);
        }

        output.push(
            '});');
    }

    if (paintProperties.length) {
        output.push(
            `
export type ${layerType}PaintProps = {`);

        for (const property of paintProperties) {
            output.push(
                `    "${property.name}": ${propertyType(property)},`);
        }

        output.push(
            `};

export type ${layerType}PaintPropsPossiblyEvaluated = {`);

        for (const property of paintProperties) {
            output.push(
                `    "${property.name}": ${possiblyEvaluatedType(property)},`);
        }

        output.push(
            '};');
    } else {
        output.push(
            `export type ${layerType}PaintProps = {};`);
    }

    output.push(
        `
let paint: Properties<${layerType}PaintProps>;
const getPaint = () => paint = paint || new Properties({`);

    for (const property of paintProperties) {
        output.push(
            `    "${property.name}": ${propertyValue(property, 'paint')},`);
    }

    output.push(
        `});

export default ({ get paint() { return getPaint() }${layoutProperties.length ? ', get layout() { return getLayout() }' : ''} });`);

    return output.join('\n');
}

for (const layer of layers) {
    fs.writeFileSync(`src/style/style_layer/${layer.type.replace('-', '_')}_style_layer_properties.g.ts`, emitlayerProperties(layer));
}
