import {StyleLayer} from '../style_layer';

import properties, {type HillshadePaintPropsPossiblyEvaluated} from './hillshade_style_layer_properties.g';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {HillshadePaintProps} from './hillshade_style_layer_properties.g';
import type {Color, LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import {degreesToRadians} from '../../util/util';
import {EvaluationParameters} from '../evaluation_parameters';

export const isHillshadeStyleLayer = (layer: StyleLayer): layer is HillshadeStyleLayer => layer.type === 'hillshade';

export class HillshadeStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<HillshadePaintProps>;
    _transitioningPaint: Transitioning<HillshadePaintProps>;
    paint: PossiblyEvaluated<HillshadePaintProps, HillshadePaintPropsPossiblyEvaluated>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this.recalculate({zoom: 0, zoomHistory: {}} as EvaluationParameters, undefined);
        if (this.paint.get('hillshade-illumination-direction').values.length < 1) {
            throw new Error('"hillshade-illumination-direction" cannot be an empty array');
        }
        if (this.paint.get('hillshade-illumination-altitude').values.length < 1) {
            throw new Error('"hillshade-illumination-altitude" cannot be an empty array');
        }
        if (this.paint.get('hillshade-highlight-color').values.length < 1) {
            throw new Error('"hillshade-highlight-color" cannot be an empty array');
        }
        if (this.paint.get('hillshade-shadow-color').values.length < 1) {
            throw new Error('"hillshade-shadow-color" cannot be an empty array');
        }

    }

    getIlluminationProperties(): {directionRadians: number[]; altitudeRadians: number[]; shadowColor: Color[]; highlightColor: Color[]} {
        const direction = this.paint.get('hillshade-illumination-direction').values;
        const altitude = this.paint.get('hillshade-illumination-altitude').values;
        const highlightColor = this.paint.get('hillshade-highlight-color').values;
        const shadowColor = this.paint.get('hillshade-shadow-color').values;
        // ensure all illumination properties have the same length
        const numIlluminationSources = Math.max(direction.length, altitude.length, highlightColor.length, shadowColor.length);
        for (let i = direction.length; i < numIlluminationSources; i++) {
            direction.push(direction[i-1]);
        }
        for (let i = altitude.length; i < numIlluminationSources; i++) {
            altitude.push(altitude[i-1]);
        }
        for (let i = highlightColor.length; i < numIlluminationSources; i++) {
            highlightColor.push(highlightColor[i-1]);
        }
        for (let i = shadowColor.length; i < numIlluminationSources; i++) {
            shadowColor.push(shadowColor[i-1]);
        }
        const altitudeRadians = [];
        const directionRadians = [];
        for (let i = 0; i < numIlluminationSources; i++) {
            altitudeRadians.push(degreesToRadians(altitude[i]));
            directionRadians.push(degreesToRadians(direction[i]));
        }

        return {directionRadians, altitudeRadians, shadowColor, highlightColor};
    }

    hasOffscreenPass() {
        return this.paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
    }
}
