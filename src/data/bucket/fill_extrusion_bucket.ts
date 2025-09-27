import {FillExtrusionLayoutArray, PosArray} from '../array_types.g';

import {members as layoutAttributes, centroidAttributes} from './fill_extrusion_attributes';
import {type Segment, SegmentVector} from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import {EXTENT} from '../extent';
import {type VectorTileLayer, VectorTileFeature} from '@mapbox/vector-tile';
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

import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer';
import type {Context} from '../../gl/context';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';
import {subdividePolygon, subdivideVertexLine} from '../../render/subdivision';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {fillLargeMeshArrays} from '../../render/fill_large_mesh_arrays';

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
    sampleCount: number;
};

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

    hasDependencies: boolean;
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
        this.hasDependencies = false;

        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.centroidVertexArray = new PosArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.features = [];
        this.hasDependencies = hasPattern('fill-extrusion', this.layers, options);

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

            if (this.hasDependencies) {
                this.features.push(addPatternDependencies('fill-extrusion', this.layers, bucketFeature, {zoom: this.zoom}, options));
            } else {
                this.addFeature(bucketFeature, bucketFeature.geometry, index, canonical, {}, options.subdivisionGranularity);
            }

            options.featureIndex.insert(feature, bucketFeature.geometry, index, sourceLayerIndex, this.index, true);
        }
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions, options.subdivisionGranularity);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {[_: string]: ImagePosition}) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions
        });
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

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}, subdivisionGranularity: SubdivisionGranularitySetting) {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            // Compute polygon centroid to calculate elevation in GPU
            const centroid: CentroidAccumulator = {x: 0, y: 0, sampleCount: 0};
            const oldVertexCount = this.layoutVertexArray.length;
            this.processPolygon(centroid, canonical, feature, polygon, subdivisionGranularity);

            const addedVertices = this.layoutVertexArray.length - oldVertexCount;

            const centroidX = Math.floor(centroid.x / centroid.sampleCount);
            const centroidY = Math.floor(centroid.y / centroid.sampleCount);

            for (let i = 0; i < addedVertices; i++) {
                this.centroidVertexArray.emplaceBack(
                    centroidX,
                    centroidY
                );
            }
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {imagePositions, canonical});
    }

    private processPolygon(
        centroid: CentroidAccumulator,
        canonical: CanonicalTileID,
        feature: BucketFeature,
        polygon: Array<Array<Point>>,
        subdivisionGranularity: SubdivisionGranularitySetting
    ): void {
        if (polygon.length < 1) {
            return;
        }

        if (isEntirelyOutside(polygon[0])) {
            return;
        }

        // Only consider the un-subdivided polygon outer ring for centroid calculation
        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }

            // Here we don't mind if a hole ring is entirely outside, unlike when generating geometry later.
            accumulatePointsToCentroid(centroid, ring);
        }

        const segmentReference = {
            segment: this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray)
        };
        const granularity = subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z);
        const isPolygon = VectorTileFeature.types[feature.type] === 'Polygon';

        for (const ring of polygon) {
            if (ring.length === 0) {
                continue;
            }

            if (isEntirelyOutside(ring)) {
                continue;
            }

            const subdividedRing = subdivideVertexLine(ring, granularity, isPolygon);
            this._generateSideFaces(subdividedRing, segmentReference);
        }

        // Only triangulate and draw the area of the feature if it is a polygon
        // Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
        if (!isPolygon)
            return;

        // Do not generate outlines, since outlines already got subdivided earlier.
        const subdividedPolygon = subdividePolygon(polygon, canonical, granularity, false);
        const vertexArray = this.layoutVertexArray;

        fillLargeMeshArrays(
            (x, y) => {
                addVertex(vertexArray, x, y, 0, 0, 1, 1, 0);
            },
            this.segments,
            this.layoutVertexArray,
            this.indexArray,
            subdividedPolygon.verticesFlattened,
            subdividedPolygon.indicesTriangles
        );
    }

    /**
     * Generates side faces for the supplied geometry. Assumes `geometry` to be a line string, like the output of {@link subdivideVertexLine}.
     * For rings, it is assumed that the first and last vertex of `geometry` are equal.
     */
    private _generateSideFaces(geometry: Array<Point>, segmentReference: {segment: Segment}) {
        let edgeDistance = 0;

        for (let p = 1; p < geometry.length; p++) {
            const p1 = geometry[p];
            const p2 = geometry[p - 1];

            if (isBoundaryEdge(p1, p2)) {
                continue;
            }

            if (segmentReference.segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segmentReference.segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
            }

            const perp = p1.sub(p2)._perp()._unit();
            const dist = p2.dist(p1);
            if (edgeDistance + dist > 32768) edgeDistance = 0;

            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);

            edgeDistance += dist;

            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);

            const bottomRight = segmentReference.segment.vertexLength;

            // ┌──────┐
            // │ 0  1 │ Counter-clockwise winding order.
            // │      │ Triangle 1: 0 => 2 => 1
            // │ 2  3 │ Triangle 2: 1 => 2 => 3
            // └──────┘
            this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
            this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

            segmentReference.segment.vertexLength += 4;
            segmentReference.segment.primitiveLength += 2;
        }
    }
}

/**
 * Accumulates geometry to centroid. Geometry can be either a polygon ring, a line string or a closed line string.
 * In case of a polygon ring or line ring, the last vertex is ignored if it is the same as the first vertex.
 */
function accumulatePointsToCentroid(centroid: CentroidAccumulator, geometry: Array<Point>): void {
    for (let i = 0; i < geometry.length; i++) {
        const p = geometry[i];

        if (i === geometry.length - 1 && geometry[0].x === p.x && geometry[0].y === p.y) {
            continue;
        }

        centroid.x += p.x;
        centroid.y += p.y;
        centroid.sampleCount++;
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
