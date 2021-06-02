attribute vec3 a_pos;

uniform mat4 u_matrix;
varying vec2 v_texture_pos;

void main() {
   v_texture_pos = a_pos.xy / 8192.0;
   gl_Position = u_matrix * vec4((a_pos), 1.0);
}
