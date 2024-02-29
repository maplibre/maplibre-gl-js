float projectLineThickness(float tileY) {
    return 1.0;
}

float projectCircleRadius(float tileY) {
    return 1.0;
}

vec4 projectTile(vec2 p) {
    // Kill pole vertices and triangles by placing the pole vertex so far in Z that
    // the clipping hardware kills the entire triangle.
    vec4 result = u_projection_matrix * vec4(p, 0.0, 1.0);
    if (p.y < -32767.5 || p.y > 32766.5) {
        result.z = -10000000.0;
    }
    return result;
}

vec4 projectTileWithElevation(vec2 posInTile, float elevation) {
    // This function is only used in symbol vertex shaders and symbols never use pole vertices,
    // so no need to detect them.
    return u_projection_matrix * vec4(posInTile, elevation, 1.0);
}

vec4 projectTileFor3D(vec2 posInTile, float elevation) {
    return projectTileWithElevation(posInTile, elevation);
}

vec4 interpolateProjection(vec2 posInTile, vec3 spherePos, float elevation) {
    return projectTileFor3D(posInTile, elevation);
}

vec4 interpolateProjectionFor3D(vec2 posInTile, vec3 spherePos, float elevation) {
    return interpolateProjection(posInTile, spherePos, elevation);
}

#define projectToSphere(p) (vec3(0.0, 1.0, 0.0))
#define getDebugColor(p) (vec4(1.0, 0.0, 1.0, 1.0))
