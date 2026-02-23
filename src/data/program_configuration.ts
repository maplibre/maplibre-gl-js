import {packUint8ToFloat} from '../shaders/encode_attribute';
import {type Color, supportsPropertyExpression} from '@maplibre/maplibre-gl-style-spec';
import {register} from '../util/web_worker_transfer';
import {PossiblyEvaluatedPropertyValue} from '../style/properties';
import {StructArrayLayout1f4, StructArrayLayout2f8, StructArrayLayout4f16, PatternLayoutArray, DashLayoutArray} from './array_types.g';
import {clamp} from '../util/util';
import {patternAttributes} from './bucket/pattern_attributes';
import {dashAttributes} from './bucket/dash_attributes';
import {EvaluationParameters} from '../style/evaluation_parameters';
import {FeaturePositionMap} from './feature_position_map';
import {type Uniform, Uniform1f, UniformColor, Uniform4f} from '../render/uniform_binding';

import type {UniformLocations} from '../render/uniform_binding';

import type {CanonicalTileID} from '../tile/tile_id';
import type {Context} from '../gl/context';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {CrossfadeParameters} from '../style/evaluation_parameters';
import type {StructArray, StructArrayMember} from '../util/struct_array';
import type {VertexBuffer} from '../gl/vertex_buffer';
import type {ImagePosition} from '../render/image_atlas';
import type {
    Feature,
    FeatureState,
    GlobalProperties,
    SourceExpression,
    CompositeExpression,
    FormattedSection
} from '@maplibre/maplibre-gl-style-spec';
import type {FeatureStates} from '../source/source_state';
import type {DashEntry} from '../render/line_atlas';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

export type BinderUniform = {
    name: string;
    property: string;
    binding: Uniform<any>;
};

function packColor(color: Color): [number, number] {
    return [
        packUint8ToFloat(255 * color.r, 255 * color.g),
        packUint8ToFloat(255 * color.b, 255 * color.a)
    ];
}

type PaintOptions = {
    imagePositions: {
        [_: string]: ImagePosition;
    };
    dashPositions?: {
        [_: string]: DashEntry;
    };
    canonical?: CanonicalTileID;
    formattedSection?: FormattedSection;
    globalState?: Record<string, any>;
};

/**
 *  `Binder` is the interface definition for the strategies for constructing,
 *  uploading, and binding paint property data as GLSL attributes. Most style-
 *  spec properties have a 1:1 relationship to shader attribute/uniforms, but
 *  some require multiple values per feature to be passed to the GPU, and in
 *  those cases we bind multiple attributes/uniforms.
 *
 *  It has three implementations, one for each of the three strategies we use:
 *
 *  * For _constant_ properties -- those whose value is a constant, or the constant
 *    result of evaluating a camera expression at a particular camera position -- we
 *    don't need a vertex attribute buffer, and instead use a uniform.
 *  * For data expressions, we use a vertex buffer with a single attribute value,
 *    the evaluated result of the source function for the given feature.
 *  * For composite expressions, we use a vertex buffer with two attributes: min and
 *    max values covering the range of zooms at which we expect the tile to be
 *    displayed. These values are calculated by evaluating the composite expression for
 *    the given feature at strategically chosen zoom levels. In addition to this
 *    attribute data, we also use a uniform value which the shader uses to interpolate
 *    between the min and max value at the final displayed zoom level. The use of a
 *    uniform allows us to cheaply update the value on every frame.
 *
 *  Note that the shader source varies depending on whether we're using a uniform or
 *  attribute. We dynamically compile shaders at runtime to accommodate this.
 */
interface AttributeBinder {
    populatePaintArray(
        length: number,
        feature: Feature,
        options: PaintOptions
    ): void;
    updatePaintArray(
        start: number,
        length: number,
        feature: Feature,
        featureState: FeatureState,
        options: PaintOptions
    ): void;
    upload(a: Context): void;
    destroy(): void;
}

interface UniformBinder {
    uniformNames: Array<string>;
    setUniform(
        uniform: Uniform<any>,
        globals: GlobalProperties,
        currentValue: PossiblyEvaluatedPropertyValue<any>,
        uniformName: string
    ): void;
    getBinding(context: Context, location: WebGLUniformLocation, name: string): Partial<Uniform<any>>;
}

class ConstantBinder implements UniformBinder {
    value: unknown;
    type: string;
    uniformNames: Array<string>;

    constructor(value: unknown, names: Array<string>, type: string) {
        this.value = value;
        this.uniformNames = names.map(name => `u_${name}`);
        this.type = type;
    }

    setUniform(
        uniform: Uniform<any>,
        globals: GlobalProperties,
        currentValue: PossiblyEvaluatedPropertyValue<unknown>
    ): void {
        uniform.set(currentValue.constantOr(this.value));
    }

    getBinding(context: Context, location: WebGLUniformLocation, _: string): Partial<Uniform<any>> {
        return (this.type === 'color') ?
            new UniformColor(context, location) :
            new Uniform1f(context, location);
    }
}

class CrossFadedConstantBinder implements UniformBinder {
    uniformNames: Array<string>;
    patternFrom: Array<number>;
    patternTo: Array<number>;
    dashFrom: Array<number>;
    dashTo: Array<number>;
    pixelRatioFrom: number;
    pixelRatioTo: number;

    constructor(value: unknown, names: Array<string>) {
        this.uniformNames = names.map(name => `u_${name}`);
        this.patternFrom = null;
        this.patternTo = null;
        this.pixelRatioFrom = 1.0;
        this.pixelRatioTo = 1.0;
    }

    setConstantPatternPositions(posTo: ImagePosition, posFrom: ImagePosition) {
        this.pixelRatioFrom = posFrom.pixelRatio;
        this.pixelRatioTo = posTo.pixelRatio;
        this.patternFrom = posFrom.tlbr;
        this.patternTo = posTo.tlbr;
    }

    setConstantDashPositions(dashTo: DashEntry, dashFrom: DashEntry) {
        this.dashTo = [0, dashTo.y, dashTo.height, dashTo.width];
        this.dashFrom = [0, dashFrom.y, dashFrom.height, dashFrom.width];
    }

    setUniform(uniform: Uniform<any>, globals: GlobalProperties, currentValue: PossiblyEvaluatedPropertyValue<unknown>, uniformName: string) {
        let value = null;

        if (uniformName === 'u_pattern_to') {
            value = this.patternTo;
        } else if (uniformName === 'u_pattern_from') {
            value = this.patternFrom;
        } else if (uniformName === 'u_dasharray_to') {
            value = this.dashTo;
        } else if (uniformName === 'u_dasharray_from') {
            value = this.dashFrom;
        } else if (uniformName === 'u_pixel_ratio_to') {
            value = this.pixelRatioTo;
        } else if (uniformName === 'u_pixel_ratio_from') {
            value = this.pixelRatioFrom;
        }

        if (value !== null) {
            uniform.set(value);
        }
    }

    getBinding(context: Context, location: WebGLUniformLocation, name: string): Partial<Uniform<any>> {
        return (name.startsWith('u_pattern') || name.startsWith('u_dasharray_')) ?
            new Uniform4f(context, location) :
            new Uniform1f(context, location);
    }
}

class SourceExpressionBinder implements AttributeBinder {
    expression: SourceExpression;
    type: string;
    maxValue: number;

    paintVertexArray: StructArray;
    paintVertexAttributes: Array<StructArrayMember>;
    paintVertexBuffer: VertexBuffer;

    constructor(expression: SourceExpression, names: Array<string>, type: string, PaintVertexArray: {
        new (...args: any): StructArray;
    }) {
        this.expression = expression;
        this.type = type;
        this.maxValue = 0;
        this.paintVertexAttributes = names.map((name) => ({
            name: `a_${name}`,
            type: 'Float32',
            components: type === 'color' ? 2 : 1,
            offset: 0
        }));
        this.paintVertexArray = new PaintVertexArray();
    }

    populatePaintArray(newLength: number, feature: Feature, options: PaintOptions) {
        const start = this.paintVertexArray.length;
        const value = this.expression.evaluate(new EvaluationParameters(0, options), feature, {}, options.canonical, [], options.formattedSection);
        this.paintVertexArray.resize(newLength);
        this._setPaintValue(start, newLength, value);
    }

    updatePaintArray(start: number, end: number, feature: Feature, featureState: FeatureState, options: PaintOptions) {
        const value = this.expression.evaluate(new EvaluationParameters(0, options), feature, featureState);
        this._setPaintValue(start, end, value);
    }

    _setPaintValue(start, end, value) {
        if (this.type === 'color') {
            const color = packColor(value);
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, color[0], color[1]);
            }
        } else {
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, value);
            }
            this.maxValue = Math.max(this.maxValue, Math.abs(value));
        }
    }

    upload(context: Context) {
        if (this.paintVertexArray && this.paintVertexArray.arrayBuffer) {
            if (this.paintVertexBuffer && this.paintVertexBuffer.buffer) {
                this.paintVertexBuffer.updateData(this.paintVertexArray);
            } else {
                this.paintVertexBuffer = context.createVertexBuffer(this.paintVertexArray, this.paintVertexAttributes, this.expression.isStateDependent);
            }
        }
    }

    destroy() {
        if (this.paintVertexBuffer) {
            this.paintVertexBuffer.destroy();
        }
    }
}

class CompositeExpressionBinder implements AttributeBinder, UniformBinder {
    expression: CompositeExpression;
    uniformNames: Array<string>;
    type: string;
    useIntegerZoom: boolean;
    zoom: number;
    maxValue: number;

    paintVertexArray: StructArray;
    paintVertexAttributes: Array<StructArrayMember>;
    paintVertexBuffer: VertexBuffer;

    constructor(expression: CompositeExpression, names: Array<string>, type: string, useIntegerZoom: boolean, zoom: number, PaintVertexArray: {
        new (...args: any): StructArray;
    }) {
        this.expression = expression;
        this.uniformNames = names.map(name => `u_${name}_t`);
        this.type = type;
        this.useIntegerZoom = useIntegerZoom;
        this.zoom = zoom;
        this.maxValue = 0;
        this.paintVertexAttributes = names.map((name) => ({
            name: `a_${name}`,
            type: 'Float32',
            components: type === 'color' ? 4 : 2,
            offset: 0
        }));
        this.paintVertexArray = new PaintVertexArray();
    }

    populatePaintArray(newLength: number, feature: Feature, options: PaintOptions) {
        const min = this.expression.evaluate(new EvaluationParameters(this.zoom, options), feature, {}, options.canonical, [], options.formattedSection);
        const max = this.expression.evaluate(new EvaluationParameters(this.zoom + 1, options), feature, {}, options.canonical, [], options.formattedSection);
        const start = this.paintVertexArray.length;
        this.paintVertexArray.resize(newLength);
        this._setPaintValue(start, newLength, min, max);
    }

    updatePaintArray(start: number, end: number, feature: Feature, featureState: FeatureState, options: PaintOptions) {
        const min = this.expression.evaluate(new EvaluationParameters(this.zoom, options), feature, featureState);
        const max = this.expression.evaluate(new EvaluationParameters(this.zoom + 1, options), feature, featureState);
        this._setPaintValue(start, end, min, max);
    }

    _setPaintValue(start, end, min, max) {
        if (this.type === 'color') {
            const minColor = packColor(min);
            const maxColor = packColor(max);
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, minColor[0], minColor[1], maxColor[0], maxColor[1]);
            }
        } else {
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, min, max);
            }
            this.maxValue = Math.max(this.maxValue, Math.abs(min), Math.abs(max));
        }
    }

    upload(context: Context) {
        if (this.paintVertexArray && this.paintVertexArray.arrayBuffer) {
            if (this.paintVertexBuffer && this.paintVertexBuffer.buffer) {
                this.paintVertexBuffer.updateData(this.paintVertexArray);
            } else {
                this.paintVertexBuffer = context.createVertexBuffer(this.paintVertexArray, this.paintVertexAttributes, this.expression.isStateDependent);
            }
        }
    }

    destroy() {
        if (this.paintVertexBuffer) {
            this.paintVertexBuffer.destroy();
        }
    }

    setUniform(uniform: Uniform<any>, globals: GlobalProperties): void {
        const currentZoom = this.useIntegerZoom ? Math.floor(globals.zoom) : globals.zoom;
        const factor = clamp(this.expression.interpolationFactor(currentZoom, this.zoom, this.zoom + 1), 0, 1);
        uniform.set(factor);
    }

    getBinding(context: Context, location: WebGLUniformLocation, _: string): Uniform1f {
        return new Uniform1f(context, location);
    }
}

abstract class CrossFadedBinder<T> implements AttributeBinder {
    expression: CompositeExpression;
    type: string;
    useIntegerZoom: boolean;
    zoom: number;
    layerId: string;

    zoomInPaintVertexArray: StructArray;
    zoomOutPaintVertexArray: StructArray;
    zoomInPaintVertexBuffer: VertexBuffer;
    zoomOutPaintVertexBuffer: VertexBuffer;
    paintVertexAttributes: Array<StructArrayMember>;

    constructor(expression: CompositeExpression, type: string, useIntegerZoom: boolean, zoom: number, PaintVertexArray: {
        new (...args: any): StructArray;
    }, layerId: string) {
        this.expression = expression;
        this.type = type;
        this.useIntegerZoom = useIntegerZoom;
        this.zoom = zoom;
        this.layerId = layerId;

        this.zoomInPaintVertexArray = new PaintVertexArray();
        this.zoomOutPaintVertexArray = new PaintVertexArray();
    }

    populatePaintArray(length: number, feature: Feature, options: PaintOptions) {
        const start = this.zoomInPaintVertexArray.length;
        this.zoomInPaintVertexArray.resize(length);
        this.zoomOutPaintVertexArray.resize(length);
        this._setPaintValues(start, length, this.getPositionIds(feature), options);
    }

    updatePaintArray(start: number, end: number, feature: Feature, featureState: FeatureState, options: PaintOptions) {
        this._setPaintValues(start, end, this.getPositionIds(feature), options);
    }

    abstract getVertexAttributes(): Array<StructArrayMember>;

    protected abstract getPositionIds(feature: Feature): {min: string; mid: string; max: string};
    protected abstract getPositions(options: PaintOptions): {[_: string]: T};
    protected abstract emplace(array: StructArray, index: number, midPos: T, minMaxPos: T): void;

    protected _setPaintValues(start: number, end: number, positionIds: {min: string; mid: string; max: string}, options: PaintOptions) {
        const positions = this.getPositions(options);
        if (!positions || !positionIds) return;
        const min = positions[positionIds.min];
        const mid = positions[positionIds.mid];
        const max = positions[positionIds.max];
        if (!min || !mid || !max) return;

        // We populate two paint arrays because, for cross-faded properties, we don't know which direction
        // we're cross-fading to at layout time. In order to keep vertex attributes to a minimum and not pass
        // unnecessary vertex data to the shaders, we determine which to upload at draw time.
        for (let i = start; i < end; i++) {
            this.emplace(this.zoomInPaintVertexArray, i, mid, min);
            this.emplace(this.zoomOutPaintVertexArray, i, mid, max);
        }
    }

    upload(context: Context) {
        if (this.zoomInPaintVertexArray && this.zoomInPaintVertexArray.arrayBuffer && this.zoomOutPaintVertexArray && this.zoomOutPaintVertexArray.arrayBuffer) {
            const attributes = this.getVertexAttributes();
            this.zoomInPaintVertexBuffer = context.createVertexBuffer(this.zoomInPaintVertexArray, attributes, this.expression.isStateDependent);
            this.zoomOutPaintVertexBuffer = context.createVertexBuffer(this.zoomOutPaintVertexArray, attributes, this.expression.isStateDependent);
        }
    }

    destroy() {
        if (this.zoomOutPaintVertexBuffer) this.zoomOutPaintVertexBuffer.destroy();
        if (this.zoomInPaintVertexBuffer) this.zoomInPaintVertexBuffer.destroy();
    }
}

class CrossFadedPatternBinder extends CrossFadedBinder<ImagePosition> {
    protected getPositions(options: PaintOptions): {[_: string]: ImagePosition} {
        return options.imagePositions;
    }

    protected getPositionIds(feature: Feature) {
        return feature.patterns && feature.patterns[this.layerId];
    }

    getVertexAttributes(): Array<StructArrayMember> {
        return patternAttributes.members;
    }

    protected emplace(array: StructArray, index: number, midPos: ImagePosition, minMaxPos: ImagePosition): void {
        array.emplace(index,
            midPos.tlbr[0], midPos.tlbr[1], midPos.tlbr[2], midPos.tlbr[3],
            minMaxPos.tlbr[0], minMaxPos.tlbr[1], minMaxPos.tlbr[2], minMaxPos.tlbr[3],
            midPos.pixelRatio,
            minMaxPos.pixelRatio,
        );
    }
}

class CrossFadedDasharrayBinder extends CrossFadedBinder<DashEntry> {
    protected getPositions(options: PaintOptions): {[_: string]: DashEntry} {
        return options.dashPositions;
    }

    protected getPositionIds(feature: Feature) {
        return feature.dashes && feature.dashes[this.layerId];
    }

    getVertexAttributes(): Array<StructArrayMember> {
        return dashAttributes.members;
    }

    protected emplace(array: StructArray, index: number, midPos: DashEntry, minMaxPos: DashEntry): void {
        array.emplace(index,
            0, midPos.y, midPos.height, midPos.width,
            0, minMaxPos.y, minMaxPos.height, minMaxPos.width,
        );
    }
}

/**
 * @internal
 * ProgramConfiguration contains the logic for binding style layer properties and tile
 * layer feature data into GL program uniforms and vertex attributes.
 *
 * Non-data-driven property values are bound to shader uniforms. Data-driven property
 * values are bound to vertex attributes. In order to support a uniform GLSL syntax over
 * both, [Mapbox GL Shaders](https://github.com/mapbox/mapbox-gl-shaders) defines a `#pragma`
 * abstraction, which ProgramConfiguration is responsible for implementing. At runtime,
 * it examines the attributes of a particular layer, combines this with fixed knowledge
 * about how layers of the particular type are implemented, and determines which uniforms
 * and vertex attributes will be required. It can then substitute the appropriate text
 * into the shader source code, create and link a program, and bind the uniforms and
 * vertex attributes in preparation for drawing.
 *
 * When a vector tile is parsed, this same configuration information is used to
 * populate the attribute buffers needed for data-driven styling using the zoom
 * level and feature property data.
 */
export class ProgramConfiguration {
    binders: {[_: string]: AttributeBinder | UniformBinder};
    cacheKey: string;

    _buffers: Array<VertexBuffer>;

    constructor(layer: TypedStyleLayer, zoom: number, filterProperties: (_: string) => boolean) {
        this.binders = {};
        this._buffers = [];

        const keys = [];

        for (const property in layer.paint._values) {
            if (!filterProperties(property)) continue;
            const value = (layer.paint as any).get(property);
            if (!(value instanceof PossiblyEvaluatedPropertyValue) || !supportsPropertyExpression(value.property.specification)) {
                continue;
            }
            const names = paintAttributeNames(property, layer.type);
            const expression = value.value;
            const type = value.property.specification.type;
            const useIntegerZoom = (value.property as any).useIntegerZoom;
            const propType = value.property.specification['property-type'];
            const isCrossFaded = propType === 'cross-faded' || propType === 'cross-faded-data-driven';

            if (expression.kind === 'constant') {
                this.binders[property] = isCrossFaded ?
                    new CrossFadedConstantBinder(expression.value, names) :
                    new ConstantBinder(expression.value, names, type);
                keys.push(`/u_${property}`);

            } else if (expression.kind === 'source' || isCrossFaded) {
                const StructArrayLayout = layoutType(property, type, 'source');
                this.binders[property] = isCrossFaded ?
                    property === 'line-dasharray' ?
                        new CrossFadedDasharrayBinder(expression as CompositeExpression, type, useIntegerZoom, zoom, StructArrayLayout, layer.id) :
                        new CrossFadedPatternBinder(expression as CompositeExpression, type, useIntegerZoom, zoom, StructArrayLayout, layer.id) :
                    new SourceExpressionBinder(expression as SourceExpression, names, type, StructArrayLayout);
                keys.push(`/a_${property}`);

            } else {
                const StructArrayLayout = layoutType(property, type, 'composite');
                this.binders[property] = new CompositeExpressionBinder(expression, names, type, useIntegerZoom, zoom, StructArrayLayout);
                keys.push(`/z_${property}`);
            }
        }

        this.cacheKey = keys.sort().join('');
    }

    getMaxValue(property: string): number {
        const binder = this.binders[property];
        return binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder ? binder.maxValue : 0;
    }

    populatePaintArrays(newLength: number, feature: Feature, options: PaintOptions) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof CrossFadedBinder)
                binder.populatePaintArray(newLength, feature, options);
        }
    }
    setConstantPatternPositions(posTo: ImagePosition, posFrom: ImagePosition) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof CrossFadedConstantBinder)
                binder.setConstantPatternPositions(posTo, posFrom);
        }
    }

    setConstantDashPositions(dashTo: DashEntry, dashFrom: DashEntry) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof CrossFadedConstantBinder)
                binder.setConstantDashPositions(dashTo, dashFrom);
        }
    }

    updatePaintArrays(
        featureStates: FeatureStates,
        featureMap: FeaturePositionMap,
        vtLayer: VectorTileLayerLike,
        layer: TypedStyleLayer,
        options: PaintOptions
    ): boolean {
        let dirty: boolean = false;
        for (const id in featureStates) {
            const positions = featureMap.getPositions(id);

            for (const pos of positions) {
                const feature = vtLayer.feature(pos.index);

                for (const property in this.binders) {
                    const binder = this.binders[property];
                    if ((binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder ||
                         binder instanceof CrossFadedBinder) && binder.expression.isStateDependent === true) {
                        //AHM: Remove after https://github.com/mapbox/mapbox-gl-js/issues/6255
                        const value = (layer.paint as any).get(property);
                        binder.expression = value.value;
                        binder.updatePaintArray(pos.start, pos.end, feature, featureStates[id], options);
                        dirty = true;
                    }
                }
            }
        }
        return dirty;
    }

    defines(): Array<string> {
        const result = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof ConstantBinder || binder instanceof CrossFadedConstantBinder) {
                result.push(...binder.uniformNames.map(name => `#define HAS_UNIFORM_${name}`));
            }
        }
        return result;
    }

    getBinderAttributes(): Array<string> {
        const result = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder) {
                for (let i = 0; i < binder.paintVertexAttributes.length; i++) {
                    result.push(binder.paintVertexAttributes[i].name);
                }
            } else if (binder instanceof CrossFadedBinder) {
                const attributes = binder.getVertexAttributes();
                for (const attribute of attributes) {
                    result.push(attribute.name);
                }
            }
        }
        return result;
    }

    getBinderUniforms(): Array<string> {
        const uniforms = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof ConstantBinder || binder instanceof CrossFadedConstantBinder || binder instanceof CompositeExpressionBinder) {
                for (const uniformName of binder.uniformNames) {
                    uniforms.push(uniformName);
                }
            }
        }
        return uniforms;
    }

    getPaintVertexBuffers(): Array<VertexBuffer> {
        return this._buffers;
    }

    getUniforms(context: Context, locations: UniformLocations): Array<BinderUniform> {
        const uniforms = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof ConstantBinder || binder instanceof CrossFadedConstantBinder || binder instanceof CompositeExpressionBinder) {
                for (const name of binder.uniformNames) {
                    if (locations[name]) {
                        const binding = binder.getBinding(context, locations[name], name);
                        uniforms.push({name, property, binding});
                    }
                }
            }
        }
        return uniforms;
    }

    setUniforms(
        context: Context,
        binderUniforms: Array<BinderUniform>,
        properties: any,
        globals: GlobalProperties
    ) {
        // Uniform state bindings are owned by the Program, but we set them
        // from within the ProgramConfiguration's binder members.
        for (const {name, property, binding} of binderUniforms) {
            (this.binders[property] as any).setUniform(binding, globals, properties.get(property), name);
        }
    }

    updatePaintBuffers(crossfade?: CrossfadeParameters) {
        this._buffers = [];

        for (const property in this.binders) {
            const binder = this.binders[property];
            if (crossfade && binder instanceof CrossFadedBinder) {
                const patternVertexBuffer = crossfade.fromScale === 2 ? binder.zoomInPaintVertexBuffer : binder.zoomOutPaintVertexBuffer;
                if (patternVertexBuffer) this._buffers.push(patternVertexBuffer);

            } else if ((binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder) && binder.paintVertexBuffer) {
                this._buffers.push(binder.paintVertexBuffer);
            }
        }
    }

    upload(context: Context) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof CrossFadedBinder)
                binder.upload(context);
        }
        this.updatePaintBuffers();
    }

    destroy() {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof CrossFadedBinder)
                binder.destroy();
        }
    }
}

export class ProgramConfigurationSet<Layer extends TypedStyleLayer> {
    programConfigurations: {[_: string]: ProgramConfiguration};
    needsUpload: boolean;
    _featureMap: FeaturePositionMap;
    _bufferOffset: number;

    constructor(layers: ReadonlyArray<Layer>, zoom: number, filterProperties: (_: string) => boolean = () => true) {
        this.programConfigurations = {};
        for (const layer of layers) {
            this.programConfigurations[layer.id] = new ProgramConfiguration(layer, zoom, filterProperties);
        }
        this.needsUpload = false;
        this._featureMap = new FeaturePositionMap();
        this._bufferOffset = 0;
    }

    populatePaintArrays(length: number, feature: Feature, index: number, options: PaintOptions) {
        for (const key in this.programConfigurations) {
            this.programConfigurations[key].populatePaintArrays(length, feature, options);
        }

        if (feature.id !== undefined) {
            this._featureMap.add(feature.id, index, this._bufferOffset, length);
        }
        this._bufferOffset = length;

        this.needsUpload = true;
    }

    updatePaintArrays(featureStates: FeatureStates, vtLayer: VectorTileLayerLike, layers: ReadonlyArray<TypedStyleLayer>, options: PaintOptions) {
        for (const layer of layers) {
            this.needsUpload = this.programConfigurations[layer.id].updatePaintArrays(featureStates, this._featureMap, vtLayer, layer, options) || this.needsUpload;
        }
    }

    get(layerId: string) {
        return this.programConfigurations[layerId];
    }

    upload(context: Context) {
        if (!this.needsUpload) return;
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].upload(context);
        }
        this.needsUpload = false;
    }

    destroy() {
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].destroy();
        }
    }
}

function paintAttributeNames(property: string, type: string) {
    const attributeNameExceptions = {
        'text-opacity': ['opacity'],
        'icon-opacity': ['opacity'],
        'text-color': ['fill_color'],
        'icon-color': ['fill_color'],
        'text-halo-color': ['halo_color'],
        'icon-halo-color': ['halo_color'],
        'text-halo-blur': ['halo_blur'],
        'icon-halo-blur': ['halo_blur'],
        'text-halo-width': ['halo_width'],
        'icon-halo-width': ['halo_width'],
        'line-gap-width': ['gapwidth'],
        'line-dasharray': ['dasharray_to', 'dasharray_from'],
        'line-pattern': ['pattern_to', 'pattern_from', 'pixel_ratio_to', 'pixel_ratio_from'],
        'fill-pattern': ['pattern_to', 'pattern_from', 'pixel_ratio_to', 'pixel_ratio_from'],
        'fill-extrusion-pattern': ['pattern_to', 'pattern_from', 'pixel_ratio_to', 'pixel_ratio_from'],
    };

    return attributeNameExceptions[property] || [property.replace(`${type}-`, '').replace(/-/g, '_')];
}

function getLayoutException(property: string) {
    const propertyExceptions = {
        'line-pattern': {
            'source': PatternLayoutArray,
            'composite': PatternLayoutArray
        },
        'fill-pattern': {
            'source': PatternLayoutArray,
            'composite': PatternLayoutArray
        },
        'fill-extrusion-pattern': {
            'source': PatternLayoutArray,
            'composite': PatternLayoutArray
        },
        'line-dasharray': {
            'source': DashLayoutArray,
            'composite': DashLayoutArray
        },
    };

    return propertyExceptions[property];
}

function layoutType(property: string, type: string, binderType: string) {
    const defaultLayouts = {
        'color': {
            'source': StructArrayLayout2f8,
            'composite': StructArrayLayout4f16
        },
        'number': {
            'source': StructArrayLayout1f4,
            'composite': StructArrayLayout2f8
        }
    };

    const layoutException = getLayoutException(property);
    return  layoutException && layoutException[binderType] || defaultLayouts[type][binderType];
}

register('ConstantBinder', ConstantBinder);
register('CrossFadedConstantBinder', CrossFadedConstantBinder);
register('SourceExpressionBinder', SourceExpressionBinder);
register('CrossFadedPatternBinder', CrossFadedPatternBinder);
register('CrossFadedDasharrayBinder', CrossFadedDasharrayBinder);
register('CompositeExpressionBinder', CompositeExpressionBinder);
register('ProgramConfiguration', ProgramConfiguration, {omit: ['_buffers']});
register('ProgramConfigurationSet', ProgramConfigurationSet);
