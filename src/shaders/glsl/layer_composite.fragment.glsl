uniform sampler2D u_image;
uniform float u_opacity;

in vec2 v_pos;

#ifdef LAYER_BLEND
uniform sampler2D u_backdrop;

// Separable and non-separable blending directly in premultiplied space.
vec4 composite(vec4 src, vec4 dst) {
    vec3 co = vec3(0.0);
#ifdef LAYER_BLEND_MULTIPLY
    co = (1.0 - dst.a) * src.rgb + (1.0 - src.a) * dst.rgb + src.rgb * dst.rgb;
#endif
#ifdef LAYER_BLEND_SCREEN
    co = src.rgb + dst.rgb - src.rgb * dst.rgb;
#endif
#ifdef LAYER_BLEND_OVERLAY
    vec3 cond = step(dst.a, 2.0 * dst.rgb);
    vec3 case1 = (1.0 - dst.a) * src.rgb + (1.0 - src.a) * dst.rgb + 2.0 * dst.rgb * src.rgb;
    vec3 case2 = src.rgb + dst.rgb + dst.a * src.rgb + src.a * dst.rgb - vec3(src.a * dst.a) - 2.0 * dst.rgb * src.rgb;
    co = mix(case1, case2, cond);
#endif
    return vec4(co, src.a + dst.a * (1.0 - src.a));
}
#endif

void main() {
    vec4 src = texture(u_image, v_pos) * u_opacity;

    // Discard empty fragments to optimize fill rate and avoid reading the backdrop
    if (src.a == 0.0) {
        discard;
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(0.0);
#else
#ifdef LAYER_BLEND
    vec4 dst = texture(u_backdrop, v_pos);
    fragColor = composite(src, dst);
#else
    fragColor = src;
#endif
#endif
}

