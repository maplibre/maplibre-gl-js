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

// 1.0 when the arcs draw the layer's `fill-outline-color` along them, as the outline does along the
// polygon's straight edges, and 0.0 when they do not.
uniform lowp float u_rounded_outline;

// How deep into a cut a fragment that no corner cuts lies: far enough on the kept side that it is
// drawn in full at any zoom.
const highp float ROUNDED_CORNER_UNCUT = -1e6;

// Whether the fragment lies within the angle at the corner that a circle rounds. The corner lies
// `radius / sin(half angle)` back along the bisector from the circle's centre.
bool within_corner_angle(highp vec2 fromCentre, highp vec4 circle, highp vec2 bisector) {
    highp float sinHalfAngle = circle.w / circle.z;
    highp float cosHalfAngle = sqrt(max(1.0 - sinHalfAngle * sinHalfAngle, 0.0));
    highp vec2 fromCorner = fromCentre + bisector * (circle.z / sinHalfAngle);
    highp float across = abs(fromCorner.x * bisector.y - fromCorner.y * bisector.x);
    return dot(fromCorner, bisector) * sinHalfAngle >= across * cosHalfAngle;
}

// How far the fragment lies beyond the chord between the ends of a corner's arc, towards the corner,
// in tile units. The arc is the part of the circle beyond it.
highp float beyond_chord(highp vec2 fromCentre, highp vec4 circle, highp vec2 bisector) {
    return -dot(fromCentre, bisector) - circle.w;
}

// Folds one corner into the cut depth that `rounded_corner_coverage` builds, in tile units, which is
// positive where a corner cuts the fragment away. A corner cuts the sliver between its arc and the
// corner itself: the part of its angle beyond the chord that lies outside its circle. Outside the
// corner's angle it cuts nothing, because a triangle that the corner reaches can also cover the polygon
// beyond the corner's edges, where the chord's half-plane extends.
highp float cut_rounded_corner(highp float depth, highp vec4 circle, highp vec2 bisector) {
    if (circle.z <= 0.0) return depth;
    highp vec2 fromCentre = v_rounded_pos - circle.xy;
    if (!within_corner_angle(fromCentre, circle, bisector)) return depth;
    return max(depth, min(beyond_chord(fromCentre, circle, bisector), length(fromCentre) - circle.z));
}

// The size of the fragment in tile units, which the arcs fade and are outlined over. It is measured
// from the position rather than from a distance to an arc, which jumps at the edges of a corner's
// angle.
highp float rounded_corner_pixel_size() {
    return max(0.7071 * length(fwidth(v_rounded_pos)), 1e-6);
}

// Returns how much of the fragment the rounded corners of its triangle leave drawn, from 0.0 to 1.0,
// fading over a pixel along the arcs. A triangle that only draws the area a concave corner's arc adds
// keeps the sliver that the same test cuts away from a convex corner.
highp float rounded_corner_coverage() {
    highp float depth = ROUNDED_CORNER_UNCUT;
    depth = cut_rounded_corner(depth, v_rounded_circle0, v_rounded_bisector01.xy);
    depth = cut_rounded_corner(depth, v_rounded_circle1, v_rounded_bisector01.zw);
    depth = cut_rounded_corner(depth, v_rounded_circle2, v_rounded_bisector2_side.xy);
    return clamp(0.5 - depth * v_rounded_bisector2_side.z / rounded_corner_pixel_size(), 0.0, 1.0);
}

// How strongly one corner's arc outlines the fragment, from 0.0 to 1.0: the same one pixel wide line,
// centred on the arc, that the outline draws along the polygon's straight edges.
highp float arc_outline(highp vec4 circle, highp vec2 bisector, highp float pixelSize) {
    if (circle.z <= 0.0) return 0.0;
    highp vec2 fromCentre = v_rounded_pos - circle.xy;
    if (!within_corner_angle(fromCentre, circle, bisector) || beyond_chord(fromCentre, circle, bisector) < 0.0) return 0.0;
    return 1.0 - smoothstep(0.0, 1.0, abs(length(fromCentre) - circle.z) / pixelSize);
}

// Returns the fill fragment's color with the outline drawn along the arcs of its triangle's corners,
// which the outline itself cannot draw: it traces the polygon's straight edges and stops where each arc
// begins. Both sides of every arc lie within the triangles that are rounded by it, so the line can be
// centred on the arc like the outline's on an edge. Discards a fragment that is left with nothing.
highp vec4 rounded_corner_color(highp vec4 fill, highp vec4 outline) {
    highp float pixelSize = rounded_corner_pixel_size();
    highp float stroke = u_rounded_outline * max(arc_outline(v_rounded_circle0, v_rounded_bisector01.xy, pixelSize),
        max(arc_outline(v_rounded_circle1, v_rounded_bisector01.zw, pixelSize),
            arc_outline(v_rounded_circle2, v_rounded_bisector2_side.xy, pixelSize)));
    highp float coverage = rounded_corner_coverage();
    if (coverage <= 0.0 && stroke <= 0.0) discard;
    return mix(fill * coverage, outline, stroke);
}

// Whether one corner leaves an outline fragment drawn: not between the corner and the points where its
// arc meets its edges, but beyond them. The arc meets each edge `radius * cos / sin` of the half angle
// from the corner.
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
// the arc to the fill. The stop is a hard one rather than a fade: along a line primitive the
// screen-space derivatives a fade is measured with are unreliable on some GPUs, and leave the hidden
// part of the line half drawn.
bool rounded_outline_drawn() {
    return outline_beyond_arc(v_rounded_circle0, v_rounded_bisector01.xy) &&
        outline_beyond_arc(v_rounded_circle1, v_rounded_bisector01.zw) &&
        outline_beyond_arc(v_rounded_circle2, v_rounded_bisector2_side.xy);
}
#endif
