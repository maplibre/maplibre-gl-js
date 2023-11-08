in vec2 a_pos;

uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * projectTile(a_pos);
}
