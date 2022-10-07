attribute vec2 a_pos;

void main() {
    gl_Position = vec4(a_pos, 0.99999, 1.0);
}
