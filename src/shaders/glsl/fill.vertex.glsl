uniform vec2 u_fill_translate;

layout(location = 0) in vec2 a_pos;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

    if (opacity < 0.01) {
        gl_Position = vec4(-2.0, -2.0, -2.0, 1.0);
        return;
    }

    gl_Position = projectTile(a_pos + u_fill_translate, a_pos);
}
