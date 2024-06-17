import {mat4, vec3} from 'gl-matrix';
import {Tile} from '../../source/tile';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import Point from '@mapbox/point-geometry';
import {ProjectionData} from '../../render/program/projection_program';
import {PreparedShader} from '../../shaders/shaders';
import {Context} from '../../gl/context';
import {Mesh} from '../../render/mesh';
import {Program} from '../../render/program';
import type {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {LngLat} from '../lng_lat';
import type {PointProjection} from '../../symbol/projection';

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
    invModelViewProjectionMatrix: mat4;
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
     * World center in camera frame.
     */
    get worldCenterPosition(): vec3;

    /**
     * World size in pixel.
     */
    get worldSize(): number;

    /**
     * Inverse projection matrix from camera to clip plane.
     */
    get invProjMatrix(): mat4;

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
     */
    getPixelScale(transform: { center: LngLat }): number;

    /**
     * @internal
     * Allows the projection to adjust the radius of `circle-pitch-alignment: 'map'` circles and heatmap kernels based on the map's latitude.
     * Circle radius and heatmap kernel radius is multiplied by this value.
     */
    getCircleRadiusCorrection(transform: { center: LngLat }): number;

    /**
     * @internal
     * Allows the projection to adjust the scale of `text-pitch-alignment: 'map'` symbols's collision boxes based on the map's center and the text anchor.
     * Only affects the collision boxes (and click areas), scaling of the rendered text is mostly handled in shaders.
     * @param transform - The map's transform, with only the `center` property, describing the map's longitude and latitude.
     * @param textAnchor - Text anchor position inside the tile.
     * @param tileID - The tile coordinates.
     */
    getPitchedTextCorrection(transform: { center: LngLat }, textAnchor: Point, tileID: UnwrappedTileID): number;

    /**
     * @internal
     * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
     */
    translatePosition(transform: { angle: number; zoom: number }, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];

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
     * Return true if the projection correspond to a Globe.
     */
    isGlobe(): boolean;

    /**
     * @internal
     * Returns light direction transformed to be in the same space as 3D features under this projection. Mostly used for globe + fill-extrusion.
     * @param transform - Current map transform.
     * @param dir - The light direction.
     * @returns A new vector with the transformed light direction.
     */
    transformLightDirection(transform: { center: LngLat }, dir: vec3): vec3;
    /**
     * @internal
     * Projects a point in tile coordinates. Used in symbol rendering.
     */
    projectTileCoordinates(x: number, y: number, unwrappedTileID: UnwrappedTileID, getElevation: (x: number, y: number) => number): PointProjection;
}
