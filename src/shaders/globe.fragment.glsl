uniform sampler2D u_texture;

uniform vec4 u_color_debug;

in vec2 v_texture_pos;

void main() {
    //fragColor = texture(u_texture, v_texture_pos) * u_color_debug;
    fragColor = u_color_debug;
}
