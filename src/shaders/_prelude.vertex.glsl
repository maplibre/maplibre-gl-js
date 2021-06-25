#ifdef GL_ES
precision highp float;
#else

#if !defined(lowp)
#define lowp
#endif

#if !defined(mediump)
#define mediump
#endif

#if !defined(highp)
#define highp
#endif

#endif

// Unpack a pair of values that have been packed into a single float.
// The packed values are assumed to be 8-bit unsigned integers, and are
// packed like so:
// packedValue = floor(input[0]) * 256 + input[1],
vec2 unpack_float(const float packedValue) {
    int packedIntValue = int(packedValue);
    int v0 = packedIntValue / 256;
    return vec2(v0, packedIntValue - v0 * 256);
}

vec2 unpack_opacity(const float packedOpacity) {
    int intOpacity = int(packedOpacity) / 2;
    return vec2(float(intOpacity) / 127.0, mod(packedOpacity, 2.0));
}

// To minimize the number of attributes needed, we encode a 4-component
// color into a pair of floats (i.e. a vec2) as follows:
// [ floor(color.r * 255) * 256 + color.g * 255,
//   floor(color.b * 255) * 256 + color.g * 255 ]
vec4 decode_color(const vec2 encodedColor) {
    return vec4(
        unpack_float(encodedColor[0]) / 255.0,
        unpack_float(encodedColor[1]) / 255.0
    );
}

// Unpack a pair of paint values and interpolate between them.
float unpack_mix_vec2(const vec2 packedValue, const float t) {
    return mix(packedValue[0], packedValue[1], t);
}

// Unpack a pair of paint values and interpolate between them.
vec4 unpack_mix_color(const vec4 packedColors, const float t) {
    vec4 minColor = decode_color(vec2(packedColors[0], packedColors[1]));
    vec4 maxColor = decode_color(vec2(packedColors[2], packedColors[3]));
    return mix(minColor, maxColor, t);
}

// The offset depends on how many pixels are between the world origin and the edge of the tile:
// vec2 offset = mod(pixel_coord, size)
//
// At high zoom levels there are a ton of pixels between the world origin and the edge of the tile.
// The glsl spec only guarantees 16 bits of precision for highp floats. We need more than that.
//
// The pixel_coord is passed in as two 16 bit values:
// pixel_coord_upper = floor(pixel_coord / 2^16)
// pixel_coord_lower = mod(pixel_coord, 2^16)
//
// The offset is calculated in a series of steps that should preserve this precision:
vec2 get_pattern_pos(const vec2 pixel_coord_upper, const vec2 pixel_coord_lower,
    const vec2 pattern_size, const float tile_units_to_pixels, const vec2 pos) {

    vec2 offset = mod(mod(mod(pixel_coord_upper, pattern_size) * 256.0, pattern_size) * 256.0 + pixel_coord_lower, pattern_size);
    return (tile_units_to_pixels * pos + offset) / pattern_size;
}

float hasBit(float value, int pos) {
    return floor(mod(floor(value / pow(2.0, float(pos))), 2.0));
}

// unpack a RGBA value from the the coords framebuffer into a vec2 in the range from 0 .. 8191
vec2 unpackCoord(vec4 rgba) {
    float r = floor(rgba.x * 255.0);
    float g = floor(rgba.y * 255.0);
    float b = floor(rgba.z * 255.0);
    float a = floor(rgba.w * 255.0);
    float x = hasBit(b, 2) * 1.0 + hasBit(b, 3) * 2.0  + hasBit(b, 4) * 4.0 + hasBit(b, 5) * 8.0 + hasBit(b, 6) * 16.0 + hasBit(b, 7) * 32.0 + hasBit(g, 0) * 64.0 + hasBit(g, 1) * 128.0 + hasBit(g, 2) * 258.0;
    float y = hasBit(a, 1) * 1.0 + hasBit(a, 2) * 2.0  + hasBit(a, 3) * 4.0 + hasBit(a, 4) * 8.0 + hasBit(a, 5) * 16.0 + hasBit(a, 6) * 32.0 + hasBit(a, 7) * 64.0 + hasBit(b, 0) * 128.0 + hasBit(b, 1) * 258.0;
    return vec2(x, y) / 511.0 * 8191.0;
}

// unpack a coord RGBA to vec2
float calculate_visibility(sampler2D u_coords, vec4 pos, vec2 tilePos) {
    vec3 frag = pos.xyz / pos.w;
    vec2 coord = unpackCoord(texture2D(u_coords, frag.xy * 0.5 + 0.5));
    vec2 delta = tilePos - coord;
    float distance = sqrt(delta.x * delta.x + delta.y * delta.y);
    if (distance < 100.0) return 1.0;
    return 0.2;
}