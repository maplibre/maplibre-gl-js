import type {CanonicalTileID} from '../../source/tile_id';
import type {PreparedShader} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import type {Mesh} from '../../render/mesh';
import type {Program} from '../../render/program';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * Custom projections are handled both by a class which implements this `Projection` interface,
 * and a class that is derived from the `Transform` base class. What is the difference?
 *
 * The transform-derived class:
 * - should do all the heavy lifting for the projection - implement all the `project*` and `unproject*` functions, etc.
 * - must store the map's state - center, pitch, etc. - this is handled in the `Transform` base class
 * - must be cloneable - it should not create any heavy resources
 *
 * The projection-implementing class:
 * - must provide basic information and data about the projection, which is *independent of the map's state* - name, shader functions, subdivision settings, etc.
 * - must be a "singleton" - no matter how many copies of the matching Transform class exist, the Projection should always exist as a single instance (per Map)
 * - may create heavy resources that should not exist in multiple copies (projection is never cloned) - for example, see the GPU inaccuracy mitigation for globe projection
 * - must be explicitly disposed of after usage using the `destroy` function - this allows the implementing class to free any allocated resources
 */

/**
 * @internal
 */
export type ProjectionGPUContext = {
    context: Context;
    useProgram: (name: string) => Program<any>;
};

/**
 * An interface the implementations of which are used internally by MapLibre to handle different projections.
 */
export interface Projection {
    /**
     * @internal
     * A short, descriptive name of this projection, such as 'mercator' or 'globe'.
     */
    get name(): ProjectionSpecification['type'];

    /**
     * @internal
     * True if this projection needs to render subdivided geometry.
     * Optimized rendering paths for non-subdivided geometry might be used throughout MapLibre.
     * The value of this property may change during runtime, for example in globe projection depending on zoom.
     */
    get useSubdivision(): boolean;

    /**
     * Name of the shader projection variant that should be used for this projection.
     * Note that this value may change dynamically, for example when globe projection internally transitions to mercator.
     * Then globe projection might start reporting the mercator shader variant name to make MapLibre use faster mercator shaders.
     */
    get shaderVariantName(): string;

    /**
     * A `#define` macro that is injected into every MapLibre shader that uses this projection.
     * @example
     * `const define = projection.shaderDefine; // '#define GLOBE'`
     */
    get shaderDefine(): string;

    /**
     * @internal
     * A preprocessed prelude code for both vertex and fragment shaders.
     */
    get shaderPreludeCode(): PreparedShader;

    /**
     * Vertex shader code that is injected into every MapLibre vertex shader that uses this projection.
     */
    get vertexShaderPreludeCode(): string;

    /**
     * @internal
     * An object describing how much subdivision should be applied to rendered geometry.
     * The subdivision settings should be a constant for a given projection.
     * Projections that do not require subdivision should return {@link SubdivisionGranularitySetting.noSubdivision}.
     */
    get subdivisionGranularity(): SubdivisionGranularitySetting;

    /**
     * @internal
     * Cleans up any resources the projection created, especially GPU buffers.
     */
    destroy(): void;

    /**
     * @internal
     * True when an animation handled by the projection is in progress,
     * requiring MapLibre to keep rendering new frames.
     */
    isRenderingDirty(): boolean;

    /**
     * @internal
     * Runs any GPU-side tasks this projection required. Called at the beginning of every frame.
     */
    updateGPUdependent(renderContext: ProjectionGPUContext): void;

    /**
     * @internal
     * Returns a subdivided mesh for a given tile ID, covering 0..EXTENT range.
     * @param context - WebGL context.
     * @param tileID - The tile coordinates for which to return a mesh. Meshes for tiles that border the top/bottom mercator edge might include extra geometry for the north/south pole.
     * @param hasBorder - When true, the mesh will also include a small border beyond the 0..EXTENT range.
     * @param allowPoles - When true, the mesh will also include geometry to cover the north (south) pole, if the given tileID borders the mercator range's top (bottom) edge.
     */
    getMeshFromTileID(context: Context, tileID: CanonicalTileID, hasBorder: boolean, allowPoles: boolean): Mesh;
}
