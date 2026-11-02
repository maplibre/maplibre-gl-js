layout(location = 0) in vec3 a_pos3d;

uniform vec4 u_tile_bounds;

out highp float v_elevation;

void main() {
    v_elevation = get_elevation(a_pos3d.xy);
    vec2 position = u_tile_bounds.xy + a_pos3d.xy / 8192.0 * u_tile_bounds.zw;
    gl_Position = vec4(position.x * 2.0 - 1.0, 1.0 - position.y * 2.0, 0.0, 1.0);
}
