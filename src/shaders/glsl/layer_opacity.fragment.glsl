uniform sampler2D u_image;
uniform float u_opacity;

in vec2 v_pos;

void main() {
    fragColor = texture(u_image, v_pos) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(0.0);
#endif
}
