in vec4 v_color;

void main() {
    fragColor = v_color;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
