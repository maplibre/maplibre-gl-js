uniform sampler2D u_image;
uniform vec4 u_unpack;
uniform float u_colormap_scale;
uniform float u_elevation_start;
uniform sampler2D u_colormap;
in vec2 v_pos;

float getElevation(vec2 coord) {
    // Convert encoded elevation value to meters
    vec4 data = texture(u_image, coord) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

void main() {
    float el = getElevation(v_pos);
    float x = (el - u_elevation_start)*u_colormap_scale;
    fragColor = texture(u_colormap, vec2(x, 0));

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
