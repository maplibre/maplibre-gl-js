
uniform float u_extrude_scale;
uniform float u_opacity;
uniform float u_intensity;
uniform highp float u_globe_extrude_scale;

in vec2 a_pos;

out vec2 v_extrude;

#pragma mapbox: define highp float weight
#pragma mapbox: define mediump float radius

// Effective "0" in the kernel density texture to adjust the kernel size to;
// this empirically chosen number minimizes artifacts on overlapping kernels
// for typical heatmap cases (assuming clustered source)
const highp float ZERO = 1.0 / 255.0 / 16.0;

// Gaussian kernel coefficient: 1 / sqrt(2 * PI)
#define GAUSS_COEF 0.3989422804014327

void main(void) {
    #pragma mapbox: initialize highp float weight
    #pragma mapbox: initialize mediump float radius

    // unencode the extrusion vector that we snuck into the a_pos vector
    vec2 unscaled_extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);

    // This 'extrude' comes in ranging from [-1, -1], to [1, 1].  We'll use
    // it to produce the vertices of a square mesh framing the point feature
    // we're adding to the kernel density texture.  We'll also pass it as
    // a out, so that the fragment shader can determine the distance of
    // each fragment from the point feature.
    // Before we do so, we need to scale it up sufficiently so that the
    // kernel falls effectively to zero at the edge of the mesh.
    // That is, we want to know S such that
    // weight * u_intensity * GAUSS_COEF * exp(-0.5 * 3.0^2 * S^2) == ZERO
    // Which solves to:
    // S = sqrt(-2.0 * log(ZERO / (weight * u_intensity * GAUSS_COEF))) / 3.0
    float S = sqrt(-2.0 * log(ZERO / weight / u_intensity / GAUSS_COEF)) / 3.0;

    // Pass the out in units of radius
    v_extrude = S * unscaled_extrude;

    // Scale by radius and the zoom-based scale factor to produce actual
    // mesh position
    vec2 extrude = v_extrude * radius * u_extrude_scale;

    // multiply a_pos by 0.5, since we had it * 2 in order to sneak
    // in extrusion data
    vec2 circle_center = floor(a_pos * 0.5);

#ifdef GLOBE
    float angle = (unscaled_extrude.x > 0.0) ? u_globe_extrude_scale : -u_globe_extrude_scale;
    angle *= S * radius;

    vec3 center_vector = projectToSphere(circle_center);

    // Default axis for vertical rotation
    vec3 axis = vec3(-center_vector.z, 0.0, center_vector.x); // Equivalent to cross(center_vector, vec3(0.0, 1.0, 0.0))
    if ((unscaled_extrude.x > 0.0) != (unscaled_extrude.y > 0.0)) {
        // Move corner horizontally instead of vertically
        axis = cross(center_vector, axis);
    }
    axis = normalize(axis);
    
    mat3 m = rotationMatrixFromAxisAngle(axis, angle);
    vec3 corner_vector = m * center_vector;
    gl_Position = interpolateProjection(circle_center, corner_vector);
#else
    gl_Position = projectTile(circle_center + extrude);
#endif
}
