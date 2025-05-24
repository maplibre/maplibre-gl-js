#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_image;
uniform vec4 u_unpack;
uniform sampler2D u_elevation_stops;
uniform sampler2D u_color_stops;
uniform float u_opacity;

in vec2 v_pos;

float getElevation(vec2 coord) {
    // Convert encoded elevation value to meters
    vec4 data = texture(u_image, coord) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

float getElevationStop(int stop) {
    // Convert encoded elevation value to meters
    float x = (float(stop)+0.5)/float(textureSize(u_elevation_stops, 0)[0]);
    vec4 data = texture(u_elevation_stops, vec2(x, 0)) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

void main() {
    float el = getElevation(v_pos);

    int num_elevation_stops = textureSize(u_elevation_stops, 0)[0];

    // Binary search
    int r = (num_elevation_stops - 1);
    int l = 0;
    float el_l = getElevationStop(l);
    float el_r = getElevationStop(r);
    while(r - l > 1)
    {
        int m = (r + l) / 2;
        float el_m = getElevationStop(m);
        if(el < el_m)
        {
            r = m;
            el_r = el_m;
        }
        else
        {
            l = m;
            el_l = el_m;
        }
    }

    float x = (float(l) + (el - el_l) / (el_r - el_l) + 0.5)/float(textureSize(u_color_stops, 0)[0]);
    fragColor = u_opacity*texture(u_color_stops, vec2(x, 0));

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
