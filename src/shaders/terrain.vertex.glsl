attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform mat4 u_fog_matrix;

varying vec2 v_texture_pos;
varying float v_depth;

void main() {
    float ele = get_elevation(a_pos);
    v_texture_pos = a_pos / 8192.0; // 8192.0 is the hardcoded vector-tiles coordinates resolution
    gl_Position = u_matrix * vec4(a_pos, ele, 1.0);
    vec4 pos = u_fog_matrix * vec4(a_pos, ele, 1.0);
    v_depth = pos.z / pos.w * 0.5 + 0.5;
}
