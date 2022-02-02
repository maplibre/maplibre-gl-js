import * as fs from 'fs';
import * as properties from '../src/style-spec/util/properties';

import spec from '../src/style-spec/reference/v8.json';

function unionType(values) {
    if (Array.isArray(values)) {
        return values.map(v => JSON.stringify(v)).join(' | ');
    } else {
        return Object.keys(values).map(v => JSON.stringify(v)).join(' | ');
    }
}

function propertyType(property) {
    if (typeof property.type === 'function') {
        return property.type();
    }

    const baseType = (() => {
        switch (property.type) {
            case 'string':
            case 'number':
            case 'boolean':
                return property.type;
            case 'enum':
                return unionType(property.values);
            case 'array': {
                const elementType = propertyType(typeof property.value === 'string' ? {type: property.value, values: property.values} : property.value);
                if (property.length) {
                    return `[${Array(property.length).fill(elementType).join(', ')}]`;
                } else {
                    return `Array<${elementType}>`;
                }
            }
            case 'light':
                return 'LightSpecification';
            case 'sources':
                return '{[_: string]: SourceSpecification}';
            case '*':
                return 'unknown';
            default:
                return `${property.type.slice(0, 1).toUpperCase()}${property.type.slice(1)}Specification`;
        }
    })();

    if (properties.supportsPropertyExpression(property)) {
        return `DataDrivenPropertyValueSpecification<${baseType}>`;
    } else if (properties.supportsZoomExpression(property)) {
        return `PropertyValueSpecification<${baseType}>`;
    } else if (property.expression) {
        return 'ExpressionSpecificationArray';
    } else {
        return baseType;
    }
}

function propertyDeclaration(key, property) {
    return `"${key}"${property.required ? '' : '?'}: ${propertyType(property)}`;
}

function objectDeclaration(key, properties) {
    return `export type ${key} = ${objectType(properties, '')};`;
}

function objectType(properties, indent) {
    return `{
${Object.keys(properties)
        .filter(k => k !== '*')
        .map(k => `    ${indent}${propertyDeclaration(k, properties[k])}`)
        .join(',\n')}
${indent}}`;
}

function sourceTypeName(key) {
    return key.replace(/source_(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}SourceSpecification`)
        .replace(/_dem/, 'DEM')
        .replace(/Geojson/, 'GeoJSON');
}

function layerTypeName(key) {
    return key.split('-').map(k => k.replace(/(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}`)).concat('LayerSpecification').join('');
}

function layerType(key) {
    const layer = spec.layer as any;

    layer.type = {
        type: 'enum',
        values: [key],
        required: true
    };

    delete layer.ref;
    delete layer['paint.*'];

    layer.paint.type = () => {
        return objectType(spec[`paint_${key}`], '    ');
    };

    layer.layout.type = () => {
        return objectType(spec[`layout_${key}`], '    ');
    };

    if (key === 'background') {
        delete layer.source;
        delete layer['source-layer'];
        delete layer.filter;
    } else {
        layer.source.required = true;
    }

    return objectDeclaration(layerTypeName(key), layer);
}

const layerTypes = Object.keys(spec.layer.type.values);

fs.writeFileSync('src/style-spec/types.ts',
    `// Generated code; do not edit. Edit build/generate-style-spec.ts instead.
/* eslint-disable */

export type ColorSpecification = string;

export type FormattedSpecification = string;

export type ResolvedImageSpecification = string;

export type PromoteIdSpecification = {[_: string]: string} | string;

export type FilterSpecificationInputType = string | number | boolean;
export type FilterSpecification =
    // Lookup
    | ['at', number, (number |string)[]]
    | ['get', string, Record<string, unknown>?]
    | ['has', string, Record<string, unknown>?]
    | ['in', ...FilterSpecificationInputType[], FilterSpecificationInputType | FilterSpecificationInputType[]]
    | ['index-of', FilterSpecificationInputType, FilterSpecificationInputType | FilterSpecificationInputType[]]
    | ['length', string | string[]]
    | ['slice', string | string[], number]
    // Decision
    | ['!', FilterSpecification]
    | ['!=', string | FilterSpecification, FilterSpecificationInputType]
    | ['<', string | FilterSpecification, FilterSpecificationInputType]
    | ['<=', string | FilterSpecification, FilterSpecificationInputType]
    | ['==', string | FilterSpecification, FilterSpecificationInputType]
    | ['>', string | FilterSpecification, FilterSpecificationInputType]
    | ['>=', string | FilterSpecification, FilterSpecificationInputType]
    | ["all", ...FilterSpecification[], FilterSpecificationInputType]
    | ["any", ...FilterSpecification[], FilterSpecificationInputType]
    | ["case", ...FilterSpecification[], FilterSpecificationInputType]
    | ["coalesce", ...FilterSpecification[], FilterSpecificationInputType]
    | ["match", ...FilterSpecification[], FilterSpecificationInputType]
    | ["within", ...FilterSpecification[], FilterSpecificationInputType]
    // Used in convert.ts
    | ["!in", ...FilterSpecification[], FilterSpecificationInputType]
    | ["!has", ...FilterSpecification[], FilterSpecificationInputType]
    | ["none", ...FilterSpecification[], FilterSpecificationInputType]
    // Fallbak for others
    | Array<string | FilterSpecification>

export type TransitionSpecification = {
    duration?: number,
    delay?: number
};

// Note: doesn't capture interpolatable vs. non-interpolatable types.

export type CameraFunctionSpecification<T> =
      { type: 'exponential', stops: Array<[number, T]> }
    | { type: 'interval',    stops: Array<[number, T]> };

export type SourceFunctionSpecification<T> =
      { type: 'exponential', stops: Array<[number, T]>, property: string, default?: T }
    | { type: 'interval',    stops: Array<[number, T]>, property: string, default?: T }
    | { type: 'categorical', stops: Array<[string | number | boolean, T]>, property: string, default?: T }
    | { type: 'identity', property: string, default?: T };

export type CompositeFunctionSpecification<T> =
      { type: 'exponential', stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T }
    | { type: 'interval',    stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T }
    | { type: 'categorical', stops: Array<[{zoom: number, value: string | number | boolean}, T]>, property: string, default?: T };

export type ExpressionSpecificationArray = Array<unknown>;

export type PropertyValueSpecification<T> =
      T
    | CameraFunctionSpecification<T>
    | ExpressionSpecificationArray;

export type DataDrivenPropertyValueSpecification<T> =
      T
    | CameraFunctionSpecification<T>
    | SourceFunctionSpecification<T>
    | CompositeFunctionSpecification<T>
    | ExpressionSpecificationArray;

${objectDeclaration('StyleSpecification', spec.$root)}

${objectDeclaration('LightSpecification', spec.light)}

${spec.source.map(key => objectDeclaration(sourceTypeName(key), spec[key])).join('\n\n')}

export type SourceSpecification =
${spec.source.map(key => `    | ${sourceTypeName(key)}`).join('\n')}

${layerTypes.map(key => layerType(key)).join('\n\n')}

export type LayerSpecification =
${layerTypes.map(key => `    | ${layerTypeName(key)}`).join('\n')};

`);
