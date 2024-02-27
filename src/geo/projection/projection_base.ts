import {mat4, vec3} from 'gl-matrix';
import {Painter} from '../../render/painter';
import {Tile} from '../../source/tile';
import {OverscaledTileID, UnwrappedTileID} from '../../source/tile_id';
import {Transform} from '../transform';
import Point from '@mapbox/point-geometry';
import {ProjectionData} from './projection_uniforms';

export abstract class ProjectionBase {
    abstract get useSpecialProjectionForSymbols(): boolean;

    abstract get isRenderingDirty(): boolean;

    abstract get drawWrappedtiles(): boolean;

    abstract updateGPUdependent(painter: Painter): void;

    abstract updateProjection(transform: Transform): void;

    abstract getProjectionData(tileID: OverscaledTileID, fallBackMatrix?: mat4): ProjectionData;

    abstract isOccluded(x: number, y: number, unwrappedTileID: UnwrappedTileID): boolean;

    abstract project(x: number, y: number, unwrappedTileID: UnwrappedTileID): {
        point: Point;
        signedDistanceFromCamera: number;
        isOccluded: boolean;
    };

    abstract transformLightDirection(dir: vec3): vec3;

    abstract getPixelScale(transform: Transform): number;

    abstract translatePosition(transform: Transform, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number];
}
