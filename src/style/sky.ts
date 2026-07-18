import {type PossiblyEvaluated, TRANSITION_SUFFIX, Transitionable, type Transitioning, type TransitionParameters} from './properties.ts';
import {Evented} from '../util/evented.ts';
import {EvaluationParameters} from './evaluation_parameters.ts';
import {validateStyle, validateAndEmit, type Validator} from './validate_style.ts';
import {getProperties, type SkyProps, type SkyPropsPossiblyEvaluated} from './sky_properties.g.ts';
import type {Mesh} from '../render/mesh.ts';
import type {SkySpecification} from '@maplibre/maplibre-gl-style-spec';
import type {StyleSetterOptions} from './style.ts';

export class Sky extends Evented {
    properties: PossiblyEvaluated<SkyProps, SkyPropsPossiblyEvaluated>;

    /**
     * This is used to cache the gl mesh for the sky, it should be initialized only once.
     */
    mesh: Mesh | undefined;
    atmosphereMesh: Mesh | undefined;
    _transitionable: Transitionable<SkyProps>;
    _transitioning: Transitioning<SkyProps>;

    constructor(sky?: SkySpecification) {
        super();
        this._transitionable = new Transitionable(getProperties(), 'sky', undefined);
        this.setSky(sky);
        this._transitioning = this._transitionable.untransitioned();
        this.recalculate(new EvaluationParameters(0));
    }

    setSky(sky?: SkySpecification, options: StyleSetterOptions = {}): void {
        if (this._validate(validateStyle.sky, sky, options)) return;

        sky ||= {
            'sky-color': 'transparent',
            'horizon-color': 'transparent',
            'fog-color': 'transparent',
            'fog-ground-blend': 1,
            'atmosphere-blend': 0,
        };

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

    updateTransitions(parameters: TransitionParameters): void {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition(): boolean {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters): void {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    _validate(validate: Validator, value: unknown, options: StyleSetterOptions = {}): boolean {
        return validateAndEmit(this, validate, {value}, options);
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
    calculateFogBlendOpacity(pitch: number): number {
        if (pitch < 60) return 0; // disable
        if (pitch < 70) return (pitch - 60) / 10; // fade in
        return 1;
    }
}
