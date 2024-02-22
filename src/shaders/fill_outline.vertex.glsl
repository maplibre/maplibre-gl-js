uniform vec2 u_world;
uniform vec2 u_fill_translate;

#ifdef PREPROJECTED
in vec3 a_pos_preprojected;
#endif
in vec2 a_pos;

out vec2 v_pos;

#pragma mapbox: define highp vec4 outline_color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 outline_color
    #pragma mapbox: initialize lowp float opacity

    #ifdef PREPROJECTED
    gl_Position = interpolateProjection(a_pos, a_pos_preprojected, 0.0);
    #else
    gl_Position = projectTile(a_pos + u_fill_translate);
    #endif
    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;
}
