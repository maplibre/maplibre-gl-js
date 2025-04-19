uniform sampler2D u_image;
uniform vec4 u_unpack;
uniform float u_colormap_scale;
uniform float u_elevation_start;
uniform sampler2D u_colormap;
uniform float u_elevation_stops[17];
uniform vec4 u_color_stops[17];
uniform int u_colormap_length;

in vec2 v_pos;

float getElevation(vec2 coord) {
    // Convert encoded elevation value to meters
    vec4 data = texture(u_image, coord) * 255.0;
    data.a = -1.0;
    return dot(data, u_unpack);
}

void main() {
    float el = getElevation(v_pos);

    // Naive lookup table
    /*fragColor = u_color_stops[0];
    for(int i = 0; i < u_colormap_length - 1; i++)
    {
        if(el >= u_elevation_stops[i] && el < u_elevation_stops[i+1])
        {
            fragColor = mix(u_color_stops[i],
                u_color_stops[i+1],
                (el - u_elevation_stops[i])/(u_elevation_stops[i+1]-u_elevation_stops[i])); 
        }
    }*/

    // Binary search
    int r = (u_colormap_length - 1);
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
    

    // Texture interpolation
    //float x = (el - u_elevation_start)*u_colormap_scale;
    //fragColor = texture(u_colormap, vec2(x, 0));

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
