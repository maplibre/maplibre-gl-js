uniform vec4 u_sky_color;
uniform vec4 u_horizon_color;

uniform vec2 u_horizon;
uniform vec2 u_horizon_normal;
uniform float u_sky_horizon_blend;
uniform float u_sky_blend;

void main() {
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;
    float blend = (y - u_horizon.y) * u_horizon_normal.y + (x - u_horizon.x) * u_horizon_normal.x;
    if (blend > 0.0) {
        if (blend < u_sky_horizon_blend) {
            fragColor = mix(u_sky_color, u_horizon_color, pow(1.0 - blend / u_sky_horizon_blend, 2.0));
        } else {
            fragColor = u_sky_color;
        }
    }
    fragColor = mix(fragColor, vec4(vec3(0.0), 0.0), u_sky_blend);
}
