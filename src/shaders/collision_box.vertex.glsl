in vec2 a_anchor_pos;
in vec2 a_placed;
in vec2 a_box_real;

uniform mat4 u_matrix;
uniform vec2 u_pixel_extrude_scale;

out float v_placed;
out float v_notUsed;

vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
    return u_matrix * vec4(posInTile, elevation, 1.0);
}

void main() {
    gl_Position = projectTileWithElevation(a_anchor_pos, get_elevation(a_anchor_pos));
    gl_Position.xy = ((a_box_real + 0.5) * u_pixel_extrude_scale * 2.0 - 1.0) * vec2(1.0, -1.0) * gl_Position.w;
    if (gl_Position.z / gl_Position.w < 1.1) {
        // Globe projection would set Z beyond visible range if the anchor point gets hidden behind the planet's horizon.
        // We force Z to a visible value, even for anchors that are slightly behind the horizon.
        // Anchors that are too far beyond the horizon are still hidden.
        gl_Position.z = 0.5;
    }

    v_placed = a_placed.x;
    v_notUsed = a_placed.y;
}
