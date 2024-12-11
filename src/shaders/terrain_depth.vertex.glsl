in vec3 a_pos3d;

uniform float u_ele_delta;

out float v_depth;

void main() {
    float ele = get_elevation(a_pos3d.xy);
    float ele_delta = a_pos3d.z == 1.0 ? u_ele_delta : 0.0;
    gl_Position = projectTileFor3D(a_pos3d.xy, ele - ele_delta);
    v_depth = gl_Position.z / gl_Position.w;
}
