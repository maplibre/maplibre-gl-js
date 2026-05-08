
uniform vec2 u_texsize;
uniform sampler2D u_image;
uniform float u_fade;
uniform lowp float u_device_pixel_ratio;

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
#pragma mapbox: define highp vec4 pattern_background_color

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern_from
    #pragma mapbox: initialize mediump vec4 pattern_to
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize highp vec4 pattern_background_color

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
    float sdf_dist_a = color1.a;
    float sdf_dist_b = color2.a;
    float sdf_dist = mix(sdf_dist_a, sdf_dist_b, u_fade);
    highp float sdf_edge = (256.0 - 64.0) / 256.0;
    highp float sdf_gamma = 0.105 / u_device_pixel_ratio;
    float sdf_alpha = smoothstep(sdf_edge - sdf_gamma, sdf_edge + sdf_gamma, sdf_dist);
    fragColor = mix(pattern_background_color, color, sdf_alpha) * alpha * opacity;
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
