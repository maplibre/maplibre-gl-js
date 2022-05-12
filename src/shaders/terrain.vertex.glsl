attribute vec2 a_pos;

uniform mat4 u_matrix;

varying vec2 v_texture_pos;
varying float v_depth;

void main() {
    v_texture_pos = a_pos / 8192.0; // 8192.0 is the hardcoded vector-tiles coordinates resolution
    gl_Position = u_matrix * vec4(a_pos, get_elevation(a_pos), 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
