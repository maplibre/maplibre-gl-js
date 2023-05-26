in vec2 a_pos;
out vec2 v_uv;

uniform mat4 u_matrix;
uniform float u_overlay_scale;

void main() {
    // This vertex shader expects a EXTENT x EXTENT quad,
    // The UV co-ordinates for the overlay texture can be calculated using that knowledge
    v_uv = a_pos / 8192.0;
    gl_Position = u_matrix * vec4(a_pos * u_overlay_scale, get_elevation(a_pos), 1);
}
