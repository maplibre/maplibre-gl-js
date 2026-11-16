uniform lowp float u_ao_ground_intensity;
uniform highp float u_ao_depth_band;

in highp float v_along;
in highp float v_length;
in highp float v_across;
in highp float v_reach;

// 256 occlusion levels in a 24-bit depth buffer.
const highp float DEPTH_STEP = 1.0 / 65536.0;

void main() {
    highp float beyond = max(-v_along, 0.0) + max(v_along - v_length, 0.0);
    highp float wallDistance = length(vec2(beyond, max(v_across, 0.0)));
    if (wallDistance >= v_reach) {
        discard;
    }

    // highp: in mediump, sqrt(1 - s) can be NaN just inside the reach.
    highp float s = wallDistance / v_reach;
    highp float occlusion = u_ao_ground_intensity * (1.0 - s) * sqrt(1.0 - s);

    // The strongest strip ends up nearest; no strip is nearer than the ground.
    gl_FragDepth = gl_FragCoord.z + DEPTH_STEP * (u_ao_depth_band + 1.0 - occlusion);
    fragColor = vec4(0.0, 0.0, 0.0, occlusion);

    #ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
    #endif
}
