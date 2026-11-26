import {FillExtrusionLayoutArray, PosArray} from '../array_types.g.ts';
import {members as layoutAttributes, centroidAttributes} from './fill_extrusion_attributes.ts';
import {type Segment, SegmentVector} from '../segment.ts';
import {ProgramConfigurationSet} from '../program_configuration.ts';
import {TriangleIndexArray} from '../index_array_type.ts';
import {isBoundaryEdge, isEntirelyOutside} from '../extent_bounds.ts';
import {VectorTileFeature} from '@mapbox/vector-tile';
import {classifyRings} from '@maplibre/maplibre-gl-style-spec';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer.ts';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features.ts';
import {loadGeometry} from '../load_geometry.ts';
import {toEvaluationFeature} from '../evaluation_feature.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {subdividePolygon, subdivideVertexLine} from '../../render/subdivision.ts';
import {fillLargeMeshArrays} from '../../render/fill_large_mesh_arrays.ts';
import {getTileUnitsForMeters, roundPolygonCornersIfNeeded, roundedWallNormals} from './round_polygon_corners.ts';

import type {CanonicalTileID} from '../../tile/tile_id.ts';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    BucketDependencyParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket.ts';
import type {FillExtrusionStyleLayer} from '../../style/style_layer/fill_extrusion_style_layer.ts';
import type {Context} from '../../webgl/context.ts';
import type {IndexBuffer} from '../../webgl/index_buffer.ts';
import type {VertexBuffer} from '../../webgl/vertex_buffer.ts';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state.ts';
import type {ImagePosition} from '../../render/image_atlas.ts';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

const FACTOR = Math.pow(2, 13);
const ROOF_NORMAL_Z = FACTOR * 2;
const MAX_WALL_LENGTH = 16383;

/** `z` is stored as is: {@link ROOF_NORMAL_Z} for roofs, {@link wallEndData} for walls. */
function addVertex(vertexArray, x, y, nx, ny, z, t, e) {
    vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        // a_normal_ed: 3-component normal and 1-component edgedistance
        Math.floor(nx * FACTOR) * 2 + t,
        ny * FACTOR * 2,
        z,
        // edgedistance (used for wrapping patterns around extrusion sides)
        Math.round(e)
    );
}

/**
 * Packs the ground occlusion data of one wall end into `a_normal_ed.z`: the sign marks the first end,
 * bit 0 a convex corner, the other bits the wall's length in tile units.
 */
function wallEndData(isFirstEnd: boolean, length: number, isConvex: boolean): number {
    const data = 2 * Math.min(Math.round(length), MAX_WALL_LENGTH) + (isConvex ? 1 : 0);
    return isFirstEnd ? data : -data;
}

/** Whether the outline turns convex at `corner`, i.e. `neighbour` lies on the side `inwardNormal` points to. */
function isConvexCorner(corner: Point, neighbour: Point | undefined, inwardNormal: Point): boolean {
    if (!neighbour || isBoundaryEdge(corner, neighbour)) return false;
    return (neighbour.x - corner.x) * inwardNormal.x + (neighbour.y - corner.y) * inwardNormal.y > 0;
}

/** The nearest point before (`step = -1`) or after (`step = 1`) `index` that differs from it, wrapping around a closed ring. */
function distinctNeighbour(geometry: Point[], index: number, step: 1 | -1): Point | undefined {
    const last = geometry.length - 1;
    const isRing = last > 0 && geometry[0].equals(geometry[last]);
    const point = geometry[index];
    for (let i = index + step, visited = 0; visited < last; i += step, visited++) {
        if (isRing) {
            if (i > last) i = 1;
            else if (i < 0) i = last - 1;
        } else if (i < 0 || i > last) {
            return undefined;
        }
        if (!geometry[i].equals(point)) return geometry[i];
    }
    return undefined;
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
    layers: FillExtrusionStyleLayer[];
    layerIds: string[];
    stateDependentLayers: FillExtrusionStyleLayer[];
    stateDependentLayerIds: string[];

    layoutVertexArray: FillExtrusionLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    centroidVertexArray: PosArray;
    centroidVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasDependencies: boolean;
    programConfigurations: ProgramConfigurationSet<FillExtrusionStyleLayer>;
    segments: SegmentVector;
    /** Subset of {@link segments} covering only wall triangles, placed at the start of each segment in {@link indexArray}. */
    wallSegments: SegmentVector;
    uploaded: boolean;
    features: BucketFeature[];

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

    populate(features: IndexedFeature[], options: PopulateParameters, canonical: CanonicalTileID): void {
        this.features = [];
        this.hasDependencies = hasPattern('fill-extrusion', this.layers, options);

        const globalProperties = new EvaluationParameters(this.zoom);
        const layer = this.layers[0];
        const roundedCornerDistanceInMeters = layer.layout.get('fill-extrusion-rounded-corner-distance');
        const roundedCornerDistance = roundedCornerDistanceInMeters > 0 ? getTileUnitsForMeters(roundedCornerDistanceInMeters, canonical) : 0;
        const needGeometry = layer._featureFilter.needGeometry;

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!layer._featureFilter.filter(globalProperties, evaluationFeature, canonical)) continue;

            const rawGeometry = needGeometry ? evaluationFeature.geometry : loadGeometry(feature);
            const geometry = roundPolygonCornersIfNeeded(rawGeometry, roundedCornerDistance);

            const bucketFeature: BucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry,
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

        if (!this.hasDependencies) {
            this._partitionWalls();
        }
    }

    addFeatures({options, canonical, patternPositions}: BucketDependencyParameters): void {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, patternPositions, options.subdivisionGranularity);
        }
        this._partitionWalls();
    }

    update(states: FeatureStates, vtLayer: VectorTileLayerLike, imagePositions: {[_: string]: ImagePosition}): void {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions
        });
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0 && this.centroidVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context): void {
        if (!this.uploaded) {
            if (!this.wallSegments) this._partitionWalls();
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.centroidVertexBuffer = context.createVertexBuffer(this.centroidVertexArray, centroidAttributes.members, true);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy(): void {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.wallSegments?.destroy();
        this.centroidVertexBuffer.destroy();
    }

    /** Places wall triangles before roof triangles in each segment and records their ranges in {@link wallSegments}. */
    private _partitionWalls(): void {
        const wallSegments = new SegmentVector();
        const int16 = this.layoutVertexArray.int16;
        const uint16 = this.indexArray.uint16;
        let scratch: Uint16Array | null = null;

        for (const segment of this.segments.get()) {
            const primCount = segment.primitiveLength;
            if (primCount === 0) continue;

            const start = segment.primitiveOffset * 3;
            const indexCount = primCount * 3;
            const end = start + indexCount;
            const vOffset = segment.vertexOffset;

            let wallCount = 0;
            for (let i = start; i < end; i += 3) {
                const va = (vOffset + uint16[i]) * 6;
                if (int16[va + 2] !== 1 || int16[va + 3] !== 0) wallCount++;
            }

            if (wallCount === 0) continue;
            if (wallCount < primCount) {
                if (!scratch || scratch.length < indexCount) scratch = new Uint16Array(indexCount);
                scratch.set(uint16.subarray(start, end));
                let wallDst = start;
                let roofDst = start + wallCount * 3;
                for (let i = 0; i < indexCount; i += 3) {
                    const a = scratch[i];
                    const va = (vOffset + a) * 6;
                    const isWall = int16[va + 2] !== 1 || int16[va + 3] !== 0;
                    const dst = isWall ? wallDst : roofDst;
                    uint16[dst] = a;
                    uint16[dst + 1] = scratch[i + 1];
                    uint16[dst + 2] = scratch[i + 2];
                    if (isWall) wallDst += 3;
                    else roofDst += 3;
                }
            }

            wallSegments.get().push({
                vertexOffset: vOffset,
                primitiveOffset: segment.primitiveOffset,
                vertexLength: segment.vertexLength,
                primitiveLength: wallCount,
                vaos: {}
            });
        }

        this.wallSegments = wallSegments;
    }

    addFeature(feature: BucketFeature, geometry: Point[][], index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}, subdivisionGranularity: SubdivisionGranularitySetting): void {
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
        polygon: Point[][],
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
                addVertex(vertexArray, x, y, 0, 0, ROOF_NORMAL_Z, 1, 0);
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
    private _generateSideFaces(geometry: Point[], segmentReference: {segment: Segment}): void {
        let edgeDistance = 0;
        const hasRoundedCorners = this.layers[0].layout.get('fill-extrusion-rounded-corner-distance') > 0;
        const wallNormals = hasRoundedCorners ? roundedWallNormals(geometry) : null;

        for (let p = 1; p < geometry.length; p++) {
            const p1 = geometry[p];
            const p2 = geometry[p - 1];

            if (isBoundaryEdge(p1, p2) || (wallNormals && !wallNormals[p])) {
                continue;
            }

            if (segmentReference.segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segmentReference.segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
            }

            const perp = p1.sub(p2)._perp()._unit();
            const {start, end} = wallNormals ? wallNormals[p] : {start: perp, end: perp};
            const dist = p2.dist(p1);
            if (edgeDistance + dist > 32768) edgeDistance = 0;

            const firstEnd = wallEndData(true, dist, !wallNormals && isConvexCorner(p1, distinctNeighbour(geometry, p, 1), perp));
            const secondEnd = wallEndData(false, dist, !wallNormals && isConvexCorner(p2, distinctNeighbour(geometry, p - 1, -1), perp));

            addVertex(this.layoutVertexArray, p1.x, p1.y, end.x, end.y, firstEnd, 0, edgeDistance);
            addVertex(this.layoutVertexArray, p1.x, p1.y, end.x, end.y, firstEnd, 1, edgeDistance);

            edgeDistance += dist;

            addVertex(this.layoutVertexArray, p2.x, p2.y, start.x, start.y, secondEnd, 0, edgeDistance);
            addVertex(this.layoutVertexArray, p2.x, p2.y, start.x, start.y, secondEnd, 1, edgeDistance);

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
function accumulatePointsToCentroid(centroid: CentroidAccumulator, geometry: Point[]): void {
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
