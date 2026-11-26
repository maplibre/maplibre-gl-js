uniform sampler2D u_image;
uniform highp vec2 u_inv_size;

#ifndef COMPOSITE
in highp float v_along;
in highp float v_length;
in highp float v_across;
in lowp float v_intensity;
#endif

void main() {
#ifdef COMPOSITE
    fragColor = vec4(0.0, 0.0, 0.0, texture(u_image, gl_FragCoord.xy * u_inv_size).r);

    #ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
    #endif
#else
    highp float beyond = max(-v_along, 0.0) + max(v_along - v_length, 0.0);
    highp float s = length(vec2(beyond, max(v_across, 0.0)));
    highp float oneMinusS = max(1.0 - s, 0.0);
    fragColor = vec4(v_intensity * oneMinusS * sqrt(oneMinusS));
#endif
}
