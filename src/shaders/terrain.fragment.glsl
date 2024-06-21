uniform sampler2D u_texture;
uniform vec4 u_fog_color;
uniform vec4 u_horizon_color;
uniform float u_fog_ground_blend;
uniform float u_fog_ground_blend_opacity;
uniform float u_horizon_fog_blend;

in vec2 v_texture_pos;
in float v_fog_depth;

void main() {
    vec4 color = texture2D(u_texture, v_texture_pos);
    if (v_fog_depth > u_fog_ground_blend) {
        vec4 fog_horizon_color = mix(u_fog_color, u_horizon_color, max((v_fog_depth - u_horizon_fog_blend) / (1.0 - u_fog_ground_blend), 0));
        float a = max((v_fog_depth - u_fog_ground_blend) / (1.0 - u_fog_ground_blend), 0);
        gl_FragColor = mix(color, fog_horizon_color, pow(a, 2.0) * u_fog_ground_blend_opacity);
    } else {
        gl_FragColor = color;
    }
}
