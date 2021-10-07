attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform sampler2D u_terrain;
uniform mat4 u_terrain_matrix;
uniform vec4 u_terrain_unpack;
uniform float u_terrain_exaggeration;
uniform float u_terrain_offset;

varying vec2 v_texture_pos;
varying float v_depth;

float getElevation(vec2 coord) {
    vec4 rgb = (texture2D(u_terrain, coord) * 255.0) * u_terrain_unpack;
    float ele = rgb.r + rgb.g + rgb.b - u_terrain_unpack.a;
    return (ele + u_terrain_offset) * u_terrain_exaggeration;
}

void main() {
    v_texture_pos = a_pos / 8192.0;
    vec2 terrain_pos = (u_terrain_matrix * vec4(a_pos, 0.0, 1.0)).xy * 0.5 + 0.5;
    gl_Position = u_matrix * vec4(a_pos, getElevation(terrain_pos), 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
