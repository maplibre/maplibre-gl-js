uniform sampler2D u_image;
in vec2 v_pos;

void main() {
    fragColor = texture(u_image, v_pos);
    fragColor *= vec4(1., 0.5, 0.5, 1.);
}
