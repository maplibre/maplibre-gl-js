uniform lowp float u_ao_ground_intensity;
uniform sampler2D u_image;

in highp float v_along;
in highp float v_length;
in highp float v_across;
in highp float v_reach;
in lowp float v_opacity;

void main() {
#ifdef COMPOSITE
    fragColor = vec4(0.0, 0.0, 0.0, texelFetch(u_image, ivec2(gl_FragCoord.xy), 0).r);

    #ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
    #endif
#else
    highp float beyond = max(-v_along, 0.0) + max(v_along - v_length, 0.0);
    highp float wallDistance = length(vec2(beyond, max(v_across, 0.0)));
    if (wallDistance >= v_reach) {
        discard;
    }

    // highp: in mediump, sqrt(1 - s) can be NaN just inside the reach.
    highp float s = wallDistance / v_reach;
    fragColor = vec4(u_ao_ground_intensity * v_opacity * (1.0 - s) * sqrt(1.0 - s));
#endif
}
