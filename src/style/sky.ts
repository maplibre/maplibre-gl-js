import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import posAttributes from '../data/pos_attributes';
import {StyleSetterOptions} from './style';
import VertexBuffer from '../gl/vertex_buffer';
import IndexBuffer from '../gl/index_buffer';
import SegmentVector from '../data/segment';
import Context from '../gl/context';
import {SkySpecification} from '../style-spec/types.g';
import {Color, StylePropertySpecification} from '../style-spec/style-spec';
import {DataConstantProperty, PossiblyEvaluated, Properties, Transitionable, Transitioning, TransitionParameters} from './properties';
import styleSpec from '../style-spec/reference/latest';
import {Evented} from '../util/evented';
import validateSky from '../style-spec/validate/validate_sky';
import EvaluationParameters from './evaluation_parameters';
import {emitValidationErrors, validateStyle} from './validate_style';
import {extend} from '../util/util';

type Props = {
    'sky-color': DataConstantProperty<Color>;
    'fog-color': DataConstantProperty<Color>;
    'fog-blend': DataConstantProperty<number>;
    'horizon-blend': DataConstantProperty<number>;
};

type PropsPossiblyEvaluated = {
    'sky-color': Color;
    'fog-color': Color;
    'fog-blend': number;
    'horizon-blend': number;
};

const properties: Properties<Props> = new Properties({
    'sky-color': new DataConstantProperty(styleSpec.sky['sky-color'] as StylePropertySpecification),
    'fog-color': new DataConstantProperty(styleSpec.sky['fog-color'] as StylePropertySpecification),
    'fog-blend': new DataConstantProperty(styleSpec.sky['fog-blend'] as StylePropertySpecification),
    'horizon-blend': new DataConstantProperty(styleSpec.sky['horizon-blend'] as StylePropertySpecification),
});

export default class Sky extends Evented {
    properties: PossiblyEvaluated<Props, PropsPossiblyEvaluated>;

    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;

    vertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    segments: SegmentVector;

    constructor(context :Context, sky?: SkySpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.setSky(sky);
        this._transitioning = this._transitionable.untransitioned();

        const vertexArray = new PosArray();
        vertexArray.emplaceBack(-1, -1);
        vertexArray.emplaceBack(1, -1);
        vertexArray.emplaceBack(1, 1);
        vertexArray.emplaceBack(-1, 1);

        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        indexArray.emplaceBack(0, 2, 3);

        this.vertexBuffer = context.createVertexBuffer(vertexArray, posAttributes.members);
        this.indexBuffer = context.createIndexBuffer(indexArray);
        this.segments = SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length);
    }

    setSky(sky?: SkySpecification, options: StyleSetterOptions = {}) {
        if (this._validate(validateSky, sky, options)) {
            return;
        }

        for (const name in sky) {
            this._transitionable.setValue(name as keyof Props, sky[name]);
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

    _validate(validate: Function, value: unknown, options?: {
        validate?: boolean;
    }) {
        if (options && options.validate === false) {
            return false;
        }

        return emitValidationErrors(this, validate.call(validateStyle, extend({
            value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }

    calculateFogBlendOpacity(pitch) {
        if (pitch < 60) return 0; // disable
        if (pitch < 70) return (pitch - 60) / 10; // fade in
        return 1;
    }
}
