// Symbol Icon shader — non-SDF icon rendering
// Same vertex positioning as symbol_sdf.wgsl, simple texture sampling in fragment.

fn unpack_opacity(packedOpacity: f32) -> vec2<f32> {
    let intOpacity = i32(packedOpacity) / 2;
    return vec2<f32>(f32(intOpacity) / 127.0, packedOpacity % 2.0);
}

// Same UBO layout as symbol_sdf.wgsl for tweaker compatibility
struct SymbolDrawableUBO {
    matrix: mat4x4<f32>,              // 64 bytes
    label_plane_matrix: mat4x4<f32>,  // 64 bytes
    coord_matrix: mat4x4<f32>,        // 64 bytes

    texsize: vec2<f32>,               // 8 bytes
    texsize_icon: vec2<f32>,          // 8 bytes

    gamma_scale: f32,                 // 4 bytes (unused for icons)
    is_text: u32,                     // 4 bytes
    is_along_line: u32,               // 4 bytes
    is_variable_anchor: u32,          // 4 bytes

    is_size_zoom_constant: u32,       // 4 bytes
    is_size_feature_constant: u32,    // 4 bytes
    size_t: f32,                      // 4 bytes
    size: f32,                        // 4 bytes

    rotate_symbol: u32,               // 4 bytes
    pitch_with_map: u32,              // 4 bytes
    is_halo: u32,                     // 4 bytes (unused for icons)

    fill_color_t: f32,                // 4 bytes
    halo_color_t: f32,                // 4 bytes
    opacity_t: f32,                   // 4 bytes
    halo_width_t: f32,                // 4 bytes
    halo_blur_t: f32,                 // 4 bytes
};

struct SymbolEvaluatedPropsUBO {
    fill_color: vec4<f32>,            // 16 bytes (unused for icons)
    halo_color: vec4<f32>,            // 16 bytes (unused for icons)
    opacity: f32,                     // 4 bytes
    halo_width: f32,                  // 4 bytes (unused)
    halo_blur: f32,                   // 4 bytes (unused)
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

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_tex: vec2<f32>,
    @location(1) v_fade_opacity: f32,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    // Unpack fade opacity
    let packed_opacity = unpack_opacity(vin.fade_opacity);
    let fade_change = select(-paintParams.symbol_fade_change, paintParams.symbol_fade_change, packed_opacity.y > 0.5);
    let fade_opacity_final = clamp(packed_opacity.x + fade_change, 0.0, 1.0);

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

    // Project anchor
    let projectedPoint = drawable.matrix * vec4<f32>(a_pos, 0.0, 1.0);

    // For icons, fontScale = size (not size/24 like text)
    let fontScale = symbol_size;

    // CSS viewport dimensions
    let cssWidth = paintParams.world_size.x / paintParams.pixel_ratio;
    let cssHeight = paintParams.world_size.y / paintParams.pixel_ratio;

    let pixelOffset = a_offset / 32.0 * fontScale;

    if (drawable.is_along_line != 0u) {
        let glyphPos = vec2<f32>(vin.projected_pos.x, vin.projected_pos.y);
        let segment_angle = vin.projected_pos.z;
        let angle_sin = sin(segment_angle);
        let angle_cos = cos(segment_angle);
        let rotatedOffset = vec2<f32>(
            pixelOffset.x * angle_cos - pixelOffset.y * angle_sin,
            pixelOffset.x * angle_sin + pixelOffset.y * angle_cos
        );
        let pos0 = glyphPos + rotatedOffset;
        let tilePos = drawable.coord_matrix * vec4<f32>(pos0, 0.0, 1.0);
        let finalPos = drawable.matrix * vec4<f32>(tilePos.xy, 0.0, 1.0);
        vout.position = vec4<f32>(finalPos.xy, (finalPos.z + finalPos.w) * 0.5, finalPos.w);
    } else {
        let viewportScale = vec2<f32>(2.0 / cssWidth, -2.0 / cssHeight);
        vout.position = vec4<f32>(
            projectedPoint.x + pixelOffset.x * viewportScale.x * projectedPoint.w,
            projectedPoint.y + pixelOffset.y * viewportScale.y * projectedPoint.w,
            (projectedPoint.z + projectedPoint.w) * 0.5,
            projectedPoint.w
        );
    }

    vout.v_tex = a_tex / drawable.texsize;
    vout.v_fade_opacity = fade_opacity_final;

    return vout;
}

struct FragmentInput {
    @location(0) v_tex: vec2<f32>,
    @location(1) v_fade_opacity: f32,
};

@group(1) @binding(0) var icon_sampler: sampler;
@group(1) @binding(1) var icon_texture: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let color = textureSample(icon_texture, icon_sampler, fin.v_tex);
    let alpha = props.opacity * fin.v_fade_opacity;
    // Premultiply alpha: raw upload doesn't premultiply like GL does,
    // but blending expects premultiplied (srcFactor: one)
    return vec4<f32>(color.rgb * color.a * alpha, color.a * alpha);
}
