uniform sampler2D u_image;
uniform vec4 u_unpack;
in vec2 v_pos;

float getElevation(vec2 coord) {
    // Convert encoded elevation value to meters
    vec4 data = texture(u_image, coord) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

void main() {
    float el = getElevation(v_pos);

    fragColor = vec4(el/3200.0, 0.0, 1.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
