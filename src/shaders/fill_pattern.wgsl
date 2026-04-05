// Fill pattern shader — renders fill layer with image pattern
// Reference: maplibre-native FillPatternShader (webgpu/fill.hpp)

struct FillPatternDrawableUBO {
    matrix: mat4x4<f32>,
    pixel_coord_upper: vec2<f32>,
    pixel_coord_lower: vec2<f32>,
    tile_ratio: f32,
    pattern_from_t: f32,
    pattern_to_t: f32,
    opacity_t: f32,
};

struct FillPatternPropsUBO {
    pattern_from: vec4<f32>,
    pattern_to: vec4<f32>,
    texsize: vec2<f32>,
    from_scale: f32,
    to_scale: f32,
    fade: f32,
    opacity: f32,
    pad1: f32,
    pad2: f32,
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
@group(0) @binding(2) var<storage, read> drawableVector: array<FillPatternDrawableUBO>;
@group(0) @binding(4) var<uniform> props: FillPatternPropsUBO;

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

    let pattern_from = props.pattern_from;
    let pattern_to = props.pattern_to;

    let pattern_tl_a = pattern_from.xy;
    let pattern_br_a = pattern_from.zw;
    let pattern_tl_b = pattern_to.xy;
    let pattern_br_b = pattern_to.zw;

    let pixelRatio = paintParams.pixel_ratio;
    let tileZoomRatio = drawable.tile_ratio;
    let fromScale = props.from_scale;
    let toScale = props.to_scale;

    let display_size_a = vec2<f32>(
        (pattern_br_a.x - pattern_tl_a.x) / pixelRatio,
        (pattern_br_a.y - pattern_tl_a.y) / pixelRatio
    );
    let display_size_b = vec2<f32>(
        (pattern_br_b.x - pattern_tl_b.x) / pixelRatio,
        (pattern_br_b.y - pattern_tl_b.y) / pixelRatio
    );

    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = drawable.matrix * vec4<f32>(pos, 0.0, 1.0);
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;

    vout.v_pos_a = get_pattern_pos(
        drawable.pixel_coord_upper,
        drawable.pixel_coord_lower,
        fromScale * display_size_a,
        tileZoomRatio,
        pos
    );
    vout.v_pos_b = get_pattern_pos(
        drawable.pixel_coord_upper,
        drawable.pixel_coord_lower,
        toScale * display_size_b,
        tileZoomRatio,
        pos
    );

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
    let pattern_from = props.pattern_from;
    let pattern_to = props.pattern_to;

    let pattern_tl_a = pattern_from.xy;
    let pattern_br_a = pattern_from.zw;
    let pattern_tl_b = pattern_to.xy;
    let pattern_br_b = pattern_to.zw;

    // Sample pattern A
    let imagecoord_a = glMod2(fin.v_pos_a, vec2<f32>(1.0));
    let pos_a = mix(pattern_tl_a / props.texsize, pattern_br_a / props.texsize, imagecoord_a);
    let color_a = textureSample(pattern_texture, pattern_sampler, pos_a);

    // Sample pattern B
    let imagecoord_b = glMod2(fin.v_pos_b, vec2<f32>(1.0));
    let pos_b = mix(pattern_tl_b / props.texsize, pattern_br_b / props.texsize, imagecoord_b);
    let color_b = textureSample(pattern_texture, pattern_sampler, pos_b);

    return mix(color_a, color_b, props.fade) * props.opacity;
}
