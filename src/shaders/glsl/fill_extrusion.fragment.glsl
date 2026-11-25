in vec4 v_color;

#ifdef WALL_AMBIENT_OCCLUSION
    uniform lowp float u_ao_wall_intensity;
    in vec3 v_color_without_ambient;
    in mediump float v_ao_wall_height;
#endif

void main() {
    fragColor = v_color;

    #ifdef WALL_AMBIENT_OCCLUSION
        // (1 - s)^1.5 approximates the share of ambient light the ground blocks within the radius.
        if (v_ao_wall_height < 1.0) {
            float oneMinusS = 1.0 - max(v_ao_wall_height, 0.0);
            float occlusion = u_ao_wall_intensity * oneMinusS * sqrt(oneMinusS);
            fragColor.rgb = mix(v_color.rgb, v_color_without_ambient, occlusion);
        }
    #endif

    #ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
    #endif
}
