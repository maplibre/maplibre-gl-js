#ifdef GL_ES
    precision highp float;
#endif
uniform vec2 u_texsize;
uniform float u_fade;
uniform bool u_sdf_pattern;

uniform sampler2D u_image;

in vec2 v_pos_a;
in vec2 v_pos_b;

#pragma maplibre: define lowp float opacity
#pragma maplibre: define highp vec4 color
#pragma maplibre: define lowp vec4 pattern_from
#pragma maplibre: define lowp vec4 pattern_to

void main() {
    #pragma maplibre: initialize lowp float opacity
    #pragma maplibre: initialize highp vec4 color
    #pragma maplibre: initialize mediump vec4 pattern_from
    #pragma maplibre: initialize mediump vec4 pattern_to

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

    if (u_sdf_pattern) {
        highp float sdf_edge = (256.0 - 64.0) / 256.0;
        highp float sdf_gamma_a = max(fwidth(color1.a) * 0.5, 1.0 / 255.0 / 16.0);
        highp float sdf_gamma_b = max(fwidth(color2.a) * 0.5, 1.0 / 255.0 / 16.0);
        float sdf_alpha_a = smoothstep(sdf_edge - sdf_gamma_a, sdf_edge + sdf_gamma_a, color1.a);
        float sdf_alpha_b = smoothstep(sdf_edge - sdf_gamma_b, sdf_edge + sdf_gamma_b, color2.a);
        fragColor = mix(color * sdf_alpha_a, color * sdf_alpha_b, u_fade) * opacity;
    } else {
        fragColor = mix(color1, color2, u_fade) * opacity;
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
