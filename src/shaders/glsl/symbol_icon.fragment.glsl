uniform sampler2D u_texture;

in vec2 v_tex;
in float v_total_opacity;

void main() {
    fragColor = texture(u_texture, v_tex) * v_total_opacity;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
