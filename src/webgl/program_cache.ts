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
    /** Every compiled program, in the order they were compiled. */
    private compiled: Array<Program<UniformBindings>> = [];
    /** The compiled programs by shader name and defines, then by configuration key, then by projection variant, then by {@link variantFlags}. */
    private programs: Map<string, Map<string, Map<string, Array<Program<UniformBindings>>>>> = new Map();

    constructor(context: Context) {
        this.context = context;
    }

    /**
     * Returns the program for a shader variant, compiling it if the cache doesn't hold it yet.
     * A lookup builds no string unless the variant has defines, since it runs for every draw.
     */
    getProgram(variant: ProgramVariant): Program<UniformBindings> {
        const name = variant.defines?.length ? `${variant.name}/${variant.defines.join('/')}` : variant.name;
        let byConfiguration = this.programs.get(name);
        if (!byConfiguration) {
            byConfiguration = new Map();
            this.programs.set(name, byConfiguration);
        }
        const configurationKey = variant.programConfiguration ? variant.programConfiguration.cacheKey : '';
        let byProjection = byConfiguration.get(configurationKey);
        if (!byProjection) {
            byProjection = new Map();
            byConfiguration.set(configurationKey, byProjection);
        }
        let byFlags = byProjection.get(variant.projectionShaderVariant.name);
        if (!byFlags) {
            byFlags = [];
            byProjection.set(variant.projectionShaderVariant.name, byFlags);
        }
        const flags = variantFlags(variant);
        let program = byFlags[flags];
        if (!program) {
            program = new Program(
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
            byFlags[flags] = program;
            this.compiled.push(program);
        }
        return program;
    }

    destroy(): void {
        for (const program of this.compiled) {
            if (program.program) {
                this.context.gl.deleteProgram(program.program);
            }
        }
        this.compiled = [];
        this.programs = new Map();
    }
}

/** The overdraw and terrain switches of a variant as an array index. */
function variantFlags(variant: ProgramVariant): number {
    return (variant.showOverdrawInspector ? 1 : 0) + (variant.useTerrain ? 2 : 0);
}
