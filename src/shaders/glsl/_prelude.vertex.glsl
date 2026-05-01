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

// To minimize the number of ins needed, we encode a 4-component
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

// Axis must be a normalized vector
// Angle is in radians
mat3 rotationMatrixFromAxisAngle(vec3 u, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    float c2 = 1.0 - c;
    return mat3(
        u.x*u.x * c2 +       c, u.x*u.y * c2 - u.z*s, u.x*u.z * c2 + u.y*s,
        u.y*u.x * c2 + u.z * s, u.y*u.y * c2 +     c, u.y*u.z * c2 - u.x*s,
        u.z*u.x * c2 - u.y * s, u.z*u.y * c2 + u.x*s, u.z*u.z * c2 +     c
    );
}

// logic for terrain 3d

#ifdef TERRAIN3D
uniform sampler2D u_terrain;
uniform float u_terrain_dim;
uniform mat4 u_terrain_matrix;
uniform vec4 u_terrain_unpack;
uniform float u_terrain_exaggeration;
uniform highp sampler2D u_depth;
#endif

// methods for pack/unpack depth value to texture rgba
// https://stackoverflow.com/questions/34963366/encode-floating-point-data-in-a-rgba-texture
const highp vec4 bitSh = vec4(256. * 256. * 256., 256. * 256., 256., 1.);
const highp vec4 bitShifts = vec4(1.) / bitSh;

highp float unpack(highp vec4 color) {
   return dot(color , bitShifts);
}

// calculate the opacity behind terrain, returns a value between 0 and 1.
highp float depthOpacity(vec3 frag) {
    #ifdef TERRAIN3D
        // create the delta between frag.z + terrain.z.
        highp float d = unpack(texture(u_depth, frag.xy * 0.5 + 0.5)) + 0.0001 - frag.z;
        // visibility range is between 0 and 0.002. 0 is visible, 0.002 is fully invisible.
        return 1.0 - max(0.0, min(1.0, -d * 500.0));
    #else
        return 1.0;
    #endif
}

// calculate the visibility of a coordinate in terrain and return an opacity value.
// if a coordinate is behind the terrain reduce its opacity
float calculate_visibility(vec4 pos) {
    #ifdef TERRAIN3D
        vec3 frag = pos.xyz / pos.w;
        // check if coordinate is fully visible
        highp float d = depthOpacity(frag);
        if (d > 0.95) return 1.0;
        // if not, go some pixel above and check it this point is visible
        return (d + depthOpacity(frag + vec3(0.0, 0.01, 0.0))) / 2.0;
    #else
        return 1.0;
    #endif
}

// grab an elevation value from a raster-dem texture
float ele(vec2 pos) {
    #ifdef TERRAIN3D
        vec4 rgb = (texture(u_terrain, pos) * 255.0) * u_terrain_unpack;
        return rgb.r + rgb.g + rgb.b - u_terrain_unpack.a;
    #else
        return 0.0;
    #endif
}

// calculate the elevation with linear interpolation for  a coordinate
float get_elevation(vec2 pos) {
    #ifdef TERRAIN3D
        #ifdef GLOBE
            if ((pos.y < -32767.5) || (pos.y > 32766.5)) {
                return 0.0;
            }
        #endif
        vec2 coord = (u_terrain_matrix * vec4(pos, 0.0, 1.0)).xy * u_terrain_dim + 1.0;
        vec2 f = fract(coord);
        vec2 c = (floor(coord) + 0.5) / (u_terrain_dim + 2.0); // get the pixel center
        float d = 1.0 / (u_terrain_dim + 2.0);
        float tl = ele(c);
        float tr = ele(c + vec2(d, 0.0));
        float bl = ele(c + vec2(0.0, d));
        float br = ele(c + vec2(d, d));
        float elevation = mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
        return elevation * u_terrain_exaggeration;
    #else
        return 0.0;
    #endif
}


const float PI = 3.141592653589793;

uniform mat4 u_projection_matrix;
