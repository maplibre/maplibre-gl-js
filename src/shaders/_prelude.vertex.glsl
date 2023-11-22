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
        // check if coordingate is fully visible
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

// logic for globe view

uniform mat4 u_projection_matrix;

#ifdef GLOBE

#define GLOBE_PI 3.1415926535897932384626433832795

uniform vec4 u_projection_tile_mercator_coords;
uniform vec4 u_projection_clipping_plane;

// get position inside the tile in range 0..8192 and project it onto the surface of a unit sphere
vec4 projectTile(vec2 posInTile) {
    // JP: TODO: there could very well be a more efficient way to compute this if we take a deeper look at the geometric idea behind mercator

    // Compute position in range 0..1 of the base tile of web mercator
    vec2 mercator_pos = mix(u_projection_tile_mercator_coords.xy, u_projection_tile_mercator_coords.zw, posInTile / 8192.0);

    // Now compute angular coordinates on the surface of a perfect sphere

    // Note: web mercator tiles are generated by taking features with coordinates in wgs84 (point on ellipsoid) and treating them as *spherical* coordinates
    // and projecting them with spherical mercator. This means that the `spherical` value computed below is actually wgs84 coordinates!
    
    // However, for now we will treat them as coordinates on a perfect sphere. TODO.

    vec2 spherical;
    spherical.x = mercator_pos.x * GLOBE_PI * 2.0 + GLOBE_PI;
    spherical.y = 2.0 * atan(exp(GLOBE_PI - (mercator_pos.y * GLOBE_PI * 2.0))) - GLOBE_PI * 0.5;

    float len = cos(spherical.y);
    vec4 pos = vec4(
        sin(spherical.x) * len,
        sin(spherical.y),
        cos(spherical.x) * len,
        1.0
    );

    // North pole
    if(posInTile.x < -32767.5 && posInTile.y < -32767.5) {
        pos.xyz = vec3(0.0, 1.0, 0.0);
    }
    // South pole
    if(posInTile.x > 32766.5 && posInTile.y > 32766.5) {
        pos.xyz = vec3(0.0, -1.0, 0.0);
    }

    vec4 result = u_projection_matrix * pos;
    // Z is overwritten by glDepthRange anyway - use a custom z value to clip geometry on the invisible side of the sphere.
    result.z = (1.0 - (dot(pos.xyz, u_projection_clipping_plane.xyz) + u_projection_clipping_plane.w)) * result.w;
    return result;
}

// vec4 getDebugColor(vec2 posInTile) {
//     vec2 mercator_pos = mix(u_projection_tile_mercator_coords.xy, u_projection_tile_mercator_coords.zw, posInTile / 8192.0);
//     vec2 spherical;
//     spherical.x = mercator_pos.x * GLOBE_PI * 2.0 + GLOBE_PI;
//     spherical.y = 2.0 * atan(exp(GLOBE_PI - (mercator_pos.y * GLOBE_PI * 2.0))) - GLOBE_PI * 0.5;
//     float scale = 0.5;
//     float len = cos(spherical.y);
//     vec4 pos = vec4(
//         sin(spherical.x) * len,
//         sin(spherical.y),
//         cos(spherical.x) * len,
//         1.0
//     );
//     float dist = dot(pos.xyz, u_projection_clipping_plane.xyz) + u_projection_clipping_plane.w;

//     vec4 result = vec4(1.0, 1.0, 0.0, 1.0);
//     float epsilon = 0.02;

//     if(dist > epsilon)
//         result = vec4(0.0, 1.0, 0.0, 1.0);
//     if(dist < -epsilon)
//         result = vec4(1.0, 0.0, 0.0, 1.0);

//     return result;
// }
#else
#define projectTile(p) (u_projection_matrix * vec4((p).x, (p).y, 0.0, 1.0))
#define getDebugColor(p) (vec4(1.0, 0.0, 1.0, 1.0))
#endif
