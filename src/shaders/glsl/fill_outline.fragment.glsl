in vec2 v_pos;
#ifdef GLOBE
in float v_depth;
#endif

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity

    float dist = length(v_pos - gl_FragCoord.xy);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    fragColor = outline_color * (alpha * opacity);

    #ifdef GLOBE
    if (v_depth > 1.0) {
        // Hides polygon outlines that are visible on the backfacing side of the globe.
        // This is needed, because some hardware seems to apply glDepthRange first and then apply clipping, which is the wrong order.
        // Other layers fix this by using backface culling, but that is unavailable for line primitives, so we clip the lines in software here.
        discard;
    }
    #endif

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
