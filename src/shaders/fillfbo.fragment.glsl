uniform sampler2D u_image;
varying vec2 v_pos;

void main() {
    vec4 color = texture2D(u_image, v_pos);
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
