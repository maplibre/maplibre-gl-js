uniform vec2 u_world;
uniform vec2 u_fill_translate;

layout(location = 0) in vec2 a_pos;

out vec2 v_pos;
#ifdef GLOBE
out float v_depth;
#endif

#pragma maplibre: define highp vec4 outline_color
#pragma maplibre: define lowp float opacity

void main() {
    #pragma maplibre: initialize highp vec4 outline_color
    #pragma maplibre: initialize lowp float opacity

    // Move vertex outside clip space to discard triangle when opacity is negligible
    if (opacity < 0.01) {
        gl_Position = vec4(-2.0, -2.0, -2.0, 1.0);
        return;
    }

    gl_Position = projectTile(a_pos + u_fill_translate, a_pos);

    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;
    #ifdef GLOBE
    v_depth = gl_Position.z / gl_Position.w;
    #endif
}
