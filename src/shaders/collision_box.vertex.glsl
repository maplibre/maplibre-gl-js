in vec2 a_anchor_pos;
in vec2 a_placed;
in vec2 a_box_real;

uniform vec2 u_pixel_extrude_scale;

out float v_placed;
out float v_notUsed;

void main() {
    gl_Position = projectTileWithElevation(a_anchor_pos, get_elevation(a_anchor_pos));
    gl_Position.xy += (a_box_real * u_pixel_extrude_scale * 2.0) * vec2(1.0, -1.0) * gl_Position.w;

    v_placed = a_placed.x;
    v_notUsed = a_placed.y;
}
