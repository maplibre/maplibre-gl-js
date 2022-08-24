import * as fs from 'fs';
import * as properties from '../src/style-spec/util/properties';

import spec from '../src/style-spec/reference/v8.json' assert {type: 'json'};

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
        return 'ExpressionSpecification';
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

fs.writeFileSync('src/style-spec/types.g.ts',
    `// Generated code; do not edit. Edit build/generate-style-spec.ts instead.
/* eslint-disable */

export type ColorSpecification = string;

export type PaddingSpecification = number | number[];

export type FormattedSpecification = string;

export type ResolvedImageSpecification = string;

export type PromoteIdSpecification = {[_: string]: string} | string;

export type ExpressionInputType = string | number | boolean;

export type CollatorExpressionSpecification = 
    ['collator', {
        'case-sensitive'?: boolean | ExpressionSpecification, 
        'diacritic-sensitive'?: boolean | ExpressionSpecification, 
        locale?: string | ExpressionSpecification}
    ]; // collator

export type InterpolationSpecification =
    | ['linear'] 
    | ['exponential', number | ExpressionSpecification] 
    | ['cubic-bezier', number | ExpressionSpecification, number | ExpressionSpecification, number | ExpressionSpecification, number | ExpressionSpecification]

export type ExpressionSpecification = 
    // types
    | ['array', unknown | ExpressionSpecification] // array
    | ['array', ExpressionInputType | ExpressionSpecification, unknown | ExpressionSpecification] // array
    | ['array', ExpressionInputType | ExpressionSpecification, number | ExpressionSpecification, unknown | ExpressionSpecification] // array
    | ['boolean', ...(unknown | ExpressionSpecification)[], unknown | ExpressionSpecification] // boolean
    | CollatorExpressionSpecification
    | ['format', ...(string | ['image', ExpressionSpecification] | ExpressionSpecification | {'font-scale'?: number | ExpressionSpecification, 'text-font'?: string[] | ExpressionSpecification, 'text-color': ColorSpecification | ExpressionSpecification})[]] // string
    | ['image', unknown | ExpressionSpecification] // image
    | ['literal', unknown]
    | ['number', unknown | ExpressionSpecification, ...(unknown | ExpressionSpecification)[]] // number
    | ['number-format', number | ExpressionSpecification, {'locale'?: string | ExpressionSpecification, 'currency'?: string | ExpressionSpecification, 'min-fraction-digits'?: number | ExpressionSpecification, 'max-fraction-digits'?: number | ExpressionSpecification}] // string
    | ['object', unknown | ExpressionSpecification, ...(unknown | ExpressionSpecification)[]] // object
    | ['string', unknown | ExpressionSpecification, ...(unknown | ExpressionSpecification)[]] // string
    | ['to-boolean', unknown | ExpressionSpecification] // boolean
    | ['to-color', unknown | ExpressionSpecification, ...(unknown | ExpressionSpecification)[]] // color
    | ['to-number', unknown | ExpressionSpecification, ...(unknown | ExpressionSpecification)[]] // number
    | ['to-string', unknown | ExpressionSpecification] // string
    // feature data
    | ['accumulated']
    | ['feature-state', string]
    | ['geometry-type'] // string
    | ['id']
    | ['line-progress'] // number
    | ['properties'] // object
    // lookup
    | ['at', number | ExpressionSpecification, ExpressionSpecification]
    | ['get', string | ExpressionSpecification, (Record<string, unknown> | ExpressionSpecification)?]
    | ['has', string | ExpressionSpecification, (Record<string, unknown> | ExpressionSpecification)?]
    | ['in', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification]
    | ['index-of', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification] // number
    | ['length', string | ExpressionSpecification]
    | ['slice', string | ExpressionSpecification, number | ExpressionSpecification]
    // Decision
    | ['!', boolean | ExpressionSpecification] // boolean
    | ['!=', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, CollatorExpressionSpecification?] // boolean
    | ['<', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, CollatorExpressionSpecification?] // boolean
    | ['<=', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, CollatorExpressionSpecification?] // boolean
    | ['==', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, CollatorExpressionSpecification?] // boolean
    | ['>', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, CollatorExpressionSpecification?] // boolean
    | ['>=', ExpressionInputType | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, CollatorExpressionSpecification?] // boolean
    | ['all', ...(boolean | ExpressionSpecification)[]] // boolean
    | ['any', ...(boolean | ExpressionSpecification)[]] // boolean
    | ['case', boolean | ExpressionSpecification, ExpressionInputType | ExpressionSpecification, 
        ...(boolean | ExpressionInputType | ExpressionSpecification)[], ExpressionInputType | ExpressionSpecification]
    | ['coalesce', ...(ExpressionInputType | ExpressionSpecification)[]] // at least two inputs required
    | ['match', ExpressionInputType | ExpressionSpecification, 
        ExpressionInputType | ExpressionInputType[], ExpressionInputType | ExpressionSpecification, 
        ...(ExpressionInputType | ExpressionInputType[] | ExpressionSpecification)[], // repeated as above
        ExpressionInputType]
    | ['within', unknown | ExpressionSpecification]
    // Ramps, scales, curves
    | ['interpolate', InterpolationSpecification, number | ExpressionSpecification, 
        ...(number | number[] | ColorSpecification)[]] // alternating number and number | number[] | ColorSpecification
    | ['interpolate-hcl', InterpolationSpecification, number | ExpressionSpecification, 
        ...(number | ColorSpecification)[]] // alternating number and ColorSpecificaton
    | ['interpolate-lab', InterpolationSpecification, number | ExpressionSpecification, 
        ...(number | ColorSpecification)[]] // alternating number and ColorSpecification
    | ['step', number | ExpressionSpecification, ExpressionInputType | ExpressionSpecification,
        ...(number | ExpressionInputType | ExpressionSpecification)[]] // alternating number and ExpressionInputType | ExpressionSpecification
    // Variable binding
    | ['let', string, ExpressionInputType | ExpressionSpecification, ...(string | ExpressionInputType | ExpressionSpecification)[]]
    | ['var', string]
    // String
    | ['concat', ...(ExpressionInputType | ExpressionSpecification)[]] // at least two inputs required -> string
    | ['downcase', string | ExpressionSpecification] // string
    | ['is-supported-script', string | ExpressionSpecification] // boolean
    | ['resolved-locale', CollatorExpressionSpecification] // string
    | ['upcase', string | ExpressionSpecification] // string
    // Color
    | ['rgb', number | ExpressionSpecification, number | ExpressionSpecification, number | ExpressionSpecification] // color
    | ['rgba', number | ExpressionSpecification, number | ExpressionSpecification, number | ExpressionSpecification, number | ExpressionSpecification]
    | ['to-rgba', ColorSpecification | ExpressionSpecification]
    // Math
    | ['-', number | ExpressionSpecification, (number | ExpressionSpecification)?] // number
    | ['*', number | ExpressionSpecification, number | ExpressionSpecification, ...(number | ExpressionSpecification)[]] // number
    | ['/', number | ExpressionSpecification, number | ExpressionSpecification] // number
    | ['%', number | ExpressionSpecification, number | ExpressionSpecification] // number
    | ['^', number | ExpressionSpecification, number | ExpressionSpecification] // number
    | ['+', ...(number | ExpressionSpecification)[]] // at least two inputs required -> number
    | ['abs', number | ExpressionSpecification] // number
    | ['acos', number | ExpressionSpecification] // number
    | ['asin', number | ExpressionSpecification] // number
    | ['atan', number | ExpressionSpecification] // number
    | ['ceil', number | ExpressionSpecification] // number
    | ['cos', number | ExpressionSpecification] // number
    | ['distance', Record<string, unknown> | ExpressionSpecification] // number
    | ['ExpressionSpecification'] // number
    | ['floor', number | ExpressionSpecification] // number
    | ['ln', number | ExpressionSpecification] // number
    | ['ln2'] // number
    | ['log10', number | ExpressionSpecification] // number
    | ['log2', number | ExpressionSpecification] // number
    | ['max', number | ExpressionSpecification, ...(number | ExpressionSpecification)[]] // number
    | ['min', number | ExpressionSpecification, ...(number | ExpressionSpecification)[]] // number
    | ['pi'] // number
    | ['round', number | ExpressionSpecification] // number
    | ['sin', number | ExpressionSpecification] // number
    | ['sqrt', number | ExpressionSpecification] // number
    | ['tan', number | ExpressionSpecification] // number
    // Zoom
    | ['zoom'] // number
    // Heatmap
    | ['heatmap-density'] // number

export type ExpressionFilterSpecification = boolean | ExpressionSpecification

export type LegacyFilterSpecification =
    // Existential
    | ['has', string]
    | ['!has', string]
    // Comparison
    | ['==', string, string | number | boolean]
    | ['!=', string, string | number | boolean]
    | ['>', string, string | number | boolean]
    | ['>=', string, string | number | boolean]
    | ['<', string, string | number | boolean]
    | ['<=', string, string | number | boolean]
    // Set membership
    | ['in', string, ...(string | number | boolean)[]]
    | ['!in', string, ...(string | number | boolean)[]]
    // Combining
    | ['all', ...LegacyFilterSpecification[]]
    | ['any', ...LegacyFilterSpecification[]]
    | ['none', ...LegacyFilterSpecification[]]

export type FilterSpecification = ExpressionFilterSpecification | LegacyFilterSpecification

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

export type PropertyValueSpecification<T> =
      T
    | CameraFunctionSpecification<T>
    | ExpressionSpecification;

export type DataDrivenPropertyValueSpecification<T> =
      T
    | CameraFunctionSpecification<T>
    | SourceFunctionSpecification<T>
    | CompositeFunctionSpecification<T>
    | ExpressionSpecification;

${objectDeclaration('StyleSpecification', spec.$root)}

${objectDeclaration('LightSpecification', spec.light)}

${objectDeclaration('TerrainSpecification', spec.terrain)}

${spec.source.map(key => objectDeclaration(sourceTypeName(key), spec[key])).join('\n\n')}

export type SourceSpecification =
${spec.source.map(key => `    | ${sourceTypeName(key)}`).join('\n')}

${layerTypes.map(key => layerType(key)).join('\n\n')}

export type LayerSpecification =
${layerTypes.map(key => `    | ${layerTypeName(key)}`).join('\n')};

`);
