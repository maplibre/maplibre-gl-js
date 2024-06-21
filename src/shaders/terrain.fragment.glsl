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
        vec4 fog_horizon_color = mix(u_horizon_color, u_fog_color, 1.0 - u_horizon_fog_blend - v_fog_depth);
        float a = (v_fog_depth - u_fog_ground_blend) / (1.0 - u_fog_ground_blend);
        gl_FragColor = mix(color, fog_horizon_color, pow(a * u_fog_ground_blend_opacity, 2.0));
    } else {
        gl_FragColor = color;
    }
}
