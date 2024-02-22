uniform vec2 u_fill_translate;

#ifdef PREPROJECTED
in vec3 a_pos_preprojected;
#endif
in vec2 a_pos;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    #ifdef PREPROJECTED
    // fill-translate is not supported on preprojected fill geometry
    // Regular geometry shader is used as fallback. This is handled in draw_fill.ts
    gl_Position = interpolateProjection(a_pos, a_pos_preprojected, 0.0);
    #else
    gl_Position = projectTile(a_pos + u_fill_translate);
    #endif
}
