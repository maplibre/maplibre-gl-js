in vec3 a_pos3d;

uniform mat4 u_matrix;
uniform float u_ele_delta;

out vec2 v_texture_pos;
out float v_depth;

void main() {
    float extent = 8192.0; // 8192.0 is the hardcoded vector-tiles coordinates resolution
    float ele_delta = a_pos3d.z == 1.0 ? u_ele_delta : 0.0;
    v_texture_pos = a_pos3d.xy / extent;
    gl_Position = u_matrix * vec4(a_pos3d.xy, get_elevation(a_pos3d.xy) - ele_delta, 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
