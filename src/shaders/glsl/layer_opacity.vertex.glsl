layout(location = 0) in vec2 a_pos;
out vec2 v_pos;

void main() {
    // Cover the full bound framebuffer in NDC.
    // a_pos.y=0 mapps this to the top.
    // This means v_pos.y=1.0-a_pos.y texcoord lookup matches the ortho-matrix variant this shader replaced.
    gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);

    v_pos.x = a_pos.x;
    v_pos.y = 1.0 - a_pos.y;
}
