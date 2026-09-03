export const UBO_BINDINGS = {
    ProjectionUBO: 0,
};

export function applyUBOBindings(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    for (const [name, binding] of Object.entries(UBO_BINDINGS)) {
        const index = gl.getUniformBlockIndex(program, name);
        if (index !== gl.INVALID_INDEX) {
            gl.uniformBlockBinding(program, index, binding);
        }
    }
}
