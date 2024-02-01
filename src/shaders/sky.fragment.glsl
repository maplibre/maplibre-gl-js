uniform vec4 u_sky_color;
uniform vec4 u_fog_color;
uniform float u_horizon;
uniform float u_horizon_blend;

void main() {
    float y = gl_FragCoord.y;
    if (y > u_horizon) {
        float blend = y - u_horizon;
        if (blend < u_horizon_blend) {
            gl_FragColor = mix(u_sky_color, u_fog_color, pow(1.0 - blend / u_horizon_blend, 2.0));
        } else {
            gl_FragColor = u_sky_color;
        }
    } else {
        gl_FragColor = u_fog_color;
    }
}