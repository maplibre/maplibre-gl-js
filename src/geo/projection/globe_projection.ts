import {type ProjectionDefinition, type ProjectionDefinitionSpecification, type ProjectionSpecification, type StylePropertySpecification, latest as styleSpec} from '@maplibre/maplibre-gl-style-spec';
import {DataConstantProperty, type PossiblyEvaluated, Properties, Transitionable, type Transitioning, type TransitionParameters} from '../../style/properties';
import {Evented} from '../../util/evented';
import {EvaluationParameters} from '../../style/evaluation_parameters';
import {MercatorProjection} from './mercator_projection';
import {VerticalPerspectiveProjection} from './vertical_perspective_projection';
import {type Projection, type ProjectionGPUContext, type TileMeshUsage} from './projection';
import {type PreparedShader} from '../../shaders/shaders';
import {type SubdivisionGranularitySetting} from '../../render/subdivision_granularity_settings';
import {type Context} from '../../gl/context';
import {type CanonicalTileID} from '../../source/tile_id';
import {type Mesh} from '../../render/mesh';

type ProjectionProps = {
    type: DataConstantProperty<ProjectionDefinition>;
}

type ProjectionPossiblyEvaluated = {
    type: ProjectionDefinitionSpecification;
}

const properties: Properties<ProjectionProps> = new Properties({
    'type': new DataConstantProperty(styleSpec.projection.type as StylePropertySpecification)
});

export class GlobeProjection extends Evented implements Projection {
    properties: PossiblyEvaluated<ProjectionProps, ProjectionPossiblyEvaluated>;

    _transitionable: Transitionable<ProjectionProps>;
    _transitioning: Transitioning<ProjectionProps>;
    _mercatorProjection: MercatorProjection;
    _verticalPerspectiveProjection: VerticalPerspectiveProjection;

    constructor(projection?: ProjectionSpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.setProjection(projection);
        this._transitioning = this._transitionable.untransitioned();
        this.recalculate(new EvaluationParameters(0));
        this._mercatorProjection = new MercatorProjection();
        this._verticalPerspectiveProjection = new VerticalPerspectiveProjection();
    }

    public get transitionState(): number {
        const currentProjectionSpecValue = this.properties.get('type');
        if (typeof currentProjectionSpecValue === 'string' && currentProjectionSpecValue === 'mercator') {
            return 0;
        }
        if (typeof currentProjectionSpecValue === 'string' && currentProjectionSpecValue === 'vertical-perspective') {
            return 1;
        }
        // HM TODO: check this!
        if ('transition' in (currentProjectionSpecValue as any)) {
            return (currentProjectionSpecValue as any).transition;
        };
        return 1;
    }

    private get currentProjection(): Projection {
        return this.useGlobeControls ? this._verticalPerspectiveProjection : this._mercatorProjection;
    }

    setProjection(projection?: ProjectionSpecification) {
        this._transitionable.setValue('type', projection?.type || 'mercator');
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition() {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    get name(): 'mercator' | 'vertical-perspective' {
        return this.currentProjection.name;
    }

    get useSubdivision(): boolean {
        return this.currentProjection.useSubdivision;
    }

    get shaderVariantName(): string {
        return this.currentProjection.shaderVariantName;
    }

    get shaderDefine(): string {
        return this.currentProjection.shaderDefine;
    }

    get shaderPreludeCode(): PreparedShader {
        return this.currentProjection.shaderPreludeCode;
    }

    get vertexShaderPreludeCode(): string {
        return this.currentProjection.vertexShaderPreludeCode;
    }

    get subdivisionGranularity(): SubdivisionGranularitySetting {
        return this.currentProjection.subdivisionGranularity;
    }

    get useGlobeControls(): boolean {
        return this.transitionState > 0;
    }

    public destroy(): void {
        this._mercatorProjection.destroy();
        this._verticalPerspectiveProjection.destroy();
    }

    public isRenderingDirty(): boolean {
        return this.hasTransition() || this.currentProjection.isRenderingDirty();
    }

    public updateGPUdependent(context: ProjectionGPUContext): void {
        this._mercatorProjection.updateGPUdependent(context);
        this._verticalPerspectiveProjection.updateGPUdependent(context);
    }

    public getMeshFromTileID(context: Context, _tileID: CanonicalTileID, _hasBorder: boolean, _allowPoles: boolean, _usage: TileMeshUsage): Mesh {
        return this.currentProjection.getMeshFromTileID(context, _tileID, _hasBorder, _allowPoles, _usage);
    }
}