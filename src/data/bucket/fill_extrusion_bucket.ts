import {FillExtrusionLayoutArray, PosArray} from '../array_types.g';

import {members as layoutAttributes, centroidAttributes} from './fill_extrusion_attributes';
import {SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import {EXTENT} from '../extent';
import mvt from '@mapbox/vector-tile';
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
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

import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import {subdivideFill, subdivideVertexLine, granularitySettings} from '../../render/subdivision';
import {fillArrays} from './fill_bucket';

const FACTOR = Math.pow(2, 13);

function addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
    vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        // a_normal_ed: 3-component normal and 1-component edgedistance
        Math.floor(nx * FACTOR) * 2 + t,
        ny * FACTOR * 2,
        nz * FACTOR * 2,
        // edgedistance (used for wrapping patterns around extrusion sides)
        Math.round(e)
    );
}

type CentroidAccumulator = {
    x: number;
    y: number;
    vertexCount: number;
}

export class FillExtrusionBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<FillExtrusionStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillExtrusionStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: FillExtrusionLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    centroidVertexArray: PosArray;
    centroidVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillExtrusionStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;

    constructor(options: BucketParameters<FillExtrusionStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.centroidVertexArray = new PosArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.features = [];
        this.hasPattern = hasPattern('fill-extrusion', this.layers, options);

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const bucketFeature: BucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                properties: feature.properties,
                type: feature.type,
                patterns: {}
            };

            if (this.hasPattern) {
                this.features.push(addPatternDependencies('fill-extrusion', this.layers, bucketFeature, this.zoom, options));
            } else {
                this.addFeature(bucketFeature, bucketFeature.geometry, index, canonical, {});
            }

            options.featureIndex.insert(feature, bucketFeature.geometry, index, sourceLayerIndex, this.index, true);
        }
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {[_: string]: ImagePosition}) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0 && this.centroidVertexArray.length === 0;
    }

    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.centroidVertexBuffer = context.createVertexBuffer(this.centroidVertexArray, centroidAttributes.members, true);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.centroidVertexBuffer.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        // Compute polygon centroid to calculate elevation in GPU
        const centroid: CentroidAccumulator = {x: 0, y: 0, vertexCount: 0};
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            this.processPolygon(centroid, canonical, feature, polygon);
        }

        for (let i = 0; i < centroid.vertexCount; i++) {
            this.centroidVertexArray.emplaceBack(
                Math.floor(centroid.x / centroid.vertexCount),
                Math.floor(centroid.y / centroid.vertexCount)
            );
        }
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, canonical);
    }

    private processPolygon(
        centroid: CentroidAccumulator,
        canonical: CanonicalTileID,
        feature: BucketFeature,
        polygon: Array<Array<Point>>,
    ): void {
        let segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
        const granuality = granularitySettings.granularityFill.getGranularityForZoomLevel(canonical.z);

        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }

            if (isEntirelyOutside(ring)) {
                continue;
            }

            const subdivided = subdivideVertexLine(ring, granuality);

            let edgeDistance = 0;

            for (let p = 0; p < subdivided.length; p++) {
                const p1 = subdivided[p];

                if (p >= 1) {
                    const p2 = subdivided[p - 1];

                    if (!isBoundaryEdge(p1, p2)) {
                        if (segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                            segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                        }

                        const perp = p1.sub(p2)._perp()._unit();
                        const dist = p2.dist(p1);
                        if (edgeDistance + dist > 32768) edgeDistance = 0;

                        addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
                        addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);
                        centroid.x += 2 * p1.x;
                        centroid.y += 2 * p1.y;
                        centroid.vertexCount += 2;

                        edgeDistance += dist;

                        addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
                        addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);
                        centroid.x += 2 * p2.x;
                        centroid.y += 2 * p2.y;
                        centroid.vertexCount += 2;

                        const bottomRight = segment.vertexLength;

                        // ┌──────┐
                        // │ 0  1 │ Counter-clockwise winding order.
                        // │      │ Triangle 1: 0 => 2 => 1
                        // │ 2  3 │ Triangle 2: 1 => 2 => 3
                        // └──────┘
                        this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
                        this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

                        segment.vertexLength += 4;
                        segment.primitiveLength += 2;
                    }
                }
            }
        }

        //Only triangulate and draw the area of the feature if it is a polygon
        //Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
        if (vectorTileFeatureTypes[feature.type] !== 'Polygon')
            return;

        const flattened = [];
        const holeIndices = [];

        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }

            if (ring !== polygon[0]) {
                holeIndices.push(flattened.length / 2);
            }

            for (let i = 0; i < ring.length; i++) {
                flattened.push(ring[i].x);
                flattened.push(ring[i].y);
            }
        }

        // Pass empty array as lines, since lines already got subdivided separately earlier.
        const subdivided = subdivideFill(flattened, holeIndices, [], canonical, granuality);
        const finalVertices = subdivided.verticesFlattened;
        const finalIndicesTriangles = subdivided.indicesTriangles;

        const vertexArray = this.layoutVertexArray;

        fillArrays(
            this.segments,
            null,
            this.layoutVertexArray,
            this.indexArray,
            null,
            finalVertices,
            finalIndicesTriangles,
            null,
            (x, y) => {
                addVertex(vertexArray, x, y, 0, 0, 1, 1, 0);
            }
        );
    }
}

register('FillExtrusionBucket', FillExtrusionBucket, {omit: ['layers', 'features']});

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}

function isEntirelyOutside(ring) {
    return ring.every(p => p.x < 0) ||
        ring.every(p => p.x > EXTENT) ||
        ring.every(p => p.y < 0) ||
        ring.every(p => p.y > EXTENT);
}
