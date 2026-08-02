import {Color} from '@maplibre/maplibre-gl-style-spec';

import type {BlendFuncType, ColorMaskType} from './types.ts';

const ZERO = 0x0000;
const ONE = 0x0001;
const ONE_MINUS_SRC_COLOR = 0x0301;
const ONE_MINUS_SRC_ALPHA = 0x0303;

export class ColorMode {
    blendFunction: BlendFuncType;
    blendColor: Color;
    mask: ColorMaskType;

    constructor(blendFunction: BlendFuncType, blendColor: Color, mask: ColorMaskType) {
        this.blendFunction = blendFunction;
        this.blendColor = blendColor;
        this.mask = mask;
    }

    static Replace: BlendFuncType;

    static disabled: Readonly<ColorMode>;
    static unblended: Readonly<ColorMode>;
    static alphaBlended: Readonly<ColorMode>;
    static plus: Readonly<ColorMode>;
    static erase: Readonly<ColorMode>;
    static screen: Readonly<ColorMode>;
}

ColorMode.Replace = [ONE, ZERO];

ColorMode.disabled = new ColorMode(ColorMode.Replace, Color.transparent, [false, false, false, false]);
ColorMode.unblended = new ColorMode(ColorMode.Replace, Color.transparent, [true, true, true, true]);
ColorMode.alphaBlended = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
ColorMode.plus = new ColorMode([ONE, ONE], Color.transparent, [true, true, true, true]);
ColorMode.erase = new ColorMode([ZERO, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
// W3C `screen` premultiplied is `cs + cb - cs*cb`, and ONE_MINUS_SRC_COLOR's alpha component is `1 - src.a`.
ColorMode.screen = new ColorMode([ONE, ONE_MINUS_SRC_COLOR], Color.transparent, [true, true, true, true]);
