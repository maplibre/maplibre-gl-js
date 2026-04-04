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
    let fade_opacity_final = 1.0;

    // Unpack vertex attributes
    let a_pos = vec2<f32>(f32(vin.pos_offset.x), f32(vin.pos_offset.y));
    let a_offset = vec2<f32>(f32(vin.pos_offset.z), f32(vin.pos_offset.w));
    let a_tex = vec2<f32>(f32(vin.data.x), f32(vin.data.y));
    let a_size = vec2<f32>(f32(vin.data.z), f32(vin.data.w));
    let a_size_min = floor(a_size.x * 0.5);

    // Compute size
    let size_zoom_constant = drawable.is_size_zoom_constant != 0u;
    let size_feature_constant = drawable.is_size_feature_constant != 0u;
    var symbol_size: f32;
    if (!size_zoom_constant && !size_feature_constant) {
        symbol_size = mix(a_size_min, a_size.y, drawable.size_t) / 128.0;
    } else if (size_zoom_constant && !size_feature_constant) {
        symbol_size = a_size_min / 128.0;
    } else {
        symbol_size = drawable.size;
    }

    // Project position to clip space
    let projectedPoint = drawable.matrix * vec4<f32>(a_pos, 0.0, 1.0);

    // Compute font size scaling
    let fontScale = symbol_size / 24.0;

    // Apply offset directly in clip space (simplified — bypasses label_plane/coord matrices)
    // The offset is in 1/32 of a pixel (CSS), scale by fontScale and convert to NDC
    let pixelOffset = a_offset / 32.0 * fontScale;
    // world_size is in physical pixels; convert to CSS pixels for offset scaling
    let cssWidth = paintParams.world_size.x / paintParams.pixel_ratio;
    let cssHeight = paintParams.world_size.y / paintParams.pixel_ratio;
    let viewportScale = vec2<f32>(2.0 / cssWidth, -2.0 / cssHeight);

    vout.position = vec4<f32>(
        projectedPoint.x + pixelOffset.x * viewportScale.x * projectedPoint.w,
        projectedPoint.y + pixelOffset.y * viewportScale.y * projectedPoint.w,
        (projectedPoint.z + projectedPoint.w) * 0.5,
        projectedPoint.w
    );
    vout.v_fade_opacity = fade_opacity_final;
    vout.v_tex = a_tex / drawable.texsize;
    vout.v_fill_color = props.fill_color;
    vout.v_halo_color = props.halo_color;
    vout.v_opacity = props.opacity;
    vout.v_halo_width = props.halo_width;
    vout.v_halo_blur = props.halo_blur;
    vout.v_gamma_scale = drawable.gamma_scale;
    vout.v_size = symbol_size;
    vout.v_is_halo = select(0.0, 1.0, drawable.is_halo != 0u);

    return vout;
}

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
    let is_halo = fin.v_is_halo > 0.5;

    let EDGE_GAMMA = 0.105 / max(paintParams.pixel_ratio, 1.0);
    let fontScale = max(fin.v_size / 24.0, 0.001);

    // Sample the SDF glyph texture (r8unorm — value in .r channel)
    let dist = textureSample(glyph_texture, glyph_sampler, fin.v_tex).r;

    // Matches GL exactly: gamma = EDGE_GAMMA / (fontScale * u_gamma_scale)
    // v_gamma_scale = drawable.gamma_scale (uniform: 1.0 for viewport, cos(pitch)*camDist for pitched)
    var gamma = EDGE_GAMMA / (fontScale * max(fin.v_gamma_scale, 0.001));
    var inner_edge = (256.0 - 64.0) / 256.0; // = 0.75

    var color = fin.v_fill_color;
    if (is_halo) {
        color = fin.v_halo_color;
        gamma = (fin.v_halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * max(fin.v_gamma_scale, 0.001));
        inner_edge = inner_edge + gamma; // push out for halo
    }

    // gamma_scaled = gamma * per_vertex_gamma_scale (≈ 1.0 for viewport-aligned text)
    let gamma_scaled = gamma;
    var alpha = smoothstep(inner_edge - gamma_scaled, inner_edge + gamma_scaled, dist);

    if (is_halo) {
        let halo_edge = (6.0 - fin.v_halo_width / fontScale) / SDF_PX;
        alpha = min(smoothstep(halo_edge - gamma_scaled, halo_edge + gamma_scaled, dist), 1.0 - alpha);
    }

    let coverage = alpha * fin.v_opacity * fin.v_fade_opacity;
    return vec4<f32>(color.rgb * coverage, color.a * coverage);
}
