uniform sampler2D u_texture;

in vec2 v_texture_pos;

void main() {
    fragColor = texture(u_texture, vec2(v_texture_pos.x, 1.0 - v_texture_pos.y));
}
