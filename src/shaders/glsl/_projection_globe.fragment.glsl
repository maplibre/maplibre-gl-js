uniform highp vec2 u_projection_antimeridian_clip;

in highp float v_projection_tile_x;

// Discards fragments of tile geometry that lies beyond the antimeridian.
//
// The projection of in-tile coordinates to the sphere is periodic in X, so geometry in a tile's buffer
// that extends past the antimeridian wraps around the planet and lands on top of the tile on the opposite side of it.
// For the zoom 0 tile, which covers the whole world, that opposite tile is the tile itself: the +/-360 degrees shifted duplicates
// that tile sources place in the buffer near the antimeridian would be rendered on top of the tile's own geometry.
// The per-tile stencil clipping masks that clip buffer geometry everywhere else cannot distinguish the overlapping fragments,
// as the zoom 0 mask covers the entire sphere, so the clipping must happen in geometry space.
//
// The range test is half-open so that the geometry kept on both sides of the antimeridian tiles the seam exactly, without overlap.
void clipAntimeridian() {
    if (v_projection_tile_x < u_projection_antimeridian_clip.x || v_projection_tile_x >= u_projection_antimeridian_clip.y) {
        discard;
    }
}
