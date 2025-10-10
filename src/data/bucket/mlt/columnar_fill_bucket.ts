import {FillLayoutArray} from '../../array_types.g';

import {members as layoutAttributes} from '../fill_attributes';
import {SegmentVector} from '../../segment';
import {ProgramConfigurationSet} from '../../program_configuration';
import {LineIndexArray, TriangleIndexArray} from '../../index_array_type';
import {register} from '../../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from '../pattern_bucket_features';

import type {CanonicalTileID} from '../../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../../bucket';
import type {FillStyleLayer} from '../../../style/style_layer/fill_style_layer';
import type {Context} from '../../../gl/context';
import type {IndexBuffer} from '../../../gl/index_buffer';
import type {VertexBuffer} from '../../../gl/vertex_buffer';
import type {FeatureStates} from '../../../source/source_state';
import type {ImagePosition} from '../../../render/image_atlas';
import {FeatureTable, filter, GeometryVector, GpuVector, SelectionVector} from "@maplibre/mlt";
import {VectorTileLayer} from "@mapbox/vector-tile";
import earcut from "earcut";
import {Feature} from "@maplibre/maplibre-gl-style-spec";
import { DashEntry } from "src/render/line_atlas";


export class ColumnarFillBucket implements Bucket {
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

    hasDependencies: boolean;
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
        this.patternFeatures = [];

        this.layoutVertexArray = new FillLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.indexArray2 = new LineIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.segments2 = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: Record<string, ImagePosition>, dashPositions?: Record<string, DashEntry>): void {
        throw new Error("Method not implemented.");
    }

    populate(features: IndexedFeature[], options: PopulateParameters, canonical: CanonicalTileID): void {
        throw new Error("Method not implemented.");
    }

    populateColumnar(featureTable: FeatureTable, options: PopulateParameters, canonical: CanonicalTileID) {
        this.populatePolygon(featureTable, options, canonical);

    }

    populatePolygon(featureTable: FeatureTable, options: PopulateParameters, canonical: CanonicalTileID) {
        this.hasDependencies = hasPattern('fill', this.layers, options);
        const fillSortKey = this.layers[0].layout.get('fill-sort-key');
        const sortFeaturesByKey = !fillSortKey.isConstant();
        if (sortFeaturesByKey) {
            throw new Error("Sorting features is not yet supported.");
        }

        const filterSpecification = this.layers[0].filter as any;

        //this.layers[0].minzoom


        let geometryVector = featureTable.geometryVector;

        if (geometryVector instanceof GpuVector) {
            const gpuVector = featureTable.geometryVector as GpuVector;
            if (!filterSpecification) {
                //TODO: refactor duplicate code
                this.addPolygonsWithoutSelectionVector(gpuVector, featureTable.extent, 0, canonical, {});
                //this.addPolygonsWithoutSelectionVectorFast(gpuVector, featureTable.extent, 0, canonical, {});
                if (!gpuVector.topologyVector) {
                    return;
                }

                if (gpuVector.topologyVector.geometryOffsets && gpuVector.topologyVector.partOffsets
                    && gpuVector.topologyVector.ringOffsets) {
                    this.addMultiPolygonOutlinesWithoutSelectionVector(featureTable, gpuVector.numGeometries, canonical);
                    //this.addMultiPolygonOutlinesWithoutSelectionVectorFast(featureTable, gpuVector.numGeometries, canonical);
                    return;
                }

                if (gpuVector.topologyVector.partOffsets && gpuVector.topologyVector.ringOffsets) {
                    this.addPolygonOutlinesWithoutSelectionVector(featureTable, gpuVector.numGeometries, canonical);
                    return;
                }

                throw new Error("Polygon outlines are only supported for Polygon and MultiPolygon geometries.");
            }

            const selectionVector = filter(featureTable, filterSpecification);
            if(selectionVector.limit === 0){
                return;
            }

            //TODO: return if selectionVector limit is zero
            this.addPolygons(selectionVector, gpuVector, featureTable.extent, 0, canonical, {});
            if (!gpuVector.topologyVector) {
                return;
            }

            if (gpuVector.topologyVector.geometryOffsets && gpuVector.topologyVector.partOffsets
                && gpuVector.topologyVector.ringOffsets) {
                this.addMultiPolygonOutlinesWithSelectionVector(featureTable, selectionVector, canonical);
                return;
            }

            if (gpuVector.topologyVector.partOffsets && gpuVector.topologyVector.ringOffsets) {
                this.addPolygonOutlinesWithSelectionVector(featureTable, selectionVector, canonical);
                return;
            }

            throw new Error("Polygon outlines are only supported for Polygon and MultiPolygon geometries.");

        } else {
            geometryVector = geometryVector as GeometryVector;

            if (!filterSpecification) {
                this.addGeometryPolygonsWithoutSelectionVector(geometryVector, featureTable.extent, 0, canonical, {});

                if (!geometryVector.topologyVector) {
                    return;
                }

                if (geometryVector.topologyVector.geometryOffsets && geometryVector.topologyVector.partOffsets
                    && geometryVector.topologyVector.ringOffsets) {
                    this.addMultiPolygonOutlinesWithoutSelectionVector(featureTable, geometryVector.numGeometries, canonical);
                    return;
                }

                if (geometryVector.topologyVector.partOffsets && geometryVector.topologyVector.ringOffsets) {
                    this.addPolygonOutlinesWithoutSelectionVector(featureTable, geometryVector.numGeometries, canonical);
                    return;
                }
                throw new Error("Polygon outlines are only supported for Polygon and MultiPolygon geometries.");

            }

            const selectionVector = filter(featureTable, filterSpecification);

            if(selectionVector.limit === 0){
                return;
            }

            this.addGeometryPolygons(selectionVector, geometryVector, featureTable.extent, 0, canonical, {});
            if (!geometryVector.topologyVector) {
                return;
            }

            if (geometryVector.topologyVector.geometryOffsets && geometryVector.topologyVector.partOffsets
                && geometryVector.topologyVector.ringOffsets) {
                this.addMultiPolygonOutlinesWithSelectionVector(featureTable, selectionVector, canonical);
                return;
            }

            if (geometryVector.topologyVector.partOffsets && geometryVector.topologyVector.ringOffsets) {
                this.addPolygonOutlinesWithSelectionVector(featureTable, selectionVector, canonical);
                return;
            }

            throw new Error("Polygon outlines are only supported for Polygon and MultiPolygon geometries.");

        }
    }

    updateColumnar(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {imagePositions});
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

    addGeometryPolygons(
        selectionVector: SelectionVector,
        geometryVector: GeometryVector,
        extent: number,
        index: number,
        canonical: CanonicalTileID,
        imagePositions: { [_: string]: ImagePosition; }
    ) {
        const topologyVector = geometryVector.topologyVector;
        const geometryOffsets = topologyVector.geometryOffsets;
        const partOffsets = topologyVector.partOffsets;
        const ringOffsets = topologyVector.ringOffsets;
        let vertexBufferOffset = 0;

        if (!geometryOffsets) {
            for (let i = 0; i < selectionVector.limit; i++) {
                const featureOffset = selectionVector.getIndex(i);
                const secondFeatureOffset = featureOffset + 1;
                vertexBufferOffset = this.updateVertexBuffer(featureOffset, secondFeatureOffset, partOffsets, ringOffsets, geometryVector, vertexBufferOffset);
            }
        } else {
            for (let i = 0; i < selectionVector.limit; i++) {
                const featureOffset = selectionVector.getIndex(i)
                vertexBufferOffset = this.updateVertexBuffer(geometryOffsets[featureOffset], geometryOffsets[featureOffset + 1], partOffsets, ringOffsets, geometryVector, vertexBufferOffset);
            }
        }
        // Erstelle ein gültiges Feature-Objekt anstatt null
        const feature : Feature = {
            type: "Polygon",
            id: index,
            properties: {},
            geometry: []  // Hier ggf. mit tatsächlichen Ringen füllen
        };

        // Konvertiere imagePositions zu PaintOptions Format
        const paintOptions = {
            imagePositions,
            canonical
        };

        this.programConfigurations.populatePaintArrays(
            this.layoutVertexArray.length,
            feature,
            index,
            paintOptions
        );
    }

    addPolygons(selectionVector: SelectionVector, gpuVector: GpuVector, extent: number, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        const triangleOffsets = gpuVector.triangleOffsets;
        const indexBuffer = gpuVector.indexBuffer;
        const vertexBuffer = gpuVector.vertexBuffer;
        let vertexBufferOffset = 0;

        for (let i = 0; i < selectionVector.limit; i++) {
            //Iterate over all triangles in the Polygon or MultiPolygon
            const featureOffset = selectionVector.getIndex(i);
            const firstTriangleOffset = triangleOffsets[featureOffset];
            const numTriangles = triangleOffsets[featureOffset + 1] - firstTriangleOffset;
            const numIndices = numTriangles * 3;
            const startIndexOffset = firstTriangleOffset * 3;
            const endIndexOffset = startIndexOffset + numIndices;
            const featureIndexBuffer = indexBuffer.subarray(startIndexOffset, endIndexOffset);

            //TODO: improve performance -> get rid of linear complexity
            const numVertices = Math.max(...featureIndexBuffer) + 1;
            const triangleSegment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            for (let j = 0; j < featureIndexBuffer.length; j += 3) {
                //TODO: resize based on number of vertices
                this.indexArray.emplaceBack(
                    vertexBufferOffset + featureIndexBuffer[j],
                    vertexBufferOffset + featureIndexBuffer[j + 1],
                    vertexBufferOffset + featureIndexBuffer[j + 2]);
            }

            const startFeatureVertexBuffer = vertexBufferOffset * 2;
            const endFeatureVertexBuffer = startFeatureVertexBuffer + numVertices * 2 - 1;
            for (let j = startFeatureVertexBuffer; j <= endFeatureVertexBuffer; j += 2) {
                this.layoutVertexArray.emplaceBack(vertexBuffer[j], vertexBuffer[j + 1]);
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += numTriangles;
            vertexBufferOffset = triangleSegment.vertexLength;
        }
        // Erstelle ein gültiges Feature-Objekt anstatt null
        const feature : Feature = {
            type: "Polygon",
            id: index,
            properties: {},
            geometry: []  // Hier ggf. mit tatsächlichen Ringen füllen
        };

        // Konvertiere imagePositions zu PaintOptions Format
        const paintOptions = {
            imagePositions,
            canonical
        };

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
    }

    addGeometryPolygonsWithoutSelectionVector(geometryVector: GeometryVector, extent: number, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        const topologyVector = geometryVector.topologyVector;
        const geometryOffsets = topologyVector.geometryOffsets;
        const partOffsets = topologyVector.partOffsets;
        const ringOffsets = topologyVector.ringOffsets;
        const numGeometries = geometryVector.numGeometries;
        let vertexBufferOffset = 0;

        if (!geometryOffsets) {
            for (let i = 0; i < numGeometries; i++) {
                vertexBufferOffset = this.updateVertexBuffer(i, i + 1, partOffsets, ringOffsets, geometryVector, vertexBufferOffset);
            }
        }
        else {
            for (let i = 0; i < numGeometries; i++) {
                const firstGeometryOffset = topologyVector.geometryOffsets[i];
                const secondGeometryOffset = topologyVector.geometryOffsets[i + 1];
                vertexBufferOffset = this.updateVertexBuffer(firstGeometryOffset, secondGeometryOffset, partOffsets, ringOffsets, geometryVector, vertexBufferOffset);
            }
        }
        // Erstelle ein gültiges Feature-Objekt anstatt null
        const feature : Feature = {
            type: "Polygon",
            id: index,
            properties: {},
            geometry: []  // Hier ggf. mit tatsächlichen Ringen füllen
        };

        // Konvertiere imagePositions zu PaintOptions Format
        const paintOptions = {
            imagePositions,
            canonical
        };

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
    }

    updateVertexBuffer(firstGeometryOffset: number, secondGeometryOffset: number, partOffsets: Int32Array, ringOffsets: Int32Array, geometryVector: GeometryVector, vertexBufferOffset: number): number {
        for (let polygonIndex = firstGeometryOffset; polygonIndex < secondGeometryOffset; polygonIndex++) {

            const firstPartOffset = partOffsets[polygonIndex];
            const secondPartOffset = partOffsets[polygonIndex + 1];

            const numParts = secondPartOffset - firstPartOffset;

            const numVertices = ringOffsets[secondPartOffset] - ringOffsets[firstPartOffset];

            const triangleSegment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            const triangleIndex = triangleSegment.vertexLength;

            const vertices = []
            const holeIndices = [];

            for (let part = firstPartOffset; part < secondPartOffset; part++) {
                const firstRingOffset = ringOffsets[part]
                const secondRingOffset = ringOffsets[part + 1];

                if (part > firstPartOffset) {
                    holeIndices.push(vertices.length / 2);
                }

                for (let vertexIndex = firstRingOffset; vertexIndex < secondRingOffset; vertexIndex++) {
                    const vertex = geometryVector.getVertex(vertexIndex);
                    vertices.push(vertex[0])
                    vertices.push(vertex[1]);
                    this.layoutVertexArray.emplaceBack(vertex[0], vertex[1])
                }

            }

            const indices = earcut(vertices, holeIndices);

            for (let i = 0; i < indices.length; i += 3) {
                this.indexArray.emplaceBack(vertexBufferOffset + indices[i],
                    vertexBufferOffset + indices[i + 1],
                    vertexBufferOffset + indices[i + 2])
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += indices.length / 3;
            vertexBufferOffset = triangleSegment.vertexLength;
        }
        return vertexBufferOffset;
    }

    addPolygonsWithoutSelectionVector(gpuVector: GpuVector, extent: number, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        const triangleOffsets = gpuVector.triangleOffsets;
        const indexBuffer = gpuVector.indexBuffer;
        const vertexBuffer = gpuVector.vertexBuffer;

        let vertexBufferOffset = 0;
        for (let featureOffset = 0; featureOffset < gpuVector.numGeometries; featureOffset++) {
            //Iterate over all triangles in the Polygon or MultiPolygon
            const firstTriangleOffset = triangleOffsets[featureOffset];
            const numTriangles = triangleOffsets[featureOffset + 1] - firstTriangleOffset;
            const numIndices = numTriangles * 3;
            const startIndexOffset = firstTriangleOffset * 3;
            const endIndexOffset = startIndexOffset + numIndices;
            const featureIndexBuffer = indexBuffer.subarray(startIndexOffset, endIndexOffset);

            //TODO: improve performance -> get rid of linear complexity
            const numVertices = Math.max(...featureIndexBuffer) + 1;
            const triangleSegment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            for (let j = 0; j < featureIndexBuffer.length; j += 3) {
                //TODO: resize based on number of vertices
                this.indexArray.emplaceBack(
                    vertexBufferOffset + featureIndexBuffer[j],
                    vertexBufferOffset + featureIndexBuffer[j + 1],
                    vertexBufferOffset + featureIndexBuffer[j + 2]);
            }

            const startFeatureVertexBuffer = vertexBufferOffset * 2;
            const endFeatureVertexBuffer = startFeatureVertexBuffer + numVertices * 2 - 1;
            for (let j = startFeatureVertexBuffer; j <= endFeatureVertexBuffer; j += 2) {
                this.layoutVertexArray.emplaceBack(vertexBuffer[j], vertexBuffer[j + 1]);
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += numTriangles;
            vertexBufferOffset = triangleSegment.vertexLength;
        }
        // Erstelle ein gültiges Feature-Objekt anstatt null
        const feature : Feature = {
            type: "Polygon",
            id: index,
            properties: {},
            geometry: []  // Hier ggf. mit tatsächlichen Ringen füllen
        };

        // Konvertiere imagePositions zu PaintOptions Format
        const paintOptions = {
            imagePositions,
            canonical
        };

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
    }

    addPolygonsWithoutSelectionVectorFast(gpuVector: GpuVector, extent: number, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        const indexBuffer = gpuVector.indexBuffer;
        const triangleOffsets = gpuVector.triangleOffsets;
        const vertexBuffer = gpuVector.vertexBuffer;
        //const transformedIndexBuffer = new Uint32Array(indexBuffer.length);
        const transformedIndexBuffer = new Uint16Array(indexBuffer.length);
        const transformedVertexBuffer = new Int16Array(vertexBuffer.length);
        //TODO: directly encode in the right representation
        //TODO: fix -> each feature starts with index 0
        for (let i = 0; i < indexBuffer.length; i++) {
            transformedIndexBuffer[i] = indexBuffer[i];
        }
        for (let i = 0; i < vertexBuffer.length; i++) {
            transformedVertexBuffer[i] = vertexBuffer[i];
        }

       /* let vertexBufferOffset = 0;
        const triangleSegment = this.segments.prepareSegment(0, this.layoutVertexArray, this.indexArray);
        for (let featureOffset = 0; featureOffset < gpuVector.numGeometries; featureOffset++) {
            //Iterate over all triangles in the Polygon or MultiPolygon
            const firstTriangleOffset = triangleOffsets[featureOffset];
            const numTriangles = triangleOffsets[featureOffset + 1] - firstTriangleOffset;
            const numIndices = numTriangles * 3;
            const startIndexOffset = firstTriangleOffset * 3;
            const endIndexOffset = startIndexOffset + numIndices;
            const featureIndexBuffer = indexBuffer.subarray(startIndexOffset, endIndexOffset);

            //TODO: improve performance -> get rid of linear complexity
            const numVertices = Math.max(...featureIndexBuffer) + 1;
            for (let j = 0; j < featureIndexBuffer.length; j += 3) {
                //TODO: resize based on number of vertices
                this.indexArray.emplaceBack(
                    vertexBufferOffset + featureIndexBuffer[j],
                    vertexBufferOffset + featureIndexBuffer[j + 1],
                    vertexBufferOffset + featureIndexBuffer[j + 2]);
            }
            vertexBufferOffset += numVertices;
        }
        for (let i = 0; i < vertexBuffer.length; i+=2) {
            this.layoutVertexArray.emplaceBack(vertexBuffer[i], vertexBuffer[i+1]);
        }
        triangleSegment.vertexLength += vertexBuffer.length / 2;
        triangleSegment.primitiveLength += indexBuffer.length / 3;*/

        /*const triangleSegment = this.segments.prepareSegment(vertexBuffer.length, this.layoutVertexArray,
                    this.indexArray);
        let lastFeatureMaxIndexOffset = 0;
        let indexCounter = 0;
        for(let i = 1; i < triangleOffsets.length; i++){
            let numIndices = (triangleOffsets[i] - triangleOffsets[i-1]) * 3;
            let maxIndexValue = 0;
            for(let j = 0; j < numIndices; j+=3){
                const index1 = indexBuffer[indexCounter++] + lastFeatureMaxIndexOffset;
                const index2 = indexBuffer[indexCounter++] + lastFeatureMaxIndexOffset;
                const index3 = indexBuffer[indexCounter++] + lastFeatureMaxIndexOffset;
                this.indexArray.emplaceBack(index1, index2, index3);

                maxIndexValue = Math.max(maxIndexValue, index1, index2, index3);
            }

            lastFeatureMaxIndexOffset += maxIndexValue + 1;
        }
        for (let i = 0; i < vertexBuffer.length; i+=2) {
            this.layoutVertexArray.emplaceBack(vertexBuffer[i], vertexBuffer[i+1]);
        }
        triangleSegment.vertexLength += vertexBuffer.length / 2;
        triangleSegment.primitiveLength += indexBuffer.length / 3;*/

        this.indexArray.uint16 = transformedIndexBuffer as any;
        this.indexArray.uint8 = new Uint8Array(transformedIndexBuffer.buffer);
        this.indexArray.arrayBuffer = transformedIndexBuffer.buffer;
        this.indexArray.length = transformedIndexBuffer.length;
        this.indexArray.isTransferred = false;

        this.layoutVertexArray.int16 = transformedVertexBuffer;
        this.layoutVertexArray.uint8 = new Uint8Array(transformedVertexBuffer.buffer);
        this.layoutVertexArray.arrayBuffer = transformedVertexBuffer.buffer;
        this.layoutVertexArray.length = transformedVertexBuffer.length;
        this.layoutVertexArray.isTransferred = false;

        const segment = ({
            vertexOffset: 0,
            primitiveOffset: 0,
            vertexLength: this.layoutVertexArray.length,
            primitiveLength: this.indexArray.length,
            sortKey: undefined,
            //TODO: add proper implementation
            //indexType: 1
        } as any);
        this.segments.segments.push(segment);


        /*let vertexBufferOffset = 0;
        let indexCounter = 0;
        for (let featureOffset = 0; featureOffset < gpuVector.numGeometries; featureOffset++) {
            //Iterate over all triangles in the Polygon or MultiPolygon
            const firstTriangleOffset = triangleOffsets[featureOffset];
            const numTriangles = triangleOffsets[featureOffset + 1] - firstTriangleOffset;
            const numIndices = numTriangles * 3;
            const startIndexOffset = firstTriangleOffset * 3;
            const endIndexOffset = startIndexOffset + numIndices;
            const featureIndexBuffer = indexBuffer.subarray(startIndexOffset, endIndexOffset);

            //TODO: improve performance -> get rid of linear complexity
            const numVertices = Math.max(...featureIndexBuffer) + 1;
            for (let j = 0; j < featureIndexBuffer.length; j += 3) {
                transformedIndexBuffer[indexCounter++] = vertexBufferOffset + featureIndexBuffer[j];
                transformedIndexBuffer[indexCounter++] = vertexBufferOffset + featureIndexBuffer[j + 1];
                transformedIndexBuffer[indexCounter++] = vertexBufferOffset + featureIndexBuffer[j + 2];
            }
            vertexBufferOffset += numVertices;
        }
        for (let i = 0; i < vertexBuffer.length; i++) {
            transformedVertexBuffer[i] = vertexBuffer[i];
        }
        this.indexArray.uint16 = transformedIndexBuffer as any;
        this.indexArray.uint8 = new Uint8Array(transformedIndexBuffer.buffer);
        this.indexArray.arrayBuffer = transformedIndexBuffer.buffer;
        this.indexArray.length = transformedIndexBuffer.length;
        this.indexArray.isTransferred = false;

        this.layoutVertexArray.int16 = transformedVertexBuffer;
        this.layoutVertexArray.uint8 = new Uint8Array(transformedVertexBuffer.buffer);
        this.layoutVertexArray.arrayBuffer = transformedVertexBuffer.buffer;
        this.layoutVertexArray.length = transformedVertexBuffer.length;
        this.layoutVertexArray.isTransferred = false;
        const segment = ({
            vertexOffset: 0,
            primitiveOffset: 0,
            vertexLength: this.layoutVertexArray.length,
            primitiveLength: this.indexArray.length,
            sortKey: undefined,
            //TODO: add proper implementation
            //indexType: 1
        } as any);
        this.segments.segments.push(segment);
*/

        // Erstelle ein gültiges Feature-Objekt anstatt null
        const feature : Feature = {
            type: "Polygon",
            id: index,
            properties: {},
            geometry: []  // Hier ggf. mit tatsächlichen Ringen füllen
        };

        // Konvertiere imagePositions zu PaintOptions Format
        const paintOptions = {
            imagePositions,
            canonical
        };

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
    }

    addPolygonOutlinesWithoutSelectionVector(featureTable: FeatureTable, numGeometries: number,
                                             canonical: CanonicalTileID) {
        const geometryVector = featureTable.geometryVector as GeometryVector;
        const topologyVector = geometryVector.topologyVector;
        const ringOffsets = topologyVector.ringOffsets;
        const partOffsets = topologyVector.partOffsets;
        for (let featureOffset = 0; featureOffset < numGeometries; featureOffset++) {
            let ringOffset = partOffsets[featureOffset];
            const numRings = partOffsets[featureOffset + 1] - ringOffset;
            for (let j = 0; j < numRings; j++) {
                let ringOffsetStart = ringOffsets[ringOffset++];
                let ringOffsetEnd = ringOffsets[ringOffset];
                const numVertices = ringOffsetEnd - ringOffsetStart;

                //TODO: fix
                const arr = new FillLayoutArray();
                const lineSegment = this.segments2.prepareSegment(numVertices, arr, this.indexArray2);
                const lineIndex = lineSegment.vertexLength;

                this.indexArray2.emplaceBack(lineIndex + numVertices - 1, lineIndex);
                for (let k = 1; k < numVertices; k++) {
                    this.indexArray2.emplaceBack(lineIndex + k - 1, lineIndex + k);
                }

                lineSegment.vertexLength += numVertices;
                lineSegment.primitiveLength += numVertices;
            }

            const id = featureTable.idVector.getValue(featureOffset) as any;
            //Test style only has constant paint properties -> no feature needed for evaluation
            const feature = {id} as any;

            // Konvertiere imagePositions zu PaintOptions Format
            const paintOptions = {
                imagePositions: null,
                canonical
            };

            this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, id, paintOptions);
        }
    }

    addMultiPolygonOutlinesWithoutSelectionVector(featureTable: FeatureTable, numGeometries,
                                                  canonical: CanonicalTileID) {
        const geometryVector = featureTable.geometryVector as GeometryVector;
        const topologyVector = geometryVector.topologyVector;
        const geometryOffsets = topologyVector.geometryOffsets;
        const ringOffsets = topologyVector.ringOffsets;
        const partOffsets = topologyVector.partOffsets;
        for (let featureOffset = 0; featureOffset < numGeometries; featureOffset++) {
            let partOffset = geometryOffsets[featureOffset];
            const numGeometries = geometryOffsets[featureOffset + 1] - partOffset;
            for (let l = 0; l < numGeometries; l++) {
                let ringOffset = partOffsets[partOffset++];
                const numRings = partOffsets[partOffset] - ringOffset;
                for (let j = 0; j < numRings; j++) {
                    let ringOffsetStart = ringOffsets[ringOffset++];
                    let ringOffsetEnd = ringOffsets[ringOffset];
                    const numVertices = ringOffsetEnd - ringOffsetStart;

                    //TODO: fix
                    const arr = new FillLayoutArray();
                    const lineSegment = this.segments2.prepareSegment(numVertices, arr, this.indexArray2);
                    const lineIndex = lineSegment.vertexLength;

                    this.indexArray2.emplaceBack(lineIndex + numVertices - 1, lineIndex);
                    for (let k = 1; k < numVertices; k++) {
                        this.indexArray2.emplaceBack(lineIndex + k - 1, lineIndex + k);
                    }

                    lineSegment.vertexLength += numVertices;
                    lineSegment.primitiveLength += numVertices;
                }
            }

            const id = featureTable.idVector.getValue(featureOffset) as any;
            //Test style only has constant paint properties -> no feature needed for evaluation
            const feature = {id} as any;
            // Konvertiere imagePositions zu PaintOptions Format
            const paintOptions = {
                imagePositions: null,
                canonical
            };

            this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, id, paintOptions);
        }
    }

    addMultiPolygonOutlinesWithoutSelectionVectorFast(featureTable: FeatureTable, numGeometries,
                                                      canonical: CanonicalTileID) {

        const topologyVector = featureTable.geometryVector.topologyVector;
        const ringOffsets = topologyVector.ringOffsets;
        const numTotalRings = ringOffsets.length;
        //const indexBuffer = new Uint32Array(ringOffsets[ringOffsets.length - 1] +
        //    topologyVector.partOffsets.length);
        const indexBuffer = new Uint16Array(ringOffsets[ringOffsets.length - 1] +
            topologyVector.partOffsets.length);
        let indexBufferCounter = 0;
        let index = 0;
        for (let i = 1; i < numTotalRings; i++) {
            let ringOffsetStart = ringOffsets[i -1];
            let ringOffsetEnd = ringOffsets[i];
            const numVertices = ringOffsetEnd - ringOffsetStart;

            indexBuffer[indexBufferCounter++] = index + numVertices - 1;
            indexBuffer[indexBufferCounter++] = index;
            for (let j = 1; j < numVertices; j++) {
                indexBuffer[indexBufferCounter++] = index++;
                indexBuffer[indexBufferCounter++] = index;
            }
            index++;
        }

        this.indexArray.uint16 = indexBuffer as any;
        this.indexArray.uint8 = new Uint8Array(indexBuffer.buffer);
        this.indexArray.arrayBuffer = indexBuffer.buffer;
        this.indexArray.length = indexBuffer.length;
        this.indexArray.isTransferred = false;

        const segment = ({
            vertexOffset: 0,
            primitiveOffset: 0,
            vertexLength: this.layoutVertexArray.length,
            primitiveLength: this.indexArray2.length,
            //indexType: 1
        } as any);
        this.segments2.segments.push(segment);

        // Erstelle ein gültiges Feature-Objekt anstatt null
        const feature : Feature = {
            type: "Polygon",
            id: index,
            properties: {},
            geometry: []  // Hier ggf. mit tatsächlichen Ringen füllen
        };

        // Konvertiere imagePositions zu PaintOptions Format
        const paintOptions = {
            imagePositions: null,
            canonical
        };

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
    }

    addPolygonOutlinesWithSelectionVector(featureTable: FeatureTable, selectionVector: SelectionVector,
                                          canonical: CanonicalTileID){
        const geometryVector = featureTable.geometryVector as GeometryVector;
        const topologyVector = geometryVector.topologyVector;
        const ringOffsets = topologyVector.ringOffsets;
        const partOffsets = topologyVector.partOffsets;
        for(let i = 0; i < selectionVector.limit; i++){
            const index = selectionVector.getIndex(i);
            let ringOffset = partOffsets[index];
            const numRings = partOffsets[index+1] - ringOffset;
            for(let j = 0; j < numRings; j++){
                let ringOffsetStart = ringOffsets[ringOffset++];
                let ringOffsetEnd = ringOffsets[ringOffset];
                const numVertices = ringOffsetEnd - ringOffsetStart;

                //TODO: fix
                const arr = new FillLayoutArray();
                const lineSegment = this.segments2.prepareSegment(numVertices, arr, this.indexArray2);
                const lineIndex = lineSegment.vertexLength;

                this.indexArray2.emplaceBack(lineIndex + numVertices-1, lineIndex);
                for(let k = 1; k < numVertices; k++){
                    this.indexArray2.emplaceBack(lineIndex + k - 1, lineIndex + k);
                }

                lineSegment.vertexLength += numVertices;
                lineSegment.primitiveLength += numVertices;
            }

            const id = featureTable.idVector.getValue(i) as any;
            //Test style only has constant paint properties -> no feature needed for evaluation
            const feature = {id} as any;
            // Konvertiere imagePositions zu PaintOptions Format
            const paintOptions = {
                imagePositions: null,
                canonical
            };

            this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
        }
    }

    addMultiPolygonOutlinesWithSelectionVector(featureTable: FeatureTable, selectionVector: SelectionVector,
                                               canonical: CanonicalTileID){
        const geometryVector = featureTable.geometryVector as GeometryVector;
        const topologyVector = geometryVector.topologyVector;
        const geometryOffsets = topologyVector.geometryOffsets;
        const ringOffsets = topologyVector.ringOffsets;
        const partOffsets = topologyVector.partOffsets;
        for(let i = 0; i < selectionVector.limit; i++){
            const index = selectionVector.getIndex(i);
            let partOffset = geometryOffsets[index];
            const numGeometries = geometryOffsets[index+1] - partOffset;
            for(let l = 0; l < numGeometries; l++){
                let ringOffset = partOffsets[partOffset++];
                const numRings = partOffsets[partOffset] - ringOffset;
                for(let j = 0; j < numRings; j++){
                    let ringOffsetStart = ringOffsets[ringOffset++];
                    let ringOffsetEnd = ringOffsets[ringOffset];
                    const numVertices = ringOffsetEnd - ringOffsetStart;

                    //TODO: fix
                    const arr = new FillLayoutArray();
                    const lineSegment = this.segments2.prepareSegment(numVertices, arr, this.indexArray2);
                    const lineIndex = lineSegment.vertexLength;

                    this.indexArray2.emplaceBack(lineIndex + numVertices-1, lineIndex);
                    for(let k = 1; k < numVertices; k++){
                        this.indexArray2.emplaceBack(lineIndex + k - 1, lineIndex + k);
                    }

                    lineSegment.vertexLength += numVertices;
                    lineSegment.primitiveLength += numVertices;
                }
            }

            const id = featureTable.idVector.getValue(i) as any;
            //Test style only has constant paint properties -> no feature needed for evaluation
            const feature = {id} as any;

            // Konvertiere imagePositions zu PaintOptions Format
            const paintOptions = {
                imagePositions: null,
                canonical
            };

            this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, paintOptions);
        }
    }


    /*addPolygonsWithoutSelectionVectorAndSegments(gpuVector: GpuVector, extent: number, index: number, canonical: CanonicalTileID, imagePositions: {
        [_: string]: ImagePosition;
    }) {
        const triangleOffsets = gpuVector.triangleOffsets;
        const indexBuffer = gpuVector.indexBuffer;
        const vertexBuffer = gpuVector.vertexBuffer;

        let vertexBufferOffset = 0;
        for(let featureOffset = 0; featureOffset < gpuVector.numGeometries; featureOffset++){
            //Iterate over all triangles in the Polygon or MultiPolygon
            const firstTriangleOffset = triangleOffsets[featureOffset];
            const numTriangles = triangleOffsets[featureOffset + 1] - firstTriangleOffset;
            const numIndices = numTriangles * 3;
            const startIndexOffset = firstTriangleOffset * 3;
            const endIndexOffset = startIndexOffset + numIndices;
            const featureIndexBuffer = indexBuffer.subarray(startIndexOffset, endIndexOffset);

            //TODO: improve performance -> get rid of linear complexity
            const numVertices = Math.max(...featureIndexBuffer) + 1;
            const triangleSegment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            //TODO: also hand over layoutVertexArray again?
            const lineSegment = this.segments2.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray2);

            for(let j = 0; j < featureIndexBuffer.length; j+=3){
                //TODO: resize based on number of vertices
                this.indexArray.emplaceBack(
                    vertexBufferOffset + featureIndexBuffer[j],
                    vertexBufferOffset + featureIndexBuffer[j+1],
                    vertexBufferOffset + featureIndexBuffer[j+2]);
            }

            const lineIndex = lineSegment.vertexLength;
            const startFeatureVertexBuffer = vertexBufferOffset * 2;
            const endFeatureVertexBuffer = startFeatureVertexBuffer + numVertices * 2 - 1;
            for(let j = startFeatureVertexBuffer; j <= endFeatureVertexBuffer; j+=2){
                this.layoutVertexArray.emplaceBack(vertexBuffer[j], vertexBuffer[j+1]);
                //TODO also add closing point -> how to identify an LinearRing?
                //TODO: get rid of that branch
                if(j > startFeatureVertexBuffer){
                    let index = lineIndex + (j / 2);
                    this.indexArray2.emplaceBack(index - 1, index);
                }
                else{
                    //TODO: get rid only test
                    let index = lineIndex + (j / 2);
                    this.indexArray2.emplaceBack(index, index);
                }
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += numTriangles;

            lineSegment.vertexLength += numVertices;
            lineSegment.primitiveLength += numVertices;

            vertexBufferOffset = triangleSegment.vertexLength;
        }

        const feature = null;
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, canonical);
    }*/
}

register('ColumnarFillBucket', ColumnarFillBucket, {omit: ['layers', 'patternFeatures']});
