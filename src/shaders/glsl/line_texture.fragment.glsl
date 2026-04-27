uniform sampler2D u_image;
uniform sampler2D u_image_opacity;
uniform float u_opacity;

in vec2 v_pos;

void main() {
    float opacity = u_opacity >= 0.0 ? u_opacity : texture(u_image_opacity, v_pos).r;
    fragColor = texture(u_image, v_pos) * opacity;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(0.0);
#endif
}
