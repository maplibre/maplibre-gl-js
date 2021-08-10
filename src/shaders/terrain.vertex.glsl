attribute vec2 a_pos;
attribute float a_ele;

uniform mat4 u_matrix;
uniform lowp float u_ele_exaggeration;

varying vec2 v_texture_pos;

void main() {
   v_texture_pos = a_pos / 8192.0;
   gl_Position = u_matrix * vec4(a_pos, a_ele * u_ele_exaggeration, 1.0);
}
