uniform sampler2D u_image;
uniform float u_opacity;

#ifdef LAYER_BLEND
uniform sampler2D u_backdrop;
/** Pixel offset of the backdrop copy within the target, as the backdrop only covers the scissor box. */
uniform vec2 u_backdrop_offset;

#ifdef LAYER_BLEND_NONSEPARABLE
/** Perceptual luminosity, per the non-separable blend modes of the W3C compositing spec. */
float lum(vec3 c) {
    return dot(c, vec3(0.3, 0.59, 0.11));
}

/** Pulls a colour back into gamut around its luminosity, leaving that luminosity unchanged. */
vec3 clipColor(vec3 c) {
    float l = lum(c);
    float n = min(min(c.r, c.g), c.b);
    float x = max(max(c.r, c.g), c.b);
    // Shifting to a luminosity in [0, 1] leaves l > n whenever n < 0, and l < x whenever x > 1.
    if (n < 0.0) c = l + (c - l) * l / (l - n);
    if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
    return c;
}

/** Re-lights a colour to the given luminosity, keeping its hue and saturation. */
vec3 setLum(vec3 c, float l) {
    return clipColor(c + (l - lum(c)));
}
#endif

/** Blending in premultiplied space, for the modes no fixed-function blend function can express. */
vec4 composite(vec4 src, vec4 dst) {
    vec3 co = vec3(0.0);
#ifdef LAYER_BLEND_MULTIPLY
    co = (1.0 - dst.a) * src.rgb + (1.0 - src.a) * dst.rgb + src.rgb * dst.rgb;
#endif
#ifdef LAYER_BLEND_OVERLAY
    vec3 cond = step(dst.a, 2.0 * dst.rgb);
    vec3 case1 = (1.0 - dst.a) * src.rgb + (1.0 - src.a) * dst.rgb + 2.0 * dst.rgb * src.rgb;
    vec3 case2 = src.rgb + dst.rgb + dst.a * src.rgb + src.a * dst.rgb - vec3(src.a * dst.a) - 2.0 * dst.rgb * src.rgb;
    co = mix(case1, case2, cond);
#endif
#ifdef LAYER_BLEND_NONSEPARABLE
    // The W3C non-separable blend functions are defined on unpremultiplied colours.
    vec3 cs = src.rgb / src.a;
    vec3 cb = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
#ifdef LAYER_BLEND_COLOR
    vec3 blended = setLum(cs, lum(cb));
#else
    vec3 blended = setLum(cb, lum(cs));
#endif
    co = (1.0 - dst.a) * src.rgb + (1.0 - src.a) * dst.rgb + src.a * dst.a * blended;
#endif
    return vec4(co, src.a + dst.a * (1.0 - src.a));
}
#endif

void main() {
    // The quad covers the target 1:1 from the viewport origin, so the pixel coordinate is also the texel coordinate.
    ivec2 texel = ivec2(gl_FragCoord.xy);
    vec4 src = texelFetch(u_image, texel, 0) * u_opacity;

    // Discard empty fragments to optimize fill rate and avoid reading the backdrop
    if (src.a == 0.0) {
        discard;
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(0.0);
#else
#ifdef LAYER_BLEND
    vec4 dst = texelFetch(u_backdrop, texel - ivec2(u_backdrop_offset), 0);
    fragColor = composite(src, dst);
#else
    fragColor = src;
#endif
#endif
}
