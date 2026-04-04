// Symbol SDF shader — signed distance field text/icon rendering
// Ported from symbol_sdf.vertex.glsl + symbol_sdf.fragment.glsl
// Reference: maplibre-native SymbolSDFShader (webgpu/symbol.hpp)

const SDF_PX: f32 = 8.0;
const OFFSCREEN: f32 = -2.0;

// Helper functions for data-driven property unpacking

fn unpack_float(packedValue: f32) -> vec2<f32> {
    let packedIntValue = i32(packedValue);
    let v0 = packedIntValue / 256;
    return vec2<f32>(f32(v0), f32(packedIntValue - v0 * 256));
}

fn decode_color(encodedColor: vec2<f32>) -> vec4<f32> {
    return vec4<f32>(
        unpack_float(encodedColor.x) / 255.0,
        unpack_float(encodedColor.y) / 255.0
    );
}

fn unpack_mix_float(packedValue: vec2<f32>, t: f32) -> f32 {
    return mix(packedValue.x, packedValue.y, t);
}

fn unpack_mix_color(packedColors: vec4<f32>, t: f32) -> vec4<f32> {
    let minColor = decode_color(vec2<f32>(packedColors.x, packedColors.y));
    let maxColor = decode_color(vec2<f32>(packedColors.z, packedColors.w));
    return mix(minColor, maxColor, t);
}

fn unpack_opacity(packedOpacity: f32) -> vec2<f32> {
    let intOpacity = i32(packedOpacity) / 2;
    return vec2<f32>(f32(intOpacity) / 127.0, packedOpacity % 2.0);
}

// UBO: per-drawable data (stored in a storage buffer, indexed by globalIndex)
struct SymbolDrawableUBO {
    matrix: mat4x4<f32>,              // 64 bytes  — tile to clip-space
    label_plane_matrix: mat4x4<f32>,  // 64 bytes  — projects to label plane
    coord_matrix: mat4x4<f32>,        // 64 bytes  — label plane to clip-space

    texsize: vec2<f32>,               // 8 bytes   — glyph atlas dimensions
    texsize_icon: vec2<f32>,          // 8 bytes   — icon atlas dimensions

    gamma_scale: f32,                 // 4 bytes   — cos(pitch)*cameraToCenterDist or 1.0
    is_text: u32,                     // 4 bytes
    is_along_line: u32,               // 4 bytes
    is_variable_anchor: u32,          // 4 bytes

    is_size_zoom_constant: u32,       // 4 bytes
    is_size_feature_constant: u32,    // 4 bytes
    size_t: f32,                      // 4 bytes   — zoom interpolation factor
    size: f32,                        // 4 bytes   — constant size value

    rotate_symbol: u32,               // 4 bytes
    pitch_with_map: u32,              // 4 bytes
    is_halo: u32,                     // 4 bytes   — 1 for halo pass, 0 for fill pass

    // Interpolation t-values for data-driven properties
    fill_color_t: f32,                // 4 bytes
    halo_color_t: f32,                // 4 bytes
    opacity_t: f32,                   // 4 bytes
    halo_width_t: f32,                // 4 bytes
    halo_blur_t: f32,                 // 4 bytes
};

// UBO: evaluated paint properties (uniforms for non-data-driven values)
struct SymbolEvaluatedPropsUBO {
    fill_color: vec4<f32>,            // 16 bytes
    halo_color: vec4<f32>,            // 16 bytes
    opacity: f32,                     // 4 bytes
    halo_width: f32,                  // 4 bytes
    halo_blur: f32,                   // 4 bytes
    pad1: f32,                        // 4 bytes
};

struct GlobalPaintParamsUBO {
    pattern_atlas_texsize: vec2<f32>,
    units_to_pixels: vec2<f32>,
    world_size: vec2<f32>,
    camera_to_center_distance: f32,
    symbol_fade_change: f32,
    aspect_ratio: f32,
    pixel_ratio: f32,
    map_zoom: f32,
    pad1: f32,
};

struct GlobalIndexUBO {
    value: u32,
    pad0: vec3<u32>,
};

@group(0) @binding(0) var<uniform> paintParams: GlobalPaintParamsUBO;
@group(0) @binding(1) var<uniform> globalIndex: GlobalIndexUBO;
@group(0) @binding(2) var<storage, read> drawableVector: array<SymbolDrawableUBO>;
@group(0) @binding(4) var<uniform> props: SymbolEvaluatedPropsUBO;

// VertexInput is generated dynamically in JS
// Expected attributes from symbol bucket:
//   @location(0) pos_offset: vec4<i32>       — a_pos_offset (Int16 x4)
//   @location(1) data: vec4<u32>             — a_data (Uint16 x4)
//   @location(2) pixeloffset: vec4<i32>      — a_pixeloffset (Int16 x4)
//   @location(3) projected_pos: vec3<f32>    — a_projected_pos (Float32 x3)
//   @location(4) fade_opacity: f32           — a_fade_opacity (packed Uint32 as f32)
// Data-driven attributes (when present):
//   @location(5) fill_color: vec4<f32>       — packed fill color
//   @location(6) halo_color: vec4<f32>       — packed halo color
//   @location(7) opacity: vec2<f32>          — packed opacity
//   @location(8) halo_width: vec2<f32>       — packed halo width
//   @location(9) halo_blur: vec2<f32>        — packed halo blur

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_tex: vec2<f32>,
    @location(1) v_fade_opacity: f32,
    @location(2) v_gamma_scale: f32,
    @location(3) v_size: f32,
    @location(4) v_fill_color: vec4<f32>,
    @location(5) v_halo_color: vec4<f32>,
    @location(6) v_opacity: f32,
    @location(7) v_halo_width: f32,
    @location(8) v_halo_blur: f32,
    @location(9) v_is_halo: f32,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    // --- Unpack fade opacity ---
    let raw_fade_opacity = unpack_opacity(f32(vin.fade_opacity));
    let fade_change = select(-paintParams.symbol_fade_change,
                              paintParams.symbol_fade_change,
                              raw_fade_opacity.y > 0.5);
    let fade_opacity = max(0.0, min(1.0, raw_fade_opacity.x + fade_change));

    // Cull vertices with zero opacity (move offscreen)
    if (fade_opacity == 0.0) {
        vout.position = vec4<f32>(OFFSCREEN, OFFSCREEN, OFFSCREEN, 1.0);
        return vout;
    }

    // --- Unpack vertex attributes ---
    let a_pos = vec2<f32>(f32(vin.pos_offset.x), f32(vin.pos_offset.y));
    let a_offset = vec2<f32>(f32(vin.pos_offset.z), f32(vin.pos_offset.w));

    let a_tex = vec2<f32>(f32(vin.data.x), f32(vin.data.y));
    let a_size = vec2<f32>(f32(vin.data.z), f32(vin.data.w));

    let a_size_min = floor(a_size.x * 0.5);
    let a_pxoffset = vec2<f32>(f32(vin.pixeloffset.x), f32(vin.pixeloffset.y)) / 16.0;
    let a_minFontScale = vec2<f32>(f32(vin.pixeloffset.z), f32(vin.pixeloffset.w)) / 256.0;

    let segment_angle = -vin.projected_pos.z;

    // --- Compute size from zoom/feature expressions ---
    let size_zoom_constant = drawable.is_size_zoom_constant != 0u;
    let size_feature_constant = drawable.is_size_feature_constant != 0u;
    var size: f32;
    if (!size_zoom_constant && !size_feature_constant) {
        // Composite function: interpolate between zoom stops
        size = mix(a_size_min, a_size.y, drawable.size_t) / 128.0;
    } else if (size_zoom_constant && !size_feature_constant) {
        // Source function: use feature value directly
        size = a_size_min / 128.0;
    } else {
        // Constant: use uniform value
        size = drawable.size;
    }

    // --- Project anchor point ---
    let projectedPoint = drawable.matrix * vec4<f32>(a_pos, 0.0, 1.0);
    let camera_to_anchor_distance = projectedPoint.w;

    // Perspective correction: labels pitched with map get smaller in distance,
    // labels not pitched get larger. Counteract both effects partially.
    let pitch_with_map = drawable.pitch_with_map != 0u;
    let distance_ratio = select(
        paintParams.camera_to_center_distance / camera_to_anchor_distance,
        camera_to_anchor_distance / paintParams.camera_to_center_distance,
        pitch_with_map
    );
    let perspective_ratio = clamp(0.5 + 0.5 * distance_ratio, 0.0, 4.0);

    size *= perspective_ratio;

    let is_text = drawable.is_text != 0u;
    let fontScale = select(size, size / 24.0, is_text);

    // --- Compute symbol rotation ---
    var symbol_rotation = 0.0;
    if (drawable.rotate_symbol != 0u) {
        // Point labels with 'rotation-alignment: map' — measure angle in projected space
        let offsetProjectedPoint = drawable.matrix * vec4<f32>(a_pos + vec2<f32>(1.0, 0.0), 0.0, 1.0);
        let a = projectedPoint.xy / projectedPoint.w;
        let b = offsetProjectedPoint.xy / offsetProjectedPoint.w;
        symbol_rotation = atan2((b.y - a.y) / paintParams.aspect_ratio, b.x - a.x);
    }

    let angle_sin = sin(segment_angle + symbol_rotation);
    let angle_cos = cos(segment_angle + symbol_rotation);
    let rotation_matrix = mat2x2<f32>(angle_cos, -angle_sin, angle_sin, angle_cos);

    // --- Project label position ---
    let is_along_line = drawable.is_along_line != 0u;
    let is_variable_anchor = drawable.is_variable_anchor != 0u;

    var projected_pos: vec4<f32>;
    if (is_along_line || is_variable_anchor) {
        // Label plane matrix is identity — use projected_pos directly
        projected_pos = vec4<f32>(vin.projected_pos.xy, 0.0, 1.0);
    } else {
        projected_pos = drawable.label_plane_matrix * vec4<f32>(vin.projected_pos.xy, 0.0, 1.0);
    }

    let pos0 = projected_pos.xy / projected_pos.w;
    let pos_rot = a_offset / 32.0 * max(a_minFontScale, vec2<f32>(fontScale)) + a_pxoffset;
    let finalPos = drawable.coord_matrix * vec4<f32>(pos0 + rotation_matrix * pos_rot, 0.0, 1.0);

    // Remap z from WebGL NDC [-1,1] to WebGPU NDC [0,1]
    vout.position = vec4<f32>(finalPos.x, finalPos.y, (finalPos.z + finalPos.w) * 0.5, finalPos.w);

    // gamma_scale for fragment: the w component encodes perspective for antialiasing
    vout.v_gamma_scale = finalPos.w;

    // --- Texture coordinates ---
    vout.v_tex = a_tex / drawable.texsize;

    // --- Varyings ---
    vout.v_fade_opacity = fade_opacity;
    vout.v_size = size;
    vout.v_is_halo = f32(drawable.is_halo);

    // --- Resolve paint properties (uniform or data-driven) ---

    var fill_color = props.fill_color;
#ifdef HAS_DATA_DRIVEN_u_fill_color
    fill_color = decode_color(vin.fill_color.xy);
#endif
#ifdef HAS_COMPOSITE_u_fill_color
    fill_color = unpack_mix_color(vin.fill_color, drawable.fill_color_t);
#endif
    vout.v_fill_color = fill_color;

    var halo_color = props.halo_color;
#ifdef HAS_DATA_DRIVEN_u_halo_color
    halo_color = decode_color(vin.halo_color.xy);
#endif
#ifdef HAS_COMPOSITE_u_halo_color
    halo_color = unpack_mix_color(vin.halo_color, drawable.halo_color_t);
#endif
    vout.v_halo_color = halo_color;

    var opacity = props.opacity;
#ifdef HAS_DATA_DRIVEN_u_opacity
    opacity = vin.opacity.x;
#endif
#ifdef HAS_COMPOSITE_u_opacity
    opacity = unpack_mix_float(vin.opacity, drawable.opacity_t);
#endif
    vout.v_opacity = opacity;

    var halo_width = props.halo_width;
#ifdef HAS_DATA_DRIVEN_u_halo_width
    halo_width = vin.halo_width.x;
#endif
#ifdef HAS_COMPOSITE_u_halo_width
    halo_width = unpack_mix_float(vin.halo_width, drawable.halo_width_t);
#endif
    vout.v_halo_width = halo_width;

    var halo_blur = props.halo_blur;
#ifdef HAS_DATA_DRIVEN_u_halo_blur
    halo_blur = vin.halo_blur.x;
#endif
#ifdef HAS_COMPOSITE_u_halo_blur
    halo_blur = unpack_mix_float(vin.halo_blur, drawable.halo_blur_t);
#endif
    vout.v_halo_blur = halo_blur;

    return vout;
}

// -------------------------------------------------------------------------
// Fragment shader
// -------------------------------------------------------------------------

struct FragmentInput {
    @location(0) v_tex: vec2<f32>,
    @location(1) v_fade_opacity: f32,
    @location(2) v_gamma_scale: f32,
    @location(3) v_size: f32,
    @location(4) v_fill_color: vec4<f32>,
    @location(5) v_halo_color: vec4<f32>,
    @location(6) v_opacity: f32,
    @location(7) v_halo_width: f32,
    @location(8) v_halo_blur: f32,
    @location(9) v_is_halo: f32,
};

@group(1) @binding(0) var glyph_sampler: sampler;
@group(1) @binding(1) var glyph_texture: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let drawable = drawableVector[globalIndex.value];

    let EDGE_GAMMA = 0.105 / paintParams.pixel_ratio;

    let is_text = drawable.is_text != 0u;
    let fontScale = select(fin.v_size, fin.v_size / 24.0, is_text);
    let fontGamma = fontScale * drawable.gamma_scale;

    // Select fill vs halo parameters based on draw pass
    let is_halo = fin.v_is_halo > 0.5;
    let color = select(fin.v_fill_color, fin.v_halo_color, is_halo);
    let gamma = select(
        EDGE_GAMMA / fontGamma,
        (fin.v_halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / fontGamma,
        is_halo
    );
    let gamma_scaled = gamma * fin.v_gamma_scale;

    // Inner edge of the SDF threshold
    var inner_edge = (256.0 - 64.0) / 256.0;
    if (is_halo) {
        inner_edge = inner_edge + gamma_scaled;
    }

    // Sample the SDF glyph texture
    let dist = textureSample(glyph_texture, glyph_sampler, fin.v_tex).a;
    var alpha = smoothstep(inner_edge - gamma_scaled, inner_edge + gamma_scaled, dist);

    // For halos, cut out the inside so the fill can show through
    if (is_halo) {
        let halo_edge = (6.0 - fin.v_halo_width / fontScale) / SDF_PX;
        alpha = min(smoothstep(halo_edge - gamma_scaled, halo_edge + gamma_scaled, dist), 1.0 - alpha);
    }

    // Premultiplied alpha output
    let coverage = alpha * fin.v_opacity * fin.v_fade_opacity;
    return vec4<f32>(color.rgb * coverage, color.a * coverage);
}
