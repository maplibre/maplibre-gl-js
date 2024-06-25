import type {Context} from '../../gl/context';
import type {CanonicalTileID} from '../../source/tile_id';
import {PosArray, TriangleIndexArray} from '../../data/array_types.g';
import {Mesh} from '../../render/mesh';
import {EXTENT} from '../../data/extent';
import {SegmentVector} from '../../data/segment';
import posAttributes from '../../data/pos_attributes';
import {browser} from '../../util/browser';
import {easeCubicInOut, lerp} from '../../util/util';
import {mercatorYfromLat} from '../mercator_coordinate';
import {NORTH_POLE_Y, SOUTH_POLE_Y} from '../../render/subdivision';
import {SubdivisionGranularityExpression, SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {Projection, ProjectionGPUContext} from './projection';
import {PreparedShader, shaders} from '../../shaders/shaders';
import {MercatorProjection} from './mercator';
import {ProjectionErrorMeasurement} from './globe_projection_error_measurement';

const EXTENT_STENCIL_BORDER = EXTENT / 128;

export const globeConstants = {
    /**
     * The size of border region for stencil masks, in internal tile coordinates.
     * Used for globe rendering.
     */
    globeTransitionTimeSeconds: 0.5,
    zoomTransitionTimeSeconds: 0.5,
    maxGlobeZoom: 12.0,
    errorTransitionTimeSeconds: 0.5
};

const granularitySettingsGlobe: SubdivisionGranularitySetting = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(128, 1),
    line: new SubdivisionGranularityExpression(512, 1),
    // Always keep at least some subdivision on raster tiles, etc,
    // otherwise they will be visibly warped at high zooms (before mercator transition).
    // This si not needed on fill, because fill geometry tends to already be
    // highly tessellated and granular at high zooms.
    tile: new SubdivisionGranularityExpression(128, 16),
    circle: 3
});

export class GlobeProjection implements Projection {
    private _mercator: MercatorProjection;

    private _tileMeshCache: {[_: string]: Mesh} = {};

    /**
     * Stores whether globe rendering should be used.
     * The value is injected from GlobeTransform.
     */
    private _useGlobeRendering: boolean = true;

    // GPU atan() error correction
    private _errorMeasurement: ProjectionErrorMeasurement;
    private _errorQueryLatitudeDegrees: number;
    private _errorCorrectionUsable: number = 0.0;
    private _errorMeasurementLastValue: number = 0.0;
    private _errorCorrectionPreviousValue: number = 0.0;
    private _errorMeasurementLastChangeTime: number = -1000.0;

    get projectionName(): string {
    private _globeMatrix: mat4 = mat4.create();
    private _globeMatrixNoCorrection: mat4 = mat4.create();
    private _globePosition: vec3 = [0, 0, 0];
    private _globeRadiusPixels: number = 0.0;

    private _projMatrix: mat4 = mat4.create();
    private _invProjMatrix: mat4 = mat4.create();

        return 'globe';
    }

    /**
     * This property is true when globe rendering and globe shader variants should be in use.
     * This is false when globe is disabled, or when globe is enabled, but mercator rendering is used due to zoom level (and no transition is happening).
     */
    get useGlobeRendering(): boolean {
        return this._useGlobeRendering;
    }

    /**
     * @internal
     * Intended for internal use, only called from GlobeTransform.
     */
    set useGlobeRendering(value: boolean) {
        this._useGlobeRendering = value;
    }

    get useSubdivision(): boolean {
        return this.useGlobeRendering;
    }

    get shaderVariantName(): string {
        return this.useGlobeRendering ? 'globe' : this._mercator.shaderVariantName;
    }

    get shaderDefine(): string {
        return this.useGlobeRendering ? '#define GLOBE' : this._mercator.shaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        return this.useGlobeRendering ? shaders.projectionGlobe : this._mercator.shaderPreludeCode;
    }

    get vertexShaderPreludeCode(): string {
        return shaders.projectionMercator.vertexSource;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        return granularitySettingsGlobe;
    }

    get useGlobeControls(): boolean {
        return this._useGlobeRendering;
    }

    get worldCenterPosition(): vec3 {
        return this._globePosition;
    }

    get errorQueryLatitudeDegrees(): number { return this._errorQueryLatitudeDegrees; }

    get worldSize(): number {
        return this._globeRadiusPixels;
    }

    get invProjMatrix(): mat4 {
        return this._invProjMatrix;
    }

    /**
     * @internal
     * Intended for internal use, only called from GlobeTransform.
     */
    set errorQueryLatitudeDegrees(value: number) {
        this._errorQueryLatitudeDegrees = value;
    }

    /**
     * @internal
     * Globe projection periodically measures the error of the GPU's
     * projection from mercator to globe and computes how much to correct
     * the globe's latitude alignment.
     * This stores the correction that should be applied to the projection matrix.
     */
    get latitudeErrorCorrectionRadians(): number { return this._errorCorrectionUsable; }

    constructor() {
        this._mercator = new MercatorProjection();
    }

    public destroy() {
        if (this._errorMeasurement) {
            this._errorMeasurement.destroy();
        }
    }

    public isRenderingDirty(): boolean {
        const now = browser.now();
        let dirty = false;
        // Error correction transition
        dirty = dirty || (now - this._errorMeasurementLastChangeTime) / 1000.0 < (globeConstants.errorTransitionTimeSeconds + 0.2);
        // Error correction query in flight
        dirty = dirty || this._errorMeasurement.awaitingQuery;
        return dirty;
    }

    public updateGPUdependent(renderContext: ProjectionGPUContext): void {
        this._mercator.updateGPUdependent(renderContext);
        if (!this._errorMeasurement) {
            this._errorMeasurement = new ProjectionErrorMeasurement(renderContext);
        }
        const mercatorY = mercatorYfromLat(this._errorQueryLatitudeDegrees);
        const expectedResult = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
        const newValue = this._errorMeasurement.updateErrorLoop(mercatorY, expectedResult);

        const now = browser.now();

        if (newValue !== this._errorMeasurementLastValue) {
            this._errorCorrectionPreviousValue = this._errorCorrectionUsable; // store the interpolated value
            this._errorMeasurementLastValue = newValue;
            this._errorMeasurementLastChangeTime = now;
        }

        const sinceUpdateSeconds = (now - this._errorMeasurementLastChangeTime) / 1000.0;
        const mix = Math.min(Math.max(sinceUpdateSeconds / globeConstants.errorTransitionTimeSeconds, 0.0), 1.0);
        const newCorrection = -this._errorMeasurementLastValue; // Note the negation
        this._errorCorrectionUsable = lerp(this._errorCorrectionPreviousValue, newCorrection, easeCubicInOut(mix));
    }




    private _getMeshKey(granularity: number, border: boolean, north: boolean, south: boolean): string {
        return `${granularity.toString(36)}_${border ? 'b' : ''}${north ? 'n' : ''}${south ? 's' : ''}`;
    }

    public getMeshFromTileID(context: Context, canonical: CanonicalTileID, hasBorder: boolean, allowPoles: boolean): Mesh {
        // Stencil granularity must match fill granularity
        const granularity = granularitySettingsGlobe.fill.getGranularityForZoomLevel(canonical.z);
        const north = (canonical.y === 0) && allowPoles;
        const south = (canonical.y === (1 << canonical.z) - 1) && allowPoles;
        return this._getMesh(context, granularity, hasBorder, north, south);
    }

    private _getMesh(context: Context, granularity: number, hasBorder: boolean, hasNorthEdge: boolean, hasSouthEdge: boolean): Mesh {
        const key = this._getMeshKey(granularity, hasBorder, hasNorthEdge, hasSouthEdge);

        if (key in this._tileMeshCache) {
            return this._tileMeshCache[key];
        }

        const mesh = this._createQuadMesh(context, granularity, hasBorder, hasNorthEdge, hasSouthEdge);
        this._tileMeshCache[key] = mesh;
        return mesh;
    }

    /**
     * Creates a quad mesh covering positions in range 0..EXTENT, for tile clipping.
     * @param context - MapLibre's rendering context object.
     * @param granularity - Mesh triangulation granularity: 1 for just a single quad, 3 for 3x3 quads.
     * @returns
     */
    private _createQuadMesh(context: Context, granularity: number, border: boolean, north: boolean, south: boolean): Mesh {
        const vertexArray = new PosArray();
        const indexArray = new TriangleIndexArray();

        // We only want to generate the north/south border if the tile
        // does NOT border the north/south edge of the mercator range.

        const quadsPerAxisX = granularity + (border ? 2 : 0); // two extra quads for border
        const quadsPerAxisY = granularity + ((north || border) ? 1 : 0) + (south || border ? 1 : 0);
        const verticesPerAxisX = quadsPerAxisX + 1; // one more vertex than quads
        //const verticesPerAxisY = quadsPerAxisY + 1; // one more vertex than quads
        const offsetX = border ? -1 : 0;
        const offsetY = (border || north) ? -1 : 0;
        const endX = granularity + (border ? 1 : 0);
        const endY = granularity + ((border || south) ? 1 : 0);

        const northY = NORTH_POLE_Y;
        const southY = SOUTH_POLE_Y;

        for (let y = offsetY; y <= endY; y++) {
            for (let x = offsetX; x <= endX; x++) {
                let vx = x / granularity * EXTENT;
                if (x === -1) {
                    vx = -EXTENT_STENCIL_BORDER;
                }
                if (x === granularity + 1) {
                    vx = EXTENT + EXTENT_STENCIL_BORDER;
                }
                let vy = y / granularity * EXTENT;
                if (y === -1) {
                    vy = north ? northY : (-EXTENT_STENCIL_BORDER);
                }
                if (y === granularity + 1) {
                    vy = south ? southY : EXTENT + EXTENT_STENCIL_BORDER;
                }
                vertexArray.emplaceBack(vx, vy);
            }
        }

        for (let y = 0; y < quadsPerAxisY; y++) {
            for (let x = 0; x < quadsPerAxisX; x++) {
                const v0 = x + y * verticesPerAxisX;
                const v1 = (x + 1) + y * verticesPerAxisX;
                const v2 = x + (y + 1) * verticesPerAxisX;
                const v3 = (x + 1) + (y + 1) * verticesPerAxisX;
                // v0----v1
                //  |  / |
                //  | /  |
                // v2----v3
                indexArray.emplaceBack(v0, v2, v1);
                indexArray.emplaceBack(v1, v2, v3);
            }
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return mesh;
    }
}
