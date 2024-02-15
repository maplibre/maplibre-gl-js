in vec4 v_color;

#ifdef GLOBE
in vec3 v_sphere_pos;
uniform vec3 u_camera_pos_globe;
#endif

void main() {
    fragColor = v_color;

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif

    // do not discard when overdraw inspection is on
#if defined GLOBE && !defined OVERDRAW_INSPECTOR
    // Discard fragments that are occluded by the planet
    vec3 toPlanetCenter = -v_sphere_pos;
    vec3 toCameraNormalized = normalize(u_camera_pos_globe - v_sphere_pos);
    float t = dot(toPlanetCenter, toCameraNormalized);
    // Get nearest point along the ray from fragment to camera.
    // Remember that planet center is at 0,0,0.
    // Also clamp t to not consider intersections that happened behind the ray origin.
    vec3 nearest = v_sphere_pos + toCameraNormalized * max(t, 0.0);
    bool intersected = dot(nearest, nearest) < 1.0;
    if (intersected) {
        discard;
    }
#endif
}
