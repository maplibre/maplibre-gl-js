import {Evented} from '../util/evented.ts';
import {validateStyle, validateAndEmit, type Validator} from './validate_style.ts';
import {getProperties, type LightProps, type LightPropsPossiblyEvaluated} from './light_properties.g.ts';
import {Transitionable, type Transitioning, type PossiblyEvaluated} from './properties.ts';
import {EvaluationParameters} from './evaluation_parameters.ts';

import type {LightSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleSetterOptions} from '../style/style.ts';
import type {TransitionParameters} from './properties.ts';

/*
 * Represents the light used to light extruded features.
 */
export class Light extends Evented {
    _transitionable: Transitionable<LightProps>;
    _transitioning: Transitioning<LightProps>;
    properties: PossiblyEvaluated<LightProps, LightPropsPossiblyEvaluated>;

    constructor(lightOptions: LightSpecification, globalState: Record<string, any>) {
        super();
        this._transitionable = new Transitionable(getProperties(), 'light', globalState);
        this.setLight(lightOptions);
        this._transitioning = this._transitionable.untransitioned();
        this.recalculate(new EvaluationParameters(0));
    }

    getLight(): LightSpecification {
        return this._transitionable.serialize();
    }

    /** The light's values for drawing; an unset `ambient-intensity` falls back to `1 - intensity`. */
    getEvaluated(): LightPropsPossiblyEvaluated {
        const intensity = this.properties.get('intensity');
        const ambientIntensity = this.properties.get('ambient-intensity');
        return {
            anchor: this.properties.get('anchor'),
            position: this.properties.get('position'),
            color: this.properties.get('color'),
            intensity,
            'ambient-color': this.properties.get('ambient-color'),
            'ambient-intensity': Number.isFinite(ambientIntensity) ? ambientIntensity : 1 - intensity,
        };
    }

    setLight(light: LightSpecification, options: StyleSetterOptions = {}): void {
        if (this._validate(validateStyle.light, light, options)) {
            return;
        }

        this._transitionable.setValues(light);
    }

    updateTransitions(parameters: TransitionParameters): void {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition(): boolean {
        return this._transitioning.hasTransition();
    }

    applyGlobalStateChange(refs: string[], priorGlobalState: Record<string, any>, parameters: TransitionParameters): void {
        this._transitioning = this._transitionable.applyGlobalStateChange(refs, priorGlobalState, this._transitioning, parameters);
    }

    recalculate(parameters: EvaluationParameters): void {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    _validate(validate: Validator, value: unknown, options?: StyleSetterOptions): boolean {
        return validateAndEmit(this, validate, {value}, options);
    }
}
