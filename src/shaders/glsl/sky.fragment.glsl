uniform vec4 u_sky_color;
uniform vec4 u_horizon_color;

uniform vec2 u_horizon;
uniform vec2 u_horizon_normal;
uniform float u_sky_horizon_blend;
uniform float u_sky_blend;
uniform vec3 u_globe_position;
uniform float u_globe_radius;
uniform float u_camera_to_center_distance;

in vec3 v_view_direction;

void main() {
    float x = gl_FragCoord.x;
    float y = gl_FragCoord.y;
    float blend = (y - u_horizon.y) * u_horizon_normal.y + (x - u_horizon.x) * u_horizon_normal.x;
    if (u_sky_blend > 0.0) {
        vec3 ray = normalize(v_view_direction);
        float globe_distance = length(u_globe_position);
        float angle_to_globe_center = acos(clamp(dot(ray, u_globe_position) / globe_distance, -1.0, 1.0));
        float horizon_angle = asin(min(u_globe_radius / globe_distance, 1.0));
        blend = mix(blend, (angle_to_globe_center - horizon_angle) * u_camera_to_center_distance, u_sky_blend);
    }
    if (blend > 0.0) {
        if (blend < u_sky_horizon_blend) {
            fragColor = mix(u_sky_color, u_horizon_color, pow(1.0 - blend / u_sky_horizon_blend, 2.0));
        } else {
            fragColor = u_sky_color;
        }
    }
    fragColor = mix(fragColor, vec4(vec3(0.0), 0.0), u_sky_blend);
}
