import {DataConstantProperty, PossiblyEvaluated, Properties, Transitionable, Transitioning, TransitionParameters} from './properties';
import {Evented} from '../util/evented';
import {EvaluationParameters} from './evaluation_parameters';
import {emitValidationErrors, validateSky, validateStyle} from './validate_style';
import {latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';
import type {StylePropertySpecification, SkySpecification} from '@maplibre/maplibre-gl-style-spec';
import {Mesh} from '../render/mesh';
import {StyleSetterOptions} from './style';

type SkyProps = {
    'atmosphere-blend': DataConstantProperty<number>;
};

type SkyPropsPossiblyEvaluated = {
    'atmosphere-blend': number;
};

let skyProperties: Properties<SkyProps>;

const TRANSITION_SUFFIX = '-transition';

export default class Sky extends Evented {
    properties: PossiblyEvaluated<SkyProps, SkyPropsPossiblyEvaluated>;

    /**
     * This is used to cache the gl mesh for the atmosphere, it should be initialized only once.
     */
    atmosphereMesh: Mesh | undefined;

    _transitionable: Transitionable<SkyProps>;
    _transitioning: Transitioning<SkyProps>;

    constructor(skyOptions?: SkySpecification) {
        super();
        skyProperties = skyProperties || new Properties({
            'atmosphere-blend': new DataConstantProperty(styleSpec.sky['atmosphere-blend'] as StylePropertySpecification),
        });
        this._transitionable = new Transitionable(skyProperties);
        this.setSky(skyOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    setSky(sky?: SkySpecification, options: StyleSetterOptions = {}) {
        if (this._validate(validateSky, sky, options)) return;

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

    _validate(validate: Function, value: unknown, options?: {
        validate?: boolean;
    }) {
        if (options && options.validate === false) {
            return false;
        }

        return emitValidationErrors(this, validate.call(validateStyle, {
            value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec
        }));
    }

    getAtmosphereBlend(): number {
        // Get the atmosphere blend coefficient
        return this.properties.get('atmosphere-blend');
    }
}
