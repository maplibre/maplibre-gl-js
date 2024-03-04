import {mat4} from 'gl-matrix';
import {Painter} from '../../render/painter';
import {Tile} from '../../source/tile';
import {UnwrappedTileID} from '../../source/tile_id';
import {Transform} from '../transform';
import Point from '@mapbox/point-geometry';
import {ProjectionData} from '../../render/program/projection_program';
import {PreparedShader} from '../../shaders/shaders';

/**
 * An abstract class the specializations of which are used internally by MapLibre to handle different projections.
 */
export abstract class ProjectionBase {
    /**
     * @internal
     * @readonly
     * A short, descriptive name of this projection, such as "mercator" or "globe".
     */
    readonly name: string;

    /**
     * @internal
     * @param name - A short, descriptive name of this projection, such as "mercator" or "globe".
     */
    constructor(name: string) {
        this.name = name;
    }

    /**
     * @internal
     * True if symbols should use the `project` method of the current ProjectionBase class
     * instead of the default (and fast) mercator projection path.
     */
    abstract get useSpecialProjectionForSymbols(): boolean;

    /**
     * @internal
     * True when an animation handled by the projection is in progress,
     * requiring MapLibre to keep rendering new frames.
     */
    abstract get isRenderingDirty(): boolean;

    /**
     * @internal
     * True if this projection required wrapped copies of the world to be drawn.
     */
    abstract get drawWrappedtiles(): boolean;

    /**
     * Name of the shader projection variant that should be used for this projection.
     * Note that this value may change dynamically, for example when globe projection internally transitions to mercator.
     * Then globe projection might start reporting the mercator shader variant name to make MapLibre use faster mercator shaders.
     */
    abstract get shaderVariantName(): string;

    /**
     * A `#define` macro that is injected into every MapLibre shader that uses this projection.
     * @example
     * `const define = projection.shaderDefine; // '#define GLOBE'`
     */
    abstract get shaderDefine(): string;

    /**
     * @internal
     * A preprocessed prelude code for both vertex and fragment shaders.
     */
    abstract get shaderPreludeCode(): PreparedShader;

    /**
     * Vertex shader code that is injected into every MapLibre vertex shader that uses this projection.
     */
    get vertexShaderPreludeCode(): string {
        return this.shaderPreludeCode.vertexSource;
    }

    /**
     * @internal
     * Runs any GPU-side tasks this projection required. Called at the beginning of every frame.
     */
    abstract updateGPUdependent(painter: Painter): void;

    /**
     * @internal
     * Updates the projection for current transform, such as recomputing internal matrices.
     * May change the value of `isRenderingDirty`.
     */
    abstract updateProjection(transform: Transform): void;

    /**
     * @internal
     * Generates a `ProjectionData` instance to be used while rendering the supplied tile.
     */
    abstract getProjectionData(canonicalTileCoords: {x: number; y: number; z: number}, tilePosMatrix: mat4): ProjectionData;

    /**
     * @internal
     * Returns whether the supplied location is occluded in this projection.
     * For example during globe rendering a location on the backfacing side of the globe is occluded.
     * @param x - Tile space coordinate in range 0..EXTENT.
     * @param y - Tile space coordinate in range 0..EXTENT.
     * @param unwrappedTileID - TileID of the tile the supplied coordinates belong to.
     */
    abstract isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean;

    /**
     * @internal
     * Projects a point in tile coordinates. Used in symbol rendering.
     */
    abstract project(x: number, y: number, unwrappedTileID: UnwrappedTileID): {
        point: Point;
        signedDistanceFromCamera: number;
        isOccluded: boolean;
    };

    /**
     * @internal
     */
    abstract getPixelScale(transform: Transform): number;

    /**
     * @internal
     * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
     */
    abstract translatePosition(transform: Transform, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];
}
