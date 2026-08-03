uniform sampler2D u_image;
uniform float u_opacity;

#ifdef LAYER_BLEND
uniform sampler2D u_backdrop;
/** Pixel offset of the backdrop copy within the target, as the backdrop only covers the scissor box. */
uniform vec2 u_backdrop_offset;

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
#ifdef LAYER_BLEND_HSV_VALUE
    // Hue and saturation are both scale invariant in HSV, so rescaling the backdrop to the layer's
    // value keeps them without a round trip through HSV. A black backdrop has neither, and takes
    // the layer's value as grey, matching the `s = 0` guard in GDAL's `hsv-value`.
    float srcValue = max(max(src.r, src.g), src.b);
    float dstValue = max(max(dst.r, dst.g), dst.b);
    vec3 rescaled = dstValue > 0.0 ? dst.rgb * (srcValue / dstValue) : vec3(srcValue);
    co = (1.0 - dst.a) * src.rgb + (1.0 - src.a) * dst.rgb + dst.a * rescaled;
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
