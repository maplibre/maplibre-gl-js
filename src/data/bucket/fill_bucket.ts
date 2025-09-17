import {FillLayoutArray} from '../array_types.g';

import {members as layoutAttributes} from './fill_attributes';
import {SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {LineIndexArray, TriangleIndexArray} from '../index_array_type';
import {classifyRings} from '@maplibre/maplibre-gl-style-spec';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features';
import {loadGeometry} from '../load_geometry';
import {toEvaluationFeature} from '../evaluation_feature';
import {EvaluationParameters} from '../../style/evaluation_parameters';

import type {CanonicalTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer';
import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import {subdividePolygon} from '../../render/subdivision';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {fillLargeMeshArrays} from '../../render/fill_large_mesh_arrays';

export class FillBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillStyleLayer>;
    stateDependentLayerIds: Array<string>;
    patternFeatures: Array<BucketFeature>;

    layoutVertexArray: FillLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    indexArray2: LineIndexArray;
    indexBuffer2: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillStyleLayer>;
    segments: SegmentVector;
    segments2: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<FillStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.patternFeatures = [];

        this.layoutVertexArray = new FillLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.indexArray2 = new LineIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.segments2 = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.hasPattern = hasPattern('fill', this.layers, options);
        const fillSortKey = this.layers[0].layout.get('fill-sort-key');
        const sortFeaturesByKey = !fillSortKey.isConstant();
        const bucketFeatures: BucketFeature[] = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const sortKey = sortFeaturesByKey ?
                fillSortKey.evaluate(evaluationFeature, {}, canonical, options.availableImages) :
                undefined;

            const bucketFeature: BucketFeature = {
                id,
                properties: feature.properties,
                type: feature.type,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                patterns: {},
                sortKey
            };

            bucketFeatures.push(bucketFeature);
        }

        if (sortFeaturesByKey) {
            bucketFeatures.sort((a, b) => a.sortKey - b.sortKey);
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;

            if (this.hasPattern) {
                const patternFeature = addPatternDependencies('fill', this.layers, bucketFeature, {zoom: this.zoom}, options);
                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(patternFeature);
            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, {}, options.subdivisionGranularity);
            }

            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions
        });
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, options.subdivisionGranularity);
        }
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }
    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
            this.indexBuffer2 = context.createIndexBuffer(this.indexArray2);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.indexBuffer2.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.segments2.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }, subdivisionGranularity: SubdivisionGranularitySetting) {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            const subdivided = subdividePolygon(polygon, canonical, subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z));

            const vertexArray = this.layoutVertexArray;

            fillLargeMeshArrays(
                (x, y) => {
                    vertexArray.emplaceBack(x, y);
                },
                this.segments,
                this.layoutVertexArray,
                this.indexArray,
                subdivided.verticesFlattened,
                subdivided.indicesTriangles,
                this.segments2,
                this.indexArray2,
                subdivided.indicesLineList,
            );
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {imagePositions, canonical});
    }
}

register('FillBucket', FillBucket, {omit: ['layers', 'patternFeatures']});
