layout(location = 0) in vec2 a_pos;

void main() {
    // Cover the full bound framebuffer in NDC.
    // The fragment shader addresses its inputs by gl_FragCoord, so no texcoord varying is needed.
    gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);
}
