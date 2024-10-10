uniform vec4 u_sky_color;
uniform vec4 u_horizon_color;

uniform vec2 u_horizon;
uniform vec2 u_horizon_normal;
uniform float u_sky_horizon_blend;

void main() {
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;
    float blend = (y - u_horizon.y) * u_horizon_normal.y + (x - u_horizon.x) * u_horizon_normal.x;
    if (blend > 0.0) {
        if (blend < u_sky_horizon_blend) {
            gl_FragColor = mix(u_sky_color, u_horizon_color, pow(1.0 - blend / u_sky_horizon_blend, 2.0));
        } else {
            gl_FragColor = u_sky_color;
        }
    }
}