import {DataConstantProperty, PossiblyEvaluated, Properties, Transitionable, Transitioning, TransitionParameters} from './properties';
import {Evented} from '../util/evented';
import {EvaluationParameters} from './evaluation_parameters';
import {emitValidationErrors, validateSky, validateStyle} from './validate_style';
import {extend} from '../util/util';
import {Color, latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';
import type {StylePropertySpecification, SkySpecification} from '@maplibre/maplibre-gl-style-spec';

type SkyProps = {
    'sky-color': DataConstantProperty<Color>;
    'fog-color': DataConstantProperty<Color>;
    'fog-blend': DataConstantProperty<number>;
    'horizon-blend': DataConstantProperty<number>;
};

type SkyPropsPossiblyEvaluated = {
    'sky-color': Color;
    'fog-color': Color;
    'fog-blend': number;
    'horizon-blend': number;
};

const properties: Properties<SkyProps> = new Properties({
    'sky-color': new DataConstantProperty(styleSpec.sky['sky-color'] as StylePropertySpecification),
    'fog-color': new DataConstantProperty(styleSpec.sky['fog-color'] as StylePropertySpecification),
    'fog-blend': new DataConstantProperty(styleSpec.sky['fog-blend'] as StylePropertySpecification),
    'horizon-blend': new DataConstantProperty(styleSpec.sky['horizon-blend'] as StylePropertySpecification),
});

const TRANSITION_SUFFIX = '-transition';

export class Sky extends Evented {
    properties: PossiblyEvaluated<SkyProps, SkyPropsPossiblyEvaluated>;

    _transitionable: Transitionable<SkyProps>;
    _transitioning: Transitioning<SkyProps>;

    constructor(sky?: SkySpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.setSky(sky);
        this._transitioning = this._transitionable.untransitioned();
    }

    setSky(sky?: SkySpecification) {
        if (this._validate(validateSky, sky)) return;

        for (const name in sky) {
            const value = sky[name];
            if (name.endsWith(TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length) as keyof SkyProps, value);
            } else {
                this._transitionable.setValue(name as keyof SkyProps, value);
            }
        }
    }

    getSky() {
        return this._transitionable.serialize();
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition() {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    _validate(validate: Function, value: unknown) {
        return emitValidationErrors(this, validate.call(validateStyle, extend({
            value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }

    /**
     * Currently fog is a very simple implementation, and should only used
     * to create an atmosphere near the horizon.
     * But because the fog is drawn from the far-clipping-plane to
     * map-center, and because the fog does nothing know about the horizon,
     * this method does a fadeout in respect of pitch. So, when the horizon
     * gets out of view, which is at about pitch 70, this methods calculates
     * the corresponding opacity values. Below pitch 60 the fog is completely
     * invisible.
     */
    calculateFogBlendOpacity(pitch: number) {
        if (pitch < 60) return 0; // disable
        if (pitch < 70) return (pitch - 60) / 10; // fade in
        return 1;
    }
}
