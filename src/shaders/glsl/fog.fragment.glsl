uniform vec4 u_fog_color;
uniform vec4 u_horizon_color;
uniform float u_fog_ground_blend;
uniform float u_fog_ground_blend_opacity;
uniform float u_horizon_fog_blend;

in vec2 v_fog_pos;

const float gamma = 2.2;

vec4 gammaToLinear(vec4 color) {
    return pow(color, vec4(gamma));
}

vec4 linearToGamma(vec4 color) {
    return pow(color, vec4(1.0 / gamma));
}

void main() {
    float fog_depth = v_fog_pos.x / v_fog_pos.y * 0.5 + 0.5;
    if (fog_depth <= u_fog_ground_blend) {
        discard;
    }
    float blend_color = u_horizon_fog_blend < 1.0 ? smoothstep(u_horizon_fog_blend, 1.0, fog_depth) : 0.0;
    vec4 fog_horizon_color_linear = mix(gammaToLinear(u_fog_color), gammaToLinear(u_horizon_color), blend_color);
    float factor_fog = clamp((fog_depth - u_fog_ground_blend) / (1.0 - u_fog_ground_blend), 0.0, 1.0);
    fragColor = linearToGamma(fog_horizon_color_linear) * pow(factor_fog, 2.0) * u_fog_ground_blend_opacity;
}
