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

// How deep into a cut a fragment that no corner cuts lies: far enough on the kept side that it is
// drawn in full at any zoom.
const highp float ROUNDED_CORNER_UNCUT = -1e6;

// Folds one corner into the cut depth that `rounded_corner_coverage` builds, in tile units, which is
// positive where a corner cuts the fragment away. A corner cuts the sliver between its arc and the
// corner itself: the part of its angle beyond the chord between the arc's ends that lies outside its
// circle. Outside the corner's angle it cuts nothing, because a triangle that the corner reaches can
// also cover the polygon beyond the corner's edges, where the chord's half-plane extends.
highp float cut_rounded_corner(highp float depth, highp vec4 circle, highp vec2 bisector) {
    if (circle.z <= 0.0) return depth;
    highp float sinHalfAngle = circle.w / circle.z;
    highp float cosHalfAngle = sqrt(max(1.0 - sinHalfAngle * sinHalfAngle, 0.0));
    highp vec2 fromCentre = v_rounded_pos - circle.xy;
    highp vec2 fromCorner = fromCentre + bisector * (circle.z / sinHalfAngle);
    highp float across = abs(fromCorner.x * bisector.y - fromCorner.y * bisector.x);
    if (dot(fromCorner, bisector) * sinHalfAngle < across * cosHalfAngle) return depth;

    highp float beyondChord = -dot(fromCentre, bisector) - circle.w;
    return max(depth, min(beyondChord, length(fromCentre) - circle.z));
}

// Returns how much of the fragment the rounded corners of its triangle leave drawn, from 0.0 to 1.0,
// fading over a pixel along the arcs. The width of that pixel is measured from the position rather
// than from the cut depth, which jumps at the edges of a corner's angle. A triangle that only draws
// the area a concave corner's arc adds keeps the sliver that the same test cuts away from a convex
// corner.
highp float rounded_corner_coverage() {
    highp float depth = ROUNDED_CORNER_UNCUT;
    depth = cut_rounded_corner(depth, v_rounded_circle0, v_rounded_bisector01.xy);
    depth = cut_rounded_corner(depth, v_rounded_circle1, v_rounded_bisector01.zw);
    depth = cut_rounded_corner(depth, v_rounded_circle2, v_rounded_bisector2_side.xy);
    highp float pixelSize = 0.7071 * length(fwidth(v_rounded_pos));
    return clamp(0.5 - depth * v_rounded_bisector2_side.z / max(pixelSize, 1e-6), 0.0, 1.0);
}

// Whether one corner leaves an outline fragment drawn: not between the corner and the points where its
// arc meets its edges, but beyond them. The corner and those points follow from the circle: the corner
// lies `radius / sin(half angle)` back along the bisector from the centre, and the arc meets each edge
// `radius * cos / sin` of the half angle from the corner.
bool outline_beyond_arc(highp vec4 circle, highp vec2 bisector) {
    if (circle.z <= 0.0) return true;
    highp float sinHalfAngle = circle.w / circle.z;
    highp float cosHalfAngle = sqrt(max(1.0 - sinHalfAngle * sinHalfAngle, 0.0));
    highp vec2 corner = circle.xy - bisector * (circle.z / sinHalfAngle);
    highp float arcStart = circle.z * cosHalfAngle / sinHalfAngle;
    return length(v_rounded_pos - corner) >= arcStart;
}

// Whether the rounded corners along an outline fragment's segment leave it drawn. The outline traces
// the polygon's edges as they are, so near a rounded corner it stops where the arc begins and leaves
// the arc, and its antialiasing, to the fill. The stop is a hard one rather than a fade: along a line
// primitive the screen-space derivatives a fade is measured with are unreliable on some GPUs, and leave
// the hidden part of the line half drawn.
bool rounded_outline_drawn() {
    return outline_beyond_arc(v_rounded_circle0, v_rounded_bisector01.xy) &&
        outline_beyond_arc(v_rounded_circle1, v_rounded_bisector01.zw) &&
        outline_beyond_arc(v_rounded_circle2, v_rounded_bisector2_side.xy);
}
#endif
