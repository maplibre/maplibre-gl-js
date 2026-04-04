in vec2 a_pos;

uniform mat4 u_inv_proj_matrix;

out vec3 view_direction;

void main() {
    // Compute each camera ray
    view_direction = (u_inv_proj_matrix * vec4(a_pos, 0.0, 1.0)).xyz;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
