'use strict';

import * as fs from 'fs';
import * as ejs from 'ejs';
import Color from '../src/style-spec/util/color.js';

const spec = JSON.parse(fs.readFileSync('src/style-spec/reference/v8.json', 'utf8'));

function camelize(str) {
    return str.replace(/(?:^|-)(.)/g, function (_, x) {
        return x.toUpperCase();
    });
}
global.camelize = camelize;

function camelizeWithLeadingLowercase(str) {
    return str.replace(/-(.)/g, function (_, x) {
      return x.toUpperCase();
    });
}
global.camelizeWithLeadingLowercase = camelizeWithLeadingLowercase;

function flowType(property) {
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
        case 'formatted':
            return 'Formatted';
        case 'resolvedImage':
            return 'ResolvedImage';
        case 'array':
            if (property.length) {
                return `[${new Array(property.length).fill(flowType({type: property.value})).join(', ')}]`;
            } else {
                return `Array<${flowType({type: property.value, values: property.values})}>`;
            }
        default: throw new Error(`unknown type for ${property.name}`)
    }
}
global.flowType = flowType;

function possiblyEvaluatedType(property)  {
    const propType = flowType(property);

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
global.possiblyEvaluatedType = possiblyEvaluatedType;

function propertyType(property) {
    switch (property['property-type']) {
        case 'data-driven':
            return `DataDrivenProperty<${flowType(property)}>`;
        case 'cross-faded':
            return `CrossFadedProperty<${flowType(property)}>`;
        case 'cross-faded-data-driven':
            return `CrossFadedDataDrivenProperty<${flowType(property)}>`;
        case 'color-ramp':
            return 'ColorRampProperty';
        case 'data-constant':
        case 'constant':
            return `DataConstantProperty<${flowType(property)}>`;
        default:
            throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
}
global.propertyType = propertyType;

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
        default: throw new Error(`unknown type for ${property.name}`)
    }
}
global.runtimeType = runtimeType;

function defaultValue(property) {
    switch (property.type) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'array':
        case 'enum':
            return JSON.stringify(property.default);
        case 'color':
            if (typeof property.default !== 'string') {
                return JSON.stringify(property.default);
            } else {
                const {r, g, b, a} = Color.parse(property.default) as Color;
                return `new Color(${r}, ${g}, ${b}, ${a})`;
            }
        default: throw new Error(`unknown type for ${property.name}`)
    }
}
global.defaultValue = defaultValue;

function overrides(property) {
    return `{ runtimeType: ${runtimeType(property)}, getOverride: (o) => o.${camelizeWithLeadingLowercase(property.name)}, hasOverride: (o) => !!o.${camelizeWithLeadingLowercase(property.name)} }`;
}
global.overrides = overrides;

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
global.propertyValue = propertyValue;

const propertiesJs = ejs.compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'), {strict: true});

const layers = Object.keys(spec.layer.type.values).map((type) => {
    const layoutProperties = Object.keys(spec[`layout_${type}`]).reduce((memo, name) => {
        if (name !== 'visibility') {
            spec[`layout_${type}`][name].name = name;
            spec[`layout_${type}`][name].layerType = type;
            memo.push(spec[`layout_${type}`][name]);
        }
        return memo;
    }, []);

    const paintProperties = Object.keys(spec[`paint_${type}`]).reduce((memo, name) => {
        spec[`paint_${type}`][name].name = name;
        spec[`paint_${type}`][name].layerType = type;
        memo.push(spec[`paint_${type}`][name]);
        return memo;
    }, []);

    return { type, layoutProperties, paintProperties };
});

for (const layer of layers) {
    fs.writeFileSync(`src/style/style_layer/${layer.type.replace('-', '_')}_style_layer_properties.ts`, propertiesJs(layer))
}
