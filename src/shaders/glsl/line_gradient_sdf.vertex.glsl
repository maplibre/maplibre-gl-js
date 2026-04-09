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

in vec2 a_pos_normal;
in vec4 a_data;
in float a_uv_x;
in float a_split_index;

uniform vec2 u_translation;
uniform mediump float u_ratio;
uniform lowp float u_device_pixel_ratio;
uniform vec2 u_units_to_pixels;
uniform float u_image_height;
uniform float u_tileratio;
uniform float u_crossfade_from;
uniform float u_crossfade_to;
uniform float u_lineatlas_height;

out vec2 v_normal;
out vec2 v_width2;
out float v_gamma_scale;
out highp vec2 v_uv;
out vec2 v_tex_a;
out vec2 v_tex_b;
#ifdef GLOBE
out float v_depth;
#endif

#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define mediump float gapwidth
#pragma mapbox: define lowp float offset
#pragma mapbox: define mediump float width
#pragma mapbox: define lowp float floorwidth
#pragma mapbox: define mediump vec4 dasharray_from
#pragma mapbox: define mediump vec4 dasharray_to

void main() {
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump float gapwidth
    #pragma mapbox: initialize lowp float offset
    #pragma mapbox: initialize mediump float width
    #pragma mapbox: initialize lowp float floorwidth
    #pragma mapbox: initialize mediump vec4 dasharray_from
    #pragma mapbox: initialize mediump vec4 dasharray_to

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    float ANTIALIASING = 1.0 / u_device_pixel_ratio / 2.0;

    vec2 a_extrude = a_data.xy - 128.0;
    float a_direction = mod(a_data.z, 4.0) - 1.0;
    float a_linesofar = (floor(a_data.z / 4.0) + a_data.w * 64.0) * LINE_DISTANCE_SCALE;

    // Gradient UV computation
    float texel_height = 1.0 / u_image_height;
    float half_texel_height = 0.5 * texel_height;
    v_uv = vec2(a_uv_x, a_split_index * texel_height - half_texel_height);

    vec2 pos = floor(a_pos_normal * 0.5);

    // x is 1 if it's a round cap, 0 otherwise
    // y is 1 if the normal points up, and -1 if it points down
    // We store these in the least significant bit of a_pos_normal
    mediump vec2 normal = a_pos_normal - 2.0 * pos;
    normal.y = normal.y * 2.0 - 1.0;
    v_normal = normal;

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

    // Dash pattern texture coordinates
    float u_patternscale_a_x = u_tileratio / dasharray_from.w / u_crossfade_from;
    float u_patternscale_a_y = -dasharray_from.z / 2.0 / u_lineatlas_height;
    float u_patternscale_b_x = u_tileratio / dasharray_to.w / u_crossfade_to;
    float u_patternscale_b_y = -dasharray_to.z / 2.0 / u_lineatlas_height;

    v_tex_a = vec2(a_linesofar * u_patternscale_a_x / floorwidth, normal.y * u_patternscale_a_y + (float(dasharray_from.y) + 0.5) / u_lineatlas_height);
    v_tex_b = vec2(a_linesofar * u_patternscale_b_x / floorwidth, normal.y * u_patternscale_b_y + (float(dasharray_to.y) + 0.5) / u_lineatlas_height);
    v_width2 = vec2(outset, inset);
}
