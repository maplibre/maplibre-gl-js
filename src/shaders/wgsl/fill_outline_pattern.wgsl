// Fill outline pattern shader — renders fill outline as pattern-textured lines
// Uses line topology with antialiasing at pixel distance

struct FillOutlinePatternDrawableUBO {
    matrix: mat4x4<f32>,                // offset 0,  size 64
    pixel_coord_upper: vec2<f32>,       // offset 64
    pixel_coord_lower: vec2<f32>,       // offset 72
    tile_ratio: f32,                    // offset 80
    pad0: f32,                          // offset 84
    pad1: f32,                          // offset 88
    pad2: f32,                          // offset 92
};

struct FillOutlinePatternPropsUBO {
    pattern_from: vec4<f32>,            // offset 0
    pattern_to: vec4<f32>,              // offset 16
    display_sizes: vec4<f32>,           // offset 32
    scales_fade_opacity: vec4<f32>,     // offset 48 — fromScale, toScale, fade, opacity
    texsize: vec4<f32>,                 // offset 64
    pad0: vec4<f32>,                    // offset 80
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
@group(0) @binding(2) var<storage, read> drawableVector: array<FillOutlinePatternDrawableUBO>;
@group(0) @binding(4) var<uniform> props: FillOutlinePatternPropsUBO;

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
    @location(2) v_pos: vec2<f32>,
};

@vertex
fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let drawable = drawableVector[globalIndex.value];

    let display_size_a = vec2<f32>(props.display_sizes.x, props.display_sizes.y);
    let display_size_b = vec2<f32>(props.display_sizes.z, props.display_sizes.w);
    let fromScale = props.scales_fade_opacity.x;
    let toScale = props.scales_fade_opacity.y;

    let pos = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    let clip = drawable.matrix * vec4<f32>(pos, 0.0, 1.0);
    vout.position = vec4<f32>(clip.x, clip.y, (clip.z + clip.w) * 0.5, clip.w);

    vout.v_pos_a = get_pattern_pos(
        drawable.pixel_coord_upper,
        drawable.pixel_coord_lower,
        fromScale * display_size_a,
        drawable.tile_ratio,
        pos
    );
    vout.v_pos_b = get_pattern_pos(
        drawable.pixel_coord_upper,
        drawable.pixel_coord_lower,
        toScale * display_size_b,
        drawable.tile_ratio,
        pos
    );

    // v_pos in physical framebuffer pixels (for distance-based antialiasing)
    vout.v_pos = (clip.xy / clip.w + 1.0) * 0.5 * paintParams.world_size;

    return vout;
}

struct FragmentInput {
    @builtin(position) frag_coord: vec4<f32>,
    @location(0) v_pos_a: vec2<f32>,
    @location(1) v_pos_b: vec2<f32>,
    @location(2) v_pos: vec2<f32>,
};

@group(1) @binding(0) var pattern_sampler: sampler;
@group(1) @binding(1) var pattern_texture: texture_2d<f32>;

@fragment
fn fragmentMain(fin: FragmentInput) -> @location(0) vec4<f32> {
    let pattern_tl_a = props.pattern_from.xy;
    let pattern_br_a = props.pattern_from.zw;
    let pattern_tl_b = props.pattern_to.xy;
    let pattern_br_b = props.pattern_to.zw;
    let texsize = vec2<f32>(props.texsize.x, props.texsize.y);
    let fade = props.scales_fade_opacity.z;
    let opacity = props.scales_fade_opacity.w;

    // Sample pattern A
    let imagecoord_a = glMod2(fin.v_pos_a, vec2<f32>(1.0));
    let pos_a = mix(pattern_tl_a / texsize, pattern_br_a / texsize, imagecoord_a);
    let color_a = textureSample(pattern_texture, pattern_sampler, pos_a);

    // Sample pattern B
    let imagecoord_b = glMod2(fin.v_pos_b, vec2<f32>(1.0));
    let pos_b = mix(pattern_tl_b / texsize, pattern_br_b / texsize, imagecoord_b);
    let color_b = textureSample(pattern_texture, pattern_sampler, pos_b);

    // Antialiased line edge based on distance to fragment position
    let dist = length(fin.v_pos - fin.frag_coord.xy);
    let alpha = 1.0 - smoothstep(0.0, 1.0, dist);

    return mix(color_a, color_b, fade) * alpha * opacity;
}
