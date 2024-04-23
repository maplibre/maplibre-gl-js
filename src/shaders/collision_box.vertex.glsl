in vec2 a_pos;
in vec2 a_anchor_pos;
in vec2 a_extrude;
in vec2 a_placed;
in vec2 a_shift;
in vec2 a_box_real;

uniform vec2 u_translation;
uniform vec2 u_extrude_scale;
uniform vec2 u_pixel_extrude_scale;
uniform float u_camera_to_center_distance;

out float v_placed;
out float v_notUsed;

void main() {
    vec4 projectedPoint = projectTile(a_anchor_pos + u_translation);
    highp float camera_to_anchor_distance = projectedPoint.w;
    highp float collision_perspective_ratio = clamp(
        0.5 + 0.5 * (u_camera_to_center_distance / camera_to_anchor_distance),
        0.0, // Prevents oversized near-field boxes in pitched/overzoomed tiles
        4.0);

    gl_Position = projectTileWithElevation(a_pos + u_translation, get_elevation(a_pos));
    gl_Position.xy = (a_box_real * u_pixel_extrude_scale * 2.0 - 1.0) * vec2(1.0, -1.0) * gl_Position.w;

    v_placed = a_placed.x;
    v_notUsed = a_placed.y;
}
