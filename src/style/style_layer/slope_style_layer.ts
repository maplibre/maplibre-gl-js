import {StyleLayer} from '../style_layer';

// Import patch before properties to ensure styleSpec has slope definitions
import '../slope_spec_patch';
import properties, {type SlopePaintPropsPossiblyEvaluated} from './slope_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {SlopePaintProps} from './slope_style_layer_properties.g';
import {Color, Interpolate, ZoomConstantExpression, type LayerSpecification, type EvaluationContext, type StylePropertyExpression} from '@maplibre/maplibre-gl-style-spec';
import {warnOnce} from '../../util/util';
import {Texture} from '../../render/texture';
import {RGBAImage} from '../../util/image';
import {type Context} from '../../gl/context';

export const isSlopeStyleLayer = (layer: StyleLayer): layer is SlopeStyleLayer => layer.type === 'slope';

export type SlopeRamp = {slopeStops: Array<number>; colorStops: Array<Color>};
export type SlopeRampTextures = {slopeTexture: Texture; colorTexture: Texture};

export class SlopeStyleLayer extends StyleLayer {
    colorRampExpression: StylePropertyExpression;
    slopeRampTextures: SlopeRampTextures;
    _transitionablePaint: Transitionable<SlopePaintProps>;
    _transitioningPaint: Transitioning<SlopePaintProps>;
    paint: PossiblyEvaluated<SlopePaintProps, SlopePaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification | any, globalState: Record<string, any>) {
        super(layer, properties, globalState);
    }

    /**
     * Create the slope color ramp, enforcing a maximum length for the vectors.
     * Slope values are in degrees (0-90).
     */
    _createSlopeRamp(maxLength: number): SlopeRamp {
        const slopeRamp: SlopeRamp = {slopeStops: [], colorStops: []};
        const expression = this._transitionablePaint._values['slope-color'].value.expression;
        if (expression instanceof ZoomConstantExpression && expression._styleExpression.expression instanceof Interpolate) {
            this.colorRampExpression = expression;
            const interpolater = expression._styleExpression.expression;
            slopeRamp.slopeStops = interpolater.labels;
            slopeRamp.colorStops = [];
            for (const label of slopeRamp.slopeStops) {
                slopeRamp.colorStops.push(interpolater.evaluate({globals: {slope: label}} as unknown as EvaluationContext));
            }
        }
        if (slopeRamp.slopeStops.length < 1) {
            slopeRamp.slopeStops = [0];
            slopeRamp.colorStops = [Color.transparent];
        }
        if (slopeRamp.slopeStops.length < 2) {
            slopeRamp.slopeStops.push(slopeRamp.slopeStops[0] + 1);
            slopeRamp.colorStops.push(slopeRamp.colorStops[0]);
        }
        if (slopeRamp.slopeStops.length <= maxLength) {
            return slopeRamp;
        }

        const remappedSlopeRamp: SlopeRamp = {slopeStops: [], colorStops: []};
        const remapStepSize = (slopeRamp.slopeStops.length - 1) / (maxLength - 1);

        for (let i = 0; i < slopeRamp.slopeStops.length - 0.5; i += remapStepSize) {
            remappedSlopeRamp.slopeStops.push(slopeRamp.slopeStops[Math.round(i)]);
            remappedSlopeRamp.colorStops.push(slopeRamp.colorStops[Math.round(i)]);
        }
        warnOnce(`Too many colors in specification of ${this.id} slope layer, may not render properly. Max possible colors: ${maxLength}, provided: ${slopeRamp.slopeStops.length}`);
        return remappedSlopeRamp;
    }

    _colorRampChanged(): boolean {
        return this.colorRampExpression != this._transitionablePaint._values['slope-color'].value.expression;
    }

    getSlopeRampTextures(context: Context, maxLength: number): SlopeRampTextures {
        if (this.slopeRampTextures && !this._colorRampChanged()) {
            return this.slopeRampTextures;
        }
        const slopeRamp = this._createSlopeRamp(maxLength);
        const colorImage = new RGBAImage({width: slopeRamp.colorStops.length, height: 1});
        const slopeImage = new RGBAImage({width: slopeRamp.colorStops.length, height: 1});
        for (let i = 0; i < slopeRamp.slopeStops.length; i++) {
            // Store slope normalized to 0-1 range (slope / 90.0) in R channel
            const normalizedSlope = slopeRamp.slopeStops[i] / 90.0;
            slopeImage.setPixel(0, i, new Color(normalizedSlope, 0, 0, 1));
            colorImage.setPixel(0, i, slopeRamp.colorStops[i]);
        }
        this.slopeRampTextures = {
            slopeTexture: new Texture(context, slopeImage, context.gl.RGBA),
            colorTexture: new Texture(context, colorImage, context.gl.RGBA)
        };
        return this.slopeRampTextures;
    }

    hasOffscreenPass() {
        return !this.isHidden() && !!this.slopeRampTextures;
    }
}
