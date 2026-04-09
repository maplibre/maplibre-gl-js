in vec2 a_pos;

uniform highp float u_input;
uniform highp float u_output_expected;

out vec4 v_output_error_encoded;

void main() {
    float real_output = 2.0 * atan(exp(PI - (u_input * PI * 2.0))) - PI * 0.5;
    // If we assume that the error visible on the map is never more than 1 km,
    // then the angular error is always smaller than 1/6378 * 2PI = ~0.00098513
    float error = real_output - u_output_expected;
    float abs_error = abs(error) * 128.0; // Scale error by some large value for extra precision
    // abs_error is assumed to be in range 0..1
    v_output_error_encoded.x = min(floor(abs_error * 256.0), 255.0) / 255.0;
    abs_error -= v_output_error_encoded.x;
    v_output_error_encoded.y = min(floor(abs_error * 65536.0), 255.0) / 255.0;
    abs_error -= v_output_error_encoded.x / 255.0;
    v_output_error_encoded.z = min(floor(abs_error * 16777216.0), 255.0) / 255.0;
    v_output_error_encoded.w = error >= 0.0 ? 1.0 : 0.0; // sign
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
