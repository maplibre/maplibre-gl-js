attribute vec2 a_pos;

uniform mat4 u_matrix;

varying float v_depth;

void main() {
    gl_Position = u_matrix * vec4(a_pos, get_elevation(a_pos), 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
