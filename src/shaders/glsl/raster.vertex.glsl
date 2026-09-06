uniform vec2 u_tl_parent;
uniform float u_scale_parent;
uniform float u_buffer_scale;
uniform vec3 u_image_warp;
uniform vec4 u_coords_top; // xy = left, zw = right
uniform vec4 u_coords_bottom;

layout(location = 0) in vec2 a_pos;

out vec3 v_pos0;
out vec3 v_pos1;

void main() {
    // in a_pos always forms a (sometimes subdivided) quad in 0..EXTENT, but actual corner coords may be different.
    // Interpolate the actual desired coordinates to get the final position.
    vec2 fractionalPos = a_pos / 8192.0;
    vec2 topLeft = u_coords_top.xy;
    vec2 topRight = u_coords_top.zw;
    vec2 bottomLeft = u_coords_bottom.xy;
    vec2 bottomRight = u_coords_bottom.zw;
    vec2 bilinearPos = mix(mix(topLeft, topRight, fractionalPos.x), mix(bottomLeft, bottomRight, fractionalPos.x), fractionalPos.y);

    // u_image_warp.xy are the perspective terms of the projective mapping from the unit square onto
    // the corner coordinates, and .z blends that mapping towards the bilinear one above. The
    // homogeneous denominator is normalized to one at the top left corner, so both the position and
    // the interpolation weight below stay well scaled and can be blended linearly.
    float denominator = dot(u_image_warp.xy, fractionalPos) + 1.0;
    vec2 acrossTop = topRight - topLeft + u_image_warp.x * topRight;
    vec2 downLeft = bottomLeft - topLeft + u_image_warp.y * bottomLeft;
    vec2 projectivePos = (acrossTop * fractionalPos.x + downLeft * fractionalPos.y + topLeft) / denominator;

    vec2 position = mix(projectivePos, bilinearPos, u_image_warp.z);
    gl_Position = projectTile(position, position);

    // We are using Int16 for texture position coordinates to give us enough precision for
    // fractional coordinates. We use 8192 to scale the texture coordinates in the buffer
    // as an arbitrarily high number to preserve adequate precision when rendering.
    // This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,
    // so math for modifying either is consistent.
    vec2 texturePos = ((fractionalPos - 0.5) / u_buffer_scale) + 0.5;

     // When globe rendering is enabled, pole vertices need special handling to get nice texture coordinates.
    #ifdef GLOBE
    // North pole
    if (a_pos.y < -32767.5) {
        texturePos.y = 0.0;
    }
    // South pole
    if (a_pos.y > 32766.5) {
        texturePos.y = 1.0;
    }
    #endif

    // Weighting the texture coordinates by the reciprocal of the denominator is what makes the
    // mapping projective rather than bilinear, so the weight is blended alongside the position.
    float perspectiveRatio = mix(1.0 / denominator, 1.0, u_image_warp.z);
    v_pos0 = vec3(texturePos * perspectiveRatio, perspectiveRatio);

    vec2 parentPos = (texturePos * u_scale_parent) + u_tl_parent;
    v_pos1 = vec3(parentPos * perspectiveRatio, perspectiveRatio);
}
