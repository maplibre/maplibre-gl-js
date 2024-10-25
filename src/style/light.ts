import {interpolates, Color, latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';

import {sphericalToCartesian} from '../util/util';
import {Evented} from '../util/evented';
import {
    validateStyle,
    validateLight,
    emitValidationErrors
} from './validate_style';

import type {StylePropertySpecification, LightSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {EvaluationParameters} from './evaluation_parameters';
import type {StyleSetterOptions} from '../style/style';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties';

import type {
    Property,
    PropertyValue,
    TransitionParameters
} from './properties';

type LightPosition = {
    x: number;
    y: number;
    z: number;
};

class LightPositionProperty implements Property<[number, number, number], LightPosition> {
    specification: StylePropertySpecification;

    constructor() {
        this.specification = styleSpec.light.position as StylePropertySpecification;
    }

    possiblyEvaluate(
        value: PropertyValue<[number, number, number], LightPosition>,
        parameters: EvaluationParameters
    ): LightPosition {
        return sphericalToCartesian(value.expression.evaluate(parameters));
    }

    interpolate(a: LightPosition, b: LightPosition, t: number): LightPosition {
        return {
            x: interpolates.number(a.x, b.x, t),
            y: interpolates.number(a.y, b.y, t),
            z: interpolates.number(a.z, b.z, t),
        };
    }
}

type LightProps = {
    'anchor': DataConstantProperty<'map' | 'viewport'>;
    'position': LightPositionProperty;
    'color': DataConstantProperty<Color>;
    'intensity': DataConstantProperty<number>;
};

type LightPropsPossiblyEvaluated = {
    'anchor': 'map' | 'viewport';
    'position': LightPosition;
    'color': Color;
    'intensity': number;
};

const TRANSITION_SUFFIX = '-transition';

let lightProperties: Properties<LightProps>;

/*
 * Represents the light used to light extruded features.
 */
export class Light extends Evented {
    _transitionable: Transitionable<LightProps>;
    _transitioning: Transitioning<LightProps>;
    properties: PossiblyEvaluated<LightProps, LightPropsPossiblyEvaluated>;

    constructor(lightOptions?: LightSpecification) {
        super();
        lightProperties = lightProperties || new Properties({
            'anchor': new DataConstantProperty(styleSpec.light.anchor as StylePropertySpecification),
            'position': new LightPositionProperty(),
            'color': new DataConstantProperty(styleSpec.light.color as StylePropertySpecification),
            'intensity': new DataConstantProperty(styleSpec.light.intensity as StylePropertySpecification),
        });
        this._transitionable = new Transitionable(lightProperties);
        this.setLight(lightOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    getLight(): LightSpecification {
        return this._transitionable.serialize();
    }

    setLight(light?: LightSpecification, options: StyleSetterOptions = {}) {
        if (this._validate(validateLight, light, options)) {
            return;
        }

        for (const name in light) {
            const value = light[name];
            if (name.endsWith(TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length) as keyof LightProps, value);
            } else {
                this._transitionable.setValue(name as keyof LightProps, value);
            }
        }
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
}
