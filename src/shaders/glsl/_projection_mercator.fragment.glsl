// Under mercator projection tile buffer geometry never wraps around the planet,
// so no fragments need to be discarded. See _projection_globe.fragment.glsl.
void clipAntimeridian() {
}
