// floor(127 / 2) == 63.0
// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is
// stored in a byte (-128..127). we scale regular normals up to length 63, but
// there are also "special" normals that have a bigger length (of up to 126 in
// this case).
// #define scale 63.0
#define scale 0.015873016

// We scale the distance before adding it to the buffers so that we can store
// long distances for long segments. Use this value to unscale the distance.
#define LINE_DISTANCE_SCALE 2.0

layout(location = 0) in ivec2 a_pos_normal;
layout(location = 1) in uvec4 a_data;
#ifdef TAPER
// The per-vertex value bound from the line bucket's taper buffer (see
// `line_taper_attributes.ts`): either the normalized line position (0 = start,
// 1 = end) for `line-width-start`/`line-width-end`, or the absolute width at the
// vertex for `line-widths`. No explicit layout location is assigned: it is
// linked after the data-driven paint attributes.
in float a_taper;
#endif

uniform vec2 u_translation;
uniform mediump float u_ratio;
out vec2 v_normal;
#ifdef TAPER
out vec2 v_width2;
#else
flat out vec2 v_width2;
#endif
out float v_linesofar;
out float v_gamma_scale;
flat out float v_width;
#ifdef GLOBE
out float v_depth;
#endif

#pragma maplibre: define lowp float blur
#pragma maplibre: define lowp float opacity
#pragma maplibre: define lowp float offset
#pragma maplibre: define mediump float gapwidth
#pragma maplibre: define mediump float width
#ifdef TAPER
#pragma maplibre: define mediump float width_start
#pragma maplibre: define mediump float width_end
#endif
#pragma maplibre: define lowp float floorwidth
#pragma maplibre: define lowp vec4 pattern_from
#pragma maplibre: define lowp vec4 pattern_to
#pragma maplibre: define lowp float pixel_ratio_from
#pragma maplibre: define lowp float pixel_ratio_to

void main() {
    #pragma maplibre: initialize lowp float blur
    #pragma maplibre: initialize lowp float opacity
    #pragma maplibre: initialize lowp float offset
    #pragma maplibre: initialize mediump float gapwidth
    #pragma maplibre: initialize mediump float width
    #pragma maplibre: initialize lowp float floorwidth
    #pragma maplibre: initialize mediump vec4 pattern_from
    #pragma maplibre: initialize mediump vec4 pattern_to
    #pragma maplibre: initialize lowp float pixel_ratio_from
    #pragma maplibre: initialize lowp float pixel_ratio_to

    // Move vertex outside clip space to discard triangle when opacity is negligible
    if (opacity < 0.01) {
        gl_Position = vec4(-2.0, -2.0, -2.0, 1.0);
        return;
    }

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;

    vec2 a_extrude = vec2(ivec2(a_data.xy) - 128);
    float a_direction = float(int(a_data.z & 3u) - 1);
    float a_linesofar = float((a_data.z >> 2u) + a_data.w * 64u) * LINE_DISTANCE_SCALE;
    // float tileRatio = u_scale.x;
    vec2 pos = vec2(a_pos_normal >> 1);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    mediump vec2 normal = vec2(a_pos_normal & 1);
    normal.y = normal.y * 2.0 - 1.0;
    v_normal = normal;

#ifdef TAPER
#ifdef VARIABLE_WIDTH
    // The per-vertex buffer already holds the absolute width at this vertex
    // (`line-widths`), so it is used directly.
    width = a_taper;
#endif
#ifdef VARIABLE_WIDTH_FACTOR
    // The per-vertex buffer holds a multiplier of the zoom-composited `line-width`
    // (`line-width-factors`). Plain nested #ifdef/#ifndef are used instead of
    // `#elif defined(...)`: the shader generator's minifier strips newlines after
    // closing parens in preprocessor directives.
    width = width * a_taper;
#endif
#ifndef VARIABLE_WIDTH
#ifndef VARIABLE_WIDTH_FACTOR

    // The start/end widths are per-feature values (uniform or attribute, supplied by
    // the `#pragma` mechanism below). An unset property (default -1) falls back to
    // the regular `line-width`, so setting only one side tapers from/towards it.
    #pragma maplibre: initialize mediump float width_start
    #pragma maplibre: initialize mediump float width_end
    float wStart = width_start >= 0.0 ? width_start : width;
    float wEnd = width_end >= 0.0 ? width_end : width;
    width = mix(wStart, wEnd, a_taper);
#endif
#endif
#endif

    // these transformations used to be applied in the JS and native code bases.
    // moved them into the shader for clarity and simplicity.
    gapwidth = gapwidth / 2.0;
    float halfwidth = width / 2.0;
    offset = -1.0 * offset;

    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);
    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + (halfwidth == 0.0 ? 0.0 : ANTIALIASING);

    // Scale the extrusion vector down to a normal and then up by the line width
    // of this vertex.
    mediump vec2 dist = outset * a_extrude * scale;

    // Calculate the offset when drawing a line that is to the side of the actual line.
    // We do this by creating a vector that points towards the extrude, but rotate
    // it when we're drawing round end points (a_direction = -1 or 1) since their
    // extrude vector points in another direction.
    mediump float u = 0.5 * a_direction;
    mediump float t = 1.0 - abs(u);
    mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);

    float adjustedThickness = projectLineThickness(pos.y);
    vec4 projected_no_extrude = projectTile(pos + offset2 / u_ratio * adjustedThickness + u_translation);
    vec4 projected_with_extrude = projectTile(pos + offset2 / u_ratio * adjustedThickness + u_translation + dist / u_ratio * adjustedThickness);
    gl_Position = projected_with_extrude;
    #ifdef GLOBE
    v_depth = gl_Position.z / gl_Position.w;
    #endif

    // calculate how much the perspective view squishes or stretches the extrude
    #ifdef TERRAIN3D
        v_gamma_scale = 1.0; // not needed, because this is done automatically via the mesh
    #else
        float extrude_length_without_perspective = length(dist);
        float extrude_length_with_perspective = length((projected_with_extrude.xy - projected_no_extrude.xy) / projected_with_extrude.w * u_units_to_pixels);
        v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;
    #endif

    v_linesofar = a_linesofar;
    v_width2 = vec2(outset, inset);
    v_width = floorwidth;
}
