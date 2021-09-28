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

// unpack a RGBA value from the coords framebuffer into a vec2 in the range from 0 .. 8191
vec2 unpackCoord(vec4 rgba) {
    float r = floor(rgba.r * 255.0);
    float g = floor(rgba.g * 255.0);
    float b = floor(rgba.b * 255.0);
    float x = r + hasBit(b, 4) * 256.0 + hasBit(b, 5) * 512.0 + hasBit(b, 6) * 1024.0 + hasBit(b, 7) * 2048.0;
    float y = g + hasBit(b, 0) * 256.0 + hasBit(b, 1) * 512.0 + hasBit(b, 2) * 1024.0 + hasBit(b, 3) * 2048.0;
    return vec2(x, y) * 8.0; // multiply by 8 is necesarry because the coords-texture has only 1024x1024 pixels.
}

// calculate the visibility of a coordinate in terrain and return an opacity value.
// if a coordinate is behind the terrain reduce its opacity
float calculate_visibility(sampler2D u_coords, sampler2D u_coords_index, vec4 pos, vec2 tilePos) {
    #ifdef TERRAIN3D
        // get pixel from coords framebuffer
        vec3 frag = pos.xyz / pos.w;
        vec4 coord_color = texture2D(u_coords, frag.xy * 0.5 + 0.5);
        vec2 coord = unpackCoord(coord_color);
        // ask coords_index for sub-regions.
        // HINT: '1.0 - coord_color.a' is because coords-index is stored in reverse order
        // because web-gl do not render pixels with zero opacity
        vec4 coords_index = texture2D(u_coords_index, vec2(1.0 - coord_color.a, 0.0));
        float q = 8192.0 / pow(2.0, floor(coords_index.a * 255.0));
        vec2 xy = coords_index.xy * 255.0 * q + coord / 8192.0 * q;
        // distance is in vector-tile coordinate-space. e.g. 0 .. 8191
        // e.g. the distance of the pos.coordinate to the tile.coordinate on the same screen-pixel.
        float distance = length(tilePos - xy);
        if (distance < 100.0) return 1.0; // assume fully visible on terrain
        return 0.2; // opacity 0.2 behind terrain
        // FIXME-3D: to get a correct fadeout effect it is necesarry to grab more
        // pixels around pos to find the exact screen-pixel distance behind the terrain.
    #else
        return 1.0;
    #endif
}