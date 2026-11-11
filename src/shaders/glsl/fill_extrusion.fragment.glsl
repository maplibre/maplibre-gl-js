in vec4 v_color;

#ifdef WALL_AMBIENT_OCCLUSION
    uniform lowp float u_ao_wall_intensity;
    in vec3 v_color_without_ambient;
    in highp float v_ao_wall_height;
#endif

void main() {
    fragColor = v_color;

    #ifdef WALL_AMBIENT_OCCLUSION
        // (1 - s)^1.5 approximates the share of ambient light the ground blocks within the radius.
        float s = clamp(v_ao_wall_height, 0.0, 1.0);
        float occlusion = u_ao_wall_intensity * (1.0 - s) * sqrt(1.0 - s);
        fragColor.rgb = mix(v_color.rgb, v_color_without_ambient, occlusion);
    #endif

    #ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
    #endif
}
