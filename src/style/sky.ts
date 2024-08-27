import {DataConstantProperty, PossiblyEvaluated, Properties, Transitionable, Transitioning, TransitionParameters} from './properties';
import {Evented} from '../util/evented';
import {EvaluationParameters} from './evaluation_parameters';
import {emitValidationErrors, validateSky, validateStyle} from './validate_style';
import {extend} from '../util/util';
import {Color, latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';
import {Mesh} from '../render/mesh';
import type {StylePropertySpecification, SkySpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleSetterOptions} from './style';

type SkyProps = {
    'sky-color': DataConstantProperty<Color>;
    'horizon-color': DataConstantProperty<Color>;
    'fog-color': DataConstantProperty<Color>;
    'fog-ground-blend': DataConstantProperty<number>;
    'horizon-fog-blend': DataConstantProperty<number>;
    'sky-horizon-blend': DataConstantProperty<number>;
    'atmosphere-blend': DataConstantProperty<number>;
};

type SkyPropsPossiblyEvaluated = {
    'sky-color': Color;
    'horizon-color': Color;
    'fog-color': Color;
    'fog-ground-blend': number;
    'horizon-fog-blend': number;
    'sky-horizon-blend': number;
    'atmosphere-blend': number;
};

const properties: Properties<SkyProps> = new Properties({
    'sky-color': new DataConstantProperty(styleSpec.sky['sky-color'] as StylePropertySpecification),
    'horizon-color': new DataConstantProperty(styleSpec.sky['horizon-color'] as StylePropertySpecification),
    'fog-color': new DataConstantProperty(styleSpec.sky['fog-color'] as StylePropertySpecification),
    'fog-ground-blend': new DataConstantProperty(styleSpec.sky['fog-ground-blend'] as StylePropertySpecification),
    'horizon-fog-blend': new DataConstantProperty(styleSpec.sky['horizon-fog-blend'] as StylePropertySpecification),
    'sky-horizon-blend': new DataConstantProperty(styleSpec.sky['sky-horizon-blend'] as StylePropertySpecification),
    'atmosphere-blend': new DataConstantProperty(styleSpec.sky['atmosphere-blend'] as StylePropertySpecification)
});

const TRANSITION_SUFFIX = '-transition';

export class Sky extends Evented {
    properties: PossiblyEvaluated<SkyProps, SkyPropsPossiblyEvaluated>;

    /**
     * This is used to cache the gl mesh for the sky, it should be initialized only once.
     */
    mesh: Mesh | undefined;
    _transitionable: Transitionable<SkyProps>;
    _transitioning: Transitioning<SkyProps>;

    constructor(sky?: SkySpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.setSky(sky);
        this._transitioning = this._transitionable.untransitioned();
        this.recalculate(new EvaluationParameters(0));
    }

    setSky(sky?: SkySpecification, options: StyleSetterOptions = {}) {
        if (this._validate(validateSky, sky, options)) return;

        if (!sky) {
            sky = {
                'sky-color': 'transparent',
                'horizon-color': 'transparent',
                'fog-color': 'transparent',
                'fog-ground-blend': 1,
                'atmosphere-blend': 0,
            };
        }

        for (const name in sky) {
            const value = sky[name];
            if (name.endsWith(TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length) as keyof SkyProps, value);
            } else {
                this._transitionable.setValue(name as keyof SkyProps, value);
            }
        }
    }

    getSky(): SkySpecification {
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

    _validate(validate: Function, value: unknown, options: StyleSetterOptions = {}) {
        if (options?.validate === false) {
            return false;
        }
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
