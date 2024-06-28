in vec3 a_pos3d;

uniform mat4 u_fog_matrix;
uniform float u_ele_delta;

out vec2 v_texture_pos;
out float v_fog_depth;

void main() {
    float ele = get_elevation(a_pos3d.xy);
    float ele_delta = a_pos3d.z == 1.0 ? u_ele_delta : 0.0;
    v_texture_pos = a_pos3d.xy / 8192.0;
    gl_Position = projectTileFor3D(a_pos3d.xy, get_elevation(a_pos3d.xy) - ele_delta);
    vec4 pos = u_fog_matrix * vec4(a_pos3d.xy, ele, 1.0);
    v_fog_depth = pos.z / pos.w * 0.5 + 0.5;
}