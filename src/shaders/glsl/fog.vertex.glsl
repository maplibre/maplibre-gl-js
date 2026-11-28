layout(location = 0) in vec3 a_pos3d;

uniform mat4 u_fog_matrix;
uniform float u_ele_delta;

out vec2 v_fog_pos;

invariant gl_Position;

void main() {
    float ele = get_elevation(a_pos3d.xy);
    float ele_delta = a_pos3d.z == 1.0 ? u_ele_delta : 0.0;
    gl_Position = projectTileFor3D(a_pos3d.xy, ele - ele_delta);
    v_fog_pos = (u_fog_matrix * vec4(a_pos3d.xy, ele, 1.0)).zw;
}
