layout(std140) uniform LayerUBO {
    mediump vec4 u_color;
    mediump float u_opacity;
};

void main() {
    fragColor = u_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
