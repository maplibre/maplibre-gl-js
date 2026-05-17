/**
 * Global UBO binding-point assignments. Each entry maps a UBO block name (as it
 * appears in GLSL `layout(std140) uniform <Name> { ... }`) to a fixed binding
 * index used both by `Drawable.draw()` (`bindBufferBase`) and by `Program`'s
 * post-link auto-scan (`uniformBlockBinding`).
 *
 * Slot 0 is reserved for a future per-frame GlobalUBO (projection/terrain
 * prelude) but is not wired up in Milestone 2.1.
 */
export const UBO_BINDINGS = {
    GlobalUBO: 0,
    LayerUBO: 1,
    DrawableUBO: 2,
} as const;

export type UBOBlockName = keyof typeof UBO_BINDINGS;

/**
 * Walks the program's active uniform blocks after `linkProgram` and assigns each
 * known block (LayerUBO / DrawableUBO / GlobalUBO) to its fixed binding index
 * via `uniformBlockBinding`. Unknown block names are silently ignored so that
 * future shaders can declare blocks the runtime hasn't been taught about yet.
 */
export function applyUBOBindings(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS) as number;
    for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniformBlockName(program, i);
        if (name && (name in UBO_BINDINGS)) {
            gl.uniformBlockBinding(program, i, UBO_BINDINGS[name as UBOBlockName]);
        }
    }
}
