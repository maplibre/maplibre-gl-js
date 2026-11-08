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
 *
 * A lookup runs once per draw call, a thousand times or more per frame, so it must not build a string key
 * from the variant: concatenating the program name with the configuration's `cacheKey` makes a new string
 * every call, which the lookup then has to flatten and hash in full. The programs are instead kept in nested
 * maps, keyed by strings that already exist and whose hashes the engine keeps: the program name, the
 * configuration's `cacheKey`, and a short key for the rest of the variant.
 */
export class ProgramCache {
    private readonly context: Context;
    private programs: Map<string, Map<string, Map<string, Program<UniformBindings>>>> = new Map();

    constructor(context: Context) {
        this.context = context;
    }

    /**
     * Returns the program for a shader variant, compiling it if the cache doesn't hold it yet.
     */
    getProgram(variant: ProgramVariant): Program<UniformBindings> {
        let byConfiguration = this.programs.get(variant.name);
        if (!byConfiguration) {
            byConfiguration = new Map();
            this.programs.set(variant.name, byConfiguration);
        }

        const configurationKey = variant.programConfiguration ? variant.programConfiguration.cacheKey : '';
        let byVariant = byConfiguration.get(configurationKey);
        if (!byVariant) {
            byVariant = new Map();
            byConfiguration.set(configurationKey, byVariant);
        }

        const variantKey = getVariantKey(variant);
        let program = byVariant.get(variantKey);
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
            byVariant.set(variantKey, program);
        }
        return program;
    }

    destroy(): void {
        for (const byConfiguration of this.programs.values()) {
            for (const byVariant of byConfiguration.values()) {
                for (const program of byVariant.values()) {
                    if (program.program) {
                        this.context.gl.deleteProgram(program.program);
                    }
                }
            }
        }
        this.programs = new Map();
    }
}

/**
 * The part of a variant's key that is neither its name nor its configuration. In the common case, a draw
 * without the overdraw inspector, terrain or extra defines, it is the projection's name as is, so that no
 * string has to be built.
 */
function getVariantKey(variant: ProgramVariant): string {
    const projectionKey = variant.projectionShaderVariant.name;
    const hasDefines = variant.defines?.length > 0;
    if (!variant.showOverdrawInspector && !variant.useTerrain && !hasDefines) return projectionKey;

    const overdrawKey = variant.showOverdrawInspector ? '/overdraw' : '';
    const terrainKey = variant.useTerrain ? '/terrain' : '';
    const definesKey = hasDefines ? `/${variant.defines.join('/')}` : '';
    return projectionKey + overdrawKey + terrainKey + definesKey;
}
