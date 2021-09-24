precision mediump float;

uniform sampler2D u_texture;
uniform sampler2D u_terrain;
varying vec2 v_texture_pos;
varying vec2 v_terrain_pos;

void main() {
    gl_FragColor = texture2D(u_texture, v_texture_pos);
}
