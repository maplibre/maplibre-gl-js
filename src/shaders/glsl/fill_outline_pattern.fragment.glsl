
uniform vec2 u_texsize;
uniform sampler2D u_image;
uniform float u_fade;

in vec2 v_pos_a;
in vec2 v_pos_b;
in vec2 v_pos;
#ifdef GLOBE
in float v_depth;
#endif

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to
#pragma mapbox: define highp vec4 color

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern_from
    #pragma mapbox: initialize mediump vec4 pattern_to
    #pragma mapbox: initialize highp vec4 color

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

    // find distance to outline for alpha interpolation

    float dist = length(v_pos - gl_FragCoord.xy);
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

#ifdef SDF_PATTERN
    highp float sdf_edge = (256.0 - 64.0) / 256.0;
    highp float sdf_gamma_a = fwidth(color1.a) * 0.5;
    highp float sdf_gamma_b = fwidth(color2.a) * 0.5;
    float sdf_alpha_a = smoothstep(sdf_edge - sdf_gamma_a, sdf_edge + sdf_gamma_a, color1.a);
    float sdf_alpha_b = smoothstep(sdf_edge - sdf_gamma_b, sdf_edge + sdf_gamma_b, color2.a);
    vec4 sdf_color_a = color * sdf_alpha_a;
    vec4 sdf_color_b = color * sdf_alpha_b;
    fragColor = mix(sdf_color_a, sdf_color_b, u_fade) * alpha * opacity;
#else
    fragColor = mix(color1, color2, u_fade) * alpha * opacity;
#endif

    #ifdef GLOBE
    if (v_depth > 1.0) {
        // See comment in fill_outline.fragment.glsl
        discard;
    }
    #endif

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
