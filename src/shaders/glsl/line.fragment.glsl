uniform lowp float u_device_pixel_ratio;

flat in vec2 v_width2;
in vec2 v_normal;
in float v_gamma_scale;
#ifdef GLOBE
in float v_depth;
#endif

#pragma maplibre: define highp vec4 color
#pragma maplibre: define lowp float blur
#pragma maplibre: define lowp float opacity

void main() {
    #pragma maplibre: initialize highp vec4 color
    #pragma maplibre: initialize lowp float blur
    #pragma maplibre: initialize lowp float opacity

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / u_device_pixel_ratio) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    fragColor = color * (alpha * opacity);

    #ifdef GLOBE
    if (v_depth > 1.0) {
        // Hides lines that are visible on the backfacing side of the globe.
        // This is needed, because some hardware seems to apply glDepthRange first and then apply clipping, which is the wrong order.
        // Other layers fix this by using backface culling, but the line layer's geometry (actually drawn as polygons) is complex and partly resolved in the shader,
        // so we can't easily ensure that all triangles have the proper winding order in the vertex buffer creation step.
        // Thus we render line geometry without face culling, and clip the lines manually here.
        discard;
    }
    #endif

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
