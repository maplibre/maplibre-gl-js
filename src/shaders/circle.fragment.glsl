in vec3 v_data;
in float v_visibility;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize mediump float radius
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize highp vec4 stroke_color
    #pragma mapbox: initialize mediump float stroke_width
    #pragma mapbox: initialize lowp float stroke_opacity

    vec2 extrude = v_data.xy;
    float extrude_length = length(extrude);
    float antialiased_blur = v_data.z;

    float opacity_t = smoothstep(0.0, antialiased_blur, extrude_length - 1.0);

    float color_t = stroke_width < 0.01 ? 0.0 : smoothstep(antialiased_blur, 0.0, extrude_length - radius / (radius + stroke_width));

    fragColor = v_visibility * opacity_t * mix(color * opacity, stroke_color * stroke_opacity, color_t);

    const float epsilon = 0.5 / 255.0;
    if (fragColor.r < epsilon && fragColor.g < epsilon && fragColor.b < epsilon && fragColor.a < epsilon) {
        // If this pixel wouldn't affect the framebuffer contents in any way, discard it for performance.
        // This disables early-Z test, but that is likely irrelevant for circles, performance wise.
        // But many circles might put a lot of load on the blending and framebuffer output hardware due to using a lot of pixels,
        // and this discard will help in that case.
        // Also, each circle will at most use ~3/4 of its rasterized pixels, due to being a circle approximated with a square,
        // this will discard the unused 1/4.
        // Also note that this discard happens even if overdraw inspection is enabled - because discarded pixels never contribute to overdraw.
        discard;
    }

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
