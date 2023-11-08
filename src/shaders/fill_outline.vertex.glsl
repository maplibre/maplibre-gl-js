in vec2 a_pos;

uniform vec2 u_world;

out vec2 v_pos;

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity

    gl_Position = projectTile(a_pos);
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;
}
