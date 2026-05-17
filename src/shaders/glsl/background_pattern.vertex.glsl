layout(std140) uniform LayerUBO {
    mediump vec2 u_pattern_tl_a;
    mediump vec2 u_pattern_br_a;
    mediump vec2 u_pattern_tl_b;
    mediump vec2 u_pattern_br_b;
    mediump vec2 u_texsize;
    mediump vec2 u_pattern_size_a;
    mediump vec2 u_pattern_size_b;
    mediump float u_mix;
    mediump float u_scale_a;
    mediump float u_scale_b;
    mediump float u_opacity;
};

// highp:
// u_pixel_coord_upper can reach 2^15 at deep zoom
// -> beyond mediump's guaranteed exact-integer range
// The split itself is still required because even highp (FP32, 24-bit mantissa) cannot store the un-split pixel coord
// exactly once it crosses 2^24 (zoom >= 16 at tileSize=512);
// get_pattern_pos keeps every intermediate small enough to avoid reassembling the full value.
layout(std140) uniform DrawableUBO {
    highp vec2 u_pixel_coord_upper;
    highp vec2 u_pixel_coord_lower;
    highp float u_tile_units_to_pixels;
};

layout(location = 0) in vec2 a_pos;
out vec2 v_pos_a;
out vec2 v_pos_b;

void main() {
    gl_Position = projectTile(a_pos);

    v_pos_a = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_a * u_pattern_size_a, u_tile_units_to_pixels, a_pos);
    v_pos_b = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_b * u_pattern_size_b, u_tile_units_to_pixels, a_pos);
}
