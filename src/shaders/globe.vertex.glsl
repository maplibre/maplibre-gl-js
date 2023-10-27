in vec3 a_pos3d;
in vec2 a_texcoord;

uniform mat4 u_matrix;

out vec2 v_texture_pos;

void main() {
    v_texture_pos = a_texcoord;
    gl_Position = u_matrix * vec4(a_pos3d, 1.0);
}
