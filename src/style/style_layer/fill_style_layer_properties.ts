// This file is generated. Edit build/generate-style-code.ts, then run 'npm run codegen'.
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest';

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

import type Color from '../../style-spec/util/color';

import type Formatted from '../../style-spec/expression/types/formatted';

import type ResolvedImage from '../../style-spec/expression/types/resolved_image';
import {StylePropertySpecification} from '../../style-spec/style-spec';

export type FillLayoutProps = {
    "fill-sort-key": DataDrivenProperty<number>,
};

export type FillLayoutPropsPossiblyEvaluated = {
    "fill-sort-key": PossiblyEvaluatedPropertyValue<number>,
};

const layout: Properties<FillLayoutProps> = new Properties({
    "fill-sort-key": new DataDrivenProperty(styleSpec["layout_fill"]["fill-sort-key"] as any as StylePropertySpecification),
});

export type FillPaintProps = {
    "fill-antialias": DataConstantProperty<boolean>,
    "fill-opacity": DataDrivenProperty<number>,
    "fill-color": DataDrivenProperty<Color>,
    "fill-outline-color": DataDrivenProperty<Color>,
    "fill-translate": DataConstantProperty<[number, number]>,
    "fill-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "fill-pattern": CrossFadedDataDrivenProperty<ResolvedImage>,
};

export type FillPaintPropsPossiblyEvaluated = {
    "fill-antialias": boolean,
    "fill-opacity": PossiblyEvaluatedPropertyValue<number>,
    "fill-color": PossiblyEvaluatedPropertyValue<Color>,
    "fill-outline-color": PossiblyEvaluatedPropertyValue<Color>,
    "fill-translate": [number, number],
    "fill-translate-anchor": "map" | "viewport",
    "fill-pattern": PossiblyEvaluatedPropertyValue<CrossFaded<ResolvedImage>>,
};

const paint: Properties<FillPaintProps> = new Properties({
    "fill-antialias": new DataConstantProperty(styleSpec["paint_fill"]["fill-antialias"] as any as StylePropertySpecification),
    "fill-opacity": new DataDrivenProperty(styleSpec["paint_fill"]["fill-opacity"] as any as StylePropertySpecification),
    "fill-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-color"] as any as StylePropertySpecification),
    "fill-outline-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-outline-color"] as any as StylePropertySpecification),
    "fill-translate": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate"] as any as StylePropertySpecification),
    "fill-translate-anchor": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate-anchor"] as any as StylePropertySpecification),
    "fill-pattern": new CrossFadedDataDrivenProperty(styleSpec["paint_fill"]["fill-pattern"] as any as StylePropertySpecification),
});

export default ({ paint, layout } as {
    paint: Properties<FillPaintProps>,
    layout: Properties<FillLayoutProps>
});