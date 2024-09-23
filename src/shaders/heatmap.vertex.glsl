
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

    // decode the extrusion vector that we snuck into the a_pos vector
    vec2 pos_raw = a_pos + 32768.0;
    vec2 unscaled_extrude = vec2(mod(pos_raw, 8.0) / 7.0 * 2.0 - 1.0);

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

    // Divide a_pos by 8, since we had it * 8 in order to sneak
    // in extrusion data
    vec2 circle_center = floor(pos_raw / 8.0);

#ifdef GLOBE
    vec2 angles = v_extrude * radius * u_globe_extrude_scale;
    vec3 center_vector = projectToSphere(circle_center);
    vec3 corner_vector = globeRotateVector(center_vector, angles);
    gl_Position = interpolateProjection(circle_center + extrude, corner_vector, 0.0);
#else
    gl_Position = projectTileFor3D(circle_center + extrude, get_elevation(circle_center));
#endif
}
