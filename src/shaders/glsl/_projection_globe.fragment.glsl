uniform bool u_projection_clip_antimeridian;

in highp float v_projection_tile_x;

// On globe the z0 tile's buffer wraps around the planet onto the tile itself, drawing geometry near the antimeridian twice.
// To avoid this, we discard fragments beyond the tile's X extent (0..8192) when enabled for the tile.
// The range test is half-open so that both sides of the antimeridian tile the seam exactly, without overlap.
void clipAntimeridian() {
    if (u_projection_clip_antimeridian && (v_projection_tile_x < 0.0 || v_projection_tile_x >= 8192.0)) {
        discard;
    }
}
