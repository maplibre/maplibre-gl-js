// Background pattern shader — renders background layer with image pattern
// Ported from background_pattern.vertex/fragment.glsl
// Reference: maplibre-native BackgroundPatternShader (webgpu/background.hpp)

struct BackgroundPatternDrawableUBO {
    matrix: mat4x4<f32>,
    pixel_coord_upper: vec2<f32>,
    pixel_coord_lower: vec2<f32>,
    tile_units_to_pixels: f32,
    pad1: f32,
    pad2: f32,
    pad3: f32,
};

struct BackgroundPatternPropsUBO {
    pattern_a: vec4<f32>,           // offset 0:  tl.x, tl.y, br.x, br.y
    pattern_b: vec4<f32>,           // offset 16: tl.x, tl.y, br.x, br.y
    pattern_sizes: vec4<f32>,       // offset 32: sizeA.x, sizeA.y, sizeB.x, sizeB.y
    scale_mix_opacity: vec4<f32>,   // offset 48: scaleA, scaleB, mix, opacity
    pad0: vec4<f32>,                // offset 64
    pad1: vec4<f32>,                // offset 80
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
@group(0) @binding(2) var<storage, read> drawableVector: array<BackgroundPatternDrawableUBO>;
@group(0) @binding(4) var<uniform> props: BackgroundPatternPropsUBO;

fn glMod(x: f32, y: f32) -> f32 {
    return x - y * floor(x / y);
}

fn glMod2(x: vec2<f32>, y: vec2<f32>) -> vec2<f32> {
    return x - y * floor(x / y);
}

fn get_pattern_pos(
    pixel_coord_upper: vec2<f32>,
    pixel_coord_lower: vec2<f32>,
    pattern_size: vec2<f32>,
    tile_units_to_pixels: f32,
    pos: vec2<f32>
) -> vec2<f32> {
    let offset = glMod2(glMod2(glMod2(pixel_coord_upper, pattern_size) * 256.0, pattern_size) * 256.0 + pixel_coord_lower, pattern_size);
    return (tile_units_to_pixels * pos + offset) / pattern_size;
}

// VertexInput is generated dynamically in JS

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) v_pos_a: vec2<f32>,
    @location(1) v_pos_b: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = drawable.matrix * vec4<f32>(pos, 0.0, 1.0);
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    let pattern_size_a = props.pattern_sizes.xy;
    let pattern_size_b = props.pattern_sizes.zw;
    let scale_a = props.scale_mix_opacity.x;
    let scale_b = props.scale_mix_opacity.y;

    vout.v_pos_a = get_pattern_pos(
        drawable.pixel_coord_upper,
        drawable.pixel_coord_lower,
        scale_a * pattern_size_a,
        drawable.tile_units_to_pixels,
        pos
    );
    vout.v_pos_b = get_pattern_pos(
        drawable.pixel_coord_upper,
        drawable.pixel_coord_lower,
        scale_b * pattern_size_b,
        drawable.tile_units_to_pixels,
        pos
    );
    let dummy = props.pad0.x + props.pad1.x;

    return vout;
}

struct FragmentInput {
    @location(0) v_pos_a: vec2<f32>,
    @location(1) v_pos_b: vec2<f32>,
};

@group(1) @binding(0) var pattern_sampler: sampler;
@group(1) @binding(1) var pattern_texture: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let texsize = paintParams.pattern_atlas_texsize;

    let pattern_tl_a = props.pattern_a.xy;
    let pattern_br_a = props.pattern_a.zw;
    let pattern_tl_b = props.pattern_b.xy;
    let pattern_br_b = props.pattern_b.zw;
    let mix_val = props.scale_mix_opacity.z;
    let opacity = props.scale_mix_opacity.w;

    // Sample pattern A
    let imagecoord_a = glMod2(fin.v_pos_a, vec2<f32>(1.0));
    let pos_a = mix(pattern_tl_a / texsize, pattern_br_a / texsize, imagecoord_a);
    let color_a = textureSample(pattern_texture, pattern_sampler, pos_a);

    // Sample pattern B
    let imagecoord_b = glMod2(fin.v_pos_b, vec2<f32>(1.0));
    let pos_b = mix(pattern_tl_b / texsize, pattern_br_b / texsize, imagecoord_b);
    let color_b = textureSample(pattern_texture, pattern_sampler, pos_b);

    return mix(color_a, color_b, mix_val) * opacity;
}
