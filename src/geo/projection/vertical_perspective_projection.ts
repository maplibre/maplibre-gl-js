import type {Context} from '../../gl/context';
import type {CanonicalTileID} from '../../tile/tile_id';
import {type Mesh} from '../../render/mesh';
import {now} from '../../util/time_control';
import {easeCubicInOut, lerp} from '../../util/util';
import {mercatorYfromLat} from '../mercator_coordinate';
import {SubdivisionGranularityExpression, SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import type {Projection, ProjectionGPUContext, TileMeshUsage} from './projection';
import {type PreparedShader, shaders} from '../../shaders/shaders';
import {ProjectionErrorMeasurement} from './globe_projection_error_measurement';
import {createTileMeshWithBuffers, type CreateTileMeshOptions} from '../../util/create_tile_mesh';
import {type EvaluationParameters} from '../../style/evaluation_parameters';

export const VerticalPerspectiveShaderDefine = '#define GLOBE';
export const VerticalPerspectiveShaderVariantKey = 'globe';

export const globeConstants = {
    errorTransitionTimeSeconds: 0.5
};

const granularitySettingsGlobe: SubdivisionGranularitySetting = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(128, 2),
    line: new SubdivisionGranularityExpression(512, 0),
    // Always keep at least some subdivision on raster tiles, etc,
    // otherwise they will be visibly warped at high zooms (before mercator transition).
    // This si not needed on fill, because fill geometry tends to already be
    // highly tessellated and granular at high zooms.
    tile: new SubdivisionGranularityExpression(128, 32),
    // Stencil granularity must never be higher than fill granularity,
    // otherwise we would get seams in the oceans at zoom levels where
    // stencil has higher granularity than fill.
    stencil: new SubdivisionGranularityExpression(128, 1),
    circle: 3
});

export class VerticalPerspectiveProjection implements Projection {
    private _tileMeshCache: {[_: string]: Mesh} = {};

    // GPU atan() error correction
    private _errorMeasurement: ProjectionErrorMeasurement;
    private _errorQueryLatitudeDegrees: number;
    private _errorCorrectionUsable: number = 0.0;
    private _errorMeasurementLastValue: number = 0.0;
    private _errorCorrectionPreviousValue: number = 0.0;
    private _errorMeasurementLastChangeTime: number = -1000.0;

    get name(): 'vertical-perspective' {
        return 'vertical-perspective';
    }

    get transitionState(): number {
        return 1;
    }

    get useSubdivision(): boolean {
        return true;
    }

    get shaderVariantName(): string {
        return VerticalPerspectiveShaderVariantKey;
    }

    get shaderDefine(): string {
        return VerticalPerspectiveShaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        return shaders.projectionGlobe;
    }

    get vertexShaderPreludeCode(): string {
        return shaders.projectionMercator.vertexSource;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        return granularitySettingsGlobe;
    }

    get useGlobeControls(): boolean {
        return true;
    }

    /**
     * @internal
     * Globe projection periodically measures the error of the GPU's
     * projection from mercator to globe and computes how much to correct
     * the globe's latitude alignment.
     * This stores the correction that should be applied to the projection matrix.
     */
    get latitudeErrorCorrectionRadians(): number { return this._errorCorrectionUsable; }

    public destroy() {
        if (this._errorMeasurement) {
            this._errorMeasurement.destroy();
        }
    }

    public updateGPUdependent(renderContext: ProjectionGPUContext): void {
        if (!this._errorMeasurement) {
            this._errorMeasurement = new ProjectionErrorMeasurement(renderContext);
        }
        const mercatorY = mercatorYfromLat(this._errorQueryLatitudeDegrees);
        const expectedResult = 2.0 * Math.atan(Math.exp(Math.PI - (mercatorY * Math.PI * 2.0))) - Math.PI * 0.5;
        const newValue = this._errorMeasurement.updateErrorLoop(mercatorY, expectedResult);

        const currentTime = now();

        if (newValue !== this._errorMeasurementLastValue) {
            this._errorCorrectionPreviousValue = this._errorCorrectionUsable; // store the interpolated value
            this._errorMeasurementLastValue = newValue;
            this._errorMeasurementLastChangeTime = currentTime;
        }

        const sinceUpdateSeconds = (currentTime - this._errorMeasurementLastChangeTime) / 1000.0;
        const mix = Math.min(Math.max(sinceUpdateSeconds / globeConstants.errorTransitionTimeSeconds, 0.0), 1.0);
        const newCorrection = -this._errorMeasurementLastValue; // Note the negation
        this._errorCorrectionUsable = lerp(this._errorCorrectionPreviousValue, newCorrection, easeCubicInOut(mix));
    }

    private _getMeshKey(options: CreateTileMeshOptions): string {
        return `${options.granularity.toString(36)}_${options.generateBorders ? 'b' : ''}${options.extendToNorthPole ? 'n' : ''}${options.extendToSouthPole ? 's' : ''}`;
    }

    public getMeshFromTileID(context: Context, canonical: CanonicalTileID, hasBorder: boolean, allowPoles: boolean, usage: TileMeshUsage): Mesh {
        // Stencil granularity must match fill granularity
        const granularityConfig = usage === 'stencil' ? granularitySettingsGlobe.stencil : granularitySettingsGlobe.tile;
        const granularity = granularityConfig.getGranularityForZoomLevel(canonical.z);
        const north = (canonical.y === 0) && allowPoles;
        const south = (canonical.y === (1 << canonical.z) - 1) && allowPoles;
        return this._getMesh(context, {
            granularity,
            generateBorders: hasBorder,
            extendToNorthPole: north,
            extendToSouthPole: south,
        });
    }

    private _getMesh(context: Context, options: CreateTileMeshOptions): Mesh {
        const key = this._getMeshKey(options);

        if (key in this._tileMeshCache) {
            return this._tileMeshCache[key];
        }

        const mesh = createTileMeshWithBuffers(context, options);
        this._tileMeshCache[key] = mesh;
        return mesh;
    }

    recalculate(_params: EvaluationParameters): void {
        // Do nothing.
    }

    hasTransition(): boolean {
        const currentTime = now();
        let dirty = false;
        // Error correction transition
        dirty = dirty || (currentTime - this._errorMeasurementLastChangeTime) / 1000.0 < (globeConstants.errorTransitionTimeSeconds + 0.2);
        // Error correction query in flight
        dirty = dirty || (this._errorMeasurement && this._errorMeasurement.awaitingQuery);
        return dirty;
    }

    setErrorQueryLatitudeDegrees(value: number) {
        this._errorQueryLatitudeDegrees = value;
    }
}