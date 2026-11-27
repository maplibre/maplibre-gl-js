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

vec2 unpack_opacity(const uint packedOpacity) {
    return vec2(float(packedOpacity >> 1u) / 127.0, float(packedOpacity & 1u));
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
uniform highp sampler2D u_depth;
layout(std140) uniform TerrainUBO {
    highp mat4 u_terrain_matrix;
    highp vec4 u_terrain_unpack;
    highp float u_terrain_dim;
    highp float u_terrain_exaggeration;
};
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
float ele(ivec2 pos) {
    #ifdef TERRAIN3D
        vec4 rgb = (texelFetch(u_terrain, pos, 0) * 255.0) * u_terrain_unpack;
        return rgb.r + rgb.g + rgb.b - u_terrain_unpack.a;
    #else
        return 0.0;
    #endif
}

// calculate the elevation with linear interpolation for a coordinate.
// DEM pixel i describes the cell centred at tile coordinate (i + 0.5) / dim, the same placement hillshade
// and color-relief use, and sits at texel i + 2 behind the 2 texel border, so the texel coordinate is uv * dim + 1.5.
float get_elevation(vec2 pos) {
    #ifdef TERRAIN3D
        #ifdef GLOBE
            if ((pos.y < -32767.5) || (pos.y > 32766.5)) {
                return 0.0;
            }
        #endif
        vec2 coord = (u_terrain_matrix * vec4(pos, 0.0, 1.0)).xy * u_terrain_dim + 1.5;
        vec2 f = fract(coord);
        ivec2 c = ivec2(floor(coord));
        ivec2 hi = textureSize(u_terrain, 0) - 1;
        float tl = ele(clamp(c, ivec2(0), hi));
        float tr = ele(clamp(c + ivec2(1, 0), ivec2(0), hi));
        float bl = ele(clamp(c + ivec2(0, 1), ivec2(0), hi));
        float br = ele(clamp(c + ivec2(1, 1), ivec2(0), hi));
        float elevation = mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);
        return elevation * u_terrain_exaggeration;
    #else
        return 0.0;
    #endif
}


const float PI = 3.141592653589793;

#define PROJECTION_UBO
layout(std140) uniform ProjectionUBO {
    highp mat4 u_projection_matrix;
    highp mat4 u_projection_fallback_matrix;
    highp vec4 u_projection_tile_mercator_coords;
    highp vec4 u_projection_clipping_plane;
    highp vec4 u_projection_tile_origin;
    highp vec2 u_projection_tile_origin_position;
    highp float u_projection_transition;
    highp int u_projection_clip_antimeridian;
};
layout(std140) uniform FrameUBO {
    highp vec2 u_units_to_pixels;
    highp vec2 u_world_size;
    highp float u_camera_to_center_distance;
    highp float u_symbol_fade_change;
    highp float u_aspect_ratio;
    highp float u_device_pixel_ratio;
    highp vec2 u_viewport_size;
    highp vec2 u_pixel_extrude_scale;
    highp float u_pitch;
};

#ifdef ROUNDED_CORNERS
// The distance from each corner, along its edges, that `fill-rounded-corner-distance` replaces with an
// arc, in tile units.
uniform highp float u_rounded_corner_distance;

// The fragment's position in tile units, which the arcs of its triangle are measured against.
out highp vec2 v_rounded_pos;
// One circle for each corner that rounds the triangle: its centre, its radius, and how far the chord
// between the two points where the arc meets the edges lies from the centre. A radius of zero leaves
// the slot unused. Every vertex of a triangle carries the same corners, so this and the varyings below
// reach each fragment unchanged by interpolation, without the `flat` qualifier that Safari's Metal
// backend handles slowly.
out highp vec4 v_rounded_circle0;
out highp vec4 v_rounded_circle1;
out highp vec4 v_rounded_circle2;
// The unit vectors from the first two corners towards their circles' centres.
out highp vec4 v_rounded_bisector01;
// The unit vector from the third corner towards its circle's centre, and 1.0 for a triangle that
// keeps what its arcs leave inside the polygon or -1.0 for one that only draws the area a concave
// corner's arc adds outside it.
out highp vec3 v_rounded_bisector2_side;

// Returns the circle that rounds a corner, in the layout of `v_rounded_circle0`, and sets `bisector` to
// the unit vector from the corner towards the circle's centre. The arc starts at
// `u_rounded_corner_distance` from the corner along each edge, but never further than half the edge,
// so the arcs at the two ends of an edge do not overlap.
highp vec4 rounded_corner_circle(highp vec2 point, highp vec2 prev, highp vec2 next, out highp vec2 bisector) {
    bisector = vec2(0.0);
    highp float prevLength = length(prev - point);
    highp float nextLength = length(next - point);
    if (prevLength == 0.0 || nextLength == 0.0 || u_rounded_corner_distance <= 0.0) return vec4(0.0);

    highp vec2 towardsPrev = (prev - point) / prevLength;
    highp vec2 towardsNext = (next - point) / nextLength;
    highp float cosAngle = dot(towardsPrev, towardsNext);
    highp float sinHalfAngle = sqrt(max((1.0 - cosAngle) * 0.5, 0.0));
    highp float cosHalfAngle = sqrt(max((1.0 + cosAngle) * 0.5, 0.0));
    if (sinHalfAngle < 1e-4 || cosHalfAngle < 1e-4) return vec4(0.0);

    highp float cut = min(u_rounded_corner_distance, 0.5 * min(prevLength, nextLength));
    highp float radius = cut * sinHalfAngle / cosHalfAngle;
    bisector = normalize(towardsPrev + towardsNext);
    return vec4(point + bisector * (radius / sinHalfAngle), radius, radius * sinHalfAngle);
}

// Passes the corners that round the vertex's triangle on to the fragment shader, unpacked from the
// attributes `fill_corner_attributes` lays out.
void prepare_rounded_corners(highp vec2 pos, highp vec4 corner0, highp vec4 corner1, highp vec4 corner2, highp vec4 next01, highp vec4 next2) {
    v_rounded_pos = pos;
    highp vec2 bisector0 = vec2(0.0);
    highp vec2 bisector1 = vec2(0.0);
    highp vec2 bisector2 = vec2(0.0);
    highp float count = next2.z;
    v_rounded_circle0 = count > 0.5 ? rounded_corner_circle(corner0.xy, corner0.zw, next01.xy, bisector0) : vec4(0.0);
    v_rounded_circle1 = count > 1.5 ? rounded_corner_circle(corner1.xy, corner1.zw, next01.zw, bisector1) : vec4(0.0);
    v_rounded_circle2 = count > 2.5 ? rounded_corner_circle(corner2.xy, corner2.zw, next2.xy, bisector2) : vec4(0.0);
    v_rounded_bisector01 = vec4(bisector0, bisector1);
    v_rounded_bisector2_side = vec3(bisector2, next2.w > 0.5 ? -1.0 : 1.0);
}
#endif
