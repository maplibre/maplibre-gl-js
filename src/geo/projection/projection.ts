import type {mat4} from 'gl-matrix';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type {PreparedShader} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import type {Mesh} from '../../render/mesh';
import type {Program} from '../../render/program';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {LngLat} from '../lng_lat';
import type {Transform} from '../transform'; // JP: TODO: maybe remove transform references?

export type ProjectionGPUContext = {
    context: Context;
    useProgram: (name: string) => Program<any>;
};

// Thin type with only the relevant fields from the Transform class
export type TransformLike = {
    center: LngLat;
    angle: number; // same as bearing, but negated and in radians
    pitch: number; // in degrees
    zoom: number;
    worldSize: number;
    fov: number; // in degrees
    width: number;
    height: number;
    cameraToCenterDistance: number;
    invProjMatrix: mat4;
    calculatePosMatrix(unwrappedTileID: UnwrappedTileID, aligned?: boolean): mat4;
}

/**
 * An interface the implementations of which are used internally by MapLibre to handle different projections.
 */
export interface Projection {
    /**
     * @internal
     * A short, descriptive name of this projection, such as 'mercator' or 'globe'.
     */
    get projectionName(): string;

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
     * When true, any transforms resulting from user interactions with the map (panning, zooming, etc.)
     * will assume the underlying map is a spherical surface, as opposed to a plane.
     */
    get useGlobeControls(): boolean;

    /**
     * @internal
     * True when an animation handled by the projection is in progress,
     * requiring MapLibre to keep rendering new frames.
     */
    isRenderingDirty(): boolean;

    /**
     * @internal
     * Cleans up any resources the projection created, especially GPU buffers.
     */
    destroy(): void;

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

    /**
     * @internal
     * Returns a new instance of a class derived from the {@link Transform} base class. Returns a specialized class for this projection type.
     */
    createSpecializedTransformInstance(): Transform;
}
