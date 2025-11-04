import type {Projection, ProjectionGPUContext, TileMeshUsage} from './projection';
import type {CanonicalTileID} from '../../tile/tile_id';
import {EXTENT} from '../../data/extent';
import {type PreparedShader, shaders} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import {Mesh} from '../../render/mesh';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import {SegmentVector} from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';

export const MercatorShaderDefine = '#define PROJECTION_MERCATOR';
export const MercatorShaderVariantKey = 'mercator';

export class MercatorProjection implements Projection {
    private _cachedMesh: Mesh = null;

    get name(): 'mercator' {
        return 'mercator';
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

    get useGlobeControls(): boolean {
        return false;
    }

    get transitionState(): number {
        return 0;
    }

    get latitudeErrorCorrectionRadians(): number {
        return 0;
    }

    public destroy(): void {
        // Do nothing.
    }

    public updateGPUdependent(_: ProjectionGPUContext): void {
        // Do nothing.
    }

    public getMeshFromTileID(context: Context, _tileID: CanonicalTileID, _hasBorder: boolean, _allowPoles: boolean, _usage: TileMeshUsage): Mesh {
        if (this._cachedMesh) {
            return this._cachedMesh;
        }

        // The parameters tileID, hasBorder and allowPoles are all ignored on purpose for mercator meshes.

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

    public recalculate(): void {
        // Do nothing.
    }

    public hasTransition(): boolean {
        return false;
    }

    setErrorQueryLatitudeDegrees(_value: number) {
        // Do nothing.
    }
}
