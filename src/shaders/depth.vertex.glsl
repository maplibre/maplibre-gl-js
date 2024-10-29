in vec2 a_pos;

void main() {
    #ifdef GLOBE
        gl_Position = projectTileFor3D(a_pos, 0.0);
    #else
        gl_Position = u_projection_matrix * vec4(a_pos, 0.0, 1.0);
    #endif
}
