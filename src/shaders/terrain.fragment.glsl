uniform sampler2D u_texture;
uniform vec4 u_fog_color;
uniform float u_fog_blend;
uniform float u_fog_blend_opacity;

in vec2 v_texture_pos;
in float v_fog_depth;

void main() {
    fragColor = texture(u_texture, v_texture_pos);
    if (v_fog_depth > u_fog_blend) {
        float a = (v_fog_depth - u_fog_blend) / (1.0 - u_fog_blend);
        fragColor = mix(fragColor, u_fog_color, pow(a * u_fog_blend_opacity, 2.0));
    }
}
