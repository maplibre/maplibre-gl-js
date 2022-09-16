attribute vec2 a_pos;

uniform mat4 u_matrix;

varying vec2 v_texture_pos;
varying float v_depth;

void main() {
    float extent = 8192.0; // 8192.0 is the hardcoded vector-tiles coordinates resolution
    vec2 pos = a_pos;
    float ele = 0.0;
    if (pos.x > extent) { // check for encoded z values when creating tile frame
        pos.x -= extent - 1.0;
        ele = -450.0;
    } else {
        ele = get_elevation(pos);
    }
    v_texture_pos = pos / extent;
    gl_Position = u_matrix * vec4(pos, ele, 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
