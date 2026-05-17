export const UBO_BINDINGS = {
    GlobalUBO: 0,
    LayerUBO: 1,
    DrawableUBO: 2,
} as const;

export type UBOBlockName = keyof typeof UBO_BINDINGS;

export function applyUBOBindings(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS) as number;
    for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniformBlockName(program, i);
        // Unknown blocks are skipped so shaders can declare blocks the runtime doesn't know about yet.
        if (name && (name in UBO_BINDINGS)) {
            gl.uniformBlockBinding(program, i, UBO_BINDINGS[name as UBOBlockName]);
        }
    }
}
