import {filterObject} from '../util/util';

import {createVisibilityExpression, featureFilter, latest as styleSpec, supportsPropertyExpression} from '@maplibre/maplibre-gl-style-spec';
import {
    validateStyle,
    validateLayoutProperty,
    validatePaintProperty,
    emitValidationErrors
} from './validate_style';
import {Evented} from '../util/evented';
import {Layout, Transitionable, type Transitioning, type Properties, PossiblyEvaluated, PossiblyEvaluatedPropertyValue, TRANSITION_SUFFIX} from './properties';

import type {Bucket, BucketParameters} from '../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {
    FeatureFilter,
    FeatureState,
    LayerSpecification,
    FilterSpecification,
    VisibilitySpecification,
    VisibilityExpression
} from '@maplibre/maplibre-gl-style-spec';
import type {TransitionParameters, PropertyValue} from './properties';
import {type EvaluationParameters} from './evaluation_parameters';
import type {CrossfadeParameters} from './evaluation_parameters';

import type {IReadonlyTransform} from '../geo/transform_interface';
import type {CustomLayerInterface} from './style_layer/custom_style_layer';
import type {Map} from '../ui/map';
import type {StyleSetterOptions} from './style';
import {type mat4} from 'gl-matrix';
import type {UnwrappedTileID} from '../tile/tile_id';
import type {VectorTileFeatureLike} from '@maplibre/vt-pbf';

export type QueryIntersectsFeatureParams = {
    /**
     * The geometry to check intersection with.
     * This geometry is in tile coordinates.
     */
    queryGeometry: Array<Point>;
    /**
     * The feature to allow expression evaluation.
     */
    feature: VectorTileFeatureLike;
    /**
     * The feature state to allow expression evaluation.
     */
    featureState: FeatureState;
    /**
     * The geometry of the feature.
     * This geometry is in tile coordinates.
     */
    geometry: Array<Array<Point>>;
    /**
     * The current zoom level.
     */
    zoom: number;
    /**
     * The transform to convert from tile coordinates to pixels.
     */
    transform: IReadonlyTransform;
    /**
     * The number of pixels per tile unit.
     */
    pixelsToTileUnits: number;
    /**
     * The matrix to convert from tile coordinates to pixel coordinates.
     * The pixel coordinates are relative to the center of the screen.
     */
    pixelPosMatrix: mat4;
    /**
     * The unwrapped tile ID for the tile being queried.
     */
    unwrappedTileID: UnwrappedTileID;
    /**
     * A function to get the elevation of a point in tile coordinates.
     */
    getElevation: undefined | ((x: number, y: number) => number);
};

/**
 * A base class for style layers
 */
export abstract class StyleLayer extends Evented {
    id: string;
    metadata: unknown;
    type: LayerSpecification['type'] | CustomLayerInterface['type'];
    source: string;
    sourceLayer: string;
    minzoom: number;
    maxzoom: number;
    filter: FilterSpecification | void;
    visibility: VisibilitySpecification;
    private _evaluatedVisibility: 'visible' | 'none' | void;

    _crossfadeParameters: CrossfadeParameters;

    _unevaluatedLayout: Layout<any>;
    readonly layout: unknown;

    _transitionablePaint: Transitionable<any>;
    _transitioningPaint: Transitioning<any>;
    readonly paint: unknown;

    _featureFilter: FeatureFilter;

    _visibilityExpression: VisibilityExpression;

    readonly onAdd: ((map: Map) => void);
    readonly onRemove: ((map: Map) => void);

    queryRadius?(bucket: Bucket): number;
    queryIntersectsFeature?(params: QueryIntersectsFeatureParams): boolean | number;
    createBucket?(parameters: BucketParameters<any>): Bucket;

    private _globalState: Record<string, any>; // reference to global state

    constructor(layer: LayerSpecification | CustomLayerInterface, properties: Readonly<{
        layout?: Properties<any>;
        paint?: Properties<any>;
    }>, globalState: Record<string, any>) {
        super();

        this.id = layer.id;
        this.type = layer.type;
        this._globalState = globalState;
        this._featureFilter = {filter: () => true, needGeometry: false, getGlobalStateRefs: () => new Set<string>()};

        if (layer.type === 'custom') return;

        layer = (layer as any as LayerSpecification);

        this.metadata = layer.metadata;
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;

        this._visibilityExpression = createVisibilityExpression(this.visibility, globalState);

        if (layer.type !== 'background') {
            this.source = layer.source;
            this.sourceLayer = layer['source-layer'];
            this.filter = layer.filter;
            this._featureFilter = featureFilter(layer.filter, globalState);
        }

        if (properties.layout) {
            this._unevaluatedLayout = new Layout(properties.layout, globalState);
        }

        if (properties.paint) {
            this._transitionablePaint = new Transitionable(properties.paint, globalState);

            for (const property in layer.paint) {
                this.setPaintProperty(property, layer.paint[property], {validate: false});
            }
            for (const property in layer.layout) {
                this.setLayoutProperty(property, layer.layout[property], {validate: false});
            }

            this._transitioningPaint = this._transitionablePaint.untransitioned();
            //$FlowFixMe
            this.paint = new PossiblyEvaluated(properties.paint);
        }
    }

    setFilter(filter: FilterSpecification | void) {
        this.filter = filter;
        this._featureFilter = featureFilter(filter, this._globalState);
    }

    getCrossfadeParameters() {
        return this._crossfadeParameters;
    }

    getLayoutProperty(name: string) {
        if (name === 'visibility') {
            return this.visibility;
        }

        return this._unevaluatedLayout.getValue(name);
    }

    /**
     * Get list of global state references that are used within layout or filter properties.
     * This is used to determine if layer source need to be reloaded when global state property changes.
     *
     */
    getLayoutAffectingGlobalStateRefs(): Set<string> {
        const globalStateRefs = new Set<string>();

        for (const globalStateRef of this._visibilityExpression.getGlobalStateRefs()) {
            globalStateRefs.add(globalStateRef);
        }

        if (this._unevaluatedLayout) {
            for (const propertyName in this._unevaluatedLayout._values) {
                const value = this._unevaluatedLayout._values[propertyName];

                for (const globalStateRef of value.getGlobalStateRefs()) {
                    globalStateRefs.add(globalStateRef);
                }
            }
        }

        for (const globalStateRef of this._featureFilter.getGlobalStateRefs()) {
            globalStateRefs.add(globalStateRef);
        }

        return globalStateRefs;
    }

    /**
     * Get list of global state references that are used within paint properties.
     * This is used to determine if layer needs to be repainted when global state property changes.
     *
     */
    getPaintAffectingGlobalStateRefs(): globalThis.Map<string, Array<{name: string; value: any}>> {
        const globalStateRefs = new globalThis.Map<string, Array<{name: string; value: any}>>();

        if (this._transitionablePaint) {
            for (const propertyName in this._transitionablePaint._values) {
                const value = this._transitionablePaint._values[propertyName].value;

                for (const globalStateRef of value.getGlobalStateRefs()) {
                    const properties = globalStateRefs.get(globalStateRef) ?? [];
                    properties.push({name: propertyName, value: value.value});
                    globalStateRefs.set(globalStateRef, properties);
                }
            }
        }

        return globalStateRefs;
    }

    /**
     * Get list of global state references that are used within visibility expression.
     * This is used to determine if layer visibility needs to be updated when global state property changes.
     */
    getVisibilityAffectingGlobalStateRefs() {
        return this._visibilityExpression.getGlobalStateRefs();
    }

    setLayoutProperty(name: string, value: any, options: StyleSetterOptions = {}) {
        if (value !== null && value !== undefined) {
            const key = `layers.${this.id}.layout.${name}`;
            if (this._validate(validateLayoutProperty, key, name, value, options)) {
                return;
            }
        }

        if (name === 'visibility') {
            this.visibility = value;
            this._visibilityExpression.setValue(value);
            this.recalculateVisibility();
            return;
        }

        this._unevaluatedLayout.setValue(name, value);
    }

    getPaintProperty(name: string) {
        if (name.endsWith(TRANSITION_SUFFIX)) {
            return this._transitionablePaint.getTransition(name.slice(0, -TRANSITION_SUFFIX.length));
        } else {
            return this._transitionablePaint.getValue(name);
        }
    }

    setPaintProperty(name: string, value: unknown, options: StyleSetterOptions = {}) {
        if (value !== null && value !== undefined) {
            const key = `layers.${this.id}.paint.${name}`;
            if (this._validate(validatePaintProperty, key, name, value, options)) {
                return false;
            }
        }

        if (name.endsWith(TRANSITION_SUFFIX)) {
            this._transitionablePaint.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), (value as any) || undefined);
            return false;
        } else {
            const transitionable = this._transitionablePaint._values[name];
            const isCrossFadedProperty = transitionable.property.specification['property-type'] === 'cross-faded-data-driven';
            const wasDataDriven = transitionable.value.isDataDriven();
            const oldValue = transitionable.value;

            this._transitionablePaint.setValue(name, value);
            this._handleSpecialPaintPropertyUpdate(name);

            const newValue = this._transitionablePaint._values[name].value;
            const isDataDriven = newValue.isDataDriven();

            // if a cross-faded value is changed, we need to make sure the new icons get added to each tile's iconAtlas
            // so a call to _updateLayer is necessary, and we return true from this function so it gets called in
            // Style.setPaintProperty
            return isDataDriven || wasDataDriven || isCrossFadedProperty || this._handleOverridablePaintPropertyUpdate(name, oldValue, newValue);
        }
    }

    _handleSpecialPaintPropertyUpdate(_: string) {
        // No-op; can be overridden by derived classes.
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        // No-op; can be overridden by derived classes.
        return false;
    }

    isHidden(zoom: number = this.minzoom, roundMinZoom: boolean = false) {
        if (this.minzoom && zoom < (roundMinZoom ? Math.floor(this.minzoom) : this.minzoom)) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        return this._evaluatedVisibility === 'none';
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioningPaint = this._transitionablePaint.transitioned(parameters, this._transitioningPaint);
    }

    hasTransition() {
        return this._transitioningPaint.hasTransition();
    }

    recalculateVisibility() {
        this._evaluatedVisibility = this._visibilityExpression.evaluate();
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        if (parameters.getCrossfadeParameters) {
            this._crossfadeParameters = parameters.getCrossfadeParameters();
        }

        if (this._unevaluatedLayout) {
            (this as any).layout = this._unevaluatedLayout.possiblyEvaluate(parameters, undefined, availableImages);
        }

        (this as any).paint = this._transitioningPaint.possiblyEvaluate(parameters, undefined, availableImages);
    }

    serialize(): LayerSpecification {
        const output: LayerSpecification = {
            'id': this.id,
            'type': this.type as LayerSpecification['type'],
            'source': this.source,
            'source-layer': this.sourceLayer,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter as FilterSpecification,
            'layout': this._unevaluatedLayout && this._unevaluatedLayout.serialize(),
            'paint': this._transitionablePaint && this._transitionablePaint.serialize()
        };

        if (this.visibility) {
            output.layout = output.layout || {};
            output.layout.visibility = this.visibility;
        }

        return filterObject(output, (value, key) => {
            return value !== undefined &&
                !(key === 'layout' && !Object.keys(value).length) &&
                !(key === 'paint' && !Object.keys(value).length);
        });
    }

    _validate(validate: Function, key: string, name: string, value: unknown, options: StyleSetterOptions = {}) {
        if (options && options.validate === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, {
            key,
            layerType: this.type,
            objectKey: name,
            value,
            styleSpec,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true}
        }));
    }

    is3D() {
        return false;
    }

    isTileClipped() {
        return false;
    }

    hasOffscreenPass() {
        return false;
    }

    resize() {
        // noop
    }

    isStateDependent() {
        for (const property in (this as any).paint._values) {
            const value = (this as any).paint.get(property);
            if (!(value instanceof PossiblyEvaluatedPropertyValue) || !supportsPropertyExpression(value.property.specification)) {
                continue;
            }

            if ((value.value.kind === 'source' || value.value.kind === 'composite') &&
                value.value.isStateDependent) {
                return true;
            }
        }
        return false;
    }
}
