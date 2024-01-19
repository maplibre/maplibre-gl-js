in vec2 a_pos;

uniform highp float u_input;
uniform highp float u_output_expected;

out vec4 v_output_error_encoded;

void main() {
    float real_output = 2.0 * atan(exp(u_input)) - GLOBE_PI * 0.5;
    // TODO: maybe scale the error by 1000?
    // If we assume that the error visible on the map is never more than 1 km,
    // then the angular error is always smaller than 1/6378 * 2PI = ~0.00098513
    float error = real_output - u_output_expected;
    float abs_error = abs(error);
    v_output_error_encoded = vec4(
        fract(abs_error * float(256 * 256 * 256)),
        fract(abs_error * float(256 * 256)),
        fract(abs_error * float(256)),
        error >= 0.0 ? 1.0 : 0.0 // sign
    );

    gl_Position = vec4(a_pos, 0.0, 1.0);
}
