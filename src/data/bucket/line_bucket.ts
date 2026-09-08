import {LineLayoutArray, LineExtLayoutArray, LineTaperLayoutArray} from '../array_types.g.ts';
import {GEOJSONVT_CLIP_END, GEOJSONVT_CLIP_START} from '@maplibre/geojson-vt';
import {members as layoutAttributes} from './line_attributes.ts';
import {members as layoutAttributesExt} from './line_attributes_ext.ts';
import {members as taperAttributes} from './line_taper_attributes.ts';
import {interpolateWidthProfile} from '../../util/interpolate_widths.ts';
    import {matchTaperProfile, expandTaperKnots, type GeoJSONTaperAnnotation, type GeoJSONTaperFeature, type TaperProfile} from '../../source/geojson_taper.ts';
import {SegmentVector} from '../segment.ts';
import {ProgramConfigurationSet} from '../program_configuration.ts';
import {TriangleIndexArray} from '../array_types.g.ts';
import {EXTENT} from '../extent.ts';
import {VectorTileFeature} from '@mapbox/vector-tile';
import {register} from '../../util/web_worker_transfer.ts';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features.ts';
import {loadGeometry} from '../load_geometry.ts';
import {toEvaluationFeature} from '../evaluation_feature.ts';
import {EvaluationParameters} from '../../style/evaluation_parameters.ts';
import {subdivideVertexLine} from '../../render/subdivision.ts';

import type {CanonicalTileID} from '../../tile/tile_id.ts';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    BucketDependencyParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket.ts';
import type {LineStyleLayer} from '../../style/style_layer/line_style_layer.ts';
import type Point from '@mapbox/point-geometry';
import type {Segment} from '../segment.ts';
import type {RGBAImage} from '../../util/image.ts';
import type {Context} from '../../webgl/context.ts';
import type {Texture} from '../../webgl/texture.ts';
import type {IndexBuffer} from '../../webgl/index_buffer.ts';
import type {VertexBuffer} from '../../webgl/vertex_buffer.ts';
import type {FeatureStates} from '../../source/source_state.ts';
import type {ImagePosition} from '../../render/image_atlas.ts';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings.ts';
import type {DashEntry} from '../../render/line_atlas.ts';
import type {VectorTileLayerLike} from '@maplibre/vt-pbf';

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
const EXTRUDE_SCALE = 63;

/*
 * Sharp corners cause dashed lines to tilt because the distance along the line
 * is the same at both the inner and outer corners. To improve the appearance of
 * dashed lines we add extra points near sharp corners so that a smaller part
 * of the line is tilted.
 *
 * COS_HALF_SHARP_CORNER controls how sharp a corner has to be for us to add an
 * extra vertex. The default is 75 degrees.
 *
 * The newly created vertices are placed SHARP_CORNER_OFFSET pixels from the corner.
 */
const COS_HALF_SHARP_CORNER = Math.cos(75 / 2 * (Math.PI / 180));
const SHARP_CORNER_OFFSET = 15;

// Angle per triangle for approximating round line joins.
const DEG_PER_TRIANGLE = 20;

// The number of bits that is used to store the line distance in the buffer.
const LINE_DISTANCE_BUFFER_BITS = 15;

// We don't have enough bits for the line distance as we'd like to have, so
// use this value to scale the line distance (in tile units) down to a smaller
// value. This lets us store longer distances while sacrificing precision.
const LINE_DISTANCE_SCALE = 1 / 2;

// The maximum line distance, in tile units, that fits in the buffer.
const MAX_LINE_DISTANCE = Math.pow(2, LINE_DISTANCE_BUFFER_BITS - 1) / LINE_DISTANCE_SCALE;

type LineClips = {
    start: number;
    end: number;
};

type GradientTexture = {
    texture?: Texture;
    gradient?: RGBAImage;
    version?: number;
};

/**
 * @internal
 * Line bucket class
 */
export class LineBucket implements Bucket {
    distance: number;
    totalDistance: number;
    maxLineLength: number;
    scaledDistance: number;
    lineClips?: LineClips;

    e1: number;
    e2: number;

    index: number;
    zoom: number;
    overscaling: number;
    layers: LineStyleLayer[];
    layerIds: string[];
    gradients: {[x: string]: GradientTexture};
    stateDependentLayers: any[];
    stateDependentLayerIds: string[];
    patternFeatures: BucketFeature[];
    lineClipsArray: LineClips[];

    layoutVertexArray: LineLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    layoutVertexArray2: LineExtLayoutArray;
    layoutVertexBuffer2: VertexBuffer;

    // Per-vertex taper factors (0 = line start, 1 = line end), only populated when a
    // layer sets `line-width-start` and/or `line-width-end`. Lives in its own buffer so
    // non-tapered lines pay no extra memory or upload cost.
    layoutTaperArray: LineTaperLayoutArray;
    layoutTaperBuffer: VertexBuffer;
    taperEnabled: boolean;
    // Cumulative distance along the current line, reset per `addLine` (never reset by the
    // `linesofar` wrap-around, so the taper factor stays monotonic on long lines).
    taperDistance: number;
    // Total length of the current line, used to normalize `taperDistance` into a 0..1 factor.
    lineLength: number;

    // Per-vertex widths (`line-widths`). When active, the per-vertex buffer holds the
    // absolute width at each vertex (instead of a normalized taper factor), taking
    // precedence over `line-width-start`/`line-width-end`.
    widthsMode: boolean;
    // The resolved widths array for the feature currently being added (may be empty).
    lineWidths: number[] | null;
    // Per-vertex width FACTORS (`line-width-factors`). When active, the per-vertex
    // buffer holds a multiplier of the zoom-composited `line-width` at each vertex,
    // taking precedence over `line-widths`. A feature without a factor value renders
    // with the neutral factor 1 (i.e. exactly `line-width`).
    factorsMode: boolean;
    // The resolved factors array for the feature currently being added (may be null).
    lineFactors: number[] | null;
    // The evaluated `line-width` of the current feature, used as fallback when the
    // widths array is empty.
    currentLineWidth: number;
    // Normalized cumulative distance of each vertex of the current line (0..1), aligned
    // with `lineWidths` and used to linearly interpolate widths along the geometry.
    lineKnots: number[] | null;
    // Worker-computed taper annotation for the current feature (see
    // src/source/geojson_taper.ts). When present, per-vertex knots are anchored to
    // the ORIGINAL line so widths are continuous across tile boundaries.
    taperAnnotation: GeoJSONTaperAnnotation | null;
    // Profiles from the annotation matched against the evaluated arrays of the
    // current feature (may be null).
    taperWidthsValues: TaperProfile | null;
    taperFactorsValues: TaperProfile | null;
    // Resolved per-ring profile (values + original-ring knots) for annotation mode.
    taperWidthProfile: {values: number[]; knots: number[]} | null;
    taperFactorProfile: {values: number[]; knots: number[]} | null;
    // Normalized position (0..1) of every emitted vertex along the ORIGINAL line,
    // aligned with the (subdivided) vertex array. Only set in annotation mode.
    taperVertexKnots: number[] | null;
    // The knot of the vertex currently being emitted (annotation mode).
    currentTaperFactor: number;
    // The widest width ever written into the per-vertex buffer, used as a conservative
    // query pre-filter (data-driven arrays cannot be handled by the paint binder).
    maxVertexWidth: number;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasDependencies: boolean;
    programConfigurations: ProgramConfigurationSet<LineStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<LineStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasDependencies = false;
        this.patternFeatures = [];
        this.lineClipsArray = [];
        this.gradients = {};
        for (const layer of this.layers) {
            this.gradients[layer.id] = {};
        }

        this.layoutVertexArray = new LineLayoutArray();
        this.layoutVertexArray2 = new LineExtLayoutArray();
        this.layoutTaperArray = new LineTaperLayoutArray();
        this.taperEnabled = false;
        this.widthsMode = false;
        this.lineWidths = null;
        this.factorsMode = false;
        this.lineFactors = null;
        this.currentLineWidth = 0;
        this.lineKnots = null;
        this.taperAnnotation = null;
        this.taperWidthsValues = null;
        this.taperFactorsValues = null;
        this.taperWidthProfile = null;
        this.taperFactorProfile = null;
        this.taperVertexKnots = null;
        this.currentTaperFactor = 0;
        this.maxVertexWidth = 0;
        this.taperDistance = 0;
        this.lineLength = 0;
        this.indexArray = new TriangleIndexArray();
        // Arrays cannot be packed into vertex attributes, so `line-widths` and
        // `line-width-factors` are evaluated per feature right here in the bucket and
        // excluded from the paint binder.
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom,
            (property) => property !== 'line-widths' && property !== 'line-width-factors');
        this.segments = new SegmentVector();
        this.maxLineLength = 0;

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);

        // Per-vertex widths take precedence over the two-sided taper, and per-vertex
        // width factors take precedence over the absolute per-vertex widths. A
        // property is active when it is data-driven (cannot be known to be empty/-1
        // for every feature) or when its constant value differs from the default.
        // When active, each vertex stores its position along the line (0..1) in the
        // taper buffer and the shader interpolates the width between
        // `line-width-start`/`line-width-end`, reads the absolute per-vertex width
        // directly, or multiplies the zoom-composited `line-width` by the per-vertex
        // factor.
        this.factorsMode = this.layers.some((layer) => {
            const factors = layer.paint.get('line-width-factors');
            const constant = factors.constantOr(null);
            return !factors.isConstant() || (Array.isArray(constant) && constant.length > 0);
        });
        this.widthsMode = !this.factorsMode && this.layers.some((layer) => {
            const widths = layer.paint.get('line-widths');
            const constant = widths.constantOr(null);
            return !widths.isConstant() || (Array.isArray(constant) && constant.length > 0);
        });
        this.taperEnabled = this.factorsMode || this.widthsMode || this.layers.some((layer) => {
            const widthStart = layer.paint.get('line-width-start');
            const widthEnd = layer.paint.get('line-width-end');
            return widthStart.constantOr(-1) >= 0 || widthEnd.constantOr(-1) >= 0 ||
                !widthStart.isConstant() || !widthEnd.isConstant();
        });
    }

    populate(features: IndexedFeature[], options: PopulateParameters, canonical: CanonicalTileID): void {
        this.hasDependencies = hasPattern('line', this.layers, options) || this.hasLineDasharray(this.layers);
        const lineSortKey = this.layers[0].layout.get('line-sort-key');
        const sortFeaturesByKey = !lineSortKey.isConstant();
        const bucketFeatures: BucketFeature[] = [];

        const globalProperties = new EvaluationParameters(this.zoom);
        const needGeometry = this.layers[0]._featureFilter.needGeometry;
        for (const {feature, id, index, sourceLayerIndex} of features) {
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(globalProperties, evaluationFeature, canonical)) continue;

            const sortKey = sortFeaturesByKey ?
                lineSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;

            const bucketFeature: BucketFeature = {
                id,
                properties: feature.properties,
                type: feature.type,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                patterns: {},
                dashes: {},
                sortKey,
                // Worker-computed cross-tile taper anchoring (see src/source/geojson_taper.ts)
                _taper: (feature as GeoJSONTaperFeature)._taper
            };

            bucketFeatures.push(bucketFeature);
        }

        if (sortFeaturesByKey) {
            bucketFeatures.sort((a, b) => {
                return (a.sortKey) - (b.sortKey);
            });
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;

            if (this.hasDependencies) {
                if (hasPattern('line', this.layers, options)) {
                    addPatternDependencies('line', this.layers, bucketFeature, {zoom: this.zoom}, options);
                } else if (this.hasLineDasharray(this.layers)) {
                    this.addLineDashDependencies(this.layers, bucketFeature, this.zoom, options);
                }

                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(bucketFeature);
            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, {}, {}, options.subdivisionGranularity);
            }

            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayerLike, imagePositions: {[_: string]: ImagePosition}, dashPositions: {[_: string]: DashEntry}): void {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
            imagePositions,
            dashPositions
        });
    }

    addFeatures({options, canonical, imagePositions, dashPositions}: BucketDependencyParameters): void {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, dashPositions, options.subdivisionGranularity);
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
            if (this.layoutVertexArray2.length !== 0) {
                this.layoutVertexBuffer2 = context.createVertexBuffer(this.layoutVertexArray2, layoutAttributesExt);
            }
            if (this.layoutTaperArray.length !== 0) {
                this.layoutTaperBuffer = context.createVertexBuffer(this.layoutTaperArray, taperAttributes);
            }
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
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
        if (this.layoutTaperBuffer) {
            this.layoutTaperBuffer.destroy();
        }
    }

    lineFeatureClips(feature: BucketFeature): LineClips | undefined {
        if (!!feature.properties && Object.hasOwn(feature.properties, GEOJSONVT_CLIP_START) && Object.hasOwn(feature.properties, GEOJSONVT_CLIP_END)) {
            const start = +feature.properties[GEOJSONVT_CLIP_START];
            const end = +feature.properties[GEOJSONVT_CLIP_END];
            return {start, end};
        }
    }

    addFeature(feature: BucketFeature, geometry: Point[][], index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}, dashPositions: Record<string, DashEntry>, subdivisionGranularity: SubdivisionGranularitySetting): void {
        const layout = this.layers[0].layout;
        // Worker-computed cross-tile taper anchoring (see src/source/geojson_taper.ts).
        this.taperAnnotation = feature._taper ?? null;
        this.taperWidthsValues = null;
        this.taperFactorsValues = null;
        const join = layout.get('line-join').evaluate(feature, {});
        const cap = layout.get('line-cap').evaluate(feature, {});
        const miterLimit = layout.get('line-miter-limit').evaluate(feature, {});
        const roundLimit = layout.get('line-round-limit').evaluate(feature, {});
        this.lineClips = this.lineFeatureClips(feature);

        // Per-vertex widths: evaluate the data-driven array for this feature. An empty
        // or missing array falls back to `line-width`. In factor mode the base
        // `line-width` also needs to be evaluated for the conservative query
        // pre-filter (`line-width` · max factor).
        if (this.factorsMode) {
            const factors = this.layers[0].paint.get('line-width-factors').evaluate(feature, {});
            this.lineFactors = Array.isArray(factors) && factors.length > 0 ? factors.map(Number) : null;
            this.taperFactorsValues = (this.taperAnnotation && Array.isArray(factors)) ?
                matchTaperProfile(this.taperAnnotation, factors) : null;
            this.currentLineWidth = this.layers[0].paint.get('line-width').evaluate(feature, {});
            if (this.lineFactors) {
                let maxFactor = 0;
                for (const f of this.lineFactors) {
                    if (f > maxFactor) maxFactor = f;
                }
                if (this.currentLineWidth * maxFactor > this.maxVertexWidth) {
                    this.maxVertexWidth = this.currentLineWidth * maxFactor;
                }
            } else if (this.currentLineWidth > this.maxVertexWidth) {
                this.maxVertexWidth = this.currentLineWidth;
            }
        } else if (this.widthsMode) {
            const widths = this.layers[0].paint.get('line-widths').evaluate(feature, {});
            this.lineWidths = Array.isArray(widths) && widths.length > 0 ? widths.map(Number) : null;
            this.taperWidthsValues = (this.taperAnnotation && Array.isArray(widths)) ?
                matchTaperProfile(this.taperAnnotation, widths) : null;
            this.currentLineWidth = this.layers[0].paint.get('line-width').evaluate(feature, {});
            if (this.lineWidths) {
                for (const w of this.lineWidths) {
                    if (w > this.maxVertexWidth) this.maxVertexWidth = w;
                }
            } else if (this.currentLineWidth > this.maxVertexWidth) {
                this.maxVertexWidth = this.currentLineWidth;
            }
        }

        for (let ringIndex = 0; ringIndex < geometry.length; ringIndex++) {
            this.addLine(geometry[ringIndex], feature, join, cap, miterLimit, roundLimit, canonical, subdivisionGranularity, ringIndex);
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {imagePositions, dashPositions, canonical});
    }

    addLine(vertices: Point[], feature: BucketFeature, join: string, cap: string, miterLimit: number, roundLimit: number, canonical: CanonicalTileID | undefined, subdivisionGranularity: SubdivisionGranularitySetting, ringIndex: number = 0): void {
        this.distance = 0;
        this.scaledDistance = 0;
        this.totalDistance = 0;
        this.taperDistance = 0;
        this.lineLength = 0;
        this.lineKnots = null;
        this.taperVertexKnots = null;
        this.taperWidthProfile = null;
        this.taperFactorProfile = null;

        // First, subdivide the line if needed (mostly for globe rendering)
        const granularity = canonical ? subdivisionGranularity.line.getGranularityForZoomLevel(canonical.z) : 1;
        const rawVertices = vertices;
        vertices = subdivideVertexLine(vertices, granularity);

        if (this.lineClips) {
            this.lineClipsArray.push(this.lineClips);
            // Calculate the total distance, in tile units, of this tiled line feature
            for (let i = 0; i < vertices.length - 1; i++) {
                this.totalDistance += vertices[i].dist(vertices[i + 1]);
            }
            this.updateScaledDistance();
            this.maxLineLength = Math.max(this.maxLineLength, this.totalDistance);
        }

        const isPolygon = VectorTileFeature.types[feature.type] === 'Polygon';

        // If the line has duplicate vertices at the ends, adjust start/length to remove them.
        let len = vertices.length;
        while (len >= 2 && vertices[len - 1].equals(vertices[len - 2])) {
            len--;
        }
        let first = 0;
        while (first < len - 1 && vertices[first].equals(vertices[first + 1])) {
            first++;
        }

        // Ignore invalid geometry.
        if (len - first < (isPolygon ? 3 : 2)) return;

        // Total length of the polyline about to be emitted. Used to normalize each
        // vertex's position along the line into a 0..1 taper factor. Only computed when
        // a layer actually uses tapered lines.
        if (this.taperEnabled) {
            let length = 0;
            for (let i = first; i < len - 1; i++) {
                length += vertices[i].dist(vertices[i + 1]);
            }
            this.lineLength = length;

            // Per-vertex widths/factors: record the normalized cumulative distance of
            // every vertex so a value given at a vertex is reproduced exactly there,
            // and anything in between (e.g. globe subdivision) interpolates along the
            // actual geometry. Falls back to evenly spaced stops if the array length
            // does not match the vertex count.
            if (this.factorsMode || this.widthsMode) {
                this.lineKnots = new Array(len - first);
                this.lineKnots[0] = 0;
                let cum = 0;
                for (let i = first, k = 1; i < len - 1; i++, k++) {
                    cum += vertices[i].dist(vertices[i + 1]);
                    this.lineKnots[k] = length > 0 ? cum / length : 0;
                }
            } else {
                this.lineKnots = null;
            }

            // Cross-tile anchoring: when the worker attached a taper annotation for
            // this feature, re-base the per-vertex knots onto the ORIGINAL line so
            // that both tiles sharing a boundary evaluate the same profile at the
            // same position (see src/source/geojson_taper.ts).
            const pieceKnots = this.taperAnnotation?.pieceKnots[ringIndex] ?? null;
            const expandedKnots = (pieceKnots?.length === rawVertices.length) ?
                expandTaperKnots(rawVertices, vertices, pieceKnots) : null;
            this.taperVertexKnots = expandedKnots;
            if (expandedKnots) {
                if (this.widthsMode && this.taperWidthsValues) {
                    const knots = this.taperWidthsValues.knotsPerRing[ringIndex];
                    if (knots?.length === this.taperWidthsValues.values.length) {
                        this.taperWidthProfile = {values: this.taperWidthsValues.values, knots};
                    }
                }
                if (this.factorsMode && this.taperFactorsValues) {
                    const knots = this.taperFactorsValues.knotsPerRing[ringIndex];
                    if (knots?.length === this.taperFactorsValues.values.length) {
                        this.taperFactorProfile = {values: this.taperFactorsValues.values, knots};
                    }
                }
            }
        }

        if (join === 'bevel') miterLimit = 1.05;

        const sharpCornerOffset = this.overscaling <= 16 ?
            SHARP_CORNER_OFFSET * EXTENT / (512 * this.overscaling) :
            0;

        // we could be more precise, but it would only save a negligible amount of space
        const segment = this.segments.prepareSegment(len * 10, this.layoutVertexArray, this.indexArray);

        let currentVertex: Point;
        let prevVertex: Point;
        let nextVertex: Point;
        let prevNormal: Point;
        let nextNormal: Point;

        // the last two vertices added
        this.e1 = this.e2 = -1;

        if (isPolygon) {
            currentVertex = vertices[len - 2];
            nextNormal = vertices[first].sub(currentVertex)._unit()._perp();
        }

        for (let i = first; i < len; i++) {

            nextVertex = i === len - 1 ?
                (isPolygon ? vertices[first + 1] : undefined) : // if it's a polygon, treat the last vertex like the first
                vertices[i + 1]; // just the next vertex

            // if two consecutive vertices exist, skip the current one
            if (nextVertex && vertices[i].equals(nextVertex)) continue;
            if (this.taperVertexKnots) this.currentTaperFactor = this.taperVertexKnots[i];

            if (nextNormal) prevNormal = nextNormal;
            if (currentVertex) prevVertex = currentVertex;

            currentVertex = vertices[i];

            // Calculate the normal towards the next vertex in this line. In case
            // there is no next vertex, pretend that the line is continuing straight,
            // meaning that we are just using the previous normal.
            nextNormal = nextVertex ? nextVertex.sub(currentVertex)._unit()._perp() : prevNormal;

            // If we still don't have a previous normal, this is the beginning of a
            // non-closed line, so we're doing a straight "join".
            prevNormal ||= nextNormal;

            // Determine the normal of the join extrusion. It is the angle bisector
            // of the segments between the previous line and the next line.
            // In the case of 180° angles, the prev and next normals cancel each other out:
            // prevNormal + nextNormal = (0, 0), its magnitude is 0, so the unit vector would be
            // undefined. In that case, we're keeping the joinNormal at (0, 0), so that the cosHalfAngle
            // below will also become 0 and miterLength will become Infinity.
            let joinNormal = prevNormal.add(nextNormal);
            if (joinNormal.x !== 0 || joinNormal.y !== 0) {
                joinNormal._unit();
            }
            /*  joinNormal     prevNormal
             *             ↖      ↑
             *                .________. prevVertex
             *                |
             * nextNormal  ←  |  currentVertex
             *                |
             *     nextVertex !
             *
             */

            // calculate cosines of the angle (and its half) using dot product
            const cosAngle = prevNormal.x * nextNormal.x + prevNormal.y * nextNormal.y;
            const cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;

            // Calculate the length of the miter (the ratio of the miter to the width)
            // as the inverse of cosine of the angle between next and join normals
            const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Infinity;

            // approximate angle from cosine
            const approxAngle = 2 * Math.sqrt(2 - 2 * cosHalfAngle);

            const isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;
            const lineTurnsLeft = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0;

            if (isSharpCorner && i > first) {
                const prevSegmentLength = currentVertex.dist(prevVertex);
                if (prevSegmentLength > 2 * sharpCornerOffset) {
                    const newPrevVertex = currentVertex.sub(currentVertex.sub(prevVertex)._mult(sharpCornerOffset / prevSegmentLength)._round());
                    this.updateDistance(prevVertex, newPrevVertex);
                    if (this.taperVertexKnots) {
                        // The inserted vertex sits between the previous and the current
                        // vertex: blend the anchor knot accordingly.
                        const k0 = this.taperVertexKnots[i - 1];
                        const k1 = this.taperVertexKnots[i];
                        const f = prevSegmentLength > 0 ? (prevSegmentLength - sharpCornerOffset) / prevSegmentLength : 1;
                        this.currentTaperFactor = k0 + (k1 - k0) * f;
                    }
                    this.addCurrentVertex(newPrevVertex, prevNormal, 0, 0, segment);
                    if (this.taperVertexKnots) this.currentTaperFactor = this.taperVertexKnots[i];
                    prevVertex = newPrevVertex;
                }
            }

            // The join if a middle vertex, otherwise the cap.
            const middleVertex = prevVertex && nextVertex;
            let currentJoin = middleVertex ? join : isPolygon ? 'butt' : cap;

            if (middleVertex && currentJoin === 'round') {
                if (miterLength < roundLimit) {
                    currentJoin = 'miter';
                } else if (miterLength <= 2) {
                    currentJoin = 'fakeround';
                }
            }

            if (currentJoin === 'miter' && miterLength > miterLimit) {
                currentJoin = 'bevel';
            }

            if (currentJoin === 'bevel') {
                // The maximum extrude length is 128 / 63 = 2 times the width of the line
                // so if miterLength >= 2 we need to draw a different type of bevel here.
                if (miterLength > 2) currentJoin = 'flipbevel';

                // If the miterLength is really small and the line bevel wouldn't be visible,
                // just draw a miter join to save a triangle.
                if (miterLength < miterLimit) currentJoin = 'miter';
            }

            // Calculate how far along the line the currentVertex is
            if (prevVertex) this.updateDistance(prevVertex, currentVertex);

            if (currentJoin === 'miter') {

                joinNormal._mult(miterLength);
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);

            } else if (currentJoin === 'flipbevel') {
                // miter is too big, flip the direction to make a beveled join

                if (miterLength > 100) {
                    // Almost parallel lines
                    joinNormal = nextNormal.mult(-1);

                } else {
                    const bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                    joinNormal._perp()._mult(bevelLength * (lineTurnsLeft ? -1 : 1));
                }
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment);
                this.addCurrentVertex(currentVertex, joinNormal.mult(-1), 0, 0, segment);

            } else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
                const offset = -Math.sqrt(miterLength * miterLength - 1);
                const offsetA = lineTurnsLeft ? offset : 0;
                const offsetB = lineTurnsLeft ? 0 : offset;

                // Close previous segment with a bevel
                if (prevVertex) {
                    this.addCurrentVertex(currentVertex, prevNormal, offsetA, offsetB, segment);
                }

                if (currentJoin === 'fakeround') {
                    // The join angle is sharp enough that a round join would be visible.
                    // Bevel joins fill the gap between segments with a single pie slice triangle.
                    // Create a round join by adding multiple pie slices. The join isn't actually round, but
                    // it looks like it is at the sizes we render lines at.

                    // pick the number of triangles for approximating round join by based on the angle between normals
                    const n = Math.round((approxAngle * 180 / Math.PI) / DEG_PER_TRIANGLE);

                    for (let m = 1; m < n; m++) {
                        let t = m / n;
                        if (t !== 0.5) {
                            // approximate spherical interpolation https://observablehq.com/@mourner/approximating-geometric-slerp
                            const t2 = t - 0.5;
                            const A = 1.0904 + cosAngle * (-3.2452 + cosAngle * (3.55645 - cosAngle * 1.43519));
                            const B = 0.848013 + cosAngle * (-1.06021 + cosAngle * 0.215638);
                            t = t + t * t2 * (t - 1) * (A * t2 * t2 + B);
                        }
                        const extrude = nextNormal.sub(prevNormal)._mult(t)._add(prevNormal)._unit()._mult(lineTurnsLeft ? -1 : 1);
                        this.addHalfVertex(currentVertex, extrude.x, extrude.y, false, lineTurnsLeft, 0, segment);
                    }
                }

                if (nextVertex) {
                    // Start next segment
                    this.addCurrentVertex(currentVertex, nextNormal, -offsetA, -offsetB, segment);
                }

            } else if (currentJoin === 'butt') {
                this.addCurrentVertex(currentVertex, joinNormal, 0, 0, segment); // butt cap

            } else if (currentJoin === 'square') {
                const offset = prevVertex ? 1 : -1; // closing or starting square cap
                this.addCurrentVertex(currentVertex, joinNormal, offset, offset, segment);

            } else if (currentJoin === 'round') {

                if (prevVertex) {
                    // Close previous segment with butt
                    this.addCurrentVertex(currentVertex, prevNormal, 0, 0, segment);

                    // Add round cap or linejoin at end of segment
                    this.addCurrentVertex(currentVertex, prevNormal, 1, 1, segment, true);
                }
                if (nextVertex) {
                    // Add round cap before first segment
                    this.addCurrentVertex(currentVertex, nextNormal, -1, -1, segment, true);

                    // Start next segment with a butt
                    this.addCurrentVertex(currentVertex, nextNormal, 0, 0, segment);
                }
            }

            if (isSharpCorner && i < len - 1) {
                const nextSegmentLength = currentVertex.dist(nextVertex);
                if (nextSegmentLength > 2 * sharpCornerOffset) {
                    const newCurrentVertex = currentVertex.add(nextVertex.sub(currentVertex)._mult(sharpCornerOffset / nextSegmentLength)._round());
                    this.updateDistance(currentVertex, newCurrentVertex);
                    if (this.taperVertexKnots) {
                        // The inserted vertex sits between the current and the next
                        // vertex: blend the anchor knot accordingly.
                        const k0 = this.taperVertexKnots[i];
                        const k1 = this.taperVertexKnots[i + 1];
                        const f = nextSegmentLength > 0 ? sharpCornerOffset / nextSegmentLength : 0;
                        this.currentTaperFactor = k0 + (k1 - k0) * f;
                    }
                    this.addCurrentVertex(newCurrentVertex, nextNormal, 0, 0, segment);
                    currentVertex = newCurrentVertex;
                }
            }
        }
    }

    /**
     * Add two vertices to the buffers.
     *
     * @param p - the line vertex to add buffer vertices for
     * @param normal - vertex normal
     * @param endLeft - extrude to shift the left vertex along the line
     * @param endRight - extrude to shift the left vertex along the line
     * @param segment - the segment object to add the vertex to
     * @param round - whether this is a round cap
     */
    addCurrentVertex(p: Point, normal: Point, endLeft: number, endRight: number, segment: Segment, round: boolean = false): void {
        // left and right extrude vectors, perpendicularly shifted by endLeft/endRight
        const leftX = normal.x + normal.y * endLeft;
        const leftY = normal.y - normal.x * endLeft;
        const rightX = -normal.x + normal.y * endRight;
        const rightY = -normal.y - normal.x * endRight;

        this.addHalfVertex(p, leftX, leftY, round, false, endLeft, segment);
        this.addHalfVertex(p, rightX, rightY, round, true, -endRight, segment);

        // There is a maximum "distance along the line" that we can store in the buffers.
        // When we get close to the distance, reset it to zero and add the vertex again with
        // a distance of zero. The max distance is determined by the number of bits we allocate
        // to `linesofar`.
        if (this.distance > MAX_LINE_DISTANCE / 2 && this.totalDistance === 0) {
            this.distance = 0;
            this.updateScaledDistance();
            this.addCurrentVertex(p, normal, endLeft, endRight, segment, round);
        }
    }

    addHalfVertex({x, y}: Point, extrudeX: number, extrudeY: number, round: boolean, up: boolean, dir: number, segment: Segment): void {
        const totalDistance = this.lineClips ? this.scaledDistance * (MAX_LINE_DISTANCE - 1) : this.scaledDistance;
        // scale down so that we can store longer distances while sacrificing precision.
        const linesofarScaled = totalDistance * LINE_DISTANCE_SCALE;

        // Per-vertex widths or taper factor: when a layer uses `line-widths`,
        // this vertex stores the absolute width at its position (interpolated along
        // the geometry between the given per-vertex widths). Otherwise it stores the
        // normalized position along the line so the shader can interpolate the width
        // between `line-width-start`/`line-width-end`. `taperDistance` is intentionally
        // used (not `distance`, which may wrap around for very long un-clipped lines)
        // so the factor stays monotonic 0..1.
        if (this.taperEnabled) {
            // With a worker taper annotation the knot is the vertex's normalized
            // position along the ORIGINAL line (identical in every tile sharing the
            // line); without one it is the piece-local position (legacy behavior).
            const factor = this.taperVertexKnots ? this.currentTaperFactor :
                (this.lineLength > 0 ? Math.min(this.taperDistance / this.lineLength, 1) : 0);
            let value;
            if (this.factorsMode) {
                const profile = this.taperFactorProfile;
                const factors = profile ? profile.values : this.lineFactors;
                const knots = profile ? profile.knots : this.lineKnots;
                // Neutral factor 1 for features without a factor value → exactly
                // `line-width` (e.g. plain tracks sharing the tapered line layer).
                value = (factors && factors.length > 0 && knots) ?
                    interpolateWidthProfile(factors, knots, factor) :
                    1;
            } else if (this.widthsMode) {
                const profile = this.taperWidthProfile;
                const widths = profile ? profile.values : this.lineWidths;
                const knots = profile ? profile.knots : this.lineKnots;
                value = (widths && widths.length > 0 && knots) ?
                    interpolateWidthProfile(widths, knots, factor) :
                    this.currentLineWidth;
            } else {
                value = factor;
            }
            this.layoutTaperArray.emplaceBack(value);
        }
        this.layoutVertexArray.emplaceBack(
            // a_pos_normal
            // Encode round/up the least significant bits
            (x << 1) + (round ? 1 : 0),
            (y << 1) + (up ? 1 : 0),
            // a_data
            // add 128 to store a byte in an unsigned byte
            Math.round(EXTRUDE_SCALE * extrudeX) + 128,
            Math.round(EXTRUDE_SCALE * extrudeY) + 128,
            // Encode the -1/0/1 direction value into the first two bits of .z of a_data.
            // Combine it with the lower 6 bits of `linesofarScaled` (shifted by 2 bits to make
            // room for the direction value). The upper 8 bits of `linesofarScaled` are placed in
            // the `w` component.
            ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1) | ((linesofarScaled & 0x3F) << 2),
            linesofarScaled >> 6);

        // Constructs a second vertex buffer with higher precision line progress
        if (this.lineClips) {
            const progressRealigned = this.scaledDistance - this.lineClips.start;
            const endClipRealigned = this.lineClips.end - this.lineClips.start;
            const uvX = progressRealigned / endClipRealigned;
            this.layoutVertexArray2.emplaceBack(uvX, this.lineClipsArray.length);
        }

        const e = segment.vertexLength++;
        if (this.e1 >= 0 && this.e2 >= 0) {
            this.indexArray.emplaceBack(this.e1, e, this.e2);
            segment.primitiveLength++;
        }
        if (up) {
            this.e2 = e;
        } else {
            this.e1 = e;
        }
    }

    updateScaledDistance(): void {
        // Knowing the ratio of the full linestring covered by this tiled feature, as well
        // as the total distance (in tile units) of this tiled feature, and the distance
        // (in tile units) of the current vertex, we can determine the relative distance
        // of this vertex along the full linestring feature and scale it to [0, 2^15)
        this.scaledDistance = this.lineClips ?
            this.lineClips.start + (this.lineClips.end - this.lineClips.start) * this.distance / this.totalDistance :
            this.distance;
    }

    updateDistance(prev: Point, next: Point): void {
        this.distance += prev.dist(next);
        this.taperDistance += prev.dist(next);
        this.updateScaledDistance();
    }

    private hasLineDasharray(layers: LineStyleLayer[]): boolean {
        for (const layer of layers) {
            const dasharrayProperty = layer.paint.get('line-dasharray');
            if (dasharrayProperty && !dasharrayProperty.isConstant()) {
                return true;
            }
        }
        return false;
    }

    private addLineDashDependencies(layers: LineStyleLayer[], bucketFeature: BucketFeature, zoom: number, options: PopulateParameters) {
        for (const layer of layers) {
            const dasharrayProperty = layer.paint.get('line-dasharray');

            if (!dasharrayProperty || dasharrayProperty.value.kind === 'constant') {
                continue;
            }

            const round = layer.layout.get('line-cap').evaluate(bucketFeature, {}) === 'round';

            const min = {
                dasharray: dasharrayProperty.value.evaluate({zoom: zoom - 1}, bucketFeature, {}),
                round
            };
            const mid = {
                dasharray: dasharrayProperty.value.evaluate({zoom}, bucketFeature, {}),
                round
            };
            const max = {
                dasharray: dasharrayProperty.value.evaluate({zoom: zoom + 1}, bucketFeature, {}),
                round
            };

            const minKey = `${min.dasharray.join(',')},${min.round}`;
            const midKey = `${mid.dasharray.join(',')},${mid.round}`;
            const maxKey = `${max.dasharray.join(',')},${max.round}`;

            options.dashDependencies[minKey] = min;
            options.dashDependencies[midKey] = mid;
            options.dashDependencies[maxKey] = max;

            bucketFeature.dashes[layer.id] = {min: minKey, mid: midKey, max: maxKey};
        }
    }
}

register('LineBucket', LineBucket, {omit: ['layers', 'patternFeatures']});
