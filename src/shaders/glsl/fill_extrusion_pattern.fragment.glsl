uniform vec2 u_texsize;
uniform float u_fade;

uniform sampler2D u_image;

in vec2 v_pos_a;
in vec2 v_pos_b;
in vec4 v_lighting;

#ifdef WALL_AMBIENT_OCCLUSION
    uniform lowp float u_ao_wall_intensity;
    in vec3 v_lighting_without_ambient;
    in highp float v_ao_wall_height;
#endif

#pragma maplibre: define lowp float base
#pragma maplibre: define lowp float height
#pragma maplibre: define lowp vec4 pattern_from
#pragma maplibre: define lowp vec4 pattern_to
#pragma maplibre: define lowp float pixel_ratio_from
#pragma maplibre: define lowp float pixel_ratio_to

void main() {
    #pragma maplibre: initialize lowp float base
    #pragma maplibre: initialize lowp float height
    #pragma maplibre: initialize mediump vec4 pattern_from
    #pragma maplibre: initialize mediump vec4 pattern_to
    #pragma maplibre: initialize lowp float pixel_ratio_from
    #pragma maplibre: initialize lowp float pixel_ratio_to

    vec2 pattern_tl_a = pattern_from.xy;
    vec2 pattern_br_a = pattern_from.zw;
    vec2 pattern_tl_b = pattern_to.xy;
    vec2 pattern_br_b = pattern_to.zw;

    vec2 imagecoord = mod(v_pos_a, 1.0);
    vec2 pos = mix(pattern_tl_a / u_texsize, pattern_br_a / u_texsize, imagecoord);
    vec4 color1 = texture(u_image, pos);

    vec2 imagecoord_b = mod(v_pos_b, 1.0);
    vec2 pos2 = mix(pattern_tl_b / u_texsize, pattern_br_b / u_texsize, imagecoord_b);
    vec4 color2 = texture(u_image, pos2);

    vec4 mixedColor = mix(color1, color2, u_fade);

    vec4 lighting = v_lighting;

    #ifdef WALL_AMBIENT_OCCLUSION
        // (1 - s)^1.5 approximates the share of ambient light the ground blocks within the radius.
        float s = clamp(v_ao_wall_height, 0.0, 1.0);
        float occlusion = u_ao_wall_intensity * (1.0 - s) * sqrt(1.0 - s);
        lighting.rgb = mix(v_lighting.rgb, v_lighting_without_ambient, occlusion);
    #endif

    fragColor = mixedColor * lighting;

    #ifdef OVERDRAW_INSPECTOR
        fragColor = vec4(1.0);
    #endif
}
