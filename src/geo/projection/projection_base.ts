import {mat4} from 'gl-matrix';
import {Painter} from '../../render/painter';
import {Tile} from '../../source/tile';
import {OverscaledTileID, UnwrappedTileID} from '../../source/tile_id';
import {Transform} from '../transform';
import Point from '@mapbox/point-geometry';
import {ProjectionData} from './projection_uniforms';
import {PreparedShader} from '../../shaders/shaders';

export abstract class ProjectionBase {
    abstract get useSpecialProjectionForSymbols(): boolean;

    abstract get isRenderingDirty(): boolean;

    abstract get drawWrappedtiles(): boolean;

    /**
     * Name of the shader projection variant that should be used for this projection.
     * Note that this value may change dynamically, eg. when globe projection transitions to mercator.
     * Then globe projection might start reporting the mercator shader variant name to make MapLibre use faster mercator shaders.
     */
    abstract get shaderVariantName(): string;
    abstract get shaderDefine(): string;
    abstract get shaderPreludeCode(): PreparedShader;

    abstract updateGPUdependent(painter: Painter): void;

    abstract updateProjection(transform: Transform): void;

    abstract getProjectionData(tileID: OverscaledTileID, fallBackMatrix?: mat4): ProjectionData;

    abstract isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean;

    abstract project(x: number, y: number, unwrappedTileID: UnwrappedTileID): {
        point: Point;
        signedDistanceFromCamera: number;
        isOccluded: boolean;
    };

    abstract getPixelScale(transform: Transform): number;

    abstract translatePosition(transform: Transform, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];
}
