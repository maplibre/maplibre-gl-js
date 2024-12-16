import {type Context} from '../gl/context';
import {Mesh} from '../render/mesh';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import {SegmentVector} from '../data/segment';
import {NORTH_POLE_Y, SOUTH_POLE_Y} from '../render/subdivision';
import {EXTENT} from '../data/extent';
import posAttributes from '../data/pos_attributes';

/**
 * The size of border region for stencil masks, in internal tile coordinates.
 * Used for globe rendering.
 */
const EXTENT_STENCIL_BORDER = EXTENT / 128;

/**
 * Options for generating a tile mesh.
 * Can optionally configure any of the following:
 * - mesh subdivision granularity
 * - border presence
 * - special geometry for the north and/or south pole
 */
export type CreateTileMeshOptions = {
    /**
     * Specifies how much should the tile mesh be subdivided.
     * A value of 1 leads to a simple quad, a value of 4 will result in a grid of 4x4 quads.
     */
    granularity?: number;
    /**
     * When true, an additional ring of quads is generated along the border, always extending `EXTENT_STENCIL_BORDER` units away from the main mesh.
     */
    generateBorders?: boolean;
    /**
     * When true, additional geometry is generated along the north edge of the mesh, connecting it to the pole special vertex position.
     * This geometry replaces the mesh border along this edge, if one is present.
     */
    extendToNorthPole?: boolean;
    /**
     * When true, additional geometry is generated along the south edge of the mesh, connecting it to the pole special vertex position.
     * This geometry replaces the mesh border along this edge, if one is present.
     */
    extendToSouthPole?: boolean;
};

/**
 * Stores the prepared vertex and index buffer bytes for a mesh.
 */
export type TileMesh = {
    /**
     * The vertex data. Each vertex is two 16 bit signed integers, one for X, one for Y.
     */
    vertices: ArrayBuffer;
    /**
     * The index data. Each triangle is defined by three indices. The indices may either be 16 bit or 32 bit unsigned integers,
     * depending on the mesh creation arguments and on whether the mesh can fit into 16 bit indices.
     */
    indices: ArrayBuffer;
    /**
     * A helper boolean indicating whether the indices are 32 bit.
     */
    uses32bitIndices: boolean;
};

/**
 * Describes desired type of vertex indices, either 16 bit uint, 32 bit uint, or, if undefined, any of the two options.
 */
export type IndicesType = '32bit' | '16bit' | undefined;

/**
 * @internal
 * Creates a mesh of a quad that covers the entire tile (covering positions in range 0..EXTENT),
 * is optionally subdivided into finer quads, optionally includes a border
 * and optionally extends to the north and/or special pole vertices.
 * Also allocates and populates WebGL buffers for the mesh.
 * Forces 16 bit indices that are used throughout MapLibre.
 * @param context - The WebGL context wrapper.
 * @param options - Specify options for tile mesh creation such as granularity or border.
 * @returns The mesh vertices and indices, already allocated and uploaded into WebGL buffers.
 */
export function createTileMeshWithBuffers(context: Context, options: CreateTileMeshOptions): Mesh {
    const tileMesh = createTileMesh(options, '16bit');
    const vertices = PosArray.deserialize({
        arrayBuffer: tileMesh.vertices,
        length: tileMesh.vertices.byteLength / 2 / 2, // Two values per vertex, 16 bit
    });
    const indices = TriangleIndexArray.deserialize({
        arrayBuffer: tileMesh.indices,
        length: tileMesh.indices.byteLength / 2 / 3, // Three values per triangle, 16 bit
    });
    const mesh = new Mesh(
        context.createVertexBuffer(vertices, posAttributes.members),
        context.createIndexBuffer(indices),
        SegmentVector.simpleSegment(0, 0, vertices.length, indices.length)
    );

    return mesh;
}

/**
 * Creates a mesh of a quad that covers the entire tile (covering positions in range 0..EXTENT),
 * is optionally subdivided into finer quads, optionally includes a border
 * and optionally extends to the north and/or special pole vertices.
 * Additionally the resulting mesh indices type can be specified using `forceIndicesSize`.
 * @example
 * ```
 * // Creating a mesh for a tile that can be used for raster layers, hillshade, etc.
 * const meshBuffers = createTileMesh({
 *     granularity: map.style.projection.subdivisionGranularity.tile.getGranularityForZoomLevel(tileID.z),
 *     generateBorders: true,
 *     extendToNorthPole: tileID.y === 0,
 *     extendToSouthPole: tileID.y === (1 << tileID.z) - 1,
 * }, '16bit');
 * ```
 * @param options - Specify options for tile mesh creation such as granularity or border.
 * @param forceIndicesSize - Specifies what indices type to use. The values '32bit' and '16bit' force their respective indices size. If undefined, the mesh may use either size, and will pick 16 bit indices if possible. If '16bit' is specified and the mesh exceeds 65536 vertices, an exception is thrown.
 * @returns Typed arrays of the mesh vertices and indices.
 */
export function createTileMesh(options: CreateTileMeshOptions, forceIndicesSize?: IndicesType): TileMesh {
    // We only want to generate the north/south border if the tile
    // does NOT border the north/south edge of the mercator range.
    const granularity = options.granularity !== undefined ? Math.max(options.granularity, 1) : 1;

    const quadsPerAxisX = granularity + (options.generateBorders ? 2 : 0); // two extra quads for border
    const quadsPerAxisY = granularity + ((options.extendToNorthPole || options.generateBorders) ? 1 : 0) + (options.extendToSouthPole || options.generateBorders ? 1 : 0);
    const verticesPerAxisX = quadsPerAxisX + 1; // one more vertex than quads
    const verticesPerAxisY = quadsPerAxisY + 1; // one more vertex than quads
    const offsetX = options.generateBorders ? -1 : 0;
    const offsetY = (options.generateBorders || options.extendToNorthPole) ? -1 : 0;
    const endX = granularity + (options.generateBorders ? 1 : 0);
    const endY = granularity + ((options.generateBorders || options.extendToSouthPole) ? 1 : 0);

    const vertexCount = verticesPerAxisX * verticesPerAxisY;
    const indexCount = quadsPerAxisX * quadsPerAxisY * 6;

    const overflows16bitIndices = verticesPerAxisX * verticesPerAxisY > (1 << 16);

    if (overflows16bitIndices && forceIndicesSize === '16bit') {
        throw new Error('Granularity is too large and meshes would not fit inside 16 bit vertex indices.');
    }

    const use32bitIndices = overflows16bitIndices || forceIndicesSize === '32bit';

    const vertices = new Int16Array(vertexCount * 2);

    let vertexId = 0;

    for (let y = offsetY; y <= endY; y++) {
        for (let x = offsetX; x <= endX; x++) {
            let vx = x / granularity * EXTENT;
            if (x === -1) {
                vx = -EXTENT_STENCIL_BORDER;
            }
            if (x === granularity + 1) {
                vx = EXTENT + EXTENT_STENCIL_BORDER;
            }
            let vy = y / granularity * EXTENT;
            if (y === -1) {
                vy = options.extendToNorthPole ? NORTH_POLE_Y : (-EXTENT_STENCIL_BORDER);
            }
            if (y === granularity + 1) {
                vy = options.extendToSouthPole ? SOUTH_POLE_Y : EXTENT + EXTENT_STENCIL_BORDER;
            }

            vertices[vertexId++] = vx;
            vertices[vertexId++] = vy;
        }
    }

    const indices = use32bitIndices ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

    let indexId = 0;

    for (let y = 0; y < quadsPerAxisY; y++) {
        for (let x = 0; x < quadsPerAxisX; x++) {
            const v0 = x + y * verticesPerAxisX;
            const v1 = (x + 1) + y * verticesPerAxisX;
            const v2 = x + (y + 1) * verticesPerAxisX;
            const v3 = (x + 1) + (y + 1) * verticesPerAxisX;

            // v0----v1
            //  |  / |
            //  | /  |
            // v2----v3
            indices[indexId++] = v0;
            indices[indexId++] = v2;
            indices[indexId++] = v1;

            indices[indexId++] = v1;
            indices[indexId++] = v2;
            indices[indexId++] = v3;
        }
    }

    return {
        vertices: vertices.buffer.slice(0),
        indices: indices.buffer.slice(0),
        uses32bitIndices: use32bitIndices,
    };
}