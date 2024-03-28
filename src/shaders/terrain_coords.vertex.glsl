attribute vec3 a_pos3d;

uniform mat4 u_matrix;
uniform float u_ele_delta;

out vec2 v_texture_pos;

void main() {
    float ele = get_elevation(a_pos3d.xy);
    float ele_delta = a_pos3d.z == 1.0 ? u_ele_delta : 0.0;
    v_texture_pos = a_pos3d.xy / 8192.0;
    gl_Position = u_matrix * vec4(a_pos3d.xy, ele - ele_delta, 1.0);
}