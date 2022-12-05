uniform sampler2D u_texture;
uniform vec4 u_fog_color;
uniform float u_fog_blend;
uniform float u_fog_blend_opacity;

varying vec2 v_texture_pos;
varying float v_fog_depth;

void main() {
    vec4 color = texture2D(u_texture, v_texture_pos);
    if (v_fog_depth > u_fog_blend) {
        float a = (v_fog_depth - u_fog_blend) / (1.0 - u_fog_blend);
        gl_FragColor = mix(color, u_fog_color, pow(a * u_fog_blend_opacity, 2.0));
    } else {
        gl_FragColor = color;
    }
}
