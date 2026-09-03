layout(location = 0) in vec2 a_pos;

uniform mat4 u_inv_proj_matrix;

out vec3 v_view_direction;

void main() {
    v_view_direction = (u_inv_proj_matrix * vec4(a_pos, 0.0, 1.0)).xyz;
    gl_Position = vec4(a_pos, 1.0, 1.0);
}
