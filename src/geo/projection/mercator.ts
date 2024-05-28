import type {Projection, ProjectionGPUContext} from './projection';
import type {CanonicalTileID} from '../../source/tile_id';
import {EXTENT} from '../../data/extent';
import {PreparedShader, shaders} from '../../shaders/shaders';
import type {Context} from '../../gl/context';
import {Mesh} from '../../render/mesh';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import {SegmentVector} from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import {SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {Transform} from '../transform';
import {MercatorTransform} from './mercator_transform';

export const MercatorShaderDefine = '#define PROJECTION_MERCATOR';
export const MercatorShaderVariantKey = 'mercator';

export class MercatorProjection implements Projection {
    private _cachedMesh: Mesh = null;

    get projectionName(): string {
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

    public isRenderingDirty(): boolean {
        // Mercator projection does no animations of its own, so rendering is never dirty from its perspective.
        return false;
    }

    public destroy(): void {
        // Do nothing.
    }

    public updateProjection(): void {
        // Do nothing.
    }

    public updateGPUdependent(_: ProjectionGPUContext): void {
        // Do nothing.
    }

    public getMeshFromTileID(context: Context, _tileID: CanonicalTileID, _hasBorder: boolean, _allowPoles: boolean): Mesh {
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

    public createSpecializedTransformInstance(): Transform {
        return new MercatorTransform();
    }
}
