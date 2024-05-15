import type {mat4, vec3} from 'gl-matrix';
import type {Tile} from '../../source/tile';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type {ProjectionData} from '../../render/program/projection_program';
import type {PreparedShader} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import type {Mesh} from '../../render/mesh';
import type {Program} from '../../render/program';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type Point from '@mapbox/point-geometry';
import type {LngLat} from '../lng_lat';

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
}

/**
 * An interface the implementations of which are used internally by MapLibre to handle different projections.
 */
export interface Projection {
    /**
     * @internal
     * A short, descriptive name of this projection, such as 'mercator' or 'globe'.
     */
    get name(): string;

    /**
     * @internal
     * True if symbols should use the `project` method of the current ProjectionBase class
     * instead of the default (and fast) mercator projection path.
     */
    get useSpecialProjectionForSymbols(): boolean;

    /**
     * @internal
     * Returns the camera's position transformed to be in the same space as 3D features under this projection. Mostly used for globe + fill-extrusion.
     */
    get cameraPosition(): vec3;

    /**
     * @internal
     * True if this projection requires wrapped copies of the world to be drawn.
     */
    get drawWrappedTiles(): boolean;

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
     * Updates the projection for current transform, such as recomputing internal matrices.
     * May change the value of `isRenderingDirty`.
     */
    updateProjection(transform: TransformLike): void;

    /**
     * @internal
     * Generates a `ProjectionData` instance to be used while rendering the supplied tile.
     */
    getProjectionData(canonicalTileCoords: {x: number; y: number; z: number}, tilePosMatrix: mat4): ProjectionData;

    /**
     * @internal
     * Returns whether the supplied location is occluded in this projection.
     * For example during globe rendering a location on the backfacing side of the globe is occluded.
     * @param x - Tile space coordinate in range 0..EXTENT.
     * @param y - Tile space coordinate in range 0..EXTENT.
     * @param unwrappedTileID - TileID of the tile the supplied coordinates belong to.
     */
    isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean;

    /**
     * @internal
     * Projects a point in tile coordinates. Used in symbol rendering.
     */
    project(x: number, y: number, unwrappedTileID: UnwrappedTileID): {
        point: Point;
        signedDistanceFromCamera: number;
        isOccluded: boolean;
    };

    /**
     * @internal
     */
    getPixelScale(transform: { center: LngLat }): number;

    /**
     * @internal
     * Allows the projection to adjust the radius of `circle-pitch-alignment: 'map'` circles and heatmap kernels based on the transform's zoom level and latitude.
     * Circle and kernel radius is multiplied by this value.
     */
    getCircleRadiusCorrection(transform: { center: LngLat }): number;

    /**
     * @internal
     * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
     */
    translatePosition(transform: { angle: number; zoom: number }, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];

    /**
     * @internal
     * Returns a subdivided mesh for a given canonical tile ID, covering 0..EXTENT range.
     * @param context - WebGL context.
     * @param canonical - The tile coordinates for which to return a mesh. Meshes for tiles that border the top/bottom mercator edge might include extra geometry for the north/south pole.
     * @param hasBorder - When true, the mesh will also include a small border beyond the 0..EXTENT range.
     */
    getMeshFromTileID(context: Context, canonical: CanonicalTileID, hasBorder: boolean): Mesh;

    /**
     * @internal
     * Returns light direction transformed to be in the same space as 3D features under this projection. Mostly used for globe + fill-extrusion.
     * @param transform - Current map transform.
     * @param dir - The light direction.
     * @returns A new vector with the transformed light direction.
     */
    transformLightDirection(transform: { center: LngLat }, dir: vec3): vec3;

    // HM TODO: this needs to be fixed.
    getPitchedTextCorrection(_transform: any, _anchor: any, _tile: any): number;

    // HM TODO: fix this!
    projectTileCoordinates(_x, _y, _t, _ele);
}
