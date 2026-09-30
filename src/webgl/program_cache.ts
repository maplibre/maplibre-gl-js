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
    /** Complete a still-compiling program before returning it instead of letting its draws skip this frame. */
    wait: boolean;
};

/**
 * @internal
 * Compiles each shader variant the first time it is asked for and deletes all of them on destroy.
 * Where the driver compiles in parallel, a new program is returned before it is ready and its
 * draws are skipped until it is; see {@link ProgramCache#takePending}.
 */
export class ProgramCache {
    private readonly context: Context;
    private programs: Record<string, Program<UniformBindings>> = {};
    private pending = false;

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
        const program = this.programs[key];
        if (!program.isReady(variant.wait)) {
            this.pending = true;
        }
        return program;
    }

    /**
     * Whether a program returned since the last call was still compiling, so some draws were
     * skipped and the caller should render another frame. Resets the flag.
     */
    takePending(): boolean {
        const pending = this.pending;
        this.pending = false;
        return pending;
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
