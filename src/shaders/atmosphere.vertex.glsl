in vec4 a_pos;

uniform mat4 u_inv_proj_matrix;

out vec3 view_direction;

void main() {
    // Compute each camera ray
    view_direction = (u_inv_proj_matrix * a_pos).xyz;
    gl_Position = a_pos;
}