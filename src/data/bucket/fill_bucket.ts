import {FillCornerLayoutArray, FillLayoutArray} from '../array_types.g.ts';
import {members as layoutAttributes} from './fill_attributes.ts';
import {members as cornerAttributes} from './fill_corner_attributes.ts';
import {cornersAlongOutline, findRoundableCorners, MAX_CORNERS_PER_TRIANGLE, roundedFillTriangles, type FillCorner, type TriangleMesh} from './fill_rounded_corners.ts';
import {SegmentVector} from '../segment.ts';
import {ProgramConfigurationSet} from '../program_configuration.ts';
import {LineIndexArray, TriangleIndexArray} from '../index_array_type.ts';
import {classifyRings} from '@maplibre/maplibre-gl-style-spec';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer.ts';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features.ts';
import {loadGeometry} from '../load_geometry.ts';
import {toEvaluationFeature} from '../evaluation_feature.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {subdividePolygon} from '../../render/subdivision.ts';
import {fillLargeMeshArrays} from '../../render/fill_large_mesh_arrays.ts';
import {warnOnce} from '../../util/util.ts';

import type {CanonicalTileID} from '../../tile/tile_id.ts';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    BucketDependencyParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket.ts';
import type {FillStyleLayer} from '../../style/style_layer/fill_style_layer.ts';
import type {Context} from '../../webgl/context.ts';
import type {IndexBuffer} from '../../webgl/index_buffer.ts';
import type {VertexBuffer} from '../../webgl/vertex_buffer.ts';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state.ts';
import type {ImagePosition} from '../../render/image_atlas.ts';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import type {SubdivisionResult} from '../../render/subdivision.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';
import type {Point2D} from '@maplibre/maplibre-gl-style-spec';
import type {GetImagesResponse} from '../../util/actor_messages.ts';
import type {StyleImage} from '../../style/style_image.ts';

export class FillBucket implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layers: FillStyleLayer[];
    layerIds: string[];
    stateDependentLayers: FillStyleLayer[];
    stateDependentLayerIds: string[];
    patternFeatures: BucketFeature[];

    layoutVertexArray: FillLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    /**
     * Whether any layer drawn from this bucket sets `fill-rounded-corner-distance`. It depends on the
     * property being set rather than on its value, because a zoom function can be zero at the zoom the
     * tile is built at and not at the zoom it is drawn at. Layers that leave it unset share the bucket and
     * draw with a distance of zero.
     */
    hasRoundedCorners: boolean;

    /**
     * The corners that round each vertex's triangle, one entry for each entry of `layoutVertexArray`.
     * Empty unless {@link hasRoundedCorners}.
     */
    cornerVertexArray: FillCornerLayoutArray;
    cornerVertexBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    indexArray2: LineIndexArray;
    indexBuffer2: IndexBuffer;

    hasDependencies: boolean;
    sdfPatterns: Record<string, boolean>;
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
        this.hasDependencies = false;
        this.sdfPatterns = {};
        this.patternFeatures = [];

        this.layoutVertexArray = new FillLayoutArray();
        this.hasRoundedCorners = this.layers.some(layer => layer.getPaintProperty('fill-rounded-corner-distance') !== undefined);
        this.cornerVertexArray = new FillCornerLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.indexArray2 = new LineIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.segments2 = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: IndexedFeature[], options: PopulateParameters, canonical: CanonicalTileID): void {
        this.hasDependencies = hasPattern('fill', this.layers, options);
        const fillSortKey = this.layers[0].layout.get('fill-sort-key');
        const sortFeaturesByKey = !fillSortKey.isConstant();
        const bucketFeatures: BucketFeature[] = [];

        const globalProperties = new EvaluationParameters(this.zoom);
        const needGeometry = this.layers[0]._featureFilter.needGeometry;
        for (const {feature, id, index, sourceLayerIndex} of features) {
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(globalProperties, evaluationFeature, canonical)) continue;

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

            if (this.hasDependencies) {
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

    update(states: FeatureStates, vtLayer: VectorTileLayerLike, imagePositions: {
        [_: string]: ImagePosition;
    }): void {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions
        });
    }

    addFeatures({options, canonical, patternPositions, patternMap}: BucketDependencyParameters): void {
        this.detectSdfPatterns(patternMap);
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, patternPositions, options.subdivisionGranularity);
        }
    }

    private detectSdfPatterns(imageMap: GetImagesResponse): void {
        for (const feature of this.patternFeatures) {
            for (const layerId in feature.patterns) {
                const pattern = feature.patterns[layerId];
                this.recordSdfPattern(layerId, imageMap[pattern.min]);
                this.recordSdfPattern(layerId, imageMap[pattern.mid]);
                this.recordSdfPattern(layerId, imageMap[pattern.max]);
            }
        }

        for (const layer of this.layers) {
            const pattern = layer.paint.get('fill-pattern').constantOr(null);
            if (pattern) {
                this.recordSdfPattern(layer.id, imageMap[pattern.from.toString()]);
                this.recordSdfPattern(layer.id, imageMap[pattern.to.toString()]);
            }
        }
    }

    private recordSdfPattern(layerId: string, image: StyleImage | undefined): void {
        if (!image) return;

        const isSdf = image.sdf === true;
        const existing = this.sdfPatterns[layerId];
        if (existing === undefined) {
            this.sdfPatterns[layerId] = isSdf;
        } else if (existing !== isSdf) {
            warnOnce(`Style sheet warning: Cannot mix SDF and non-SDF fill patterns in layer "${layerId}"`);
        }
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }
    upload(context: Context): void {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            if (this.hasRoundedCorners) {
                this.cornerVertexBuffer = context.createVertexBuffer(this.cornerVertexArray, cornerAttributes);
            }
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
            this.indexBuffer2 = context.createIndexBuffer(this.indexArray2);
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy(): void {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.cornerVertexBuffer?.destroy();
        this.indexBuffer.destroy();
        this.indexBuffer2.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.segments2.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Point[][], index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }, subdivisionGranularity: SubdivisionGranularitySetting): void {
        for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
            const granularity = subdivisionGranularity.fill.getGranularityForZoomLevel(canonical.z);
            const subdivided = subdividePolygon(polygon, canonical, granularity);
            if (this.hasRoundedCorners) {
                this.addRoundedPolygon(polygon, subdivided, ring => subdividePolygon([ring], canonical, granularity, false));
                continue;
            }

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

    /**
     * Adds a polygon whose corners the shader rounds. Its mesh is laid out as two vertices of its own for
     * every segment of the outline, followed by three for every triangle of the fill, so that each
     * segment and triangle can carry the corners that shape it. Both are written through one mesh so that
     * the triangle and line segments keep counting the same vertices.
     * @param polygon - The exterior ring followed by its holes, as `classifyRings` groups them
     * @param subdivided - The polygon's mesh, as `subdividePolygon` returns it
     * @param triangulate - Subdivides a ring the way the polygon was, for the triangles that fill its
     * concave corners
     */
    private addRoundedPolygon(polygon: Point[][], subdivided: SubdivisionResult, triangulate: (ring: Point[]) => TriangleMesh): void {
        const corners = findRoundableCorners(polygon);
        const fill = roundedFillTriangles(corners, subdivided, triangulate);

        const lineIndices = subdivided.indicesLineList.flat();
        const outlineCorners = cornersAlongOutline(corners, subdivided.verticesFlattened, lineIndices);
        const outlineVertices = lineIndices.flatMap(v => [subdivided.verticesFlattened[v * 2], subdivided.verticesFlattened[v * 2 + 1]]);
        const outlineVertexCount = lineIndices.length;
        const fillTriangleIndices = Array.from({length: fill.vertices.length / 2}, (_, i) => outlineVertexCount + i);

        fillLargeMeshArrays(
            (x, y, i) => {
                this.layoutVertexArray.emplaceBack(x, y);
                if (i < outlineVertexCount) {
                    emplaceCornerVertex(this.cornerVertexArray, corners, outlineCorners, Math.floor(i / 2), false);
                } else {
                    const triangle = Math.floor((i - outlineVertexCount) / 3);
                    emplaceCornerVertex(this.cornerVertexArray, corners, fill.corners, triangle, fill.addsArea[triangle]);
                }
            },
            this.segments,
            this.layoutVertexArray,
            this.indexArray,
            outlineVertices.concat(fill.vertices),
            fillTriangleIndices,
            this.segments2,
            this.indexArray2,
            [Array.from({length: outlineVertexCount}, (_, i) => i)],
        );
    }
}

/**
 * A corner slot that holds no corner.
 */
const EMPTY_CORNER = {point: {x: 0, y: 0}, prev: {x: 0, y: 0}, next: {x: 0, y: 0}};

/**
 * Appends the corner attributes of one vertex, laid out as `fill_corner_attributes` describes: the
 * corners of the triangle or outline segment the vertex belongs to, how many there are, and whether a
 * triangle adds the arc's area.
 * @param array - The bucket's corner attributes
 * @param corners - The polygon's corners
 * @param slots - {@link MAX_CORNERS_PER_TRIANGLE} indices into `corners` for each triangle or segment, -1 where unused
 * @param entry - The triangle or segment the vertex belongs to
 * @param addsArea - Whether the vertex's triangle draws the area a concave corner's arc adds
 */
function emplaceCornerVertex(array: FillCornerLayoutArray, corners: FillCorner[], slots: Int32Array, entry: number, addsArea: boolean): void {
    const used: Array<Record<'point' | 'prev' | 'next', Point2D>> = [EMPTY_CORNER, EMPTY_CORNER, EMPTY_CORNER];
    let count = 0;
    for (let s = 0; s < MAX_CORNERS_PER_TRIANGLE; s++) {
        const corner = slots[entry * MAX_CORNERS_PER_TRIANGLE + s];
        if (corner === -1) break;
        used[count++] = corners[corner];
    }
    const [c0, c1, c2] = used;

    array.emplaceBack(
        c0.point.x, c0.point.y, c0.prev.x, c0.prev.y,
        c1.point.x, c1.point.y, c1.prev.x, c1.prev.y,
        c2.point.x, c2.point.y, c2.prev.x, c2.prev.y,
        c0.next.x, c0.next.y, c1.next.x, c1.next.y,
        c2.next.x, c2.next.y, count, addsArea ? 1 : 0
    );
}

register('FillBucket', FillBucket, {omit: ['layers', 'patternFeatures']});
