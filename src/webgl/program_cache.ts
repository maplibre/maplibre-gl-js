import {shaders} from '../shaders/shaders.ts';
import {Program} from './program.ts';
import {programUniforms} from './program/program_uniforms.ts';

import type {Context} from './context.ts';
import type {ProgramConfiguration} from '../data/program_configuration.ts';
import type {UniformBindings} from './uniform_binding.ts';
import type {ProjectionShaderVariant} from '../render/frame_render_context.ts';

type ProgramVariant = {
    name: string;
    programConfiguration?: ProgramConfiguration | null;
    projectionShaderVariant: ProjectionShaderVariant;
    showOverdrawInspector: boolean;
    useTerrain: boolean;
    defines: string[];
};

/**
 * @internal
 * Compiles each shader variant the first time it is asked for and deletes all of them on destroy.
 */
export class ProgramCache {
    private readonly context: Context;
    private programs: Record<string, Program<UniformBindings>> = {};

    constructor(context: Context) {
        this.context = context;
    }

    /**
     * Returns the program for a shader variant, compiling it if the cache doesn't hold it yet.
     */
    getProgram(variant: ProgramVariant): Program<UniformBindings> {
        const configurationKey = (variant.programConfiguration ? variant.programConfiguration.cacheKey : '');
        const projectionKey = `/${variant.projectionShaderVariant.name}`;
        const overdrawKey = (variant.showOverdrawInspector ? '/overdraw' : '');
        const terrainKey = (variant.useTerrain ? '/terrain' : '');
        const definesKey = (variant.defines ? `/${variant.defines.join('/')}` : '');

        const key = variant.name + configurationKey + projectionKey + overdrawKey + terrainKey + definesKey;

        this.programs[key] ||= new Program(
            this.context,
            shaders[variant.name],
            variant.programConfiguration,
            programUniforms[variant.name],
            variant.showOverdrawInspector,
            variant.useTerrain,
            variant.projectionShaderVariant.prelude,
            variant.projectionShaderVariant.define,
            variant.defines
        );
        return this.programs[key];
    }

    destroy(): void {
        for (const program of Object.values(this.programs)) {
            if (program.program) {
                this.context.gl.deleteProgram(program.program);
            }
        }
        this.programs = {};
    }
}
