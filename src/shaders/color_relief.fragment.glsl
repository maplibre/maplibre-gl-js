uniform sampler2D u_image;
uniform vec4 u_unpack;
uniform float u_elevation_stops[NUM_ELEVATION_STOPS];
uniform vec4 u_color_stops[NUM_ELEVATION_STOPS];

in vec2 v_pos;

float getElevation(vec2 coord) {
    // Convert encoded elevation value to meters
    vec4 data = texture(u_image, coord) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

void main() {
    float el = getElevation(v_pos);

    // Binary search
    int r = (NUM_ELEVATION_STOPS - 1);
    int l = 0;
    while(r - l > 1)
    {
        int m = (r + l) / 2;
        if(el < u_elevation_stops[m])
        {
            r = m;
        }
        else
        {
            l = m;
        }
    }
    fragColor = mix(u_color_stops[l],
        u_color_stops[r],
        clamp((el - u_elevation_stops[l])/(u_elevation_stops[r]-u_elevation_stops[l]), 0.0, 1.0));

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
