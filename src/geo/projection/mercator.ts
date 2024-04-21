import {mat4, vec3, vec4} from 'gl-matrix';
import {Projection, ProjectionGPUContext} from './projection';
import {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import Point from '@mapbox/point-geometry';
import {Tile} from '../../source/tile';
import {ProjectionData} from '../../render/program/projection_program';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units';
import {EXTENT} from '../../data/extent';
import {PreparedShader, shaders} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import {Mesh} from '../../render/mesh';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import {SegmentVector} from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import {LngLat} from '../lng_lat';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';

export const MercatorShaderDefine = '#define PROJECTION_MERCATOR';
export const MercatorShaderVariantKey = 'mercator';

export class MercatorProjection implements Projection {
    private _cachedMesh: Mesh | null = null;
    private _cameraPosition: vec3 = [0, 0, 0];

    get name(): string {
        return 'mercator';
    }

    get useSpecialProjectionForSymbols(): boolean {
        return false;
    }

    get cameraPosition(): vec3 {
        return vec3.clone(this._cameraPosition); // Return a copy - don't let outside code mutate our precomputed camera position.
    }

    get drawWrappedTiles(): boolean {
        // Mercator always needs to draw wrapped/duplicated tiles.
        return true;
    }

    get useSubdivision(): boolean {
        // Mercator never uses subdivision.
        return false;
    }

    get shaderVariantName(): string {
        return MercatorShaderVariantKey;
    }

    get shaderDefine(): string {
        return MercatorShaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        return shaders.projectionMercator;
    }

    get vertexShaderPreludeCode(): string {
        return shaders.projectionMercator.vertexSource;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        return SubdivisionGranularitySetting.noSubdivision;
    }

    get globePosition(): vec3 {
        return vec3.fromValues(0.0, 0.0, 0.0);
    }

    get globeRadius(): number {
        return 1.0;
    }

    get invProjMatrix(): mat4 {
        return mat4.create();
    }

    public isRenderingDirty(): boolean {
        // Mercator projection does no animations of its own, so rendering is never dirty from its perspective.
        return false;
    }

    public destroy(): void {
        // Do nothing.
    }

    public updateGPUdependent(_: ProjectionGPUContext): void {
        // Do nothing.
    }

    public updateProjection(t: { invProjMatrix: mat4 }): void {
        const cameraPos: vec4 = [0, 0, -1, 1];
        vec4.transformMat4(cameraPos, cameraPos, t.invProjMatrix);
        this._cameraPosition = [
            cameraPos[0] / cameraPos[3],
            cameraPos[1] / cameraPos[3],
            cameraPos[2] / cameraPos[3]
        ];
    }

    public getProjectionData(canonicalTileCoords: {x: number; y: number; z: number}, tilePosMatrix: mat4): ProjectionData {
        let tileOffsetSize: [number, number, number, number];

        if (canonicalTileCoords) {
            const scale = (canonicalTileCoords.z >= 0) ? (1 << canonicalTileCoords.z) : Math.pow(2.0, canonicalTileCoords.z);
            tileOffsetSize = [
                canonicalTileCoords.x / scale,
                canonicalTileCoords.y / scale,
                1.0 / scale / EXTENT,
                1.0 / scale / EXTENT
            ];
        } else {
            tileOffsetSize = [0, 0, 1, 1];
        }
        const mainMatrix = tilePosMatrix ? tilePosMatrix : mat4.create();

        const data: ProjectionData = {
            'u_projection_matrix': mainMatrix, // Might be set to a custom matrix by different projections
            'u_projection_tile_mercator_coords': tileOffsetSize,
            'u_projection_clipping_plane': [0, 0, 0, 0],
            'u_projection_transition': 0.0,
            'u_projection_fallback_matrix': mainMatrix,
        };

        return data;
    }

    public isOccluded(_: number, __: number, ___: UnwrappedTileID): boolean {
        return false;
    }

    public project(_x: number, _y: number, _unwrappedTileID: UnwrappedTileID): {
        point: Point;
        signedDistanceFromCamera: number;
        isOccluded: boolean;
    } {
        // This function should only be used when useSpecialProjectionForSymbols is set to true.
        throw new Error('Not implemented.');
    }

    public getPixelScale(_: any): number {
        return 1.0;
    }

    public getCircleRadiusCorrection(_: any): number {
        return 1.0;
    }

    public translatePosition(transform: { angle: number; zoom: number }, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number] {
        return translatePosition(transform, tile, translate, translateAnchor);
    }

    public getMeshFromTileID(context: Context, _: CanonicalTileID, _hasBorder: boolean): Mesh {
        if (this._cachedMesh) {
            return this._cachedMesh;
        }

        // Both poles/canonicalTileID and borders are ignored for mercator meshes on purpose.

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        const tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        const tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(1, 0, 2);
        quadTriangleIndices.emplaceBack(1, 2, 3);
        const quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);

        this._cachedMesh = new Mesh(tileExtentBuffer, quadTriangleIndexBuffer, tileExtentSegments);
        return this._cachedMesh;
    }

    public transformPosition(_lngLat: LngLat, _elev: number): vec3 {
        return vec3.fromValues(0, 0, 0);
    }

    isGlobe(): boolean {
        return false;
    }

    public transformLightDirection(_: any, dir: vec3): vec3 {
        return vec3.clone(dir);
    }
}

/**
 * Transform a matrix to incorporate the *-translate and *-translate-anchor properties into it.
 * @param inViewportPixelUnitsUnits - True when the units accepted by the matrix are in viewport pixels instead of tile units.
 * @returns matrix
 */
export function translatePosMatrix(
    transform: { angle: number; zoom: number },
    tile: Tile,
    matrix: mat4,
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    inViewportPixelUnitsUnits: boolean = false
): mat4 {
    if (!translate[0] && !translate[1]) return matrix;

    const translation = translatePosition(transform, tile, translate, translateAnchor, inViewportPixelUnitsUnits);
    const translatedMatrix = new Float32Array(16);
    mat4.translate(translatedMatrix, matrix, [translation[0], translation[1], 0]);
    return translatedMatrix;
}

/**
 * Returns a translation in tile units that correctly incorporates the view angle and the *-translate and *-translate-anchor properties.
 * @param inViewportPixelUnitsUnits - True when the units accepted by the matrix are in viewport pixels instead of tile units.
 */
export function translatePosition(
    transform: { angle: number; zoom: number },
    tile: Tile,
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    inViewportPixelUnitsUnits: boolean = false
): [number, number] {
    if (!translate[0] && !translate[1]) return [0, 0];

    const angle = inViewportPixelUnitsUnits ?
        (translateAnchor === 'map' ? transform.angle : 0) :
        (translateAnchor === 'viewport' ? -transform.angle : 0);

    if (angle) {
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        translate = [
            translate[0] * cosA - translate[1] * sinA,
            translate[0] * sinA + translate[1] * cosA
        ];
    }

    return [
        inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], transform.zoom),
        inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], transform.zoom)];
}
