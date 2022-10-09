varying float v_depth;

// methods for pack/unpack depth value to texture rgba
// https://stackoverflow.com/questions/34963366/encode-floating-point-data-in-a-rgba-texture
const highp vec4 bitSh = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
const highp vec4 bitMsk = vec4(0.0, vec3(1.0 / 256.0));
highp vec4 pack(highp float value) {
    highp vec4 comp = fract((value * 0.5 + 0.5) * bitSh);
    comp -= comp.xxyz * bitMsk;
    return comp;
}

void main() {
    gl_FragColor = pack(v_depth);
}
