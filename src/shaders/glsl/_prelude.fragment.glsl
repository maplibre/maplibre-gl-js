#ifdef GL_ES
precision mediump float;
#else

#if !defined(lowp)
#define lowp
#endif

#if !defined(mediump)
#define mediump
#endif

#if !defined(highp)
#define highp
#endif

#endif

out highp vec4 fragColor;

layout(std140) uniform ProjectionUBO {
    highp mat4 u_projection_matrix;
    highp mat4 u_projection_fallback_matrix;
    highp vec4 u_projection_tile_mercator_coords;
    highp vec4 u_projection_clipping_plane;
    highp vec4 u_projection_tile_origin;
    highp vec2 u_projection_tile_origin_position;
    highp float u_projection_transition;
    highp int u_projection_clip_antimeridian;
};
layout(std140) uniform FrameUBO {
    highp vec2 u_units_to_pixels;
    highp vec2 u_world_size;
    highp float u_camera_to_center_distance;
    highp float u_symbol_fade_change;
    highp float u_aspect_ratio;
    highp float u_device_pixel_ratio;
    highp vec2 u_viewport_size;
    highp vec2 u_pixel_extrude_scale;
    highp float u_pitch;
};

#ifdef ROUNDED_CORNERS
in highp vec2 v_rounded_pos;
in highp vec4 v_rounded_circle0;
in highp vec4 v_rounded_circle1;
in highp vec4 v_rounded_circle2;
in highp vec4 v_rounded_bisector01;
in highp vec3 v_rounded_bisector2_side;

// Folds one corner into the signed distance that `rounded_corner_coverage` builds, which is negative
// where the fragment is kept. The corner first claims the area beyond the chord between its arc's
// ends, then gives back what lies inside its circle, so only the sliver between the arc and the corner
// is cut away.
highp float cut_rounded_corner(highp float distance, highp vec4 circle, highp vec2 bisector) {
    if (circle.z <= 0.0) return distance;
    highp vec2 fromCentre = v_rounded_pos - circle.xy;
    highp float beyondChord = dot(fromCentre, -bisector) - circle.w;
    return min(max(distance, beyondChord), length(fromCentre) - circle.z);
}

// Returns how much of the fragment the rounded corners of its triangle leave drawn, from 0.0 to 1.0,
// fading over a pixel along the arcs. A triangle that only draws the area a concave corner's arc adds
// keeps the sliver that the same test cuts away from a convex corner.
highp float rounded_corner_coverage() {
    highp float distance = -1.0;
    distance = cut_rounded_corner(distance, v_rounded_circle0, v_rounded_bisector01.xy);
    distance = cut_rounded_corner(distance, v_rounded_circle1, v_rounded_bisector01.zw);
    distance = cut_rounded_corner(distance, v_rounded_circle2, v_rounded_bisector2_side.xy);
    highp float outside = distance * v_rounded_bisector2_side.z;
    return clamp(0.5 - outside / max(fwidth(outside), 1e-6), 0.0, 1.0);
}
#endif
