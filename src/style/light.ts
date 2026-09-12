import {sphericalToCartesian} from '../util/util.ts';
import {Evented} from '../util/evented.ts';
import {validateStyle, validateAndEmit, type Validator} from './validate_style.ts';
import {getProperties, type LightProps, type LightPropsPossiblyEvaluated} from './light_properties.g.ts';

import type {vec3} from 'gl-matrix';
import type {LightSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from './evaluation_parameters.ts';
import type {StyleSetterOptions} from '../style/style.ts';
import {Transitionable, type Transitioning, type PossiblyEvaluated} from './properties.ts';

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
    }

    getLight(): LightSpecification {
        return this._transitionable.serialize();
    }

    /**
     * Gets the light position in cartesian coordinates.
     */
    getCartesianPosition(): vec3 {
        return sphericalToCartesian(this.properties.get('position'));
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

    /**
     * Reads the properties that read one of the changed global state keys in `refs` again, transitioning each from
     * the value it had under `priorGlobalState`, a copy of the state from before the change.
     */
    updateGlobalState(refs: string[], priorGlobalState: Record<string, any>, parameters: TransitionParameters): void {
        this._transitioning.retainGlobalState(refs, priorGlobalState);
        if (this._transitionable.rereadGlobalState(refs)) {
            this.updateTransitions(parameters);
        }
    }

    recalculate(parameters: EvaluationParameters): void {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    _validate(validate: Validator, value: unknown, options?: StyleSetterOptions): boolean {
        return validateAndEmit(this, validate, {value}, options);
    }
}
