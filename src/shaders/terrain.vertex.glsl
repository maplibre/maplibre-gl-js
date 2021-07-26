attribute vec2 a_pos;
attribute float a_ele;

uniform mat4 u_matrix;
varying vec2 v_texture_pos;

void main() {
   v_texture_pos = a_pos / 8192.0;
   gl_Position = u_matrix * vec4(a_pos, a_ele, 1.0);
}
