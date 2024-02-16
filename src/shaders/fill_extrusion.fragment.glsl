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

#ifdef GLOBE
    // We want extruded geometry to be occluded by the planet.
    // This would be trivial in any traditional 3D renderer with Z-buffer,
    // but not in MapLibre, since Z-buffer is used to mask certain layers
    // and optimize overdraw.
    // One solution would be to draw the planet into Z-buffer just before
    // rendering fill-extrusion layers, but what if another layer
    // is drawn after that which makes use of this Z-buffer mask?
    // We can't just trash the mask with out own Z values.
    // So instead, the "Z-test" against the planet is done here,
    // in the pixel shader.
    // Luckily the planet is (assumed to be) a perfect sphere,
    // so the ray-planet intersection test is quite simple.
    // We discard any fragments that are occluded by the planet.
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
