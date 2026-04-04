uniform lowp float u_device_pixel_ratio;
uniform sampler2D u_image;
uniform sampler2D u_image_dash;
uniform float u_mix;
uniform lowp float u_lineatlas_width;

in vec2 v_normal;
in vec2 v_width2;
in vec2 v_tex_a;
in vec2 v_tex_b;
in float v_gamma_scale;
in highp vec2 v_uv;
#ifdef GLOBE
in float v_depth;
#endif

#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define mediump float width
#pragma mapbox: define lowp float floorwidth
#pragma mapbox: define mediump vec4 dasharray_from
#pragma mapbox: define mediump vec4 dasharray_to

void main() {
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump float width
    #pragma mapbox: initialize lowp float floorwidth
    #pragma mapbox: initialize mediump vec4 dasharray_from
    #pragma mapbox: initialize mediump vec4 dasharray_to

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    // Sample gradient color
    vec4 color = texture(u_image, v_uv);

    // Sample dash pattern from SDF atlas
    float sdfdist_a = texture(u_image_dash, v_tex_a).a;
    float sdfdist_b = texture(u_image_dash, v_tex_b).a;
    float sdfdist = mix(sdfdist_a, sdfdist_b, u_mix);
    float sdfgamma = (u_lineatlas_width / 256.0) / min(dasharray_from.w, dasharray_to.w);
    float dash_alpha = smoothstep(0.5 - sdfgamma / floorwidth, 0.5 + sdfgamma / floorwidth, sdfdist);

    // Combine gradient color with dash pattern
    fragColor = color * (alpha * dash_alpha * opacity);

    #ifdef GLOBE
    if (v_depth > 1.0) {
        // See comment in line.fragment.glsl
        discard;
    }
    #endif

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
