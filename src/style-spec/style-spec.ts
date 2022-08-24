type ExpressionType = 'data-driven' | 'cross-faded' | 'cross-faded-data-driven' | 'color-ramp' | 'data-constant' | 'constant';
type ExpressionParameters = Array<'zoom' | 'feature' | 'feature-state' | 'heatmap-density' | 'line-progress'>;

type ExpressionSpecificationDefinition = {
    interpolated: boolean;
    parameters: ExpressionParameters;
};

export type StylePropertySpecification = {
    type: 'number';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    transition: boolean;
    default?: number;
} | {
    type: 'string';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    transition: boolean;
    default?: string;
    tokens?: boolean;
} | {
    type: 'boolean';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    transition: boolean;
    default?: boolean;
} | {
    type: 'enum';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    values: {[_: string]: {}};
    transition: boolean;
    default?: string;
} | {
    type: 'color';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    transition: boolean;
    default?: string;
    overridable: boolean;
} | {
    type: 'array';
    value: 'number';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    length?: number;
    transition: boolean;
    default?: Array<number>;
} | {
    type: 'array';
    value: 'string';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    length?: number;
    transition: boolean;
    default?: Array<string>;
} | {
    type: 'padding';
    'property-type': ExpressionType;
    expression?: ExpressionSpecificationDefinition;
    transition: boolean;
    default?: number | Array<number>;
};

import v8Spec from './reference/v8.json' assert {type: 'json'};
const v8 = v8Spec as any;
import latest from './reference/latest';
import format from './format';
import migrate from './migrate';
import composite from './composite';
import derefLayers from './deref';
import diff from './diff';
import ValidationError from './error/validation_error';
import ParsingError from './error/parsing_error';
import {StyleExpression, isExpression, createExpression, createPropertyExpression, normalizePropertyExpression, ZoomConstantExpression, ZoomDependentExpression, StylePropertyFunction} from './expression';
import featureFilter, {isExpressionFilter} from './feature_filter';

import convertFilter from './feature_filter/convert';
import Color from './util/color';
import Padding from './util/padding';
import {createFunction, isFunction} from './function';
import convertFunction from './function/convert';
import {eachSource, eachLayer, eachProperty} from './visit';

import validate from './validate_style';

const expression = {
    StyleExpression,
    isExpression,
    isExpressionFilter,
    createExpression,
    createPropertyExpression,
    normalizePropertyExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    StylePropertyFunction
};

const styleFunction = {
    convertFunction,
    createFunction,
    isFunction
};

const visit = {eachSource, eachLayer, eachProperty};

export {
    v8,
    latest,
    format,
    migrate,
    composite,
    derefLayers,
    diff,
    ValidationError,
    ParsingError,
    expression,
    featureFilter,
    convertFilter,
    Color,
    Padding,
    styleFunction as function,
    validate,
    visit
};
