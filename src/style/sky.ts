import {DataConstantProperty, PossiblyEvaluated, Properties, Transitionable, Transitioning, TransitionParameters} from './properties';
import {Evented} from '../util/evented';
import {EvaluationParameters} from './evaluation_parameters';
import {emitValidationErrors, validateSky, validateStyle} from './validate_style';
import {extend} from '../util/util';
import {latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';
import type {StylePropertySpecification, SkySpecification} from '@maplibre/maplibre-gl-style-spec';
import {Mesh} from '../render/mesh';

type SkyProps = {
    'atmosphere-blend': DataConstantProperty<number>;
};

type SkyPropsPossiblyEvaluated = {
    'atmosphere-blend': number;
};

const properties: Properties<SkyProps> = new Properties({
    'atmosphere-blend': new DataConstantProperty(styleSpec.sky['atmosphere-blend'] as StylePropertySpecification),
});

const TRANSITION_SUFFIX = '-transition';

export default class Sky extends Evented {
    properties: PossiblyEvaluated<SkyProps, SkyPropsPossiblyEvaluated>;

    /**
     * This is used to cache the gl mesh for the atmosphere, it should be initialized only once.
     */
    atmosphereMesh: Mesh | undefined;

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

    _validate(validate: Function, value: unknown) {
        return emitValidationErrors(this, validate.call(validateStyle, extend({
            value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }

    getAtmosphereBlend(): number {
        // Get the atmosphere blend coefficient
        return this.properties.get('atmosphere-blend');
    }
}
