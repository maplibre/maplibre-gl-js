'use strict';

import * as fs from 'fs';

import {latest, type StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * Which kind of value a property holds, and so which `Property` class implements it.
 * Taken from the spec so a new kind shows up here as a compile error rather than at runtime.
 */
type SpecPropertyType = StylePropertySpecification['property-type'];

/** The allowed values of an `enum`, keyed by name. */
type SpecEnumValues = {[value: string]: unknown};

/** The types a value can have when it carries nothing beyond the type itself. */
type SpecScalarType =
    'boolean' | 'number' | 'string' | 'color' | 'padding' | 'formatted' | 'resolvedImage' |
    'numberArray' | 'colorArray' | 'projectionDefinition' | 'variableAnchorOffsetCollection';

/**
 * The part of a spec entry that describes what a value looks like. `enum` and `array` carry extra
 * fields; everything else is just its type. Arrays describe their elements the same way, so this is
 * also the shape passed when recursing into one.
 */
type SpecValue =
    /** the `name` on each is the property this came from, used for error messages */
    | {type: SpecScalarType; name?: string}
    | {type: 'enum'; values: SpecEnumValues; name?: string}
    | {
        type: 'array';
        /** the type of each element */
        value: 'number' | 'string' | 'enum';
        /** how many elements, when the spec pins it down */
        length?: number;
        /** for an array of `enum`, the allowed values live here, on the array itself */
        values?: SpecEnumValues;
        name?: string;
    };

/**
 * A property of the style spec, tagged with where it lives so the generated code can reach its spec
 * at runtime: either a layer's `layout`/`paint`, or a root such as `sky`.
 */
type SpecProperty = SpecValue & {
    name: string;
    'property-type': SpecPropertyType;
    /** whether a data-driven property can be overridden per formatted section, e.g. `text-color` */
    overridable?: boolean;
    /** the layer type owning this property, e.g. `fill` */
    layerType?: string;
    /** the style root owning this property, e.g. `sky` */
    root?: string;
};

/** A layer's properties, as {@link emitLayerProperties} takes them. */
type LayerProperties = {
    type: string;
    layoutProperties: SpecProperty[];
    paintProperties: SpecProperty[];
};

/** A root's properties, as {@link emitRootProperties} takes them. */
type RootProperties = {
    root: string;
    properties: SpecProperty[];
};

/**
 * One group of properties: the `Props` type, the `PropsPossiblyEvaluated` type, and the lazily
 * built `Properties` singleton holding them. A layer file has one of these for `layout` and one for
 * `paint`; a root file has a single one.
 */
type PropertyBlock = {
    /** what the generated types are named after, e.g. `FillPaint` gives `FillPaintProps` */
    typeName: string;
    properties: SpecProperty[];
    /** the group the properties live in: `layout`, `paint`, or a root such as `sky` */
    specGroup: string;
    /** the singleton, and the getter that builds it on first use */
    variable: string;
    getter: string;
    /** whether the getter is part of the module's API, or only reached through its default export */
    exportGetter: boolean;
};

function camelCase(str: string): string {
    return str.replace(/-(.)/g, (_, x) => {
        return x.toUpperCase();
    });
}

function pascalCase(str: string): string {
    const almostCamelized = camelCase(str);
    return almostCamelized[0].toUpperCase() + almostCamelized.slice(1);
}

/** How each element of an `array` property is specified. */
function elementOf(property: Extract<SpecValue, {type: 'array'}>): SpecValue {
    return property.value === 'enum' ?
        {type: 'enum', values: property.values ?? {}, name: property.name} :
        {type: property.value, name: property.name};
}

/** The TypeScript type a property evaluates to, e.g. `Color` or `"map" | "viewport"`. */
function nativeType(property: SpecValue): string {
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
        case 'numberArray':
            return 'NumberArray';
        case 'colorArray':
            return 'ColorArray';
        case 'variableAnchorOffsetCollection':
            return 'VariableAnchorOffsetCollection';
        case 'projectionDefinition':
            return 'ProjectionDefinitionSpecification';
        case 'formatted':
            return 'Formatted';
        case 'resolvedImage':
            return 'ResolvedImage';
        case 'array': {
            const inner = nativeType(elementOf(property));
            if (property.length) {
                return `[${new Array(property.length).fill(inner).join(', ')}]`;
            }
            return inner.includes('|') ? `Array<${inner}>` : `${inner}[]`;
        }
        // Unreachable per the union above, but the spec is JSON: this still fires if it grows a type.
        default: {
            const {type, name} = property as SpecValue;
            throw new Error(`unknown type "${type}" for "${name}"`);
        }
    }
}

/** The type the property has once evaluated, which for data-driven ones wraps {@link nativeType}. */
function possiblyEvaluatedType(property: SpecProperty): string {
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

/** The `Property` class implementing this property, e.g. `DataConstantProperty<Color>`. */
function propertyType(property: SpecProperty): string {
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

/** The expression type used to evaluate an overridable property at runtime. */
function runtimeType(property: SpecValue): string {
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
        case 'formatted':
            return 'FormattedType';
        case 'array': {
            const inner = runtimeType(elementOf(property));
            return property.length ? `array(${inner}, ${property.length})` : `array(${inner})`;
        }
        default: throw new Error(`unknown type "${property.type}" for "${property.name}"`);
    }
}

/** How a formatted section overrides an overridable property, e.g. `text-color`. */
function overrides(property: SpecProperty): string {
    return `{ runtimeType: ${runtimeType(property)}, getOverride: (o) => o.${camelCase(property.name)}, hasOverride: (o) => !!o.${camelCase(property.name)} }`;
}

/**
 * Where a property's spec lives, e.g. `styleSpec["paint_fill"]["fill-color"]` for a layer property
 * and `styleSpec["sky"]["sky-color"]` for a root one.
 */
function specPath(property: SpecProperty, type: string): string {
    return property.root ?
        `styleSpec["${property.root}"]["${property.name}"]` :
        `styleSpec["${type}_${property.layerType}"]["${property.name}"]`;
}

/** How the generated code constructs the property, e.g. `new DataConstantProperty(...)`. */
function propertyValue(property: SpecProperty, type: string): string {
    const propertyAsSpec = `${specPath(property, type)} as any as StylePropertySpecification`;
    const name = JSON.stringify(property.name);

    switch (property['property-type']) {
        case 'data-driven':
            if (property.overridable) {
                return `new DataDrivenProperty(${propertyAsSpec}, ${name}, ${overrides(property)})`;
            } else {
                return `new DataDrivenProperty(${propertyAsSpec}, ${name})`;
            }
        case 'cross-faded':
            return `new CrossFadedProperty(${propertyAsSpec}, ${name})`;
        case 'cross-faded-data-driven':
            return `new CrossFadedDataDrivenProperty(${propertyAsSpec}, ${name})`;
        case 'color-ramp':
            return `new ColorRampProperty(${propertyAsSpec}, ${name})`;
        case 'data-constant':
        case 'constant':
            return `new DataConstantProperty(${propertyAsSpec}, ${name})`;
        default:
            throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
}

/**
 * Parts of the style that carry properties without being layers. Their spec entries have the same
 * shape as a layer's, so the same code generates them.
 */
/**
 * Collects the properties the spec lists under `specKey`, tagging each one with its name and with
 * where it came from, which is what {@link specPath} needs to point the generated code back at it.
 */
function specProperties(specKey: string, tag: Pick<SpecProperty, 'layerType'> | Pick<SpecProperty, 'root'>): SpecProperty[] {
    const spec = latest[specKey as keyof typeof latest] as unknown as Record<string, SpecProperty>;
    return Object.keys(spec).map((name) => ({...spec[name], ...tag, name}));
}

/** The imports every generated file opens with. */
function emitHeader(propertiesPath: string): string {
    return `// This file is generated. Edit build/generate-style-code.ts, then run 'npm run codegen'.
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
} from '${propertiesPath}';

import type {Color, Formatted, Padding, NumberArray, ColorArray, ResolvedImage, VariableAnchorOffsetCollection, ProjectionDefinitionSpecification} from '@maplibre/maplibre-gl-style-spec';
import {StylePropertySpecification} from '@maplibre/maplibre-gl-style-spec';
`;
}

function emitPropertyBlock({typeName, properties, specGroup, variable, getter, exportGetter}: PropertyBlock): string {
    const output: string[] = [];

    output.push(`
export type ${typeName}Props = {`);
    for (const property of properties) {
        output.push(`    "${property.name}": ${propertyType(property)},`);
    }

    output.push(`};

export type ${typeName}PropsPossiblyEvaluated = {`);
    for (const property of properties) {
        output.push(`    "${property.name}": ${possiblyEvaluatedType(property)},`);
    }

    output.push(`};

let ${variable}: Properties<${typeName}Props>;
${exportGetter ? 'export ' : ''}const ${getter} = (): Properties<${typeName}Props> => ${variable} = ${variable} || new Properties({`);
    for (const property of properties) {
        output.push(`    "${property.name}": ${propertyValue(property, specGroup)},`);
    }

    output.push('});');

    return output.join('\n');
}

function emitLayerProperties({type, layoutProperties, paintProperties}: LayerProperties): string {
    const layerType = pascalCase(type);
    const output: string[] = [emitHeader('../properties.ts')];

    const overridables = paintProperties.filter(p => p.overridable);
    if (overridables.length) {
        output.push(`import {
            ${overridables.map(runtimeType).join(',\n    ')}
        } from '@maplibre/maplibre-gl-style-spec';
        `);
    }

    if (layoutProperties.length) {
        output.push(emitPropertyBlock({
            typeName: `${layerType}Layout`,
            properties: layoutProperties,
            specGroup: 'layout',
            variable: 'layout',
            getter: 'getLayout',
            exportGetter: false
        }));
    }

    output.push(emitPropertyBlock({
        typeName: `${layerType}Paint`,
        properties: paintProperties,
        specGroup: 'paint',
        variable: 'paint',
        getter: 'getPaint',
        exportGetter: false
    }));

    output.push(`
export default ({ get paint(): Properties<${layerType}PaintProps> { return getPaint() }${layoutProperties.length ? `, get layout(): Properties<${layerType}LayoutProps> { return getLayout() }` : ''} });`);

    return output.join('\n');
}

function emitRootProperties({root, properties}: RootProperties): string {
    return [
        emitHeader('./properties.ts'),
        emitPropertyBlock({
            typeName: pascalCase(root),
            properties,
            specGroup: root,
            variable: 'properties',
            getter: 'getProperties',
            exportGetter: true
        })
    ].join('\n');
}

const layers: LayerProperties[] = Object.keys(latest.layer.type.values).map((type: string) => ({
    type,
    // `visibility` is not a real layout property: it is handled by the layer itself.
    layoutProperties: specProperties(`layout_${type}`, {layerType: type}).filter(({name}) => name !== 'visibility'),
    paintProperties: specProperties(`paint_${type}`, {layerType: type})
}));

for (const layer of layers) {
    fs.writeFileSync(`src/style/style_layer/${layer.type.replace('-', '_')}_style_layer_properties.g.ts`, emitLayerProperties(layer));
}

const roots: RootProperties[] = ['light', 'sky', 'projection'].map((root) => ({
    root,
    properties: specProperties(root, {root})
}));

for (const root of roots) {
    fs.writeFileSync(`src/style/${root.root}_properties.g.ts`, emitRootProperties(root));
}
