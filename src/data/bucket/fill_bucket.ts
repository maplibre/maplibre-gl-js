import {FillLayoutArray} from '../array_types.g';

import {members as layoutAttributes} from './fill_attributes';
import {SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {LineIndexArray, TriangleIndexArray} from '../index_array_type';
import earcut from 'earcut';
import {classifyRings} from '../../util/classify_rings';
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
import {subdivideFill} from '../../render/subdivision';
import {ProjectionManager} from '../../render/projection_manager';

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
                const patternFeature = addPatternDependencies('fill', this.layers, bucketFeature, this.zoom, options);
                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(patternFeature);
            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, {});
            }

            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions);
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
    }) {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            const flattened = [];
            const holeIndices = [];
            const lineList = [];

            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                const lineIndices = [];
                const baseIndex = flattened.length / 2;

                lineIndices.push(baseIndex + ring.length - 1);
                lineIndices.push(baseIndex);
                flattened.push(ring[0].x);
                flattened.push(ring[0].y);

                for (let i = 1; i < ring.length; i++) {
                    lineIndices.push(baseIndex + i - 1);
                    lineIndices.push(baseIndex + i);
                    flattened.push(ring[i].x);
                    flattened.push(ring[i].y);
                }

                lineList.push(lineIndices);
            }

            const indices = earcut(flattened, holeIndices);

            // const subdivided = {
            //     vertices: flattened,
            //     indices,
            // };
            //const subdividedTris = subdivideTriangles(flattened, indices, ProjectionManager.getGranualityForZoomLevelForTiles(canonical.z));
            //const subdividedLines = subdivideLines(subdividedTris.vertices, lineIndices, subdividedTris.vertexDictionary, ProjectionManager.getGranualityForZoomLevelForTiles(canonical.z));
            //const subdivided = subdivideSimple(flattened, indices, ProjectionManager.getGranualityForZoomLevel(canonical.z), canonical);

            const subdivided = subdivideFill(flattened, indices, lineList, canonical, ProjectionManager.getGranualityForZoomLevelForTiles(canonical.z));
            const finalVertices = subdivided.verticesFlattened;
            const finalIndicesTriangles = subdivided.indicesTriangles;
            const finalIndicesLineList = subdivided.indicesLineList;

            // const finalVertices = flattened;
            // const finalIndicesTriangles = indices;
            // const finalIndicesLineList = lineList;


            fillArrays(
                this.segments,
                this.segments2,
                this.layoutVertexArray,
                this.indexArray,
                this.indexArray2,
                finalVertices,
                finalIndicesTriangles,
                finalIndicesLineList
            );
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, canonical);
    }
}

register('FillBucket', FillBucket, {omit: ['layers', 'patternFeatures']});

/**
 * This function will take any "mesh" and fill in into vertex buffers, breaking it up into multiple drawcalls as needed
 * if too many vertices are used.
 * Sometimes subdivision might generate more vertices than what fits into 16 bit indices (MAX_VERTEX_ARRAY_LENGTH).
 */
function fillArrays(
    segmentsTriangles: SegmentVector,
    segmentsLines: SegmentVector,
    vertexArray: FillLayoutArray,
    triangleIndexArray: TriangleIndexArray,
    lineIndexArray: LineIndexArray,
    flattened: Array<number>,
    triangleIndices: Array<number>,
    lineList: Array<Array<number>>) {

    const numVertices = flattened.length / 2;

    if (numVertices < SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
        // The fast path - no segmentation needed
        const triangleSegment = segmentsTriangles.prepareSegment(numVertices, vertexArray, triangleIndexArray);
        const triangleIndex = triangleSegment.vertexLength;

        for (let i = 0; i < triangleIndices.length; i += 3) {
            triangleIndexArray.emplaceBack(
                triangleIndex + triangleIndices[i],
                triangleIndex + triangleIndices[i + 1],
                triangleIndex + triangleIndices[i + 2]);
        }

        triangleSegment.vertexLength += numVertices;
        triangleSegment.primitiveLength += triangleIndices.length / 3;

        const lineSegment = segmentsLines.prepareSegment(numVertices, vertexArray, lineIndexArray);
        const lineIndicesStart = lineSegment.vertexLength;
        lineSegment.vertexLength += numVertices;

        for (let i = 0; i < flattened.length; i += 2) {
            vertexArray.emplaceBack(flattened[i], flattened[i + 1]);
        }

        for (let listIndex = 0; listIndex < lineList.length; listIndex++) {
            const lineIndices = lineList[listIndex];

            for (let i = 1; i < lineIndices.length; i += 2) {
                lineIndexArray.emplaceBack(
                    lineIndicesStart + lineIndices[i - 1],
                    lineIndicesStart + lineIndices[i]);
            }

            lineSegment.primitiveLength += lineIndices.length / 2;
        }
    } else {
        // Assumption: the incoming triangle indices use vertices in roughly linear order,
        // for example a grid of quads where vertices are created row by row would satisfy this.
        // Some completely random arbitrary vertex order would not.
        // Thus, if we encounter a vertex that doesn't fit into MAX_VERTEX_ARRAY_LENGTH,
        // we can just stop appending into the old segment and start a new segment,
        // copying vertices that are already present in the old segment into the new segment,
        // because there will not be too many of those vertices.
    }
}
